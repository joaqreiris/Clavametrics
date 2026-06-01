/**
 * Supabase Edge Function — generate-card
 *
 * Converts a natural-language prompt into a validated gp.card/v1 CONFIG
 * using Claude. The CONFIG is returned to the client, which opens it in
 * the builder panel for human review before saving.
 *
 * Pipeline:
 *   prompt → buildSystemPrompt(catalog) → Claude (structured JSON output)
 *          → validateCardSchema + validateCardRules
 *          → [one self-repair pass if invalid]
 *          → audit log → return { config, rationale }
 *
 * Required Supabase secrets:
 *   ANTHROPIC_API_KEY   — from console.anthropic.com
 *
 * Deploy:
 *   supabase functions deploy generate-card --no-verify-jwt
 *   (or with --verify-jwt if you want auth enforcement server-side)
 */

import Anthropic from 'npm:@anthropic-ai/sdk@0.36.3';
import { createClient } from 'npm:@supabase/supabase-js@2';

// ── CORS headers ──────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── gp.card/v1 schema inline (avoids bundling path issues) ────────────────
// Subset validation sufficient for server-side guard; full Ajv schema below.
const VALID_VIZ   = new Set(['kpi','bars','line','scatter','radar','ranking','table','heatmap']);
const VALID_AGG   = new Set(['avg','total','median','max','min']);
const VALID_RANGE = new Set(['mc','w7','w30','season','custom']);
const VIZ_BOUNDS: Record<string,[number,number]> = {
  kpi:[1,1], ranking:[1,1], scatter:[2,2], bars:[1,2],
  line:[1,6], radar:[3,8], table:[1,12], heatmap:[1,12],
};

// ── Rate limit: max 20 AI generations per club per 24 h ──────────────────
const DAILY_LIMIT = 20;

// ── System prompt template ────────────────────────────────────────────────
const SYSTEM_TEMPLATE = `You are the chart builder for ClavaMetrics GPS analysis.
Convert the user's request into a single chart CONFIG.
You DO NOT write SQL or access data — you only choose from the catalog and rules below.
Output JSON only, matching the gp.card/v1 schema. No prose. No markdown fences.

# Visualization types (metric count)
- kpi      : exactly 1 metric  — one headline number
- ranking  : exactly 1 metric  — players sorted high→low (scope always squad)
- bars     : 1–2 metrics       — compare across players/sessions
- line     : 1+ metrics        — trend over time (range drives the time axis)
- scatter  : exactly 2 metrics — X vs Y, one dot per player
- radar    : 3–8 metrics       — multi-axis z-profile
- table    : 1+ metrics        — players × metrics grid (squad)
- heatmap  : 1+ metrics        — players × metrics, z-colored (squad)

# Aggregations: avg | total | median | max | min
PEAK RULE: metrics with kind="peak" (e.g. max_speed) ONLY allow avg, max, min. Never total or median on a peak metric.

# Scope:      player | squad   (ranking/table/heatmap are always squad)
# Comparison: role | match | md | none
# Range:      mc | w7 | w30 | season

# Metric catalog — use these ids ONLY
{{METRIC_CATALOG}}

# Output JSON (no prose, no fences):
{"schema":"gp.card/v1","title":"...","viz":"...","scope":{"level":"player|squad"},
 "metrics":[{"id":"<id>","agg":"<agg>"}],
 "range":{"type":"mc|w7|w30|season"},
 "comparison":{"baseline":"role|match|md"}|null,
 "style":{"size":"sm|md|lg|full","color":"#15803D","palette":"pitch","axes":true,"legend":true,"dataLabels":false}}

# Decision rules
- Smallest set of metrics that satisfies the type's count.
- "vs role / position" → comparison.baseline="role".
- "trend / over time / last N days" → viz=line + matching range.
- "top / rank / best" → viz=ranking.
- Unsure of type: 1 metric→kpi, 2→bars, 3+→table.
- Size: kpi→sm, radar→lg, line/table/heatmap→full, else md.
- Output ONLY the JSON object.`;

