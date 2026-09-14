/**
 * Supabase Edge Function — trial-emails
 *
 * Los cuatro mails que acompañan una prueba: el que rescata al club que no cargó
 * el plantel, el que desatasca al que se frenó, la propuesta y el aviso de que
 * vence. Los manda por Resend, en el idioma en el que la persona usa la app.
 *
 * Son mails de SERVICIO, no de marketing: acompañan una prueba que la persona
 * inició. Por eso no dependen de `marketing_opt_in`. Lo que sí respetan es
 * clubs.trial_emails_opt_out, que se marca cuando alguien pide que no le escriban.
 *
 * Texto plano y remitente persona, a propósito: un mail que parece software se
 * ignora, uno que parece de alguien se contesta. Sin pixel de apertura y sin links
 * reescritos — eso es justo lo que hace que Gmail lo mande a Promociones.
 *
 * Request (service role key, o JWT de platform admin):
 *   POST /trial-emails { "action": "dry_run" }   → a quién le tocaría, sin mandar
 *   POST /trial-emails { "action": "send" }      → manda de verdad
 *   POST /trial-emails { "action": "send", "only": "d2_sin_plantel" }
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
 *          EMAIL_FROM (opcional), EMAIL_REPLY_TO (opcional)
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const FROM     = Deno.env.get('EMAIL_FROM')     || 'ClavaMetrics <info@clavametrics.app>';
const REPLY_TO = Deno.env.get('EMAIL_REPLY_TO') || 'info@clavametrics.app';

/** Cuentas internas: los clubes de demo y de prueba no se mandan mails a sí mismos. */
const INTERNOS = [
  'info@clavametrics.app', 'joaqreiris@gmail.com',
  'reiris.joaquin@gmail.com', 'joaqreiris@outlook.com',
];

type Fila = Record<string, any>;
type Kind = 'd2_sin_plantel' | 'd7_frenado' | 'd12_propuesta' | 'd15_vence';

const dias = (desde: string) => Math.floor((Date.now() - new Date(desde).getTime()) / 86400000);

/** A quién le toca hoy, y sólo uno por club: si alguien entra en dos reglas el mismo
 *  día, manda la más urgente. Dos mails nuestros en la misma bandeja el mismo día
 *  no son el doble de atención, son la mitad. */
function queMailLeToca(f: Fila): Kind | null {
  if (f.stage !== 'trial') return null;
  const edad = dias(f.created_at);

  // Las 48 horas que deciden todo: sin plantel cargado no hay nada que ver adentro.
  if (f.players === 0 && edad >= 2 && edad <= 6) return 'd2_sin_plantel';

  // Vence: el último día, o el día después si el cron no llegó a tiempo.
  if (f.days_left !== null && f.days_left <= 0 && f.days_left >= -1) return 'd15_vence';

  // La propuesta llega antes del final, con tiempo de decidir y de contestar. Sólo
  // a quien llegó a usar la app: el texto habla de cuántos jugadores y categorías
  // tiene, y mandárselo a un club vacío sería anunciarle "0 jugadores en 0
  // categorías". A ese le toca el aviso de vencimiento, que no presume nada.
  if (f.players > 0 && f.days_left !== null && f.days_left >= 2 && f.days_left <= 4) return 'd12_propuesta';

  // Cargó el plantel pero no llegó a planificar nada.
  if (f.players > 0 && edad >= 6 && edad <= 11 && (f.sessions === 0 || f.events_7d === 0)) return 'd7_frenado';

  return null;
}

/** El pie con el enlace de baja. Un clic, sin login y sin tener que escribir nada:
 *  pedir que alguien responda una palabra para dejar de recibir correos es ponerle
 *  un trámite a lo único que siempre debería ser fácil. */
const PIE: Record<string, (url: string) => string> = {
  es: (u) => `\n\n—\nSi prefieres no recibir más correos sobre la prueba, date de baja aquí:\n${u}`,
  en: (u) => `\n\n—\nIf you would rather not get these trial emails, unsubscribe here:\n${u}`,
  pt: (u) => `\n\n—\nSe preferir não receber mais e-mails sobre o teste, cancele aqui:\n${u}`,
};

/** La página de baja vive en nuestro dominio; la función que hace el trabajo queda
 *  detrás. Un enlace a supabase.co en el pie de un correo no invita a hacer clic. */
const urlBaja = (token: string, lang: string) =>
  `https://clavametrics.app/baja.html?t=${token}&lang=${lang}`;

/** Lo que Gmail y Outlook usan para su propio botón "Cancelar suscripción". Va
 *  directo a la función, que acepta el POST de un clic sin abrir el navegador.
 *  Además es lo que le dice al buzón que esto no es correo no deseado. */
