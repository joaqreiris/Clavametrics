/**
 * Supabase Edge Function — share-video
 *
 * Vista pública, sin login, de UN envío de video a UN jugador (video_shares),
 * direccionada por su token. Las RLS de video_shares / video_share_items / videos
 * siguen cerradas al staff; esta función usa el service role y devuelve el envío
 * SOLO cuando token = token AND revoked = false AND (expires_at es null o futuro).
 *
 * Devuelve lo mínimo que la página del jugador necesita: su nombre y número, el
 * mensaje del cuerpo técnico y, por cada corte, título + comentario + URL para
 * abrir en Drive/Dropbox + URL embebible cuando el proveedor la tiene. Nada de
 * ids internos, emails ni datos del club más allá del nombre.
 *
 * Request:
 *   GET  /share-video?token=<uuid>
 *   POST /share-video   { "token":"<uuid>" }                    → mismo payload
 *   POST /share-video   { "token":"<uuid>", "action":"open" }   → cuenta la apertura
 *   POST /share-video   { "token":"<uuid>", "action":"seen", "value":true|false }
 *   POST /share-video   { "token":"<uuid>", "action":"progress", "session":"<id>",
 *                         "items":[{ index, watched, position, duration, completed,
 *                                    visible, plays, tracking }] }   → visionado por corte
 *
 * El progreso llega por índice de corte, no por video_id: la página del jugador
 * nunca ve ids internos y no hace falta que empiece ahora. Los valores son el
 * ACUMULADO de la apertura en curso (session), no incrementos, así que un beat
 * perdido o repetido no descuadra la cuenta.
 * Response (200 JSON):
 *   { found:false }
 *   { found:true, share:{…} }
 *
 * Secrets (ya seteados para todas las funciones):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Deploy (tiene que permitir acceso anónimo):
 *   supabase functions deploy share-video --no-verify-jwt
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type VideoRow = {
  id: string; title: string | null; provider: string; url: string; kind: string;
  external_id: string | null; thumbnail_url: string | null; duration_seconds: number | null;
};

function driveFileId(v: VideoRow): string | null {
  if (v.external_id) return v.external_id;
  const u = v.url || '';
  return (u.match(/\/file\/d\/([^/]+)/) || u.match(/[?&]id=([^&]+)/) || u.match(/\/d\/([^/]+)/) || [])[1] || null;
}
function driveFolderId(v: VideoRow): string | null {
  const m = (v.url || '').match(/\/folders\/([^/?#]+)/);
  return m ? m[1] : null;
}

/**
 * Cómo se embebe cada corte: 'frame' es el reproductor de un tercero dentro de un
 * <iframe>, 'file' es el archivo servido en crudo, que va en un <video> nuestro.
 *
 * La diferencia no es cosmética: dentro del iframe de Drive no hay forma de saber
 * si el jugador reprodujo algo, y con un <video> propio se mide todo. Por eso
 * Dropbox pasó de iframe a archivo — es el mismo criterio que media-embed.js usa
 * en el resto de la app, y de paso arregla el reproductor corrido de Safari.
 */
function embedKind(v: VideoRow): 'frame' | 'file' | null {
  if (v.kind === 'folder') return v.provider === 'google_drive' ? 'frame' : null;
  if (v.provider === 'youtube' || v.provider === 'vimeo' || v.provider === 'google_drive') return 'frame';
  if (v.provider === 'dropbox') return isDropboxFolder(v.url) ? null : 'file';
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(v.url || '') ? 'file' : null;
}

/** Las carpetas compartidas de Dropbox no son un archivo: no hay nada que reproducir. */
function isDropboxFolder(url: string): boolean {
  return /dropbox\.com\/(?:scl\/fo\/|sh\/)/i.test(url || '');
}

