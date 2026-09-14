/**
 * Supabase Edge Function — hubspot-sync
 *
 * Empuja el pipeline comercial a HubSpot: un contacto por club, con el estado de
 * su prueba y su uso real. Reemplaza al ida y vuelta del CSV.
 *
 * Dirección única, a propósito: de ClavaMetrics hacia HubSpot y nunca al revés.
 * El uso del producto lo sabe la app; el CRM es donde se anota la gestión comercial.
 * Si alguien edita "Jugadores cargados" a mano en HubSpot, la próxima corrida lo
 * pisa — y está bien: ese dato no se decide en el CRM.
 *
 * Request (JWT de platform admin, o la service role key para el cron):
 *   POST /hubspot-sync  { "action": "ping" }   → prueba el token y devuelve las
 *                                                propiedades personalizadas que
 *                                                encontró, con su nombre interno
 *   POST /hubspot-sync  { "action": "sync" }   → sincroniza todos los clubes
 *   POST /hubspot-sync  { "action": "sync", "email": "x@y.z" }  → solo ese
 *
 * Response: { ok, ... } con el detalle de lo que hizo.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HUBSPOT_TOKEN
 *
 * Deploy:  supabase functions deploy hubspot-sync
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const HS = 'https://api.hubapi.com';

/** Las propiedades propias, buscadas por la ETIQUETA que se ve en HubSpot.
 *  Buscar por etiqueta y no por nombre interno es a propósito: el nombre interno lo
 *  inventa HubSpot al crearla ("Fin de prueba" puede quedar como fin_de_prueba, o
 *  con un sufijo si ya existía otra igual). La etiqueta es lo que la persona eligió
 *  y lo único que podemos dar por conocido. */