const cabecerasBaja = (token: string) => ({
  'List-Unsubscribe': `<https://xesrumijvdmqjrufgeka.supabase.co/functions/v1/email-unsubscribe?t=${token}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
});

/** Los textos. Se arman acá y no en una plantilla de Resend para que vivan en el
 *  repositorio: un cambio de texto se revisa como cualquier otro cambio. */
function redactar(kind: Kind, f: Fila, lang: 'es' | 'en' | 'pt', token = '') {
  const nombre = String(f.contact_name || '').trim().split(/\s+/)[0] || '';
  const club   = f.club_name || '';
  const quedan = f.days_left ?? 0;

  const T: Record<Kind, Record<string, { subject: string; text: string }>> = {
    d2_sin_plantel: {
      es: { subject: '¿Te ayudamos a cargar tus jugadores?',
            text: `Hola ${nombre},\n\nVimos que creaste ${club} en ClavaMetrics hace un par de días, pero todavía no has cargado jugadores. Te escribimos porque ese primer paso es el que más cuesta y el que hace que todo lo demás tenga sentido: sin jugadores, la aplicación no puede mostrarte nada.\n\nSi nos envías tu lista en Excel, la dejamos cargada y la tienes lista hoy. O, si lo prefieres, nos conectamos 15 minutos y lo hacemos juntos.\n\n¿Qué te resulta más cómodo?\n\nEl equipo de ClavaMetrics`},
      en: { subject: 'Want a hand adding your players?',
            text: `Hi ${nombre},\n\nWe saw you created ${club} on ClavaMetrics a couple of days ago, but no players have been added yet. We are writing because that first step is the hardest one, and the one that makes everything else work: with no players, the app has nothing to show you.\n\nSend us your list in Excel and we will load it for you today. Or, if you prefer, let's take 15 minutes and do it together.\n\nWhich works better for you?\n\nThe ClavaMetrics team`},
      pt: { subject: 'Podemos ajudar a cadastrar seus jogadores?',
            text: `Olá ${nombre},\n\nVimos que você criou o ${club} no ClavaMetrics há alguns dias, mas ainda não cadastrou jogadores. Escrevemos porque esse primeiro passo é o que mais custa e o que faz todo o resto ter sentido: sem jogadores, o aplicativo não tem o que mostrar.\n\nSe nos enviar sua lista em Excel, nós a cadastramos e você já a tem hoje. Ou, se preferir, marcamos 15 minutos e fazemos juntos.\n\nO que é mais cômodo para você?\n\nA equipe ClavaMetrics`},
    },
    d7_frenado: {
      es: { subject: `${club}: el siguiente paso`,
            text: `Hola ${nombre},\n\nYa tienes los jugadores cargados. El siguiente paso que ayuda a casi todos los clubes es planificar una semana de trabajo y que los jugadores empiecen a responder el wellness: con tres o cuatro días de datos ya se ve quién llega bien al partido y quién no.\n\nTe quedan ${quedan} días de prueba. ¿Quieres que te mostremos cómo dejarlo funcionando en 20 minutos?\n\nEl equipo de ClavaMetrics`},
      en: { subject: `${club}: the next step`,
            text: `Hi ${nombre},\n\nYour players are in. The next step that helps almost every club is planning a week of training and getting players to fill in their wellness: with three or four days of data you start to see who is arriving at the match in good shape and who is not.\n\nYou have ${quedan} days left on your trial. Would you like us to show you how to get it running in 20 minutes?\n\nThe ClavaMetrics team`},
      pt: { subject: `${club}: o próximo passo`,
            text: `Olá ${nombre},\n\nSeus jogadores já estão cadastrados. O próximo passo que ajuda quase todos os clubes é planejar uma semana de trabalho e fazer os jogadores responderem o wellness: com três ou quatro dias de dados já se vê quem chega bem para o jogo e quem não.\n\nFaltam ${quedan} dias de teste. Quer que mostremos como deixar isso funcionando em 20 minutos?\n\nA equipe ClavaMetrics`},
    },
    d12_propuesta: {
      es: { subject: `Cómo continúa ${club} después de la prueba`,
            text: `Hola ${nombre},\n\nEn ${quedan} días termina tu prueba. Te escribimos para que no te tome por sorpresa y para contarte cómo continúa.\n\nPor lo que vemos, ${club} está trabajando con ${f.players} jugadores en ${f.teams} ${f.teams === 1 ? 'categoría' : 'categorías'}. Los planes se pagan por categoría y no por club entero, así que si el año próximo añades la femenina, añades solo esa.\n\nSi quieres que lo repasemos juntos antes de decidir, responde a este correo y coordinamos una llamada corta.\n\nEl equipo de ClavaMetrics`},
      en: { subject: `What happens to ${club} after the trial`,
            text: `Hi ${nombre},\n\nYour trial ends in ${quedan} days. We are writing so it does not catch you by surprise, and to explain how it continues.\n\nFrom what we can see, ${club} is working with ${f.players} players across ${f.teams} ${f.teams === 1 ? 'squad' : 'squads'}. Plans are paid per squad rather than per club, so if you add the women's team next year, you only add that one.\n\nIf you would like to go over it together before deciding, reply to this email and we will set up a short call.\n\nThe ClavaMetrics team`},
      pt: { subject: `Como o ${club} continua depois do teste`,
            text: `Olá ${nombre},\n\nEm ${quedan} dias termina seu teste. Escrevemos para que não te pegue de surpresa e para contar como continua.\n\nPelo que vemos, o ${club} está trabalhando com ${f.players} jogadores em ${f.teams} ${f.teams === 1 ? 'categoria' : 'categorias'}. Os planos são pagos por categoria e não pelo clube inteiro, então se no ano que vem você adicionar o feminino, adiciona só ele.\n\nSe quiser revisar isso conosco antes de decidir, responda este e-mail e marcamos uma ligação curta.\n\nA equipe ClavaMetrics`},
    },
    d15_vence: {
      es: { subject: 'Hoy termina tu prueba',
            text: `Hola ${nombre},\n\nHoy termina la prueba de ${club}. Tus datos no se borran: quedan guardados y, si activas un plan más adelante, está todo donde lo dejaste.\n\nSi te faltó tiempo para probarlo de verdad, responde a este correo y ampliamos la prueba una semana más. Y si has decidido que no es para ustedes, también nos sirve saberlo: nos ayuda a entender qué nos falta.\n\nGracias por probarlo.\n\nEl equipo de ClavaMetrics`},
      en: { subject: 'Your trial ends today',
            text: `Hi ${nombre},\n\nThe ${club} trial ends today. Your data is not deleted: it stays where it is, and if you activate a plan later everything is exactly as you left it.\n\nIf you did not get enough time to really try it, reply to this email and we will extend the trial for another week. And if you decided it is not for you, that is worth knowing too: it helps us understand what we are missing.\n\nThank you for giving it a go.\n\nThe ClavaMetrics team`},
      pt: { subject: 'Hoje termina seu teste',
            text: `Olá ${nombre},\n\nHoje termina o teste do ${club}. Seus dados não são apagados: ficam guardados e, se ativar um plano mais adiante, está tudo onde você deixou.\n\nSe faltou tempo para testar de verdade, responda este e-mail e ampliamos o teste por mais uma semana. E se decidiu que não é para vocês, também nos serve saber: ajuda a entender o que falta.\n\nObrigado por testar.\n\nA equipe ClavaMetrics`},
    },
  };

  const t = T[kind][lang] || T[kind].es;
  const pie = token ? (PIE[lang] || PIE.es)(urlBaja(token, lang)) : '';
  return { subject: t.subject, text: t.text + pie };
}

