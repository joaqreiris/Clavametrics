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

/** URL embebible (o null cuando el proveedor no la tiene). Espeja embedUrl() de Video Detail. */
function embedUrl(v: VideoRow, start?: number | null): string | null {
  const t = start && start > 0 ? Math.floor(start) : 0;
  if (v.kind === 'folder') {
    if (v.provider === 'google_drive') { const fid = driveFolderId(v); return fid ? `https://drive.google.com/embeddedfolderview?id=${fid}#grid` : null; }
    return null;
  }
  if (v.provider === 'youtube') {
    const yid = v.external_id || (v.url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/) || [])[1];
    return yid ? `https://www.youtube.com/embed/${yid}?rel=0&playsinline=1${t ? `&start=${t}` : ''}` : null;
  }
  if (v.provider === 'vimeo') {
    const vid = v.external_id || (v.url.match(/vimeo\.com\/(?:video\/)?(\d+)/) || [])[1];
    return vid ? `https://player.vimeo.com/video/${vid}${t ? `#t=${t}s` : ''}` : null;
  }
  if (v.provider === 'google_drive') { const fid = driveFileId(v); return fid ? `https://drive.google.com/file/d/${fid}/preview` : null; }
  if (v.provider === 'dropbox') {
    const u = v.url || ''; if (!u) return null;
    if (/[?&]dl=\d/.test(u)) return u.replace(/([?&])dl=\d/, '$1raw=1');
    return u + (u.includes('?') ? '&' : '?') + 'raw=1';
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    let token: string | null = null;
    let action = '';
    let value: boolean | null = null;
    if (req.method === 'GET') {
      token = new URL(req.url).searchParams.get('token');
    } else {
      const body = await req.json().catch(() => ({}));
      token  = body?.token || null;
      action = String(body?.action || '');
      value  = typeof body?.value === 'boolean' ? body.value : null;
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

    // 2) Acciones de escritura del jugador (contar apertura / marcar visto).
    let seenAt = share.seen_at as string | null;
    if (action === 'open') {
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { last_opened_at: now, open_count: (share.open_count || 0) + 1 };
      if (!share.opened_at) patch.opened_at = now;          // solo la primera vez
      await supabase.from('video_shares').update(patch).eq('id', share.id);
    } else if (action === 'seen') {
      seenAt = value === false ? null : new Date().toISOString();
      await supabase.from('video_shares').update({ seen_at: seenAt }).eq('id', share.id);
    }

    // 3) Los cortes del envío.
    const { data: items } = await supabase
      .from('video_share_items')
      .select('video_id, position, comment, start_seconds, videos(id,title,provider,url,kind,external_id,thumbnail_url,duration_seconds)')
      .eq('share_id', share.id)
      .order('position', { ascending: true });

    const clips = (items || []).flatMap((it: Record<string, unknown>) => {
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
