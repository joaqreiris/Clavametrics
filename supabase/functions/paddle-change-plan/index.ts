/**
 * Supabase Edge Function — paddle-change-plan
 *
 * Cambia el plan de una suscripción de Paddle YA EXISTENTE (upgrade/downgrade),
 * con PRORRATEO. Esto NO se puede hacer desde el cliente: `Paddle.Checkout.open`
 * solo CREA transacciones nuevas (cobra el plan entero). Para pasar de Professional
 * a Full (o viceversa) hay que actualizar la suscripción vía la API server-side:
 *
 *   PATCH /subscriptions/{id}  { items:[{price_id,quantity}], proration_billing_mode }
 *
 * Paddle acredita lo no usado del plan anterior y cobra solo la diferencia. Luego
 * dispara `subscription.updated` → paddle-webhook espeja el nuevo plan en la DB.
 *
 * Entrada (POST JSON): { team_id, plan_slug, cycle, preview? }
 *   preview=true  → NO aplica; devuelve el resumen prorrateado (para confirmar monto).
 *   preview=false → aplica el cambio (cobro/crédito inmediato).
 *
 * Seguridad: exige JWT de un admin/owner del club del equipo (o super-admin).
 *
 * Secrets requeridos:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY  (ya seteados)
 *   PADDLE_API_KEY   (Paddle → Developer tools → Authentication, `pdl_sdbx_...` en sandbox)
 *   PADDLE_API_BASE  (opcional; default https://sandbox-api.paddle.com;
 *                     en producción: https://api.paddle.com)
 *
 * Deploy:
 *   supabase functions deploy paddle-change-plan
 *   supabase secrets set PADDLE_API_KEY=pdl_sdbx_xxx
 *   # (opcional prod) supabase secrets set PADDLE_API_BASE=https://api.paddle.com
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

    // ── Auth: el que llama tiene que ser admin/owner del club (o super-admin) ──
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

    const { team_id, plan_slug, cycle, preview } = await req.json();
    if (!team_id || !plan_slug) return json({ error: 'Faltan team_id / plan_slug' }, 400);

    // El equipo tiene que pertenecer al club del que llama (salvo super-admin).
    const { data: team } = await admin.from('teams').select('id, club_id').eq('id', team_id).maybeSingle();
    if (!team) return json({ error: 'Team not found' }, 404);
    if (!isSuper && team.club_id !== caller?.club_id) return json({ error: 'Not authorized' }, 403);

    // ── Suscripción de Paddle activa del equipo (no comp) ──
    const { data: sub } = await admin.from('subscriptions')
      .select('provider_subscription_id, is_comp, status')
      .eq('team_id', team_id).eq('status', 'active').maybeSingle();
    if (!sub || sub.is_comp || !sub.provider_subscription_id) {
      // No hay nada que actualizar → el cliente debe abrir un checkout nuevo.
      return json({ needs_checkout: true }, 409);
    }

    // ── Price id del plan destino ──
    const { data: plan } = await admin.from('plans')
      .select('slug, provider_price_monthly_id, provider_price_yearly_id')
      .eq('slug', plan_slug).maybeSingle();
    if (!plan) return json({ error: 'Plan not found' }, 404);
    const priceId = cycle === 'annual' ? plan.provider_price_yearly_id : plan.provider_price_monthly_id;
    if (!priceId) return json({ error: 'El plan no tiene price_id de Paddle para este ciclo' }, 422);

    // ── Paddle: preview o update ──
    // Ambos usan PATCH y el mismo body; /preview NO aplica el cambio.
    const path = preview
      ? `/subscriptions/${sub.provider_subscription_id}/preview`
      : `/subscriptions/${sub.provider_subscription_id}`;
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        proration_billing_mode: 'prorated_immediately',
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      console.error('Paddle change-plan failed', res.status, JSON.stringify(payload));
      return json({ error: 'paddle_error', detail: payload?.error ?? payload }, res.status);
    }

    // update_summary = { credit, charge, result:{ amount, currency_code } } (minor units string)
    return json({ ok: true, preview: !!preview, update_summary: payload?.data?.update_summary ?? null });
  } catch (e) {
    console.error(e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