/** URL embebible (o null cuando el proveedor no la tiene). Espeja embedUrl() de Video Detail. */
function embedUrl(v: VideoRow, start?: number | null): string | null {
  const t = start && start > 0 ? Math.floor(start) : 0;
  if (v.kind === 'folder') {
    if (v.provider === 'google_drive') { const fid = driveFolderId(v); return fid ? `https://drive.google.com/embeddedfolderview?id=${fid}#grid` : null; }
    return null;
  }
  if (v.provider === 'youtube') {
    const yid = v.external_id || (v.url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/) || [])[1];
    // enablejsapi: sin esto la IFrame API no puede leer el progreso del reproductor.
    return yid ? `https://www.youtube.com/embed/${yid}?rel=0&playsinline=1&enablejsapi=1${t ? `&start=${t}` : ''}` : null;
  }
  if (v.provider === 'vimeo') {
    const vid = v.external_id || (v.url.match(/vimeo\.com\/(?:video\/)?(\d+)/) || [])[1];
    return vid ? `https://player.vimeo.com/video/${vid}${t ? `#t=${t}s` : ''}` : null;
  }
  if (v.provider === 'google_drive') { const fid = driveFileId(v); return fid ? `https://drive.google.com/file/d/${fid}/preview` : null; }
  if (v.provider === 'dropbox') {
    const u = v.url || ''; if (!u || isDropboxFolder(u)) return null;
    // El host de descarga directa sirve el archivo con Range, que es lo que el
    // <video> necesita para buscar dentro del clip.
    return u.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/([?&])dl=\d/, '$1raw=1');
  }
  return v.url || null;
}

/** URL para abrir en el proveedor, saltando al segundo marcado cuando se puede. */
function openUrl(v: VideoRow, start?: number | null): string {
  const t = start && start > 0 ? Math.floor(start) : 0;
  if (!t) return v.url;
  if (v.provider === 'youtube') return v.url + (v.url.includes('?') ? '&' : '?') + `t=${t}`;
  if (v.provider === 'vimeo')   return v.url + `#t=${t}s`;
  return v.url;
}

/* ── Visionado por corte ──────────────────────────────────────────────────────
 * Lo que llega es lo que dijo el navegador del jugador, así que nada se guarda
 * sin acotar: se puede abrir la consola y mandar "vi 3 horas del corte 2". El
 * tope no lo vuelve infalsificable —eso no existe en una página pública— pero sí
 * evita que un valor absurdo ensucie el reporte del cuerpo técnico.
 *
 * El índice se resuelve contra los cortes de ESTE envío: con el token de otro
 * jugador no se puede escribir en un envío ajeno ni inventar un video_id.
 */
const MAX_ITEMS    = 50;          // cortes por beat (un envío real tiene 3-10)
const MAX_SECONDS  = 6 * 3600;    // techo duro para cualquier contador de tiempo
const MAX_PLAYS    = 500;

function intIn(v: unknown, max: number): number {
  const n = Math.floor(Number(v));
  if (!isFinite(n) || n <= 0) return 0;
  return Math.min(n, max);
}

