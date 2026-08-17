/**
 * Supabase Edge Function — paddle-change-plan
 *
 * Gestiona cambios sobre una suscripción de Paddle YA existente. Esto NO se puede
 * hacer desde el cliente (`Paddle.Checkout.open` solo CREA transacciones nuevas y
 * cobraría el plan entero). Acciones:
 *
 *   action:'change' (default)
 *     · UPGRADE  (plan destino > actual): PATCH con proration_billing_mode
 *       'prorated_immediately' → Paddle cobra solo la diferencia ahora.
 *     · DOWNGRADE (plan destino < actual): Paddle NO difiere cambios de plan de
 *       forma nativa (todos los modos cambian el ítem al instante). Usamos
 *       'do_not_bill' → Paddle cobra el plan menor recién en la próxima
 *       renovación, sin cargo/crédito ahora. El webhook mantiene las features del
 *       plan alto hasta fin de período (ve baja de plan dentro del mismo ciclo →
 *       lo agenda) y recién al renovar aplica el plan menor.
 *   action:'cancel'
 *     · POST /subscriptions/{id}/cancel { effective_from:'next_billing_period' } →
 *       la sub sigue activa hasta fin del período pago y luego cae a Free.
 *
 * Entrada (POST JSON): { team_id, plan_slug?, cycle?, preview?, action? }
 *   preview=true  → NO aplica; devuelve el resumen (monto prorrateado en upgrades,
 *                   o la fecha efectiva en downgrades).
 *
 * Seguridad: exige JWT de un admin/owner del club del equipo (o super-admin).
 *
 * Secrets requeridos:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY  (ya seteados)
 *   PADDLE_API_KEY   (Paddle → Developer tools → Authentication, `pdl_sdbx_...`)
 *   PADDLE_API_BASE  (opcional; default https://sandbox-api.paddle.com;
 *                     prod: https://api.paddle.com)
 *
 * Deploy:
 *   supabase functions deploy paddle-change-plan
 *   supabase secrets set PADDLE_API_KEY=pdl_sdbx_xxx
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const URL     = Deno.env.get('SUPABASE_URL')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON    = Deno.env.get('SUPABASE_ANON_KEY')!;
    const API_KEY = Deno.env.get('PADDLE_API_KEY');
    const API_BASE = (Deno.env.get('PADDLE_API_BASE') || 'https://sandbox-api.paddle.com').replace(/\/+$/, '');
    if (!API_KEY) return json({ error: 'PADDLE_API_KEY no configurado' }, 500);

    // ── Auth: admin/owner del club (o super-admin) ──
    const userClient = createClient(URL, ANON, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: 'Not authenticated' }, 401);

    const admin = createClient(URL, SERVICE);
    const { data: caller } = await admin.from('profiles')
      .select('club_id, role, club_role').eq('id', user.id).single();
    const { data: superRow } = await admin.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    const isSuper = !!superRow;
    const isAdmin = caller &&
      (['admin', 'owner'].includes(caller.role) || ['admin', 'owner'].includes(caller.club_role));
    if (!isAdmin && !isSuper) return json({ error: 'Not authorized' }, 403);

    const { team_id, plan_slug, cycle, preview, action } = await req.json();
    const act = action === 'cancel' ? 'cancel' : 'change';
    if (!team_id) return json({ error: 'Falta team_id' }, 400);
    if (act === 'change' && !plan_slug) return json({ error: 'Falta plan_slug' }, 400);

    // El equipo tiene que pertenecer al club del que llama (salvo super-admin).
    const { data: team } = await admin.from('teams').select('id, club_id').eq('id', team_id).maybeSingle();
    if (!team) return json({ error: 'Team not found' }, 404);
    if (!isSuper && team.club_id !== caller?.club_id) return json({ error: 'Not authorized' }, 403);

    // ── Suscripción de Paddle activa del equipo (no comp) ──
    const { data: sub } = await admin.from('subscriptions')
      .select('provider_subscription_id, is_comp, status, plan_id, current_period_end')
      .eq('team_id', team_id).eq('status', 'active').maybeSingle();
    if (!sub || sub.is_comp || !sub.provider_subscription_id) {
      // No hay sub de Paddle que modificar → el cliente debe abrir checkout nuevo.
      return json({ needs_checkout: true }, 409);
    }
    const subId = sub.provider_subscription_id;

    const paddle = (path: string, method: string, body?: unknown) =>
      fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });

    // ── Cancelar → Free (a fin de período) ──
    if (act === 'cancel') {
      if (preview) return json({ ok: true, preview: true, cancel: true, effective_at: sub.current_period_end });
      const res = await paddle(`/subscriptions/${subId}/cancel`, 'POST', { effective_from: 'next_billing_period' });
      const payload = await res.json();
      if (!res.ok) {
        console.error('Paddle cancel failed', res.status, JSON.stringify(payload));
        return json({ error: 'paddle_error', detail: payload?.error ?? payload }, res.status);
      }
      return json({ ok: true, cancel: true, effective_at: payload?.data?.scheduled_change?.effective_at ?? sub.current_period_end });
    }

    // ── Cambio de plan (upgrade / downgrade) ──
    const { data: plansRows } = await admin.from('plans')
      .select('id, slug, sort_order, provider_price_monthly_id, provider_price_yearly_id');
    const plans: Record<string, any> = {};
    (plansRows || []).forEach((p) => { plans[p.slug] = p; plans[p.id] = p; });
    const target = plans[plan_slug];
    const current = plans[sub.plan_id];
    if (!target) return json({ error: 'Plan destino no encontrado' }, 404);

    const priceId = cycle === 'annual' ? target.provider_price_yearly_id : target.provider_price_monthly_id;
    if (!priceId) return json({ error: 'El plan destino no tiene price_id de Paddle para este ciclo' }, 422);

    const curSort = current?.sort_order ?? 0;
    const tgtSort = target.sort_order ?? 0;
    if (current && target.id === current.id) return json({ error: 'same_plan' }, 400);
    const isDowngrade = tgtSort < curSort;
    const mode = isDowngrade ? 'do_not_bill' : 'prorated_immediately';

    if (preview) {
      // En downgrade no hay cargo ahora: informamos la fecha efectiva (fin de período).
      if (isDowngrade) return json({ ok: true, preview: true, downgrade: true, effective_at: sub.current_period_end });
      // Upgrade: preview real del prorrateo.
      const res = await paddle(`/subscriptions/${subId}/preview`, 'PATCH', {
        items: [{ price_id: priceId, quantity: 1 }], proration_billing_mode: mode,
      });
      const payload = await res.json();
      if (!res.ok) {
        console.error('Paddle preview failed', res.status, JSON.stringify(payload));
        return json({ error: 'paddle_error', detail: payload?.error ?? payload }, res.status);
      }
      return json({ ok: true, preview: true, downgrade: false, update_summary: payload?.data?.update_summary ?? null });
    }

    // Aplicar
    const res = await paddle(`/subscriptions/${subId}`, 'PATCH', {
      items: [{ price_id: priceId, quantity: 1 }], proration_billing_mode: mode,
    });
    const payload = await res.json();
    if (!res.ok) {
      console.error('Paddle change-plan failed', res.status, JSON.stringify(payload));
      return json({ error: 'paddle_error', detail: payload?.error ?? payload }, res.status);
    }
    return json({ ok: true, downgrade: isDowngrade, effective_at: isDowngrade ? sub.current_period_end : null });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