// Few-shot examples appended to system prompt
const FEW_SHOT = `
# Examples
User: top sprinters this microcycle
{"schema":"gp.card/v1","title":"Top sprinters · MC","viz":"ranking","scope":{"level":"squad"},"metrics":[{"id":"sprint_distance","agg":"total"}],"range":{"type":"mc"},"comparison":{"baseline":"role"},"style":{"size":"md","color":"#15803D","palette":"pitch","axes":true,"legend":true,"dataLabels":true}}

User: player load vs HSR by player
{"schema":"gp.card/v1","title":"Load vs HSR","viz":"scatter","scope":{"level":"squad"},"metrics":[{"id":"player_load","agg":"avg"},{"id":"high_speed_distance","agg":"avg"}],"range":{"type":"mc"},"comparison":null,"style":{"size":"md","color":"#2563EB","palette":"cool","axes":true,"legend":true,"dataLabels":false}}`;

// ── Validators (JSON-Schema-free for Deno edge compatibility) ─────────────
interface MetricRef { id:string; agg:string; kind?:string; }
interface CardConfig { schema:string; viz:string; scope:{level:string}; metrics:MetricRef[]; range:{type:string}; [k:string]:unknown; }
interface ValidationError { path:string; message:string; }

function validateShape(cfg: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!cfg || typeof cfg !== 'object') return [{ path:'', message:'not an object' }];
  const c = cfg as Record<string,unknown>;
  if (c.schema !== 'gp.card/v1') errors.push({ path:'schema', message:'must be "gp.card/v1"' });
  if (!VALID_VIZ.has(c.viz as string)) errors.push({ path:'viz', message:`"${c.viz}" not a valid viz` });
  if (!c.scope || (c.scope as any).level !== 'player' && (c.scope as any).level !== 'squad')
    errors.push({ path:'scope.level', message:'must be player or squad' });
  if (!Array.isArray(c.metrics) || !c.metrics.length)
    errors.push({ path:'metrics', message:'must be a non-empty array' });
  if (!c.range || !VALID_RANGE.has((c.range as any).type))
    errors.push({ path:'range.type', message:'invalid range type' });
  if (!Array.isArray(c.metrics)) return errors;
  (c.metrics as MetricRef[]).forEach((m, i) => {
    if (!VALID_AGG.has(m.agg)) errors.push({ path:`metrics[${i}].agg`, message:`invalid agg "${m.agg}"` });
    if (m.kind === 'peak' && !['avg','max','min'].includes(m.agg))
      errors.push({ path:`metrics[${i}].agg`, message:`peak metric "${m.id}" cannot use "${m.agg}"` });
  });
  const viz = c.viz as string;
  if (VALID_VIZ.has(viz)) {
    const [mn,mx] = VIZ_BOUNDS[viz];
    const n = (c.metrics as unknown[]).length;
    if (n < mn || n > mx) errors.push({ path:'metrics', message:`${viz} needs ${mn}–${mx} metrics, got ${n}` });
  }
  return errors;
}

function validateAgainstCatalog(cfg: CardConfig, catalog: Map<string,{kind:string}>): ValidationError[] {
  const errors: ValidationError[] = [];
  cfg.metrics.forEach((m, i) => {
    const cat = catalog.get(m.id);
    if (!cat) { errors.push({ path:`metrics[${i}].id`, message:`unknown metric "${m.id}"` }); return; }
    if (cat.kind === 'peak' && !['avg','max','min'].includes(m.agg))
      errors.push({ path:`metrics[${i}].agg`, message:`peak metric "${m.id}": only avg/max/min allowed` });
  });
  return errors;
}

// ── Catalog fetch ─────────────────────────────────────────────────────────
async function fetchCatalog(clubId: string, supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from('gps_metric_definitions')
    .select('key,label,unit,kind,category,is_core')
    .eq('club_id', clubId)
    .order('display_order', { ascending: true });
  if (error) throw new Error(`fetchCatalog: ${error.message}`);

  const map = new Map<string,{kind:string; is_custom:boolean}>();
  const lines: string[] = [];
  for (const row of data ?? []) {
    map.set(row.key, { kind: row.kind ?? 'accum', is_custom: !row.is_core });
    lines.push(`${row.key} — ${row.label} — ${row.unit ?? ''} — ${row.kind ?? 'accum'} — ${row.category ?? ''}${!row.is_core ? ' — custom' : ''}`);
  }
  return { map, lines };
}

// ── Rate limit check ──────────────────────────────────────────────────────
async function checkRateLimit(clubId: string, supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await supabase
    .from('ai_card_generations')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .gte('created_at', since);
  return (count ?? 0) < DAILY_LIMIT;
}

