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

// ── Cupo ────────────────────────────────────────────────────────────────────
// verify es la única de las tres funciones GPS que ESCRIBE (status/last_error) y cada
// llamada gasta una petición contra la API del proveedor con el token del club. El cupo
// diario por club lo lleva la DB (`ai_rate_limit_take`, migraciones 129/131), sobre una
// tabla que el cliente no puede leer ni escribir. Fail-closed.
async function takeQuota(userClient: any, fn: string): Promise<Response | null> {
  const { data, error } = await userClient.rpc('ai_rate_limit_take', { p_fn: fn });
  if (error) {
    console.error(`${fn}: rate limit check failed:`, error.message);
    return json({ error: 'Could not verify the daily limit. Try again in a moment.' }, 503);
  }
  if (!data?.allowed) {
    if (data?.reason === 'no_club') return json({ error: 'Your user is not linked to a club.' }, 403);
    return json({
      error: `Daily limit reached (${data?.limit} checks/day for the club). Try again tomorrow.`,
      used: data?.used, limit: data?.limit,
    }, 429);
  }
  return null;
}

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

    // AUTHZ (rol): configurar la integración GPS es de admin + S&C, igual que el canConfig
    // del panel (assets/gps-integrations.js). Hasta ahora alcanzaba con ser miembro del
    // staff: la regla vivía en la UI y no en el servidor. can_configure_gps() (migración
    // 131) mira el rol principal y el secundario; se ajusta en la DB, sin redeploy.
    // Fail-closed: si el chequeo falla, no se sigue.
    const { data: canConfig, error: roleErr } = await userClient.rpc('can_configure_gps');
    if (roleErr) {
      console.error('gps-verify: role check failed:', roleErr.message);
      return json({ error: 'Could not verify your permissions. Try again in a moment.' }, 503);
    }
    if (!canConfig) return json({ error: 'Forbidden: only admins and S&C staff can configure the GPS integration' }, 403);

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

    // Recién acá se consume cupo: un pedido inválido (sin región, sin credencial) no gasta.
    const denied = await takeQuota(userClient, 'gps-verify');
    if (denied) return denied;

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
