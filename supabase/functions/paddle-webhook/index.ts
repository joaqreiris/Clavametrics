/**
 * Supabase Edge Function — paddle-webhook
 *
 * Receives Paddle Billing webhooks and persists the subscription state that the
 * client-side checkout (Plan Picker.html) started. Paddle is the source of truth
 * for recurring billing; this function mirrors it into our DB:
 *
 *   subscriptions   — one row per team (uniq_sub_active_per_team), keyed by
 *                     provider_subscription_id (Paddle `sub_...`).
 *   clubs.billing_* — club-level summary (provider, customer id, status, plan…).
 *
 * The Plan Picker passes custom_data on Checkout.open:
 *   { team_id, club_id, plan_slug, cycle }   (cycle = 'monthly' | 'annual')
 * Paddle propagates it onto the subscription events, so we read it back here.
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
    const priceId     = data.items?.[0]?.price?.id ?? null;         // pri_...
    const interval    = data.billing_cycle?.interval ?? null;       // 'month' | 'year'

    // cycle: prefer custom_data, fall back to Paddle interval. Normalize to enum.
    const rawCycle = String(custom.cycle ?? interval ?? 'monthly');
    const cycle = (rawCycle === 'annual' || rawCycle === 'year' || rawCycle === 'yearly') ? 'yearly' : 'monthly';

    // ── Resolve the plan row (need plan_id; subscriptions.plan_id is NOT NULL) ──
    let plan: any = null;
    // Fallback por price id: es lo que refleja el PLAN REAL vigente en Paddle tras
    // un update (custom.plan_slug queda "pegado" al slug de la compra original, así
    // que para detectar upgrade/downgrade priorizamos el price del evento).
    if (priceId) {
      // Matchea contra price ids de sandbox O producción (un price id solo existe en
      // un entorno), así el webhook es agnóstico al toggle de entorno.
      const { data: p } = await supabase.from('plans')
        .select('id, slug, sort_order, price_monthly, price_yearly')
        .or(`provider_price_monthly_id.eq.${priceId},provider_price_yearly_id.eq.${priceId},provider_price_monthly_id_live.eq.${priceId},provider_price_yearly_id_live.eq.${priceId}`)
        .maybeSingle();
      plan = p;
    }
    if (!plan && custom.plan_slug) {
      const { data: p } = await supabase.from('plans')
        .select('id, slug, sort_order, price_monthly, price_yearly').eq('slug', custom.plan_slug).maybeSingle();
      plan = p;
    }
    if (!plan) { console.error('No plan resolved', { subId, priceId, custom }); return json({ error: 'plan_not_found' }, 422); }

    // ── Resolve team_id / club_id ──
    // team_id sale de custom_data, que el CLIENTE setea en el checkout. NUNCA confiar en el
    // club_id del cliente: derivar el club SIEMPRE desde el team en nuestra DB (evita escribir
    // filas team/club inconsistentes o apuntadas a otro club).
    const teamId = custom.team_id ?? null;
    if (!teamId) { console.error('Missing team_id', { subId, custom }); return json({ error: 'missing_ids' }, 422); }
    const { data: teamRow } = await supabase.from('teams').select('club_id').eq('id', teamId).maybeSingle();
    const clubId = teamRow?.club_id ?? null;
    if (!clubId) { console.error('Team not found / no club', { subId, teamId }); return json({ error: 'missing_ids' }, 422); }

    const isActive = ['active', 'trialing', 'past_due', 'paused'].includes(status);

    // SEGURIDAD (audit): el team_id viene de custom_data controlado por el cliente. Impedir que un
    // checkout ajeno (otro customer de Paddle) tome el control de un team que YA tiene una sub activa
    // de OTRO customer — si no, se podría cancelar/pisar la suscripción de otro club con un checkout
    // barato legítimo. Permitido: mismo customer (cambios normales) y customer nuevo sobre un team sin
    // sub activa (alta genuina tras churn).
    if (isActive && customerId) {
      const { data: clubBill } = await supabase.from('clubs')
        .select('billing_provider_customer_id').eq('id', clubId).maybeSingle();
      const clubCustomer = clubBill?.billing_provider_customer_id ?? null;
      if (clubCustomer && clubCustomer !== customerId) {
        const { data: otherActive } = await supabase.from('subscriptions')
          .select('id').eq('team_id', teamId)
          .neq('provider_subscription_id', subId)
          .in('status', ['active', 'trialing', 'past_due', 'paused']).maybeSingle();
        if (otherActive) {
          console.warn('Rejected foreign Paddle checkout for team with active sub', { subId, teamId, clubCustomer, customerId });
          return json({ ok: true, ignored: 'customer_mismatch' });
        }
      }
    }

    // ── Downgrade AGENDADO (a fin de período) ──────────────────────────────
    // Paddle no difiere cambios de plan: un downgrade (vía do_not_bill desde
    // paddle-change-plan) cambia el ítem al instante y factura el plan menor
    // recién en la próxima renovación. Para NO bajar las features antes de tiempo:
    // si vemos una baja de plan DENTRO del mismo ciclo (no una renovación),
    // dejamos plan_id en el plan ALTO y guardamos el cambio como agendado. Cuando
    // el ciclo avanza (renovación) caemos al camino normal y se aplica el menor.
    let scheduledPlanId: string | null = null;
    let scheduledChangeAt: string | null = null;
    let scheduledSlug: string | null = null;       // slug del plan agendado (para la alerta)
    let effectivePlan = plan;

    // Estado previo de ESTA sub (para agendado y para dedup de alertas).
    const { data: existing } = await supabase.from('subscriptions')
      .select('plan_id, status, current_period_start, scheduled_plan_id')
      .eq('provider_subscription_id', subId).maybeSingle();

    if (isActive && existing?.plan_id && existing.plan_id !== plan.id) {
      const { data: curPlan } = await supabase.from('plans')
        .select('id, slug, sort_order, price_monthly, price_yearly').eq('id', existing.plan_id).maybeSingle();
      const samePeriod = !!(periodStart && existing.current_period_start
        && new Date(periodStart).getTime() === new Date(existing.current_period_start).getTime());
      const isDowngrade = curPlan && (plan.sort_order ?? 0) < (curPlan.sort_order ?? 0);
      if (isDowngrade && samePeriod) {
        scheduledPlanId = plan.id;          // plan menor: se aplica al renovar
        scheduledChangeAt = periodEnd;
        scheduledSlug = plan.slug;
        effectivePlan = curPlan;            // features del plan alto siguen vigentes
      }
    }

    // Cancelación programada (Paddle scheduled_change action='cancel'): el equipo
    // sigue con su plan hasta effective_at y luego cae a Free. Lo reflejamos como
    // un cambio agendado hacia el plan 'initiation' para mostrarlo en la UI.
    const schedChange = (data as any).scheduled_change ?? null;
    if (isActive && schedChange && schedChange.action === 'cancel') {
      const { data: freePlan } = await supabase.from('plans').select('id').eq('slug', 'initiation').maybeSingle();
      if (freePlan?.id) {
        scheduledPlanId = freePlan.id;
        scheduledChangeAt = schedChange.effective_at ?? periodEnd;
        scheduledSlug = 'initiation';
      }
    }

    const amount = cycle === 'yearly' ? (effectivePlan.price_yearly ?? effectivePlan.price_monthly) : effectivePlan.price_monthly;

    // ── Upsert the subscription (keyed by provider_subscription_id) ──
    // The partial unique index allows only ONE active sub per team, so if THIS
    // sub is going active we first retire any other active sub for the team.
    if (isActive) {
      await supabase.from('subscriptions')
        .update({ status: 'canceled', canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('team_id', teamId)
        .neq('provider_subscription_id', subId)
        .in('status', ['active', 'trialing', 'past_due', 'paused']);
    }

    const row = {
      team_id: teamId,
      club_id: clubId,
      plan_id: effectivePlan.id,
      status,
      billing_cycle: cycle,
      provider_subscription_id: subId,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      scheduled_plan_id: scheduledPlanId,     // null salvo downgrade agendado
      scheduled_change_at: scheduledChangeAt,
      canceled_at: status === 'canceled' ? (data.canceled_at ?? new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    };
    const { error: upErr } = await supabase.from('subscriptions')
      .upsert(row, { onConflict: 'provider_subscription_id' });
    if (upErr) { console.error('subscriptions upsert failed', upErr); return json({ error: 'db_sub' }, 500); }

    // ── Mirror the summary onto the club ──
    const { error: clubErr } = await supabase.from('clubs').update({
      billing_provider: 'paddle',
      billing_provider_customer_id: customerId,
      billing_status: status,
      billing_plan: effectivePlan.slug,
      billing_amount: amount,
      billing_next_date: periodEnd ? String(periodEnd).slice(0, 10) : null,
      plan: effectivePlan.slug,
      updated_at: new Date().toISOString(),
    }).eq('id', clubId);
    if (clubErr) console.error('clubs update failed (non-fatal)', clubErr);

    // ── Alerta de churn/pago para el super admin (ventas + recuperación) ──────
    // Deduplicada contra el estado previo (existing) para no repetir en cada
    // reenvío del mismo evento. No fatal si falla.
    try {
      let alert: { kind: string; from_plan: string | null; to_plan: string | null; effective_at: string | null } | null = null;
      const prevSched = existing?.scheduled_plan_id ?? null;
      const prevStatus = existing?.status ?? null;

      if (scheduledPlanId && scheduledPlanId !== prevSched) {
        // Nuevo cambio agendado: downgrade o cancelación (→ Free).
        alert = {
          kind: scheduledSlug === 'initiation' ? 'cancel' : 'downgrade',
          from_plan: effectivePlan.slug,
          to_plan: scheduledSlug,
          effective_at: scheduledChangeAt,
        };
      } else if (status === 'past_due' && prevStatus !== 'past_due') {
        // Pago fallido → oportunidad de recuperar el pago.
        alert = { kind: 'payment_failed', from_plan: effectivePlan.slug, to_plan: null, effective_at: periodEnd };
      } else if (status === 'canceled' && prevStatus && prevStatus !== 'canceled' && !prevSched) {
        // Cancelación efectiva no anticipada por un agendado (ej. dunning agotado).
        alert = { kind: 'cancel', from_plan: effectivePlan.slug, to_plan: 'initiation', effective_at: null };
      }

      if (alert) {
        const { error: alErr } = await supabase.from('billing_alerts').insert({
          club_id: clubId, team_id: teamId, kind: alert.kind,
          from_plan: alert.from_plan, to_plan: alert.to_plan, effective_at: alert.effective_at,
        });
        if (alErr) console.error('billing_alerts insert failed (non-fatal)', alErr);
      }
    } catch (e) { console.error('billing_alerts block error (non-fatal)', e); }

    return json({ ok: true, type, sub: subId, team: teamId, status });
  } catch (e) {
    console.error('paddle-webhook error', e);
    return json({ error: 'internal' }, 500);
  }
});
