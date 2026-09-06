/**
 * Supabase Edge Function — paddle-change-plan
 *
 * Gestiona cambios sobre una suscripción de Paddle YA existente. Esto NO se puede
 * hacer desde el cliente (`Paddle.Checkout.open` solo CREA transacciones nuevas y
 * cobraría el plan entero).
 *
 * UNA SUSCRIPCIÓN, VARIAS CATEGORÍAS
 * La suscripción del club cubre todas sus categorías (un ítem por categoría paga; dos
 * categorías con el mismo plan viajan como un ítem con quantity 2). Como un PATCH con
 * `items` REEMPLAZA la lista entera, cada cambio reconstruye todos los ítems a partir
 * del reparto guardado en `subscriptions` — mandar sólo el ítem que cambia borraría las
 * demás categorías del club. El reparto se reenvía en `custom_data` para que el webhook
 * lo lea. Cambiar una categoría a Free = quitarle el ítem, no cancelar la suscripción;
 * la cancelación real queda para cuando era la última categoría paga.
 *
 * Acciones:
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
  // Referencia de diagnostico: viaja al cliente y queda en los logs, para poder cruzar
  // "me dio error 3f2a9c11" con la linea del log sin mandarle al navegador la respuesta
  // cruda de Paddle (ids internos, precios, estados de suscripcion de terceros).
  const ref = crypto.randomUUID().slice(0, 8);
  try {
    const URL     = Deno.env.get('SUPABASE_URL')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON    = Deno.env.get('SUPABASE_ANON_KEY')!;

    // ── Auth: admin/owner del club (o super-admin) ──
    const userClient = createClient(URL, ANON, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: 'Not authenticated' }, 401);

    const admin = createClient(URL, SERVICE);

    // ── Entorno de Paddle (bandera en DB) → elige secrets/base/price ──
    const { data: envVal } = await admin.rpc('paddle_env');
    const ENV = envVal === 'production' ? 'production' : 'sandbox';
    const API_BASE = ENV === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
    const API_KEY = ENV === 'production'
      ? Deno.env.get('PADDLE_API_KEY_LIVE')
      : (Deno.env.get('PADDLE_API_KEY_SANDBOX') || Deno.env.get('PADDLE_API_KEY'));
    if (!API_KEY) return json({ error: 'PADDLE_API_KEY (' + ENV + ') no configurado' }, 500);
    // price id según entorno
    const priceOf = (p: any, cyc: any) => ENV === 'production'
      ? (cyc === 'annual' ? p?.provider_price_yearly_id_live : p?.provider_price_monthly_id_live)
      : (cyc === 'annual' ? p?.provider_price_yearly_id      : p?.provider_price_monthly_id);
    const { data: caller } = await admin.from('profiles')
      .select('club_id, role, club_role').eq('id', user.id).single();
    const { data: superRow } = await admin.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    const isSuper = !!superRow;
    const isAdmin = caller &&
      (['admin', 'owner'].includes(caller.role) || ['admin', 'owner'].includes(caller.club_role));
    if (!isAdmin && !isSuper) return json({ error: 'Not authorized' }, 403);

    const { team_id, plan_slug, cycle, preview, action } = await req.json();
    const act = ['cancel', 'undo', 'manage', 'apply_discount'].includes(action) ? action : 'change';
    if (!team_id) return json({ error: 'Falta team_id' }, 400);
    if (act === 'change' && !plan_slug) return json({ error: 'Falta plan_slug' }, 400);

    // El equipo tiene que pertenecer al club del que llama (salvo super-admin).
    const { data: team } = await admin.from('teams').select('id, club_id').eq('id', team_id).maybeSingle();
    if (!team) return json({ error: 'Team not found' }, 404);
    if (!isSuper && team.club_id !== caller?.club_id) return json({ error: 'Not authorized' }, 403);

    // ── Suscripción de Paddle activa del equipo (no comp) ──
    const { data: ownSub } = await admin.from('subscriptions')
      .select('id, provider_subscription_id, is_comp, status, plan_id, billing_cycle, current_period_end, scheduled_plan_id, scheduled_change_at')
      .eq('team_id', team_id).eq('status', 'active').maybeSingle();

    // Una suscripción de Paddle cubre varias categorías del club. Si ESTA categoría
    // todavía no está adentro pero el club ya tiene una suscripción, no corresponde
    // abrir un checkout nuevo (sería una segunda tarjeta y una segunda factura): se le
    // suma un ítem a la que ya existe.
    let sub: any = ownSub;
    let adding = false;
    if ((!sub || sub.is_comp || !sub.provider_subscription_id) && act === 'change') {
      const { data: clubSub } = await admin.from('subscriptions')
        .select('id, provider_subscription_id, is_comp, status, plan_id, billing_cycle, current_period_end, scheduled_plan_id, scheduled_change_at')
        .eq('club_id', team.club_id).eq('status', 'active').eq('is_comp', false)
        .not('provider_subscription_id', 'is', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (clubSub) { sub = clubSub; adding = true; }
    }
    if (!sub || sub.is_comp || !sub.provider_subscription_id) {
      // No hay sub de Paddle que modificar → el cliente debe abrir checkout nuevo.
      // 200 (no 409) para que el cliente pueda leer el flag en `data`.
      return json({ needs_checkout: true }, 200);
    }
    const subId = sub.provider_subscription_id;
    // El ciclo lo fija la suscripción: no se pueden mezclar mensual y anual en la misma.
    const subCycle: 'monthly' | 'annual' = sub.billing_cycle === 'yearly' ? 'annual' : 'monthly';

    // ── Reparto vigente: qué categoría lleva qué plan dentro de esta suscripción ──
    // Es la fuente de verdad del reparto (Paddle solo ve cantidades por precio: dos
    // categorías con el mismo plan viajan como un ítem con quantity 2).
    const { data: mapRows } = await admin.from('subscriptions')
      .select('team_id, plan_id')
      .eq('provider_subscription_id', subId)
      .in('status', ['active', 'trialing', 'past_due', 'paused']);
    const mapping = new Map<string, string>();               // team_id → plan_id
    for (const r of mapRows || []) mapping.set(r.team_id, r.plan_id);

    const paddle = (path: string, method: string, body?: unknown) =>
      fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });

    // ── Catálogo de planes ──
    const { data: plansRows } = await admin.from('plans')
      .select('id, slug, sort_order, provider_price_monthly_id, provider_price_yearly_id, provider_price_monthly_id_live, provider_price_yearly_id_live');
    const plans: Record<string, any> = {};
    (plansRows || []).forEach((p) => { plans[p.slug] = p; plans[p.id] = p; });
    const FREE = 'initiation';

    // Los ítems de la suscripción se reconstruyen ENTEROS en cada cambio: un PATCH con
    // `items` reemplaza la lista, así que mandar sólo el ítem que cambia borraría las
    // demás categorías del club. Las que quedan en Free no tienen precio y por eso no
    // aportan ítem — pero siguen en el reparto, para que el webhook sepa de ellas.
    const buildItems = (map: Map<string, string>) => {
      const qty = new Map<string, number>();
      for (const planId of map.values()) {
        const p = plans[planId];
        if (!p || p.slug === FREE) continue;
        const priceId = priceOf(p, subCycle);
        if (!priceId) continue;
        qty.set(priceId, (qty.get(priceId) ?? 0) + 1);
      }
      return [...qty.entries()].map(([price_id, quantity]) => ({ price_id, quantity }));
    };
    // El reparto viaja en custom_data para que el webhook lo lea en la creación; en los
    // eventos siguientes manda lo que tengamos guardado, que es esto mismo.
    const customData = (map: Map<string, string>) => ({
      club_id: team.club_id,
      cycle: subCycle,
      teams: [...map.entries()].map(([tid, pid]) => ({ team_id: tid, plan_slug: plans[pid]?.slug ?? null })),
    });

    // ── Cancelar → Free (a fin de período) ──
    // Si la suscripción cubre varias categorías, cancelarla entera dejaría al club sin
    // las otras: se baja SÓLO esta a Free (mismo mecanismo que un downgrade, con las
    // features vigentes hasta fin del período ya pago). La cancelación de verdad queda
    // para cuando esta era la última categoría paga.
    if (act === 'cancel') {
      const others = new Map(mapping);
      others.delete(team_id);
      const someoneElsePays = buildItems(others).length > 0;

      if (preview) return json({ ok: true, preview: true, cancel: true, partial: someoneElsePays, effective_at: sub.current_period_end });

      if (someoneElsePays) {
        const next = new Map(mapping);
        next.set(team_id, plans[FREE]?.id ?? '');
        const res = await paddle(`/subscriptions/${subId}`, 'PATCH', {
          items: buildItems(next),
          custom_data: customData(next),
          proration_billing_mode: 'do_not_bill',
        });
        const payload = await res.json();
        if (!res.ok) {
          console.error(`[ref=${ref}] Paddle remove item failed`, res.status, JSON.stringify(payload));
          return json({ error: 'paddle_error', ref }, res.status);
        }
        return json({ ok: true, cancel: true, partial: true, effective_at: sub.current_period_end });
      }

      const res = await paddle(`/subscriptions/${subId}/cancel`, 'POST', { effective_from: 'next_billing_period' });
      const payload = await res.json();
      if (!res.ok) {
        console.error(`[ref=${ref}] Paddle cancel failed`, res.status, JSON.stringify(payload));
        return json({ error: 'paddle_error', ref }, res.status);
      }
      return json({ ok: true, cancel: true, effective_at: payload?.data?.scheduled_change?.effective_at ?? sub.current_period_end });
    }

    // ── Oferta de retención: aplica un discount de Paddle a la suscripción ──
    // El discount (%, duración en ciclos) se crea en Paddle y su id va en el secret
    // PADDLE_RETENTION_DISCOUNT_ID (dsc_...). Paddle lo aplica y lo saca solo al vencer.
    if (act === 'apply_discount') {
      const discountId = ENV === 'production'
        ? Deno.env.get('PADDLE_RETENTION_DISCOUNT_ID_LIVE')
        : (Deno.env.get('PADDLE_RETENTION_DISCOUNT_ID_SANDBOX') || Deno.env.get('PADDLE_RETENTION_DISCOUNT_ID'));
      if (!discountId) return json({ error: 'PADDLE_RETENTION_DISCOUNT_ID (' + ENV + ') no configurado' }, 500);
      const res = await paddle(`/subscriptions/${subId}`, 'PATCH', {
        discount: { id: discountId, effective_from: 'immediately' },
      });
      const payload = await res.json();
      if (!res.ok) {
        console.error(`[ref=${ref}] Paddle apply_discount failed`, res.status, JSON.stringify(payload));
        return json({ error: 'paddle_error', ref }, res.status);
      }
      return json({ ok: true, discount_applied: true });
    }

    // ── Portal de gestión: URL de Paddle para actualizar el método de pago ──
    if (act === 'manage') {
      const res = await paddle(`/subscriptions/${subId}`, 'GET');
      const payload = await res.json();
      if (!res.ok) {
        console.error(`[ref=${ref}] Paddle get sub failed`, res.status, JSON.stringify(payload));
        return json({ error: 'paddle_error', ref }, res.status);
      }
      const mu = payload?.data?.management_urls ?? {};
      return json({ ok: true, update_payment_method: mu.update_payment_method ?? null, cancel_url: mu.cancel ?? null });
    }

    // ── Deshacer un cambio agendado (downgrade programado o cancelación) ──
    if (act === 'undo') {
      const { data: schedPlan } = sub.scheduled_plan_id
        ? await admin.from('plans').select('id, slug').eq('id', sub.scheduled_plan_id).maybeSingle()
        : { data: null } as any;
      const isCancel = !sub.scheduled_plan_id || schedPlan?.slug === 'initiation';
      let res: Response;
      if (isCancel) {
        // Quitar la cancelación programada.
        res = await paddle(`/subscriptions/${subId}`, 'PATCH', { scheduled_change: null });
      } else {
        // Downgrade programado: volver al plan ALTO actual, sin cobro (aún dentro del
        // período ya pago). Se reconstruyen todos los ítems: `mapping` ya trae el plan
        // vigente de cada categoría (el alto, porque el agendado no se aplicó todavía).
        const items = buildItems(mapping);
        if (!items.length) return json({ error: 'Sin price_id del plan actual' }, 422);
        res = await paddle(`/subscriptions/${subId}`, 'PATCH', {
          items, custom_data: customData(mapping), proration_billing_mode: 'do_not_bill',
        });
      }
      const payload = await res.json();
      if (!res.ok) {
        console.error(`[ref=${ref}] Paddle undo failed`, res.status, JSON.stringify(payload));
        return json({ error: 'paddle_error', ref }, res.status);
      }
      // Limpiar el agendado en nuestra DB (el webhook también lo hará al reflejar el evento).
      await admin.from('subscriptions')
        .update({ scheduled_plan_id: null, scheduled_change_at: null, updated_at: new Date().toISOString() })
        .eq('id', sub.id);
      return json({ ok: true, undo: true });
    }

    // ── Cambio de plan (upgrade / downgrade / alta de una categoría) ──
    const target = plans[plan_slug];
    // El plan actual es el de ESTA categoría dentro de la suscripción. Si la categoría
    // todavía no está adentro (se le suma un ítem), viene de Free.
    const current = adding ? plans[FREE] : plans[mapping.get(team_id) ?? sub.plan_id];
    if (!target) return json({ error: 'Plan destino no encontrado' }, 404);
    if (target.slug !== FREE && !priceOf(target, subCycle)) {
      return json({ error: 'El plan destino no tiene price_id de Paddle para este ciclo' }, 422);
    }
    // El ciclo lo manda la suscripción: si el cliente pide otro, se avisa en vez de
    // crear una mezcla de mensual y anual que Paddle factura junta.
    if (cycle && cycle !== subCycle) return json({ error: 'cycle_mismatch', sub_cycle: subCycle }, 400);

    const curSort = current?.sort_order ?? 0;
    const tgtSort = target.sort_order ?? 0;
    if (current && target.id === current.id) return json({ error: 'same_plan' }, 400);
    const isDowngrade = tgtSort < curSort;
    const mode = isDowngrade ? 'do_not_bill' : 'prorated_immediately';

    const next = new Map(mapping);
    next.set(team_id, target.id);
    const items = buildItems(next);
    if (!items.length) return json({ error: 'no_paid_items' }, 422);   // todo a Free → usar action:'cancel'

    if (preview) {
      // En downgrade no hay cargo ahora: informamos la fecha efectiva (fin de período).
      if (isDowngrade) return json({ ok: true, preview: true, downgrade: true, effective_at: sub.current_period_end });
      // Upgrade: preview real del prorrateo.
      const res = await paddle(`/subscriptions/${subId}/preview`, 'PATCH', {
        items, proration_billing_mode: mode,
      });
      const payload = await res.json();
      if (!res.ok) {
        console.error(`[ref=${ref}] Paddle preview failed`, res.status, JSON.stringify(payload));
        return json({ error: 'paddle_error', ref }, res.status);
      }
      return json({ ok: true, preview: true, downgrade: false, adding, update_summary: payload?.data?.update_summary ?? null });
    }

    // Aplicar
    const res = await paddle(`/subscriptions/${subId}`, 'PATCH', {
      items, custom_data: customData(next), proration_billing_mode: mode,
    });
    const payload = await res.json();
    if (!res.ok) {
      console.error(`[ref=${ref}] Paddle change-plan failed`, res.status, JSON.stringify(payload));
      return json({ error: 'paddle_error', ref }, res.status);
    }
    return json({ ok: true, downgrade: isDowngrade, effective_at: isDowngrade ? sub.current_period_end : null });
  } catch (e) {
    console.error(`[ref=${ref}]`, e);
    return json({ error: 'internal_error', ref }, 500);
  }
});
