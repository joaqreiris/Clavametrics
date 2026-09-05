/**
 * Supabase Edge Function — generate-gym-plan
 *
 * Builds a gym session DRAFT from a natural-language objective, selecting ONLY
 * from the candidate exercises the client passes (by exercise_id — never
 * invents). Output maps to the Gym Planner's three blocks (warmup / plyo /
 * main) so the client can render it as an editable draft via gpApplyContent().
 * The manual planner is untouched; this is an alternative source of `content`.
 *
 * Request  (POST JSON):
 *   { objective: string,
 *     constraints?: { players?:number, emphasis?:string,
 *                     available_equipment?:string[], duration_min?:number },
 *     candidates:  [{ id, name, primary_purpose, purposes, muscle_groups,
 *                     movement_patterns, equipment_tags }],   // capped, pre-filtered
 *     sequence?:   string[] }   // coach's purpose order (optional)
 * Response (200 JSON):
 *   { plan: { title, notes,
 *             warmup:{ min, items:[{ exercise_id, name, sets, reps, load, rest, notes }] },
 *             plyo:  { min, items:[…] },
 *             main:  { min, items:[{ …, mode }] } } }
 *
 * Required secrets: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
 * Deploy: supabase functions deploy generate-gym-plan
 */

import Anthropic from 'npm:@anthropic-ai/sdk@0.36.3';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MODEL          = 'claude-sonnet-4-6';
const MAX_CANDIDATES = 150;

// ── Rate limit ──────────────────────────────────────────────────────────────
// El cupo diario por club lo lleva la DB (`ai_rate_limit_take`, migración 129): cuenta e
// inserta en la misma transacción, sobre una tabla que el cliente no puede leer ni borrar.
// Acá solo se corta. Fail-closed a propósito: si el chequeo no se puede hacer, no se gasta
// cuota de Anthropic. Devuelve la Response de rechazo, o null si hay cupo.
async function takeQuota(supabase: any, fn: string): Promise<Response | null> {
  const { data, error } = await supabase.rpc('ai_rate_limit_take', { p_fn: fn });
  if (error) {
    console.error(`${fn}: rate limit check failed:`, error.message);
    return json({ error: 'Could not verify the daily limit. Try again in a moment.' }, 503);
  }
  if (!data?.allowed) {
    if (data?.reason === 'no_club') return json({ error: 'Your user is not linked to a club.' }, 403);
    return json({
      error: `Daily limit reached (${data?.limit} plans/day for the club). Try again tomorrow.`,
      used: data?.used, limit: data?.limit,
    }, 429);
  }
  return null;
}

interface Candidate {
  id: string; name: string;
  primary_purpose?: string; purposes?: string[];
  muscle_groups?: string[]; movement_patterns?: string[]; equipment_tags?: string[];
}

function candidateLine(c: Candidate): string {
  const parts = [
    `id=${c.id}`,
    `name="${(c.name || '').slice(0, 120)}"`,
    c.primary_purpose ? `purpose=${c.primary_purpose}` : '',
    c.muscle_groups?.length ? `muscles=${c.muscle_groups.join('|')}` : '',
    c.movement_patterns?.length ? `patterns=${c.movement_patterns.join('|')}` : '',
    c.equipment_tags?.length ? `equipment=${c.equipment_tags.join('|')}` : '',
  ].filter(Boolean);
  return parts.join('  ');
}

const SYSTEM = `You are a strength & conditioning session planner for ClavaMetrics.
Build a single gym session as a DRAFT for a coach to review and edit. You map
the work into three fixed blocks that mirror the planner:

- warmup: rise_temperature / release / activation / mobility purposes
- plyo:   power / plyometric work (jumps, landings, throws)
- main:   the main work — strength / conditioning / prevention

Hard rules:
- Choose exercises ONLY from the CANDIDATES list, by their exact id. NEVER
  invent an exercise or use an id that is not in the list. Echo the exact name.
- Honor the objective: target muscles, available equipment, emphasis. Do not
  include exercises that contradict it (e.g. wrong muscle or unavailable gear).
- Dose realistically for the stated goal:
    strength → low reps / higher load / longer rest;
    hypertrophy → moderate reps; power → low reps, high intent;
    prevention/activation → controlled tempo, moderate volume.
  Fields sets (number as string), reps (e.g. "8", "6-8", "5x3"), load
  (e.g. "RPE 8", "75%", "moderate", "bodyweight"), rest (e.g. "90s"), notes.
- If a MATCH-DAY POSITION is given (e.g. MD-4, MD-1, MD+1), do NOT treat the
  session in isolation — modulate load and emphasis to fit the microcycle:
    MD-5 / MD-4  → main loading window: heavier strength is appropriate,
                   higher-intent plyo allowed;
    MD-3         → moderate-high, build volume but keep quality;
    MD-2         → moderate, quality over volume, trim total sets;
    MD-1         → activation / primer ONLY: low volume, minimal-to-zero plyo
                   contacts, no high-load eccentrics, short and sharp;
    MD+1         → regeneration: low intensity, no high mechanical stress;
    MD+2         → progressive re-entry.
  These are sensible defaults; the explicit OBJECTIVE always wins if it
  conflicts. Reflect the chosen logic briefly in the top-level "notes".
- If TEAM LOAD signals are present (ACWR, readiness), use them ONLY to modulate
  the session — never to diagnose or predict injury. They are soft, squad-level
  context worth a closer look, not a verdict:
    ACWR in "Caution"/"High risk", OR readiness "below baseline"
        → trim total volume, lower plyometric contacts, avoid high-load
          eccentrics; bias toward quality and control;
    ACWR "Under-training" with readiness "at"/"above baseline"
        → progressing load is reasonable if the objective calls for it.
  If a load signal is absent, do not infer or mention it. When load context
  shaped the dosage, state it plainly in "notes" (e.g. "Volume trimmed: squad
  ACWR elevated"), framed as a coaching choice, never as a risk claim.
- main items also get a "mode" field: "SR" (sets x reps) by default.
- Keep it sensible: warmup 2-4 items, plyo 0-3, main 3-6. Set each block's
  "min" (estimated minutes). Leave a block's items [] if not appropriate.
- Put coaching rationale in the top-level "notes" (one or two short lines).
- Output STRICT JSON only — no prose, no markdown fences.

# Output schema
{"title":"","notes":"","warmup":{"min":0,"items":[{"exercise_id":"","name":"","sets":"","reps":"","load":"","rest":"","notes":""}]},"plyo":{"min":0,"items":[]},"main":{"min":0,"items":[{"exercise_id":"","name":"","sets":"","reps":"","load":"","rest":"","mode":"SR","notes":""}]}}`;