function rolDelToken(auth: string | null): string {
  try {
    const jwt = (auth || '').replace(/^Bearer\s+/i, '');
    return String(JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role || '');
  } catch { return ''; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ ok: false, error: 'method_not_allowed' }, 405);

  const url     = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth    = req.headers.get('Authorization');

  if (rolDelToken(auth) !== 'service_role') {
    const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') || service, {
      global: { headers: { Authorization: auth || '' } }, auth: { persistSession: false },
    });
    const { data: esAdmin } = await comoUsuario.rpc('is_platform_admin');
    if (!esAdmin) return json({ ok: false, error: 'solo_platform_admins' }, 403);
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* sin cuerpo = dry_run */ }
  const action = String(body.action || 'dry_run');
  const only   = body.only ? String(body.only) : null;

  const sb = createClient(url, service, { auth: { persistSession: false } });
  const { data: filas, error } = await sb.rpc('sales_pipeline_rows');
  if (error) return json({ ok: false, error: 'pipeline_falló: ' + error.message }, 500);

  // Lo ya enviado, para no repetir. Se mira acá además del unique de la tabla: así
  // el dry_run muestra la lista real y no una que incluye mails que no van a salir.
  const { data: enviados } = await sb.from('trial_emails').select('club_id, kind');
  const yaFue = new Set((enviados || []).map((e: any) => e.club_id + '|' + e.kind));

  // El token de baja de cada club. No va en sales_pipeline_rows() porque ahí no
  // pinta nada: es un dato del envío, no del estado comercial del club.
  const { data: tokens } = await sb.from('clubs').select('id, unsubscribe_token');
  const tokenDe = new Map((tokens || []).map((c: any) => [c.id, c.unsubscribe_token]));

  const pendientes: Array<{ fila: Fila; kind: Kind; lang: 'es'|'en'|'pt' }> = [];
  for (const f of (filas || []) as Fila[]) {
    if (!f.contact_email) continue;
    if (f.emails_opt_out) continue;
    if (INTERNOS.includes(String(f.contact_email).toLowerCase())) continue;

    const kind = queMailLeToca(f);
    if (!kind) continue;
    if (only && kind !== only) continue;
    if (yaFue.has(f.club_id + '|' + kind)) continue;

    const lang = (['es','en','pt'].includes(f.contact_lang) ? f.contact_lang : 'es') as 'es'|'en'|'pt';
    pendientes.push({ fila: f, kind, lang });
  }

  if (action === 'dry_run') {
    return json({
      ok: true,
      modo: 'dry_run',
      pendientes: pendientes.map(p => ({
        club: p.fila.club_name, email: p.fila.contact_email, kind: p.kind, lang: p.lang,
        asunto: redactar(p.kind, p.fila, p.lang, tokenDe.get(p.fila.club_id)).subject,
      })),
    });
  }
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return json({ ok: false, error: 'falta_resend_api_key' }, 500);

  // Mandarse los mails a uno mismo con datos de ejemplo, para verlos como los va a
  // ver un club. No toca trial_emails: es una prueba, no parte de la cadencia.
  if (action === 'test') {
    const to   = String(body.to || '');
    const lang = (['es','en','pt'].includes(String(body.lang)) ? String(body.lang) : 'es') as 'es'|'en'|'pt';
    const kinds: Kind[] = body.kind
      ? [String(body.kind) as Kind]
      : ['d2_sin_plantel', 'd7_frenado', 'd12_propuesta', 'd15_vence'];
    if (!to) return json({ ok: false, error: 'falta_destinatario' }, 400);

    const ejemplo: Fila = {
      contact_name: 'Ana Pérez', club_name: 'Club Ejemplo', players: 24, teams: 2,
      days_left: 3, created_at: new Date().toISOString(),
    };
    // Token inventado: el pie tiene que verse igual que en el correo real, pero este
    // enlace no da de baja a ningún club de verdad.
    const tokenPrueba = '00000000-0000-0000-0000-000000000000';
    const hechos: unknown[] = [];
    for (const k of kinds) {
      const { subject, text } = redactar(k, ejemplo, lang, tokenPrueba);
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject: '[PRUEBA] ' + subject, text }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) console.error('[trial-emails] prueba rechazada', res.status, JSON.stringify(out).slice(0, 400));
      hechos.push({ kind: k, ok: res.ok, detalle: res.ok ? out?.id : out });
    }
    return json({ ok: hechos.every((h: any) => h.ok), modo: 'test', enviados: hechos });
  }

  if (action !== 'send') return json({ ok: false, error: 'accion_desconocida' }, 400);

  const resultados: unknown[] = [];
  for (const { fila, kind, lang } of pendientes) {
    const token = tokenDe.get(fila.club_id) || '';
    const { subject, text } = redactar(kind, fila, lang, token);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM, to: [fila.contact_email], reply_to: REPLY_TO, subject, text,
          headers: cabecerasBaja(token),
        }),
      });
      const out = await res.json().catch(() => ({}));

      // Se registra el intento SIEMPRE, salga bien o mal. Si sólo se anotaran los
      // éxitos, un fallo repetido volvería a intentarlo cada noche para siempre.
      await sb.from('trial_emails').insert({
        club_id: fila.club_id, kind, email: fila.contact_email, lang,
        resend_id: out?.id || null,
        status: res.ok ? 'sent' : 'failed',
        error: res.ok ? null : JSON.stringify(out).slice(0, 500),
      });

      if (!res.ok) console.error('[trial-emails] Resend rechazó', res.status, JSON.stringify(out).slice(0, 400));
      resultados.push({ club: fila.club_name, kind, ok: res.ok });
    } catch (e) {
      console.error('[trial-emails] no se pudo enviar:', String(e));
      resultados.push({ club: fila.club_name, kind, ok: false, error: String(e) });
    }
  }

  return json({ ok: true, enviados: resultados.filter((r: any) => r.ok).length, detalle: resultados });
});
