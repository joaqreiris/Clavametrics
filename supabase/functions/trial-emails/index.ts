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

const FROM     = Deno.env.get('EMAIL_FROM')     || 'Joaquín Reiris <joaquin@clavametrics.app>';
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

const PIE = {
  es: '\n\n—\nSi no querés recibir más avisos sobre tu prueba, respondé BAJA a este mail y no te escribo más.',
  en: '\n\n—\nIf you would rather not get these trial reminders, reply STOP and I will not write again.',
  pt: '\n\n—\nSe preferir não receber mais avisos sobre o teste, responda SAIR e não escrevo mais.',
};

/** Los textos. Se arman acá y no en una plantilla de Resend para que vivan en el
 *  repositorio: un cambio de texto se revisa como cualquier otro cambio. */
function redactar(kind: Kind, f: Fila, lang: 'es' | 'en' | 'pt') {
  const nombre = String(f.contact_name || '').trim().split(/\s+/)[0] || '';
  const club   = f.club_name || '';
  const quedan = f.days_left ?? 0;

  const T: Record<Kind, Record<string, { subject: string; text: string }>> = {
    d2_sin_plantel: {
      es: { subject: '¿Te doy una mano con el plantel?',
            text: `Hola ${nombre},\n\nVi que creaste ${club} en ClavaMetrics hace un par de días pero todavía no cargaste jugadores. Te escribo porque ese primer paso es el que más cuesta y el que hace que todo lo demás tenga sentido: sin plantel, la app no te puede mostrar nada.\n\nSi me pasás tu lista en Excel, la dejo cargada yo y la tenés lista hoy. O si preferís, nos conectamos 15 minutos y lo hacemos juntos.\n\n¿Cuál te sirve más?\n\nJoaquín` },
      en: { subject: 'Want a hand loading your squad?',
            text: `Hi ${nombre},\n\nI saw you created ${club} on ClavaMetrics a couple of days ago but haven't added any players yet. I'm writing because that first step is the hardest one, and the one that makes everything else work: with no squad, the app has nothing to show you.\n\nSend me your list in Excel and I'll load it for you today. Or if you prefer, let's jump on a 15-minute call and do it together.\n\nWhich works better?\n\nJoaquín` },
      pt: { subject: 'Quer uma ajuda para carregar o elenco?',
            text: `Olá ${nombre},\n\nVi que você criou o ${club} no ClavaMetrics há alguns dias, mas ainda não cadastrou jogadores. Escrevo porque esse primeiro passo é o que mais custa e o que faz todo o resto ter sentido: sem elenco, o app não tem o que mostrar.\n\nSe me enviar sua lista em Excel, eu carrego e você já a tem hoje. Ou, se preferir, marcamos 15 minutos e fazemos juntos.\n\nO que funciona melhor?\n\nJoaquín` },
    },
    d7_frenado: {
      es: { subject: `${club}: el siguiente paso`,
            text: `Hola ${nombre},\n\nYa tenés el plantel cargado — bien ahí. El siguiente paso que le sirve a casi todos los clubes es planificar una semana de trabajo y que los jugadores empiecen a responder el wellness: con tres o cuatro días de datos ya empezás a ver quién llega bien al partido y quién no.\n\nTe quedan ${quedan} días de prueba. ¿Querés que te muestre cómo dejarlo andando en 20 minutos?\n\nJoaquín` },
      en: { subject: `${club}: the next step`,
            text: `Hi ${nombre},\n\nYour squad is loaded — nice work. The next step that helps almost every club is planning a week of training and getting players to fill in their wellness: with three or four days of data you start seeing who is arriving at the match in good shape and who isn't.\n\nYou have ${quedan} days left on your trial. Want me to show you how to get it running in 20 minutes?\n\nJoaquín` },
      pt: { subject: `${club}: o próximo passo`,
            text: `Olá ${nombre},\n\nSeu elenco já está carregado — muito bom. O próximo passo que ajuda quase todos os clubes é planejar uma semana de trabalho e fazer os jogadores responderem o wellness: com três ou quatro dias de dados você já começa a ver quem chega bem para o jogo e quem não.\n\nFaltam ${quedan} dias de teste. Quer que eu mostre como deixar isso rodando em 20 minutos?\n\nJoaquín` },
    },
    d12_propuesta: {
      es: { subject: `Cómo sigue ${club} después de la prueba`,
            text: `Hola ${nombre},\n\nEn ${quedan} días termina tu prueba. Te escribo para que no te agarre de sorpresa y para contarte cómo sigue.\n\nPor lo que vi, ${club} está trabajando con ${f.players} jugadores en ${f.teams} ${f.teams === 1 ? 'categoría' : 'categorías'}. Los planes se pagan por categoría y no por club entero, así que si el año que viene sumás la femenina, sumás solo esa.\n\nSi querés que lo repasemos juntos antes de decidir, decime y coordinamos una llamada corta.\n\nJoaquín` },
      en: { subject: `What happens to ${club} after the trial`,
            text: `Hi ${nombre},\n\nYour trial ends in ${quedan} days. I'm writing so it doesn't catch you by surprise, and to tell you how it continues.\n\nFrom what I can see, ${club} is working with ${f.players} players across ${f.teams} ${f.teams === 1 ? 'squad' : 'squads'}. Plans are paid per squad rather than per club, so if you add the women's team next year, you only add that one.\n\nIf you'd like to go over it together before deciding, tell me and we'll set up a short call.\n\nJoaquín` },
      pt: { subject: `Como o ${club} segue depois do teste`,
            text: `Olá ${nombre},\n\nSeu teste termina em ${quedan} dias. Escrevo para que não te pegue de surpresa e para contar como segue.\n\nPelo que vi, o ${club} está trabalhando com ${f.players} jogadores em ${f.teams} ${f.teams === 1 ? 'categoria' : 'categorias'}. Os planos se pagam por categoria e não pelo clube inteiro, então se no ano que vem somar o feminino, soma só ele.\n\nSe quiser revisar isso junto antes de decidir, me diga e marcamos uma ligação curta.\n\nJoaquín` },
    },
    d15_vence: {
      es: { subject: 'Hoy termina tu prueba',
            text: `Hola ${nombre},\n\nHoy vence la prueba de ${club}. Tus datos no se borran: quedan guardados y si activás un plan más adelante está todo donde lo dejaste.\n\nSi te faltó tiempo para probarlo de verdad, contestá este mail y te extiendo la prueba una semana más, sin vueltas. Y si decidiste que no es para ustedes, también me sirve saberlo: me ayuda a entender qué nos falta.\n\nGracias por probarlo.\n\nJoaquín` },
      en: { subject: 'Your trial ends today',
            text: `Hi ${nombre},\n\nThe ${club} trial ends today. Your data isn't deleted: it stays where it is, and if you activate a plan later everything is exactly as you left it.\n\nIf you didn't get enough time to really try it, reply to this email and I'll extend the trial another week, no strings. And if you decided it isn't for you, that's worth knowing too — it helps me understand what we're missing.\n\nThanks for giving it a go.\n\nJoaquín` },
      pt: { subject: 'Seu teste termina hoje',
            text: `Olá ${nombre},\n\nHoje vence o teste do ${club}. Seus dados não são apagados: ficam guardados e, se ativar um plano mais adiante, está tudo onde você deixou.\n\nSe faltou tempo para testar de verdade, responda este e-mail e eu estendo o teste por mais uma semana, sem complicação. E se decidiu que não é para vocês, também me serve saber: me ajuda a entender o que falta.\n\nObrigado por testar.\n\nJoaquín` },
    },
  };

  const t = T[kind][lang] || T[kind].es;
  return { subject: t.subject, text: t.text + (PIE[lang] || PIE.es) };
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
        asunto: redactar(p.kind, p.fila, p.lang).subject,
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
    const hechos: unknown[] = [];
    for (const k of kinds) {
      const { subject, text } = redactar(k, ejemplo, lang);
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
    const { subject, text } = redactar(kind, fila, lang);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM, to: [fila.contact_email], reply_to: REPLY_TO, subject, text,
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