// ── Audit log ─────────────────────────────────────────────────────────────
async function audit(
  { clubId, userId, prompt, produced, model, valid }:
  { clubId:string; userId?:string; prompt:string; produced:unknown; model:string; valid:boolean },
  supabase: ReturnType<typeof createClient>
) {
  await supabase.from('ai_card_generations').insert({
    club_id: clubId, user_id: userId ?? null,
    prompt, produced, model, valid, accepted: false,
  });
}

// ── Claude call ───────────────────────────────────────────────────────────
async function callClaude(
  anthropic: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  repairContext?: { previous: string; errors: string }
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];
  if (repairContext) {
    messages.push(
      { role: 'assistant', content: repairContext.previous },
      { role: 'user',      content: `That CONFIG was invalid: ${repairContext.errors}. Return only a corrected gp.card/v1 JSON object.` }
    );
  }
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });
  const block = response.content.find(b => b.type === 'text');
  return (block as Anthropic.TextBlock)?.text ?? '';
}

function parseJSON(raw: string): unknown {
  // strip markdown code fences if the model adds them despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(cleaned);
}

// ── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── Parse body ────────────────────────────────────────────────────────
    const { prompt, clubId } = await req.json() as { prompt: string; clubId: string };
    if (!prompt?.trim() || !clubId) {
      return new Response(JSON.stringify({ error: 'prompt and clubId are required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── Rate limit ────────────────────────────────────────────────────────
    const withinLimit = await checkRateLimit(clubId, supabase);
    if (!withinLimit) {
      return new Response(JSON.stringify({ error: 'Daily limit reached (20 generations/day). Try again tomorrow.' }), { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── Catalog ───────────────────────────────────────────────────────────
    const { map: catalogMap, lines: catalogLines } = await fetchCatalog(clubId, supabase);
    if (!catalogLines.length) {
      return new Response(JSON.stringify({ error: 'No metrics found for this club. Import GPS data first.' }), { status: 422, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── System prompt ─────────────────────────────────────────────────────
    const systemPrompt = SYSTEM_TEMPLATE.replace('{{METRIC_CATALOG}}', catalogLines.join('\n')) + FEW_SHOT;

    // ── Claude call ───────────────────────────────────────────────────────
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const MODEL = 'claude-sonnet-4-6';
    let rawText = await callClaude(anthropic, systemPrompt, prompt.trim());
    let cfg: unknown;
    let parseOk = false;

    try { cfg = parseJSON(rawText); parseOk = true; }
    catch { /* will trigger repair */ }

    // ── Validate ──────────────────────────────────────────────────────────
    let shapeErrors: ValidationError[] = parseOk ? validateShape(cfg) : [{ path:'', message:'model output was not valid JSON' }];
    let catalogErrors: ValidationError[] = [];
    if (!shapeErrors.length) catalogErrors = validateAgainstCatalog(cfg as CardConfig, catalogMap);
    let allErrors = [...shapeErrors, ...catalogErrors];

    // ── One self-repair pass ──────────────────────────────────────────────
    if (allErrors.length) {
      const errorSummary = allErrors.map(e => `${e.path}: ${e.message}`).join('; ');
      rawText = await callClaude(anthropic, systemPrompt, prompt.trim(), { previous: rawText, errors: errorSummary });
      try { cfg = parseJSON(rawText); parseOk = true; }
      catch { /* still invalid, will audit and fall through */ }
      if (parseOk) {
        shapeErrors   = validateShape(cfg);
        catalogErrors = shapeErrors.length ? [] : validateAgainstCatalog(cfg as CardConfig, catalogMap);
        allErrors     = [...shapeErrors, ...catalogErrors];
      }
    }

    const valid = parseOk && allErrors.length === 0;

    // ── Audit ─────────────────────────────────────────────────────────────
    await audit({ clubId, userId: user.id, prompt, produced: cfg ?? rawText, model: MODEL, valid }, supabase);

    if (!valid) {
      // surface the errors to the client so gp-ai.js can fall back to heuristic
      return new Response(JSON.stringify({
        error: 'AI produced an invalid config after repair. Falling back to heuristic.',
        details: allErrors,
      }), { status: 422, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ config: cfg }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('generate-card error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
