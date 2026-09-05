/**
 * Supabase Edge Function — tag-exercise
 *
 * Suggests canonical taxonomy tokens for one or more exercises from their
 * name + description, using Claude Haiku. Constrained to the vocabulary the
 * client passes (single source of truth = lib/exercise-taxonomy.js). Returns
 * suggestions only — the client/editor applies them after human review.
 * Never writes to the DB.
 *
 * Request  (POST JSON):
 *   { exercises:  [{ idx:number, name:string, description?:string }],  // max 30
 *     vocabulary: { purpose:[{token,label}], muscle_group:[…], movement_pattern:[…],
 *                   equipment:[…], contraction_type:[…], movement_speed:[…],
 *                   plane:[…], myofascial_chain:[…] } }
 * Response (200 JSON):
 *   { results: [{ idx, primary_purpose, purposes, muscle_groups, movement_patterns,
 *                 equipment_tags, contraction_types, movement_speeds, planes,
 *                 myofascial_chains }] }
 *
 * Required Supabase secrets:
 *   ANTHROPIC_API_KEY   — already configured (used by generate-card)
 *   SUPABASE_URL, SUPABASE_ANON_KEY  — already set for all functions
 *
 * Deploy:
 *   supabase functions deploy tag-exercise
 */

import Anthropic from 'npm:@anthropic-ai/sdk@0.36.3';
import { createClient } from 'npm:@supabase/supabase-js@2';

// ── CORS ────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MODEL     = 'claude-haiku-4-5-20251001';
const MAX_BATCH = 30;

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
      error: `Daily limit reached (${data?.limit} calls/day for the club). Try again tomorrow.`,
      used: data?.used, limit: data?.limit,
    }, 429);
  }
  return null;
}

// dimension key (in vocabulary) → output column name
const DIM_COL: Record<string, string> = {
  purpose:          'purposes',
  muscle_group:     'muscle_groups',
  movement_pattern: 'movement_patterns',
  equipment:        'equipment_tags',
  contraction_type: 'contraction_types',
  movement_speed:   'movement_speeds',
  plane:            'planes',
  myofascial_chain: 'myofascial_chains',
};

type Vocab = Record<string, { token: string; label: string }[]>;

function buildSystem(vocabulary: Vocab): string {
  const blocks: string[] = [];
  for (const dim of Object.keys(DIM_COL)) {
    const items = vocabulary[dim] || [];
    if (!items.length) continue;
    blocks.push(`## ${dim}\n` + items.map(i => `${i.token} (${i.label})`).join(', '));
  }
  return `You are a strength & conditioning exercise tagger for ClavaMetrics.
Given an exercise name and description, assign canonical tokens from the
controlled vocabulary below.

Rules:
- Use ONLY tokens that appear in the lists. Never invent tokens.
- primary_purpose: exactly one token (the main role in a session).
- purposes: the primary plus any clear secondary purpose.
- muscle_groups: the atomic muscles worked.
- movement_patterns: the fundamental gesture(s).
- equipment_tags: implements needed (omit if not deducible from the text).
- Optional dims (contraction_types, movement_speeds, planes, myofascial_chains):
  fill ONLY when clearly implied; otherwise return an empty array.
- Tag CONSERVATIVELY. If unsure about a dimension, leave it empty rather than guess.
- Output STRICT JSON only. No prose, no markdown code fences.

# Vocabulary
${blocks.join('\n\n')}

# Output schema (one object per input exercise, matched by idx)
{"results":[{"idx":0,"primary_purpose":"<token|null>","purposes":[],"muscle_groups":[],"movement_patterns":[],"equipment_tags":[],"contraction_types":[],"movement_speeds":[],"planes":[],"myofascial_chains":[]}]}`;
}

function parseJSON(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(cleaned);
}

// Keep only tokens that exist in the passed vocabulary; fix primary_purpose.
function sanitize(r: any, vocabulary: Vocab) {
  const sets: Record<string, Set<string>> = {};
  for (const d of Object.keys(DIM_COL)) sets[d] = new Set((vocabulary[d] || []).map(i => i.token));
  const clean = (dim: string, arr: any) =>
    Array.isArray(arr) ? [...new Set(arr.filter((t: any) => sets[dim].has(t)))] : [];

  const purposes = clean('purpose', r?.purposes);
  let primary = (r?.primary_purpose && sets.purpose.has(r.primary_purpose)) ? r.primary_purpose : (purposes[0] ?? null);
  const allPurposes = primary ? [...new Set([primary, ...purposes])] : purposes;

  return {
    idx: r?.idx,
    primary_purpose:   primary,
    purposes:          allPurposes,
    muscle_groups:     clean('muscle_group', r?.muscle_groups),
    movement_patterns: clean('movement_pattern', r?.movement_patterns),
    equipment_tags:    clean('equipment', r?.equipment_tags),
    contraction_types: clean('contraction_type', r?.contraction_types),
    movement_speeds:   clean('movement_speed', r?.movement_speeds),
    planes:            clean('plane', r?.planes),
    myofascial_chains: clean('myofascial_chain', r?.myofascial_chains),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405);

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    // ── Body ──────────────────────────────────────────────────────────────
    const { exercises, vocabulary } = await req.json().catch(() => ({}));
    if (!Array.isArray(exercises) || !exercises.length) return json({ error: 'exercises[] required' }, 400);
    if (!vocabulary || typeof vocabulary !== 'object')  return json({ error: 'vocabulary required' }, 400);
    if (exercises.length > MAX_BATCH) return json({ error: `Max ${MAX_BATCH} exercises per call` }, 400);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

    // ── Cupo ──────────────────────────────────────────────────────────────
    // Después de validar el body: un request mal formado no consume cupo.
    const denied = await takeQuota(supabase, 'tag-exercise');
    if (denied) return denied;

    // ── Prompt ────────────────────────────────────────────────────────────
    const system = buildSystem(vocabulary as Vocab);
    const userPrompt = 'Tag these exercises:\n' + exercises.map((e: any) =>
      `[idx ${e.idx}] name: ${String(e.name || '').slice(0, 200)}` +
      (e.description ? ` — description: ${String(e.description).slice(0, 600)}` : '')
    ).join('\n');

    // ── Claude (Haiku) ─────────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey });
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const textBlock = resp.content.find((b: any) => b.type === 'text');
    const raw = (textBlock as any)?.text ?? '';

    let parsed: any;
    try { parsed = parseJSON(raw); }
    catch { return json({ error: 'AI output was not valid JSON' }, 502); }

    const byIdx = new Map<number, any>();
    for (const r of (parsed?.results || [])) byIdx.set(r.idx, sanitize(r, vocabulary as Vocab));
    // align to the input order; empty suggestion if the model skipped one
    const results = exercises.map((e: any) =>
      byIdx.get(e.idx) ?? sanitize({ idx: e.idx }, vocabulary as Vocab));

    return json({ results });
  } catch (err) {
    console.error('tag-exercise error:', err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
