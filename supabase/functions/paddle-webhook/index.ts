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
async function verifyPaddleSignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(';').map((kv) => kv.split('=') as [string, string]));
  const ts = parts['ts'];
  const h1 = parts['h1'];
  if (!ts || !h1) return false;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}:${rawBody}`));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');

  // constant-time-ish compare
  if (expected.length !== h1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ h1.charCodeAt(i);
  return diff === 0;
}

// Paddle status → our enum (they already line up, but guard unknowns).
const STATUS_MAP: Record<string, string> = {
  active: 'active', trialing: 'trialing', past_due: 'past_due',
  canceled: 'canceled', paused: 'paused',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secret = Deno.env.get('PADDLE_WEBHOOK_SECRET');
  if (!secret) { console.error('PADDLE_WEBHOOK_SECRET not set'); return json({ error: 'not_configured' }, 500); }

  // Read the RAW body first — the signature is over these exact bytes.
  const raw = await req.text();
  const ok = await verifyPaddleSignature(raw, req.headers.get('paddle-signature'), secret);
  if (!ok) { console.warn('Invalid Paddle signature'); return json({ error: 'bad_signature' }, 401); }

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
    const status      = STATUS_MAP[paddleStat] ?? 'active';
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
    if (custom.plan_slug) {
      const { data: p } = await supabase.from('plans')
        .select('id, slug, price_monthly, price_yearly').eq('slug', custom.plan_slug).maybeSingle();
      plan = p;
    }
    if (!plan && priceId) {
      // fall back: match by the price id we stored on the plan
      const { data: p } = await supabase.from('plans')
        .select('id, slug, price_monthly, price_yearly')
        .or(`provider_price_monthly_id.eq.${priceId},provider_price_yearly_id.eq.${priceId}`)
        .maybeSingle();
      plan = p;
    }
    if (!plan) { console.error('No plan resolved', { subId, priceId, custom }); return json({ error: 'plan_not_found' }, 422); }

    // ── Resolve team_id / club_id (custom_data first, derive if missing) ──
    let teamId = custom.team_id ?? null;
    let clubId = custom.club_id ?? null;
    if (teamId && !clubId) {
      const { data: t } = await supabase.from('teams').select('club_id').eq('id', teamId).maybeSingle();
      clubId = t?.club_id ?? null;
    }
    if (!teamId || !clubId) { console.error('Missing team/club', { subId, custom }); return json({ error: 'missing_ids' }, 422); }

    const amount = cycle === 'yearly' ? (plan.price_yearly ?? plan.price_monthly) : plan.price_monthly;
    const isActive = ['active', 'trialing', 'past_due', 'paused'].includes(status);

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
      plan_id: plan.id,
      status,
      billing_cycle: cycle,
      provider_subscription_id: subId,
      current_period_start: periodStart,
      current_period_end: periodEnd,
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
      billing_plan: plan.slug,
      billing_amount: amount,
      billing_next_date: periodEnd ? String(periodEnd).slice(0, 10) : null,
      plan: plan.slug,
      updated_at: new Date().toISOString(),
    }).eq('id', clubId);
    if (clubErr) console.error('clubs update failed (non-fatal)', clubErr);

    return json({ ok: true, type, sub: subId, team: teamId, status });
  } catch (e) {
    console.error('paddle-webhook error', e);
    return json({ error: 'internal' }, 500);
  }
});
