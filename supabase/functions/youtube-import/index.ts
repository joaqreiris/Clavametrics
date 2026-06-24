/**
 * Supabase Edge Function — youtube-import
 *
 * Lists the videos of a YouTube playlist so the client can preview them and
 * import the chosen ones as draft exercises. The YouTube API key stays
 * server-side; this function never writes to the DB — the client inserts the
 * selected videos via RLS (scoped to its club), deduped by (club_id, video_id).
 *
 * Request  (POST JSON): { playlistUrl: string, max?: number }
 * Response (200 JSON):  { playlistId, count, videos: [
 *                          { videoId, title, description, thumbnail, position } ] }
 *
 * Required Supabase secrets:
 *   YOUTUBE_API_KEY     — Google Cloud, YouTube Data API v3
 *   SUPABASE_URL, SUPABASE_ANON_KEY  — already set for all functions
 *
 * Deploy:
 *   supabase functions deploy youtube-import
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

const MAX_VIDEOS = 300;   // hard cap to bound quota + response size
const PAGE_SIZE  = 50;    // YouTube max per page

// Extract a playlist id from a URL or accept a raw id (PL…/UU…/FL…/OL…).
function parsePlaylistId(input: string): string | null {
  const s = (input || '').trim();
  const m = s.match(/[?&]list=([\w-]+)/);
  if (m) return m[1];
  if (/^(PL|UU|FL|OL|LL)[\w-]+$/.test(s)) return s;
  return null;
}

interface Video {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  position: number;
}

async function fetchPlaylist(playlistId: string, apiKey: string, max: number): Promise<Video[]> {
  const out: Video[] = [];
  let pageToken = '';
  while (out.length < max) {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('maxResults', String(PAGE_SIZE));
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('key', apiKey);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString());
    const data = await res.json();
    if (!res.ok) {
      const reason = data?.error?.errors?.[0]?.reason || data?.error?.message || `HTTP ${res.status}`;
      throw new Error(`YouTube API: ${reason}`);
    }

    for (const item of (data.items || [])) {
      const sn = item.snippet || {};
      const videoId = item.contentDetails?.videoId || sn.resourceId?.videoId;
      // skip deleted / private / missing
      if (!videoId || sn.title === 'Deleted video' || sn.title === 'Private video') continue;
      const thumbs = sn.thumbnails || {};
      const thumbnail = (thumbs.medium || thumbs.high || thumbs.default || {}).url || '';
      out.push({
        videoId,
        title: (sn.title || '').slice(0, 300),
        description: (sn.description || '').slice(0, 2000),
        thumbnail,
        position: sn.position ?? out.length,
      });
      if (out.length >= max) break;
    }

    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405);

  try {
    // ── Auth: require a valid Supabase session (protects the API quota) ──
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const apiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!apiKey) return json({ error: 'YOUTUBE_API_KEY not configured' }, 500);

    const { playlistUrl, max } = await req.json().catch(() => ({}));
    const playlistId = parsePlaylistId(playlistUrl || '');
    if (!playlistId) {
      return json({ error: 'Could not find a playlist in that URL. Paste a playlist link (it contains "list=").' }, 400);
    }

    const cap = Math.min(Number(max) || MAX_VIDEOS, MAX_VIDEOS);
    const videos = await fetchPlaylist(playlistId, apiKey, cap);

    return json({ playlistId, count: videos.length, videos });
  } catch (err) {
    return json({ error: String((err as Error)?.message || err) }, 502);
  }
});
