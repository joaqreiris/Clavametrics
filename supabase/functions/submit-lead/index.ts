/**
 * Supabase Edge Function — submit-lead
 *
 * Recibe el formulario de demo de Contact.html y lo guarda en public.leads.
 *
 * Por qué una función y no un insert desde el navegador: la tabla no tiene policy
 * de INSERT (ver migración 154). Si la tuviera para anon, cualquiera con la clave
 * publicable —que está a la vista en el HTML— podría llenar la tabla de basura sin
 * pasar por la validación. Acá entra con service role, después de tres filtros:
 * honeypot, validación y límite de envíos por origen.
 *
 * Request:
 *   POST /submit-lead
 *   { name, email, phone?, club?, role?, sport?, size?, message?, lang?,
 *     website?,                  ← honeypot: si viene con algo, es un bot
 *     leadSource?: { utm_source, utm_medium, utm_campaign, utm_content,
 *                    utm_term, referrer, landing_page } }
 *
 * Response:
 *   200 { ok:true }              guardado (y también cuando se descarta un bot:
 *                                 decirle que lo detectamos solo lo ayuda a afinar)
 *   400 { ok:false, error }      faltan datos o el email no es un email
 *   429 { ok:false, error }      demasiados envíos desde el mismo origen
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ya seteados),
 *          LEAD_IP_SALT (opcional; sin ella el hash usa el service role como sal)
 *
 * Deploy (tiene que permitir acceso anónimo):
 *   supabase functions deploy submit-lead --no-verify-jwt
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** Recorta y normaliza. Un campo vacío entra como null, no como cadena vacía. */
function txt(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim().slice(0, max);
  return s || null;
}

/** Hash de la IP con sal. No se guarda la IP: solo hace falta reconocer repeticiones. */
async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(salt + '|' + ip);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const MAX_POR_HORA = 5;

/** El lead también va al CRM, que es donde se gestiona el seguimiento.
 *
 *  Se manda DESPUÉS de guardarlo en nuestra base y sin esperar la respuesta: si
 *  HubSpot está caído o el token venció, el pedido ya está a salvo y aparece en el
 *  panel igual. Al revés —mandar primero al CRM y guardar después— un fallo de un
 *  tercero haría perder el lead, que es exactamente lo que veníamos a arreglar.
 *
 *  Sólo propiedades estándar de HubSpot: las personalizadas (Salud, Etapa) describen
 *  un club en prueba y este todavía no tiene cuenta. */
async function aHubspot(lead: Record<string, unknown>) {
  const token = Deno.env.get('HUBSPOT_TOKEN');
  if (!token) return;

  const nombre = String(lead.name || '').trim();
  const props: Record<string, string> = { email: String(lead.email) };
  if (nombre) {
    props.firstname = nombre.split(/\s+/)[0];
    const resto = nombre.split(/\s+/).slice(1).join(' ');
    if (resto) props.lastname = resto;
  }
  if (lead.phone)     props.phone    = String(lead.phone);
  if (lead.club_name) props.company  = String(lead.club_name);
  if (lead.role)      props.jobtitle = String(lead.role);
  if (lead.message)   props.message  = String(lead.message).slice(0, 4000);

  try {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: [{ idProperty: 'email', id: String(lead.email), properties: props }] }),
    });
    if (!res.ok) console.error('[submit-lead] HubSpot rechazó el lead', res.status, (await res.text()).slice(0, 500));
  } catch (e) {
    console.error('[submit-lead] HubSpot no respondió:', String(e));
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ ok: false, error: 'method_not_allowed' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ ok: false, error: 'bad_json' }, 400); }

  // 1. Honeypot. El campo va oculto por CSS: una persona no lo ve y no lo llena.
  //    Se responde 200 para que el bot crea que funcionó y no reintente de otra forma.
  if (txt(body.website, 200)) return json({ ok: true });

  // 2. Validación. Los mismos tres campos que el formulario marca como obligatorios.
  const name  = txt(body.name, 120);
  const email = txt(body.email, 200);
  const club  = txt(body.club, 160);
  if (!name || !email || !club) return json({ ok: false, error: 'missing_fields' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: 'bad_email' }, 400);

  const url     = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(url, service, { auth: { persistSession: false } });

  // 3. Límite por origen. x-forwarded-for puede traer varias IPs encadenadas; la
  //    primera es la del cliente.
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'desconocida';
  const ipHash = await hashIp(ip, Deno.env.get('LEAD_IP_SALT') || service);

  const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await sb.from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', desde);
  if ((count || 0) >= MAX_POR_HORA) return json({ ok: false, error: 'rate_limited' }, 429);

  const src = (body.leadSource && typeof body.leadSource === 'object')
    ? body.leadSource as Record<string, unknown> : {};

  const fila = {
    name,
    email: email.toLowerCase(),
    phone:     txt(body.phone, 40),
    club_name: club,
    role:      txt(body.role, 80),
    sport:     txt(body.sport, 60),
    size:      txt(body.size, 60),
    message:   txt(body.message, 4000),
    lang:      txt(body.lang, 5),
    utm_source:   txt(src.utm_source, 120),
    utm_medium:   txt(src.utm_medium, 120),
    utm_campaign: txt(src.utm_campaign, 120),
    utm_content:  txt(src.utm_content, 120),
    utm_term:     txt(src.utm_term, 120),
    referrer:     txt(src.referrer, 500),
    landing_page: txt(src.landing_page, 500),
    ip_hash: ipHash,
  };

  const { error } = await sb.from('leads').insert(fila);
  if (error) {
    console.error('[submit-lead] insert falló:', error.message);
    return json({ ok: false, error: 'insert_failed' }, 500);
  }

  // En segundo plano: quien mandó el formulario no tiene por qué esperar al CRM.
  try { (globalThis as any).EdgeRuntime?.waitUntil?.(aHubspot(fila)); }
  catch { aHubspot(fila); }

  return json({ ok: true });
});
