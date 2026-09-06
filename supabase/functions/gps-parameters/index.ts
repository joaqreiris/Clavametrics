/**
 * Supabase Edge Function — gps-parameters
 *
 * Lists the metric parameters the club's Catapult account exposes, so the
 * client can map each one to a gps_reports column or a custom metric
 * (gps_column_mappings, source_label='catapult'). Read-only.
 *
 * Mirror of gps-athletes: CORS, userClient per-club authz, adminClient
 * (service role) to read the secret, CATAPULT_BASE per region.
 *
 * Request  (POST JSON): { integration_id }
 * Response (200 JSON):  { ok:true, parameters:[{ id, slug, name }] }
 *                       { ok:false, http_status } | { ok:false, message }
 *
 * Deploy: supabase functions deploy gps-parameters
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const CATAPULT_BASE: Record<string, string> = {
  au: 'https://connect-au.catapultsports.com/api/v6',
  us: 'https://connect-us.catapultsports.com/api/v6',
  eu: 'https://connect-eu.catapultsports.com/api/v6',
};

// Field names vary across OpenField versions — map defensively with fallbacks.
function normalizeParam(p: Record<string, unknown>) {
  const str = (v: unknown) => (v == null ? '' : String(v)).trim();
  // slug | name | parameter (machine key) vs human display name
  const slug = str(p.slug ?? p.name ?? p.parameter ?? p.key ?? p.id);
  return {
    id:   str(p.id ?? p.parameter_id ?? slug),
    slug,
    name: str(p.display_name ?? p.title ?? p.label ?? p.name ?? slug),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405);

  try {
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

    const { data: callerClub } = await userClient.rpc('get_user_club_id');
    if (!callerClub) return json({ error: 'No club found for caller' }, 403);

    // AUTHZ (rol): configurar la integración GPS es de admin + S&C, igual que el canConfig
    // del panel (assets/gps-integrations.js). Hasta ahora alcanzaba con ser miembro del
    // staff: la regla vivía en la UI y no en el servidor. can_configure_gps() (migración
    // 131) mira el rol principal y el secundario; se ajusta en la DB, sin redeploy.
    // Fail-closed: si el chequeo falla, no se sigue.
    const { data: canConfig, error: roleErr } = await userClient.rpc('can_configure_gps');
    if (roleErr) {
      console.error('gps-parameters: role check failed:', roleErr.message);
      return json({ error: 'Could not verify your permissions. Try again in a moment.' }, 503);
    }
    if (!canConfig) return json({ error: 'Forbidden: only admins and S&C staff can configure the GPS integration' }, 403);

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: integration, error: intErr } = await adminClient
      .from('gps_integrations').select('id, club_id, provider, config').eq('id', integration_id).single();
    if (intErr || !integration) return json({ error: 'Integration not found' }, 404);
    if (integration.club_id !== callerClub) return json({ error: 'Forbidden' }, 403);
    if (integration.provider !== 'catapult') return json({ ok: false, message: 'Not supported for this provider yet' });

    const region = (integration.config || {}).region as string | undefined;
    if (!region || !CATAPULT_BASE[region]) return json({ error: 'region not set' }, 400);

    const { data: secretRow } = await adminClient
      .from('gps_integration_secrets').select('credential').eq('integration_id', integration_id).single();
    const credential = secretRow?.credential;
    if (!credential) return json({ error: 'no credential' }, 400);

    const res = await fetch(`${CATAPULT_BASE[region]}/parameters`, {
      headers: { Authorization: `Bearer ${credential}` },
    });
    if (!res.ok) return json({ ok: false, http_status: res.status });

    const raw = await res.json().catch(() => []);
    const list = Array.isArray(raw) ? raw : [];
    const parameters = list.map(normalizeParam).filter(p => p.slug);

    return json({ ok: true, parameters });

  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message || err) }, 502);
  }
});