async function recordProgress(
  supabase: ReturnType<typeof createClient>,
  shareId: string,
  shareItems: Record<string, unknown>[],
  session: string,
  items: unknown[],
) {
  if (!session || !items.length || !shareItems.length) return;

  for (const raw of items) {
    const it = (raw || {}) as Record<string, unknown>;
    const idx = Math.floor(Number(it.index));
    if (!isFinite(idx) || idx < 0 || idx >= shareItems.length) continue;
    const videoId = shareItems[idx]?.video_id as string | undefined;
    if (!videoId) continue;

    // La duración del video manda: es el único techo que conocemos del lado servidor.
    const v = shareItems[idx]?.videos as VideoRow | null;
    const known = Math.max(0, Math.floor(Number(v?.duration_seconds) || 0));
    const duration = intIn(it.duration, MAX_SECONDS) || known;
    // Margen sobre la duración: los reproductores redondean y el jugador puede
    // volver atrás y volver a mirar el mismo tramo (eso SÍ es tiempo visto).
    const cap = duration > 0 ? Math.min(duration * 3 + 60, MAX_SECONDS) : MAX_SECONDS;

    const watched  = intIn(it.watched, cap);
    const position = intIn(it.position, duration > 0 ? duration + 5 : MAX_SECONDS);
    const visible  = intIn(it.visible, MAX_SECONDS);
    const plays    = intIn(it.plays, MAX_PLAYS);
    const tracking = it.tracking === 'player' ? 'player' : 'viewport';
    // Sin reproductor no hay "completo": el tiempo en pantalla no prueba nada.
    const completed = tracking === 'player' && it.completed === true;

    if (!watched && !visible && !plays && !position) continue;

    const { error } = await supabase.rpc('record_video_share_view', {
      p_share_id:  shareId,
      p_video_id:  videoId,
      p_session:   session,
      p_watched:   watched,
      p_position:  position,
      p_duration:  duration,
      p_completed: completed,
      p_visible:   visible,
      p_plays:     plays,
      p_tracking:  tracking,
    });
    if (error) console.error('[share-video] progress', error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    let token: string | null = null;
    let action = '';
    let value: boolean | null = null;
    let session = '';
    let items: unknown[] = [];
    if (req.method === 'GET') {
      token = new URL(req.url).searchParams.get('token');
    } else {
      const body = await req.json().catch(() => ({}));
      token   = body?.token || null;
      action  = String(body?.action || '');
      value   = typeof body?.value === 'boolean' ? body.value : null;
      session = String(body?.session || '').slice(0, 80);
      items   = Array.isArray(body?.items) ? body.items.slice(0, MAX_ITEMS) : [];
    }
    if (!token || !/^[0-9a-fA-F-]{10,}$/.test(token)) return json({ found: false });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // 1) El envío — solo si el token coincide y el link sigue vivo.
    const { data: share, error } = await supabase
      .from('video_shares')
      .select('id, title, message, created_by_name, created_at, expires_at, revoked, seen_at, opened_at, open_count, clubs(name), players(first_name,last_name,number)')
      .eq('token', token)
      .maybeSingle();

    if (error) { console.error('[share-video] share query', error); return json({ found: false }); }
    if (!share || share.revoked) return json({ found: false });
    if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) return json({ found: false, expired: true });

    // 2) Los cortes del envío. Van antes que las acciones porque el progreso llega
    //    por índice y hay que resolverlo contra esta lista.
    const { data: shareItems } = await supabase
      .from('video_share_items')
      .select('video_id, position, comment, start_seconds, videos(id,title,provider,url,kind,external_id,thumbnail_url,duration_seconds)')
      .eq('share_id', share.id)
      .order('position', { ascending: true });

    // 3) Acciones de escritura del jugador (contar apertura / marcar visto / visionado).
    let seenAt = share.seen_at as string | null;
    if (action === 'open') {
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { last_opened_at: now, open_count: (share.open_count || 0) + 1 };
      if (!share.opened_at) patch.opened_at = now;          // solo la primera vez
      await supabase.from('video_shares').update(patch).eq('id', share.id);
    } else if (action === 'seen') {
      seenAt = value === false ? null : new Date().toISOString();
      await supabase.from('video_shares').update({ seen_at: seenAt }).eq('id', share.id);
    } else if (action === 'progress') {
      await recordProgress(supabase, share.id as string, shareItems || [], session, items);
      // El beat no necesita el payload de vuelta: se responde corto y se corta acá.
      return json({ ok: true });
    }

    const clips = (shareItems || []).flatMap((it: Record<string, unknown>) => {
      const v = it.videos as VideoRow | null;
      if (!v) return [];
      return [{
        title:            v.title,
        provider:         v.provider,
        kind:             v.kind,
        thumbnail_url:    v.thumbnail_url,
        duration_seconds: v.duration_seconds,
        comment:          (it.comment as string | null) || null,
        start_seconds:    (it.start_seconds as number | null) ?? null,
        embed:            embedUrl(v, it.start_seconds as number | null),
        embed_kind:       embedKind(v),
        open:             openUrl(v, it.start_seconds as number | null),
      }];
    });

    const player = (share as Record<string, unknown>).players as { first_name?: string; last_name?: string; number?: number } | null;
    const club   = (share as Record<string, unknown>).clubs   as { name?: string } | null;

    return json({
      found: true,
      share: {
        title:      share.title,
        message:    share.message,
        from:       share.created_by_name,
        created_at: share.created_at,
        expires_at: share.expires_at,
        seen_at:    seenAt,
        club:       club?.name || null,
        player:     player ? { first_name: player.first_name || '', last_name: player.last_name || '', number: player.number ?? null } : null,
        clips,
      },
    });
  } catch (e) {
    console.error('[share-video] fatal', e);
    return json({ found: false });
  }
});
