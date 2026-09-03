/**
 * Supabase Edge Function — share-rehab-plan
 *
 * Public, login-free read-only view of ONE rehab / preventive plan (rehab_plans),
 * addressed by its share_token. RLS on rehab_plans / rehab_sessions stays closed;
 * this function uses the service role and returns a plan ONLY when
 *   share_token = token  AND  shared = true.
 *
 * Each rehab_sessions row is ONE block on a date; rows sharing a date form a day.
 * We assemble a days -> blocks -> exercises tree matching the shape the public
 * player page expects, sanitize it (display name/number + programme data only —
 * no ids, no emails, no club data), and resolve exercise media server-side
 * (image -> signed URL, youtube -> thumbnail, else null).
 *
 * Request:
 *   GET  /share-rehab-plan?token=<uuid>
 *   POST /share-rehab-plan   { "token": "<uuid>" }
 * Response (200 JSON):
 *   { found:false }                                   // unknown token / shared=false
 *   { found:true, plan:{…} }                          // sanitized
 *
 * Required Supabase secrets (already set for all functions):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Deploy (must allow anonymous access):
 *   supabase functions deploy share-rehab-plan --no-verify-jwt
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
      .from('rehab_plans')
      .select('id, name, kind, diagnosis, phase, phase_type, start_date, programme_week, programme_total_weeks, status, players(first_name,last_name,number)')
      .eq('share_token', token)
      .eq('shared', true)
      .maybeSingle();

    if (error) { console.error('[share-rehab-plan] plan query', error); return json({ found: false }); }
    if (!plan) return json({ found: false });

    // 2) The sessions (each row = one block on a date).
    const { data: sessions } = await supabase
      .from('rehab_sessions')
      .select('id, date, name, color, block_type, duration_min, rpe_target, volume_sets, context_note, notes, phase_number, exercises, created_at')
      .eq('plan_id', plan.id)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });

    // 3) Collect exercise ids across all sessions to resolve media in one pass.
    const ids = new Set<string>();
    (sessions || []).forEach((s: any) => {
      const list = Array.isArray(s.exercises) ? s.exercises : [];
      list.forEach((ex: any) => { if (ex && ex.exercise_id) ids.add(ex.exercise_id); });
    });

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
      } catch (e) { console.warn('[share-rehab-plan] sign', e); }
    }

    function resolveMedia(ex: any): { thumb: string | null; videoUrl: string | null } {
      const m = ex.exercise_id ? mediaById[ex.exercise_id] : null;
      let thumb: string | null = null;
      let videoUrl: string | null = null;
      if (m) {
        if (m.media_type === 'image' && m.media_ref && signed[m.media_ref]) thumb = signed[m.media_ref];
        const yt = youtubeId(m.video_url);
        if (yt && !thumb) thumb = `https://img.youtube.com/vi/${yt}/mqdefault.jpg`;
        if (m.video_url) videoUrl = m.video_url;
      }
      return { thumb, videoUrl };
    }

    // 4) Assemble days -> blocks -> exercises, dropping every internal id.
    const dayMap = new Map<string, any>();
    for (const s of (sessions || [])) {
      const key = String((s as any).date);
      if (!dayMap.has(key)) dayMap.set(key, { date: key, blocks: [] });
      const list = Array.isArray((s as any).exercises) ? (s as any).exercises : [];
      const block = {
        type:  (s as any).block_type || null,
        name:  (s as any).name || null,
        dur:   (s as any).duration_min || null,
        rpe:   (s as any).rpe_target ?? null,
        notes: (s as any).context_note || (s as any).notes || null,
        exercises: list.map((ex: any) => {
          const { thumb, videoUrl } = resolveMedia(ex || {});
          return {
            name: ex?.name || null,
            sets: Array.isArray(ex?.sets)
              ? ex.sets.map((st: any) => ({ reps: st?.reps ?? null, load: st?.load ?? null, tempo: st?.tempo ?? null, rest: st?.rest ?? null, note: st?.note || null }))
              : [],
            side: ex?.side || null,
            flag: ex?.flag || null,
            thumb,
            videoUrl,
          };
        }),
      };
      dayMap.get(key).blocks.push(block);
    }
    const days = [...dayMap.values()];

    const pl: any = Array.isArray(plan.players) ? plan.players[0] : plan.players;
    const payload = {
      found: true,
      plan: {
        name: plan.name,
        kind: plan.kind,                 // 'rehab' | 'preventive'
        phase: plan.phase,
        phase_type: plan.phase_type,
        start_date: plan.start_date,
        programme_week: plan.programme_week,
        programme_total_weeks: plan.programme_total_weeks,
        status: plan.status,
        content: { days },
        player: pl ? { first_name: pl.first_name, last_name: pl.last_name, number: pl.number } : null,
      },
    };
    return json(payload);
  } catch (err) {
    console.error('[share-rehab-plan] fatal', err);
    return json({ found: false }, 200);
  }
});
