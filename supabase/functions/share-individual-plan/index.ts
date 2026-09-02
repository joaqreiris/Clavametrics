/**
 * Supabase Edge Function — share-individual-plan
 *
 * Public, login-free read-only view of ONE individual S&C plan, addressed by
 * its share_token. RLS on individual_plans / individual_plan_phases stays
 * closed; this function uses the service role and returns a plan ONLY when
 *   share_token = token  AND  shared = true.
 * The payload is sanitized: display name/number + programme data only — no ids,
 * no emails. The player's own club is included for branding (name, crest, colour
 * — all of it already public on the club's page), nothing else. Exercise media
 * thumbnails are resolved server-side (image → signed URL, youtube → thumbnail,
 * else null) so the client needs no storage access.
 *
 * Request:
 *   GET  /share-individual-plan?token=<uuid>
 *   POST /share-individual-plan   { "token": "<uuid>" }
 * Response (200 JSON):
 *   { found:false }                                   // unknown token / shared=false
 *   { found:true, club:{…}, plan:{…}, phases:[…] }    // sanitized
 *
 * Required Supabase secrets (already set for all functions):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Deploy (must allow anonymous access):
 *   supabase functions deploy share-individual-plan --no-verify-jwt
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MEDIA_BUCKET = 'gym-exercise-media';

function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// Walk every block's exercise list in the content jsonb.
function forEachExercise(content: any, cb: (ex: any) => void) {
  const days = Array.isArray(content) ? content : (content && Array.isArray(content.days) ? content.days : []);
  for (const day of days) {
    const blocks = day && Array.isArray(day.blocks) ? day.blocks : [];
    for (const b of blocks) {
      const list = Array.isArray(b?.exList) ? b.exList : (Array.isArray(b?.exercises) ? b.exercises : []);
      for (const ex of list) if (ex && typeof ex === 'object') cb(ex);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    let token: string | null = null;
    if (req.method === 'GET') {
      token = new URL(req.url).searchParams.get('token');
    } else {
      const body = await req.json().catch(() => ({}));
      token = body?.token || null;
    }
    if (!token || !/^[0-9a-fA-F-]{10,}$/.test(token)) return json({ found: false });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // 1) The plan — ONLY if share_token matches AND sharing is on.
    const { data: plan, error } = await supabase
      .from('individual_plans')
      .select('id, club_id, name, goal, focus, start_date, programme_week, programme_total_weeks, status, content, players(first_name,last_name,number)')
      .eq('share_token', token)
      .eq('shared', true)
      .maybeSingle();

    if (error) { console.error('[share-individual-plan] plan query', error); return json({ found: false }); }
    if (!plan) return json({ found: false });

    // 1b) The club, for branding only. logo_url points at the public club-logos
    //     bucket, so it needs no signing.
    let club: { name: string; short_name: string | null; logo_url: string | null; primary_color: string | null } | null = null;
    if (plan.club_id) {
      const { data: c } = await supabase
        .from('clubs')
        .select('name, short_name, logo_url, primary_color')
        .eq('id', plan.club_id)
        .maybeSingle();
      if (c) club = { name: c.name, short_name: c.short_name, logo_url: c.logo_url, primary_color: c.primary_color };
    }

    // 2) Phases (sanitized).
    const { data: phaseRows } = await supabase
      .from('individual_plan_phases')
      .select('name, week_start, week_end, color, objective, load_level, phase_order')
      .eq('plan_id', plan.id)
      .order('phase_order', { ascending: true });

    // 3) Resolve exercise media thumbnails server-side.
    const content = plan.content || {};
    const ids = new Set<string>();
    forEachExercise(content, (ex) => { if (ex.exercise_id) ids.add(ex.exercise_id); });

    const mediaById: Record<string, { media_type: string | null; media_ref: string | null; video_url: string | null }> = {};
    if (ids.size) {
      const { data: exRows } = await supabase
        .from('gym_exercises')
        .select('id, media_type, media_ref, video_url')
        .in('id', [...ids]);
      (exRows || []).forEach((e: any) => { mediaById[e.id] = { media_type: e.media_type, media_ref: e.media_ref, video_url: e.video_url }; });
    }

    // Batch-sign image paths.
    const signed: Record<string, string> = {};
    const paths = [...new Set(Object.values(mediaById).filter(m => m.media_type === 'image' && m.media_ref).map(m => m.media_ref!))];
    if (paths.length) {
      try {
        const { data: urls } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 3600);
        (urls || []).forEach((u: any) => { if (u && u.path && u.signedUrl) signed[u.path] = u.signedUrl; });
      } catch (e) { console.warn('[share-individual-plan] sign', e); }
    }

    // 4) Rewrite each exercise into a display-only shape (drop internal ids).
    const sanitizeContent = JSON.parse(JSON.stringify(content));
    forEachExercise(sanitizeContent, (ex) => {
      const m = ex.exercise_id ? mediaById[ex.exercise_id] : null;
      let thumb: string | null = null;
      let videoUrl: string | null = null;
      if (m) {
        if (m.media_type === 'image' && m.media_ref && signed[m.media_ref]) thumb = signed[m.media_ref];
        const yt = youtubeId(m.video_url);
        if (yt && !thumb) thumb = `https://img.youtube.com/vi/${yt}/mqdefault.jpg`;
        if (m.video_url) videoUrl = m.video_url;
      }
      ex.thumb = thumb;
      ex.videoUrl = videoUrl;
      delete ex.exercise_id;   // never leak internal ids
    });

    const pl: any = Array.isArray(plan.players) ? plan.players[0] : plan.players;
    const payload = {
      found: true,
      club,
      plan: {
        name: plan.name,
        goal: plan.goal,
        focus: plan.focus,
        start_date: plan.start_date,
        programme_week: plan.programme_week,
        programme_total_weeks: plan.programme_total_weeks,
        status: plan.status,
        content: sanitizeContent,
        player: pl ? { first_name: pl.first_name, last_name: pl.last_name, number: pl.number } : null,
      },
      phases: (phaseRows || []).map((p: any) => ({
        name: p.name, week_start: p.week_start, week_end: p.week_end,
        color: p.color, objective: p.objective, load_level: p.load_level, phase_order: p.phase_order,
      })),
    };
    return json(payload);
  } catch (err) {
    console.error('[share-individual-plan] fatal', err);
    return json({ found: false }, 200);
  }
});