function parseJSON(raw: string): any {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(cleaned);
}

// Keep only items whose exercise_id is a real candidate; re-stamp the name.
function sanitizeBlock(block: any, byId: Map<string, Candidate>, withMode: boolean) {
  const items = Array.isArray(block?.items) ? block.items : [];
  const clean = items
    .filter((it: any) => it && byId.has(it.exercise_id))
    .map((it: any) => {
      const c = byId.get(it.exercise_id)!;
      const row: any = {
        exercise_id: it.exercise_id,
        name: c.name,
        sets: String(it.sets ?? ''),
        reps: String(it.reps ?? ''),
        load: String(it.load ?? ''),
        rest: String(it.rest ?? ''),
        notes: String(it.notes ?? ''),
      };
      if (withMode) row.mode = it.mode || 'SR';
      return row;
    });
  return { min: Number(block?.min) || 0, items: clean };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const { objective, constraints, candidates, sequence } = await req.json().catch(() => ({}));
    if (!objective || typeof objective !== 'string') return json({ error: 'objective required' }, 400);
    if (!Array.isArray(candidates) || !candidates.length) return json({ error: 'candidates[] required' }, 400);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

    // Después de validar el body: un request mal formado no consume cupo.
    const denied = await takeQuota(supabase, 'generate-gym-plan');
    if (denied) return denied;

    const list: Candidate[] = candidates.slice(0, MAX_CANDIDATES);
    const byId = new Map(list.map((c) => [c.id, c]));

    const userPrompt = [
      `OBJECTIVE: ${objective.trim()}`,
      constraints?.players ? `PLAYERS: ${constraints.players}` : '',
      constraints?.emphasis ? `EMPHASIS: ${constraints.emphasis}` : '',
      constraints?.md ? `MATCH-DAY POSITION: ${constraints.md}` : '',
      constraints?.microcycle ? `MICROCYCLE: ${constraints.microcycle}` : '',
      constraints?.home_away ? `VENUE: ${constraints.home_away}` : '',
      constraints?.opponent ? `OPPONENT: ${constraints.opponent}` : '',
      constraints?.load?.acwr_player_load != null ? `TEAM ACWR (player load, soft signal): ${constraints.load.acwr_player_load}${constraints.load.acwr_zone ? ` — ${constraints.load.acwr_zone}` : ''}` : '',
      constraints?.load?.readiness_trend ? `TEAM READINESS (recent vs baseline): ${constraints.load.readiness_trend}${constraints.load.readiness_n ? ` (n=${constraints.load.readiness_n})` : ''}` : '',
      constraints?.duration_min ? `TARGET DURATION (min): ${constraints.duration_min}` : '',
      constraints?.available_equipment?.length ? `AVAILABLE EQUIPMENT: ${constraints.available_equipment.join(', ')}` : '',
      sequence?.length ? `COACH PURPOSE ORDER: ${sequence.join(' > ')}` : '',
      '',
      `CANDIDATES (${list.length}) — pick only from these ids:`,
      ...list.map(candidateLine),
    ].filter(Boolean).join('\n');

    const anthropic = new Anthropic({ apiKey });
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const textBlock = resp.content.find((b: any) => b.type === 'text');
    const raw = (textBlock as any)?.text ?? '';

    let parsed: any;
    try { parsed = parseJSON(raw); }
    catch { return json({ error: 'AI output was not valid JSON' }, 502); }

    const plan = {
      title: String(parsed?.title || '').slice(0, 120),
      notes: String(parsed?.notes || '').slice(0, 500),
      warmup: sanitizeBlock(parsed?.warmup, byId, false),
      plyo:   sanitizeBlock(parsed?.plyo,   byId, false),
      main:   sanitizeBlock(parsed?.main,   byId, true),
    };

    if (!plan.warmup.items.length && !plan.plyo.items.length && !plan.main.items.length) {
      return json({ error: 'No valid exercises selected from candidates. Loosen the filters and retry.' }, 422);
    }

    return json({ plan });
  } catch (err) {
    console.error('generate-gym-plan error:', err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
