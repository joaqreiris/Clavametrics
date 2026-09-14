/**
 * Supabase Edge Function — email-unsubscribe
 *
 * El enlace de baja de los mails de la prueba. Sin login: quien recibe el correo
 * no tiene por qué entrar a la app para dejar de recibirlo.
 *
 * Dos usos:
 *   GET  ?t=<token>   → la persona hizo clic; devuelve una página de confirmación
 *   POST ?t=<token>   → Gmail y Outlook llaman así a su propio botón "Cancelar
 *                       suscripción" (List-Unsubscribe-Post, un clic); responde JSON
 *
 * Es idempotente: abrirlo dos veces no es un error. Y un token desconocido tampoco
 * dice "ese token no existe" con detalle — no hay nada que ganar dándole pistas a
 * quien esté probando tokens al azar.
 *
 * Deploy: supabase functions deploy email-unsubscribe --no-verify-jwt
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function pagina(titulo: string, cuerpo: string) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${titulo} — ClavaMetrics</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#0f1117; color:#e8eaed;
         font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; padding:24px; }
  .caja { max-width:460px; text-align:center; }
  .marca { font:700 15px/1 sans-serif; color:#22c55e; letter-spacing:.02em; margin-bottom:28px; }
  h1 { font-size:21px; margin:0 0 12px; font-weight:600; }
  p { color:#9aa0a6; margin:0 0 10px; font-size:14.5px; }
  a { color:#22c55e; text-decoration:none; font-size:14px; display:inline-block; margin-top:20px; }
</style></head><body><div class="caja">
<div class="marca">ClavaMetrics</div>
<h1>${titulo}</h1>
${cuerpo}
<a href="https://clavametrics.app">Ir a clavametrics.app</a>
</div></body></html>`;
}

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url   = new URL(req.url);
  const token = url.searchParams.get('t') || '';
  const esPost = req.method === 'POST';

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
                          { auth: { persistSession: false } });

  const { data, error } = await sb.rpc('unsubscribe_trial_emails', { p_token: token });
  const ok = !error && (data as any)?.ok === true;

  // El botón nativo del cliente de correo espera una respuesta corta, no una página.
  if (esPost) {
    return new Response(JSON.stringify({ ok }), {
      status: ok ? 200 : 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (!ok) {
    return html(pagina('No pudimos procesar la baja',
      `<p>Es posible que el enlace esté incompleto o que sea muy antiguo.</p>
       <p>Escríbenos a <strong>info@clavametrics.app</strong> y lo resolvemos.</p>`), 400);
  }

  return html(pagina('Listo, no te escribiremos más',
    `<p>No volverás a recibir los correos de seguimiento de la prueba.</p>
     <p>Esto no afecta a tu cuenta ni a tus datos: todo sigue donde estaba.</p>`));
});
