/**
 * Supabase Edge Function — paddle-webhook
 *
 * Receives Paddle Billing webhooks and persists the subscription state that the
 * client-side checkout (Plan Picker.html) started. Paddle is the source of truth
 * for recurring billing; this function mirrors it into our DB:
 *
 *   subscriptions   — one row per team (uniq_sub_active_per_team). Several rows can
 *                     share provider_subscription_id: ONE Paddle subscription covers
 *                     every category of the club, so the club pays once and gets a
 *                     single invoice.
 *   clubs.billing_* — club-level summary (provider, customer id, status, plan…).
 *
 * WHY THE MAPPING LIVES IN custom_data
 * Two categories on the same plan travel as ONE item with quantity 2 — Paddle only
 * knows prices and quantities, never which category is which. So the checkout passes
 * the split and paddle-change-plan rewrites it on every change:
 *   { club_id, cycle, teams: [{ team_id, plan_slug }, …] }   (cycle = 'monthly' | 'annual')
 * Categories on Free are listed too (they carry no item, but they are part of the club).
 * Older subscriptions carry the single-category shape { team_id, club_id, plan_slug,
 * cycle } and are still read.
 *
 * Events handled (Paddle Billing):
 *   subscription.created / .updated / .activated / .resumed / .canceled
 * Everything else → 200 ignored (Paddle only cares that we ack).
 *
 * Security: verifies the Paddle-Signature HMAC over the RAW body. NEVER trust
 * the payload without this. Requires the destination's secret key.
 *
 * Required Supabase secrets:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (already set for all functions)
 *   PADDLE_WEBHOOK_SECRET                     (Paddle → Notifications → your
 *                                              destination → Secret key, `pdl_ntfset_…`)
 *
 * Deploy (Paddle is unauthenticated, so skip JWT verification):
 *   supabase functions deploy paddle-webhook --no-verify-jwt
 *   supabase secrets set PADDLE_WEBHOOK_SECRET=pdl_ntfset_xxx
 * Then in Paddle (sandbox) → Notifications → add a destination pointing at:
 *   https://<project-ref>.supabase.co/functions/v1/paddle-webhook
 * subscribed to the subscription.* events above.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, paddle-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ── Signature verification ───────────────────────────────
// Paddle-Signature: "ts=1700000000;h1=<hex hmac-sha256>"
// The signed payload is `${ts}:${rawBody}` HMAC'd with the destination secret.
async function verifyPaddleSignature(rawBody: string, header: string | null, secret: string): Promise<{ ok: boolean; ts: number }> {
  if (!header) return { ok: false, ts: 0 };
  const parts = Object.fromEntries(header.split(';').map((kv) => kv.split('=') as [string, string]));
  const ts = parts['ts'];
  const h1 = parts['h1'];
  if (!ts || !h1) return { ok: false, ts: 0 };

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}:${rawBody}`));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');

  // constant-time-ish compare
  if (expected.length !== h1.length) return { ok: false, ts: 0 };
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ h1.charCodeAt(i);
  return { ok: diff === 0, ts: Number(ts) || 0 };
}

// Paddle status → our enum (they already line up, but guard unknowns).
const STATUS_MAP: Record<string, string> = {
  active: 'active', trialing: 'trialing', past_due: 'past_due',
  canceled: 'canceled', paused: 'paused',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // Aceptamos eventos de sandbox O producción: verificamos la firma contra CUALQUIERA
  // de los secrets configurados (una firma solo valida con su propio secret). Así el
  // toggle de entorno no requiere tocar el webhook. Legacy PADDLE_WEBHOOK_SECRET = sandbox.
  const secrets = [
    Deno.env.get('PADDLE_WEBHOOK_SECRET_LIVE'),
    Deno.env.get('PADDLE_WEBHOOK_SECRET_SANDBOX'),
    Deno.env.get('PADDLE_WEBHOOK_SECRET'),
  ].filter(Boolean) as string[];
  if (!secrets.length) { console.error('No PADDLE_WEBHOOK_SECRET* set'); return json({ error: 'not_configured' }, 500); }

  // Read the RAW body first — the signature is over these exact bytes.
  const raw = await req.text();
  const sigHeader = req.headers.get('paddle-signature');
  let ok = false, ts = 0;
  for (const s of secrets) {
    const r = await verifyPaddleSignature(raw, sigHeader, s);
    if (r.ok) { ok = true; ts = r.ts; break; }
  }
  if (!ok) { console.warn('Invalid Paddle signature'); return json({ error: 'bad_signature' }, 401); }

  // Replay guard: Paddle re-firma cada intento de entrega con un ts fresco, así que un
  // webhook capturado y reenviado más tarde (para revertir estado) llega con ts viejo.
  // Ventana amplia (15 min) para tolerar reintentos legítimos y skew de reloj.
  const ageSec = Math.abs(Date.now() / 1000 - ts);
  if (ts && ageSec > 900) { console.warn('Stale Paddle signature (replay?)', { ts, ageSec }); return json({ error: 'stale_signature' }, 400); }

  let evt: any;
  try { evt = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400); }

  const type = evt?.event_type as string | undefined;
  const data = evt?.data ?? {};

  // We only act on subscription lifecycle events; ack everything else.
  if (!type || !type.startsWith('subscription.')) return json({ ok: true, ignored: type ?? null });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const subId       = data.id as string;                         // sub_...
    const customerId  = data.customer_id as string | null;
    const paddleStat  = String(data.status ?? '');
    // Estado desconocido → ackear e ignorar (antes caía en 'active' por default y regalaba acceso).
    if (!STATUS_MAP[paddleStat]) { console.warn('Unknown Paddle status, ignoring', { subId, paddleStat }); return json({ ok: true, ignored: 'unknown_status' }); }
    const status      = STATUS_MAP[paddleStat];
    const custom      = data.custom_data ?? {};
    const periodStart = data.current_billing_period?.starts_at ?? null;
    const periodEnd   = data.current_billing_period?.ends_at ?? null;
    const evtItems    = Array.isArray(data.items) ? data.items : [];
    const interval    = data.billing_cycle?.interval ?? null;       // 'month' | 'year'

    // cycle: prefer custom_data, fall back to Paddle interval. Normalize to enum.
    const rawCycle = String(custom.cycle ?? interval ?? 'monthly');
    const cycle = (rawCycle === 'annual' || rawCycle === 'year' || rawCycle === 'yearly') ? 'yearly' : 'monthly';

    const isActive = ['active', 'trialing', 'past_due', 'paused'].includes(status);

    // ── Catálogo de planes (una sola lectura; se indexa por id, slug y price id) ──
    const { data: planRows } = await supabase.from('plans')
      .select('id, slug, sort_order, price_monthly, price_yearly, provider_price_monthly_id, provider_price_yearly_id, provider_price_monthly_id_live, provider_price_yearly_id_live');
    const byId: Record<string, any> = {};
    const bySlug: Record<string, any> = {};
    const byPrice: Record<string, any> = {};
    for (const row of planRows || []) {
      const p = row as Record<string, any>;
      byId[p.id] = p; bySlug[p.slug] = p;
      // Un price id existe en un solo entorno, así que indexar los cuatro es seguro y
      // deja al webhook agnóstico al toggle sandbox/producción.
      for (const k of ['provider_price_monthly_id', 'provider_price_yearly_id', 'provider_price_monthly_id_live', 'provider_price_yearly_id_live']) {
        if (p[k]) byPrice[p[k]] = p;
      }
    }

    // ── Reparto: qué categoría lleva qué plan dentro de ESTA suscripción ─────────
    // Una suscripción de Paddle cubre varias categorías (un ítem por categoría) para que
    // el club pague una vez y reciba una factura. Como dos categorías con el mismo plan
    // viajan como UN ítem con quantity 2, el ítem no identifica al equipo: el reparto lo
    // llevamos nosotros. Orden de confianza:
    //   1. custom_data.teams — lo setea el checkout, y paddle-change-plan lo reescribe
    //      en cada cambio, así que es el estado vigente.
    //   2. lo ya guardado para esta suscripción — para eventos (renovación, pago fallido)
    //      donde Paddle reenvía el custom_data original.
    //   3. custom_data.team_id — formato anterior, una sola categoría.
    const { data: knownRows } = await supabase.from('subscriptions')
      .select('team_id, plan_id, status, current_period_start, scheduled_plan_id')
      .eq('provider_subscription_id', subId);
    const known = knownRows || [];
    const knownByTeam: Record<string, any> = {};
    for (const r of known) knownByTeam[r.team_id] = r;

    type Assign = { teamId: string; plan: any };
    const rawAssigns: { teamId: string; slug: string | null }[] = [];
    if (Array.isArray(custom.teams) && custom.teams.length) {
      for (const t of custom.teams) {
        if (t && t.team_id) rawAssigns.push({ teamId: String(t.team_id), slug: t.plan_slug ?? null });
      }
    } else if (known.length) {
      for (const r of known) rawAssigns.push({ teamId: r.team_id, slug: null });
    } else if (custom.team_id) {
      rawAssigns.push({ teamId: String(custom.team_id), slug: custom.plan_slug ?? null });
    }
    if (!rawAssigns.length) { console.error('No team mapping for subscription', { subId, custom }); return json({ error: 'missing_ids' }, 422); }

    // NUNCA confiar en el club_id del cliente: se deriva de los equipos en nuestra DB.
    // Un checkout que mezcle equipos de clubes distintos se recorta al club mayoritario
    // en vez de escribir filas cruzadas.
    const { data: teamRows } = await supabase.from('teams')
      .select('id, club_id').in('id', rawAssigns.map((a) => a.teamId));
    const clubByTeam: Record<string, string> = {};
    for (const t of teamRows || []) clubByTeam[t.id] = t.club_id;
    const clubId = clubByTeam[rawAssigns[0].teamId] ?? null;
    if (!clubId) { console.error('Team not found / no club', { subId, team: rawAssigns[0].teamId }); return json({ error: 'missing_ids' }, 422); }

    const assigns: Assign[] = [];
    for (const a of rawAssigns) {
      if (clubByTeam[a.teamId] !== clubId) { console.warn('Team from another club ignored', { subId, team: a.teamId }); continue; }
      // Plan: el slug del reparto, si no el que ya tenía guardado el equipo.
      let plan = (a.slug && bySlug[a.slug]) || byId[knownByTeam[a.teamId]?.plan_id] || null;
      // Suscripción de una sola categoría: el price del evento manda, porque refleja un
      // cambio hecho fuera de la app (desde el panel de Paddle) que el reparto no vería.
      if (evtItems.length === 1 && rawAssigns.length === 1) {
        const p = byPrice[evtItems[0]?.price?.id ?? ''];
        if (p) plan = p;
      }
      if (!plan) { console.warn('No plan resolved for team', { subId, team: a.teamId }); continue; }
      assigns.push({ teamId: a.teamId, plan });
    }
    if (!assigns.length) { console.error('No assignable teams', { subId, custom }); return json({ error: 'plan_not_found' }, 422); }

    // Aviso (no fatal): la suma de cantidades en Paddle debería igualar la cantidad de
    // categorías PAGAS del reparto — las que están en Free no llevan ítem. Si no cuadra,
    // estamos cobrando algo distinto de lo que muestra la app.
    const paidUnits = evtItems.reduce((n: number, it: any) => n + (Number(it?.quantity) || 0), 0);
    const paidTeams = assigns.filter((a) => Number(a.plan.price_monthly) > 0).length;
    if (isActive && paidUnits !== paidTeams) {
      console.warn('Item quantity does not match team mapping', { subId, paidUnits, paidTeams });
    }

    // SEGURIDAD (audit): el reparto viene de custom_data, controlado por el cliente. Impedir que un
    // checkout ajeno (otro customer de Paddle) tome el control de categorías que YA tienen una sub
    // activa de OTRO customer — si no, se podría pisar la suscripción de otro club con un checkout
    // barato legítimo. Permitido: mismo customer (cambios normales) y customer nuevo sobre categorías
    // sin sub activa (alta genuina tras churn).
    if (isActive && customerId) {
      const { data: clubBill } = await supabase.from('clubs')
        .select('billing_provider_customer_id').eq('id', clubId).maybeSingle();
      const clubCustomer = clubBill?.billing_provider_customer_id ?? null;
      if (clubCustomer && clubCustomer !== customerId) {
        const { data: otherActive } = await supabase.from('subscriptions')
          .select('id').in('team_id', assigns.map((a) => a.teamId))
          .neq('provider_subscription_id', subId)
          .in('status', ['active', 'trialing', 'past_due', 'paused']).limit(1);
        if (otherActive && otherActive.length) {
          console.warn('Rejected foreign Paddle checkout for teams with active subs', { subId, clubCustomer, customerId });
          return json({ ok: true, ignored: 'customer_mismatch' });
        }
      }
    }

    // ── Downgrade AGENDADO (a fin de período), por categoría ────────────────
    // Paddle no difiere cambios de plan: un downgrade (vía do_not_bill desde
    // paddle-change-plan) cambia el ítem al instante y factura el plan menor
    // recién en la próxima renovación. Para NO bajar las features antes de tiempo:
    // si vemos una baja de plan DENTRO del mismo ciclo (no una renovación),
    // dejamos plan_id en el plan ALTO y guardamos el cambio como agendado. Cuando
    // el ciclo avanza (renovación) caemos al camino normal y se aplica el menor.
    const nowIso = new Date().toISOString();
    const schedChange = (data as any).scheduled_change ?? null;
    const cancelScheduled = isActive && schedChange && schedChange.action === 'cancel';
    const freePlan = bySlug['initiation'] ?? null;

    type Resolved = {
      teamId: string; plan: any; scheduledPlanId: string | null;
      scheduledChangeAt: string | null; scheduledSlug: string | null; prev: any;
    };
    const resolved: Resolved[] = assigns.map(({ teamId, plan }) => {
      const prev = knownByTeam[teamId] ?? null;
      let scheduledPlanId: string | null = null;
      let scheduledChangeAt: string | null = null;
      let scheduledSlug: string | null = null;
      let effectivePlan = plan;

      if (isActive && prev?.plan_id && prev.plan_id !== plan.id) {
        const curPlan = byId[prev.plan_id] ?? null;
        const samePeriod = !!(periodStart && prev.current_period_start
          && new Date(periodStart).getTime() === new Date(prev.current_period_start).getTime());
        const isDowngrade = curPlan && (plan.sort_order ?? 0) < (curPlan.sort_order ?? 0);
        if (isDowngrade && samePeriod) {
          scheduledPlanId = plan.id;          // plan menor: se aplica al renovar
          scheduledChangeAt = periodEnd;
          scheduledSlug = plan.slug;
          effectivePlan = curPlan;            // features del plan alto siguen vigentes
        }
      }

      // Cancelación programada (Paddle scheduled_change action='cancel'): la categoría
      // sigue con su plan hasta effective_at y luego cae a Free. Se refleja como un
      // cambio agendado hacia 'initiation' para poder mostrarlo en la UI.
      if (cancelScheduled && freePlan?.id) {
        scheduledPlanId = freePlan.id;
        scheduledChangeAt = schedChange.effective_at ?? periodEnd;
        scheduledSlug = 'initiation';
      }

      return { teamId, plan: effectivePlan, scheduledPlanId, scheduledChangeAt, scheduledSlug, prev };
    });

    // ── Persistir una fila por categoría ────────────────────────────────────
    // Todas comparten provider_subscription_id: es la misma suscripción de Paddle.
    if (isActive) {
      // El índice uniq_sub_active_per_team deja una sola sub activa por categoría: se
      // retiran las de OTRAS suscripciones antes de escribir esta.
      await supabase.from('subscriptions')
        .update({ status: 'canceled', canceled_at: nowIso, updated_at: nowIso })
        .in('team_id', resolved.map((r) => r.teamId))
        .neq('provider_subscription_id', subId)
        .in('status', ['active', 'trialing', 'past_due', 'paused']);
    }

    const rows = resolved.map((r) => ({
      team_id: r.teamId,
      club_id: clubId,
      plan_id: r.plan.id,
      status,
      billing_cycle: cycle,
      provider_subscription_id: subId,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      scheduled_plan_id: r.scheduledPlanId,     // null salvo downgrade agendado
      scheduled_change_at: r.scheduledChangeAt,
      canceled_at: status === 'canceled' ? (data.canceled_at ?? nowIso) : null,
      updated_at: nowIso,
    }));
    const { error: upErr } = await supabase.from('subscriptions')
      .upsert(rows, { onConflict: 'provider_subscription_id,team_id' });
    if (upErr) { console.error('subscriptions upsert failed', upErr); return json({ error: 'db_sub' }, 500); }

    // Categorías que ESTABAN en esta suscripción y ya no: se les quitó el ítem (bajaron
    // a Free). Si no se cierran acá quedarían con plan pago sin que nadie lo pague.
    const stillIn = new Set(resolved.map((r) => r.teamId));
    const dropped = known.filter((r) => !stillIn.has(r.team_id) && r.status !== 'canceled').map((r) => r.team_id);
    if (dropped.length) {
      await supabase.from('subscriptions')
        .update({ status: 'canceled', canceled_at: nowIso, updated_at: nowIso })
        .eq('provider_subscription_id', subId).in('team_id', dropped);
    }

    // ── Espejo del resumen en el club ───────────────────────────────────────
    // Con varias categorías en la misma suscripción, "el plan del club" es el más alto
    // que tenga contratado, y el importe es la suma de todas: es lo que se cobra.
    const top = resolved.reduce((best: any, r) => (!best || (r.plan.sort_order ?? 0) > (best.sort_order ?? 0)) ? r.plan : best, null as any);
    const amount = resolved.reduce((sum, r) => sum + Number(
      (cycle === 'yearly' ? (r.plan.price_yearly ?? r.plan.price_monthly) : r.plan.price_monthly) ?? 0), 0);
    const { error: clubErr } = await supabase.from('clubs').update({
      billing_provider: 'paddle',
      billing_provider_customer_id: customerId,
      billing_status: status,
      billing_plan: top?.slug ?? null,
      billing_amount: amount,
      billing_next_date: periodEnd ? String(periodEnd).slice(0, 10) : null,
      plan: top?.slug ?? null,
      updated_at: nowIso,
    }).eq('id', clubId);
    if (clubErr) console.error('clubs update failed (non-fatal)', clubErr);

    // ── Alerta de churn/pago para el super admin (ventas + recuperación) ──────
    // Una por categoría, deduplicada contra su estado previo para no repetir en cada
    // reenvío del mismo evento. No fatal si falla.
    try {
      const alerts: any[] = [];
      for (const r of resolved) {
        const prevSched = r.prev?.scheduled_plan_id ?? null;
        const prevStatus = r.prev?.status ?? null;
        let alert: { kind: string; from_plan: string | null; to_plan: string | null; effective_at: string | null } | null = null;

        if (r.scheduledPlanId && r.scheduledPlanId !== prevSched) {
          // Nuevo cambio agendado: downgrade o cancelación (→ Free).
          alert = {
            kind: r.scheduledSlug === 'initiation' ? 'cancel' : 'downgrade',
            from_plan: r.plan.slug, to_plan: r.scheduledSlug, effective_at: r.scheduledChangeAt,
          };
        } else if (status === 'past_due' && prevStatus !== 'past_due') {
          alert = { kind: 'payment_failed', from_plan: r.plan.slug, to_plan: null, effective_at: periodEnd };
        } else if (status === 'canceled' && prevStatus && prevStatus !== 'canceled' && !prevSched) {
          alert = { kind: 'cancel', from_plan: r.plan.slug, to_plan: 'initiation', effective_at: null };
        }
        if (alert) alerts.push({ club_id: clubId, team_id: r.teamId, kind: alert.kind, from_plan: alert.from_plan, to_plan: alert.to_plan, effective_at: alert.effective_at });
      }
      if (alerts.length) {
        const { error: alErr } = await supabase.from('billing_alerts').insert(alerts);
        if (alErr) console.error('billing_alerts insert failed (non-fatal)', alErr);
      }
    } catch (e) { console.error('billing_alerts block error (non-fatal)', e); }

    return json({ ok: true, type, sub: subId, teams: resolved.map((r) => r.teamId), status });
  } catch (e) {
    console.error('paddle-webhook error', e);
    return json({ error: 'internal' }, 500);
  }
});
