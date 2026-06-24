/**
 * Supabase Edge Function — gps-verify
 *
 * Validates a stored GPS credential against the provider's real API and flips
 * the integration status to 'connected' (or 'error'). This is the handler the
 * mig 073 reserved the 'connected' state for. Verify only — it does NOT sync
 * sessions and does NOT touch last_sync_at (that's Ladrillo 2).
 *
 * Only Catapult (OpenField) is supported for now. StatSports is push-based and
 * comes later; for it we return ok:false WITHOUT changing the status.
 *
 * Request  (POST JSON): { integration_id: string }
 * Response (200 JSON):
 *   ok    → { ok:true,  status:'connected', activity_count }
 *   error → { ok:false, status:'error',     http_status }
 *   n/a   → { ok:false, message:'Verify not supported for this provider yet' }
 *
 * Required Supabase secrets (already set for all functions):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * Deploy:
 *   supabase functions deploy gps-verify
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

// ── CORS headers ──────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// Catapult OpenField API base URL per region. The region is the single source
// of truth living in gps_integrations.config.region.
const CATAPULT_BASE: Record<string, string> = {
  au: 'https://connect-au.catapultsports.com/api/v6',
  us: 'https://connect-us.catapultsports.com/api/v6',
  eu: 'https://connect-eu.catapultsports.com/api/v6',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405);

  // adminClient declared here so the catch can still flip status='error'.
  let adminClient: ReturnType<typeof createClient> | null = null;
  let integrationId: string | null = null;

  try {
    // ── Auth: resolve the caller's club from their JWT ──────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const { integration_id } = await req.json().catch(() => ({}));
    if (!integration_id) return json({ error: 'integration_id is required' }, 400);
    integrationId = integration_id;

    const { data: callerClub } = await userClient.rpc('get_user_club_id');
    if (!callerClub) return json({ error: 'No club found for caller' }, 403);

    // ── Admin client: read the secret + write status (service role only) ────
    adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: integration, error: intErr } = await adminClient
      .from('gps_integrations')
      .select('id, club_id, provider, config')
      .eq('id', integration_id)
      .single();
    if (intErr || !integration) return json({ error: 'Integration not found' }, 404);

    // AUTHZ: the integration must belong to the caller's club.
    if (integration.club_id !== callerClub) return json({ error: 'Forbidden' }, 403);

    if (integration.provider !== 'catapult') {
      return json({ ok: false, message: 'Verify not supported for this provider yet' });
    }

    const region = (integration.config || {}).region as string | undefined;
    if (!region || !CATAPULT_BASE[region]) return json({ error: 'region not set' }, 400);

    const { data: secretRow } = await adminClient
      .from('gps_integration_secrets')
      .select('credential')
      .eq('integration_id', integration_id)
      .single();
    const credential = secretRow?.credential;
    if (!credential) return json({ error: 'no credential' }, 400);

    // ── Validate the token against the real Catapult API ────────────────────
    const res = await fetch(`${CATAPULT_BASE[region]}/activities`, {
      headers: { Authorization: `Bearer ${credential}` },
    });

    if (res.ok) {
      const activities = await res.json().catch(() => []);
      const activity_count = Array.isArray(activities) ? activities.length : 0;
      await adminClient.from('gps_integrations')
        .update({ status: 'connected', connected_at: new Date().toISOString(), last_error: null })
        .eq('id', integration_id);
      return json({ ok: true, status: 'connected', activity_count });
    }

    await adminClient.from('gps_integrations')
      .update({ status: 'error', last_error: `HTTP ${res.status}` })
      .eq('id', integration_id);
    return json({ ok: false, status: 'error', http_status: res.status });

  } catch (err) {
    const message = String((err as Error)?.message || err);
    if (adminClient && integrationId) {
      await adminClient.from('gps_integrations')
        .update({ status: 'error', last_error: message })
        .eq('id', integrationId);
    }
    return json({ ok: false, status: 'error', error: message }, 502);
  }
});