const PROPIAS: Record<string, string> = {
  club_id:    'Club ID',
  salud:      'Salud',
  jugadores:  'Jugadores cargados',
  fin_prueba: 'Fin de prueba',
  etapa:      'Etapa producto',
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

async function hubspot(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(HS + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const texto = await res.text();
  let body: unknown = null;
  try { body = texto ? JSON.parse(texto) : null; } catch { body = texto; }
  return { ok: res.ok, status: res.status, body };
}

/** Nombre interno real de cada propiedad propia, resuelto por su etiqueta.
 *  Si falta el permiso para leer el esquema, se devuelve vacío y el sync manda
 *  solo las propiedades estándar en vez de fallar entero. */
async function resolverPropias(token: string) {
  const r = await hubspot('/crm/v3/properties/contacts', token);
  if (!r.ok) return { mapa: {} as Record<string, string>, error: r.status, faltantes: Object.values(PROPIAS) };

  const existentes = ((r.body as any)?.results || []) as Array<{ name: string; label: string }>;
  const porEtiqueta = new Map(existentes.map(p => [norm(p.label), p.name]));

  const mapa: Record<string, string> = {};
  const faltantes: string[] = [];
  for (const [clave, etiqueta] of Object.entries(PROPIAS)) {
    const nombre = porEtiqueta.get(norm(etiqueta));
    if (nombre) mapa[clave] = nombre; else faltantes.push(etiqueta);
  }
  return { mapa, error: 0, faltantes };
}

type Fila = Record<string, any>;

function propiedadesDe(fila: Fila, mapa: Record<string, string>) {
  const nombre = (fila.contact_name || '').trim();
  const props: Record<string, string> = {
    email: String(fila.contact_email || '').toLowerCase(),
  };
  if (nombre) {
    props.firstname = nombre.split(/\s+/)[0];
    const resto = nombre.split(/\s+/).slice(1).join(' ');
    if (resto) props.lastname = resto;
  }
  if (fila.contact_phone) props.phone    = String(fila.contact_phone);
  if (fila.club_name)     props.company  = String(fila.club_name);
  if (fila.contact_job)   props.jobtitle = String(fila.contact_job);
  if (fila.country)       props.country  = String(fila.country);

  if (mapa.club_id)   props[mapa.club_id]   = String(fila.club_id);
  if (mapa.salud)     props[mapa.salud]     = String(fila.health || '');
  if (mapa.etapa)     props[mapa.etapa]     = String(fila.stage || '');
  if (mapa.jugadores) props[mapa.jugadores] = String(fila.players ?? 0);
  // Las propiedades de fecha de HubSpot son fechas sin hora: se manda YYYY-MM-DD.
  if (mapa.fin_prueba && fila.trial_ends_at) props[mapa.fin_prueba] = String(fila.trial_ends_at).slice(0, 10);

  return props;
}

/** El gateway ya validó la firma del JWT; acá solo se mira qué rol trae. */
function rolDelToken(auth: string | null): string {
  try {
    const jwt = (auth || '').replace(/^Bearer\s+/i, '');
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return String(payload.role || '');
  } catch { return ''; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ ok: false, error: 'method_not_allowed' }, 405);

  const token = Deno.env.get('HUBSPOT_TOKEN');
  if (!token) return json({ ok: false, error: 'falta_hubspot_token' }, 500);

  const url     = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth    = req.headers.get('Authorization');

  // Quién puede pedir esto: el cron (service role) o un platform admin. Un usuario
  // cualquiera con sesión válida no: la lista lleva el contacto de todos los clubes.
  if (rolDelToken(auth) !== 'service_role') {
    const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') || service, {
      global: { headers: { Authorization: auth || '' } }, auth: { persistSession: false },
    });
    const { data: esAdmin } = await comoUsuario.rpc('is_platform_admin');
    if (!esAdmin) return json({ ok: false, error: 'solo_platform_admins' }, 403);
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* sin cuerpo = ping */ }
  const action = String(body.action || 'ping');

  const { mapa, error: errProps, faltantes } = await resolverPropias(token);

  if (action === 'ping') {
    const prueba = await hubspot('/crm/v3/objects/contacts?limit=1', token);
    return json({
      ok: prueba.ok,
      hubspot: prueba.status,
      propiedades_encontradas: mapa,
      propiedades_faltantes: faltantes,
      // 403 acá significa token sin permiso para leer el esquema: se puede
      // sincronizar igual, pero sólo las propiedades estándar.
      esquema_legible: errProps === 0,
    }, prueba.ok ? 200 : 502);
  }

  if (action !== 'sync') return json({ ok: false, error: 'accion_desconocida' }, 400);

  const sb = createClient(url, service, { auth: { persistSession: false } });
  const { data: filas, error } = await sb.rpc('sales_pipeline_rows');
  if (error) return json({ ok: false, error: 'pipeline_falló: ' + error.message }, 500);

  let candidatas = (filas || []) as Fila[];
  if (body.email) candidatas = candidatas.filter(f => String(f.contact_email || '').toLowerCase() === String(body.email).toLowerCase());
  // Un club sin nadie con email (quedó a medio crear) no tiene contacto que sincronizar.
  const conEmail = candidatas.filter(f => f.contact_email);

  const enviados: string[] = [];
  const fallos: unknown[] = [];

  // De a 100, que es el máximo del batch de HubSpot.
  for (let i = 0; i < conEmail.length; i += 100) {
    const lote = conEmail.slice(i, i + 100);
    const r = await hubspot('/crm/v3/objects/contacts/batch/upsert', token, {
      method: 'POST',
      body: JSON.stringify({
        inputs: lote.map(f => ({
          idProperty: 'email',
          id: String(f.contact_email).toLowerCase(),
          properties: propiedadesDe(f, mapa),
        })),
      }),
    });
    if (r.ok) lote.forEach(f => enviados.push(String(f.contact_email)));
    else {
      // Al log además de a la respuesta: cuando esto falla, el mensaje de HubSpot
      // ("property X does not exist", "missing scopes") es lo único que dice qué
      // hacer, y perderlo obliga a adivinar.
      console.error('[hubspot-sync] batch rechazado', r.status, JSON.stringify(r.body).slice(0, 900));
      fallos.push({ status: r.status, detalle: r.body });
    }
  }

  return json({
    ok: fallos.length === 0,
    sincronizados: enviados.length,
    total_clubes: candidatas.length,
    sin_email: candidatas.length - conEmail.length,
    propiedades_faltantes: faltantes,
    fallos,
  });
});
