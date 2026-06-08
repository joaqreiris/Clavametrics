# AI generator — `POST /api/ai/generate-card`

The AI rung is safe because the model **only ever emits a `gp.card/v1` CONFIG** — never SQL, never direct data access. The CONFIG then flows through the *same* validation + resolver + render pipeline as the manual builder. The user reviews it in the editor before saving.

```
prompt ──► LLM (structured output: gp.card/v1) ──► validateConfig() ──► [repair?] ──► open in builder for human review ──► save
                              ▲                                                          │
                              └────────── inject catalog + rules into system prompt ─────┘
```

---

## System prompt template

Inject `{{METRIC_CATALOG}}` (core + the club's custom EAV metrics) and keep the rules verbatim. Everything the model needs to stay valid is in the prompt, so it can't invent metrics or illegal aggregations.

```text
You are the chart builder for ClavaMetrics GPS analysis. Convert the user's
request into a single chart CONFIG. You DO NOT write SQL or access data — you
only choose from the catalog and rules below. Output JSON only, matching the
gp.card/v1 schema. No prose.

# Visualization types (and how many metrics each takes)
- kpi      : exactly 1 metric  — one headline number
- ranking  : exactly 1 metric  — players sorted high→low (scope is always squad)
- bars     : 1–2 metrics       — compare across players/sessions
- line     : 1+ metrics        — trend over time (range drives the time axis)
- scatter  : exactly 2 metrics — X vs Y, one dot per player
- radar    : 3+ metrics        — multi-axis z-profile
- table    : 1+ metrics        — players × metrics grid (squad)
- heatmap  : 1+ metrics        — players × metrics, z-colored (squad)

# Aggregations
avg | total | median | max | min
RULE (peak vs accumulable): metrics with kind="peak" (e.g. max speed, ACWR,
meters/min) ONLY allow avg, max, min. Never use total or median on a peak metric.

# Scope:        player | squad   (ranking/table/heatmap are always squad)
# Comparison:   role | match | md | none
# Range:        mc | w7 | w30 | season   (or custom with from/to dates)

# Metric catalog (use these ids ONLY)
{{METRIC_CATALOG}}
# ^ each line: id — name — unit — kind(accum|peak) — group — [custom]

# Output: a JSON object with exactly these keys
{
  "schema": "gp.card/v1",
  "title": string,                       // short, human, derived from the request
  "viz": one of the types above,
  "scope": { "level": "player" | "squad" },
  "metrics": [ { "id": <catalog id>, "agg": <aggregation> } ],
  "range": { "type": "mc" | "w7" | "w30" | "season" },
  "comparison": { "baseline": "role" | "match" | "md" } | null,
  "style": { "size": "sm|md|lg|full", "color": "#15803D",
             "palette": "pitch|heat|cool|mono",
             "axes": true, "legend": true, "dataLabels": false }
}

# Rules
- Pick the smallest set of metrics that satisfies the request and the type's count.
- If the request implies a comparison ("vs role", "vs match"), set comparison.
- If it implies time ("trend", "last 30 days", "over the season"), use line + the right range.
- If unsure of the type, prefer: 1 metric → kpi, 2 → bars, "top/rank" → ranking.
- Choose size sensibly (kpi→sm, radar→lg, line/table/heatmap→full, else md).
- Output ONLY the JSON object. If the request can't map to the catalog, return
  the closest valid CONFIG and put a clarifying note in "title".
```

### Few-shot examples (optional, improves reliability)

```text
User: top sprinters this microcycle
{ "schema":"gp.card/v1","title":"Top sprinters · MC","viz":"ranking",
  "scope":{"level":"squad"},"metrics":[{"id":"sprint_distance","agg":"total"}],
  "range":{"type":"mc"},"comparison":{"baseline":"role"},
  "style":{"size":"md","color":"#15803D","palette":"pitch","axes":true,"legend":true,"dataLabels":true} }

User: player load vs HSR by player
{ "schema":"gp.card/v1","title":"Load vs HSR","viz":"scatter",
  "scope":{"level":"squad"},
  "metrics":[{"id":"player_load","agg":"avg"},{"id":"high_speed_distance","agg":"avg"}],
  "range":{"type":"mc"},"comparison":null,
  "style":{"size":"md","color":"#2563EB","palette":"cool","axes":true,"legend":true,"dataLabels":false} }
```

---

## Orchestration (server) — validate + one repair pass

```ts
import Ajv from 'ajv';
import schema from './gp.card.schema.json';
import { validateConfig, CatalogMetric, CardConfig } from './config-to-query';

const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile(schema);

export async function generateCard(prompt: string, ctx: { clubId: string; playerId?: string },
                                   catalog: Map<string, CatalogMetric>, llm: LLM): Promise<CardConfig> {
  const system = buildSystemPrompt(catalog);                 // injects {{METRIC_CATALOG}}

  let cfg = await llm.json({ system, user: prompt });         // request structured JSON output

  // 1) schema check
  let errors = validateSchema(cfg) ? [] : (validateSchema.errors ?? []).map(e => `${e.instancePath} ${e.message}`);
  // 2) business rules (metric existence, peak rule, per-type counts)
  if (!errors.length) errors = validateConfig(cfg as CardConfig, catalog).map(e => `${e.path}: ${e.message}`);

  // 3) one self-repair pass on failure
  if (errors.length) {
    cfg = await llm.json({ system, user: prompt,
      assistant: JSON.stringify(cfg),
      correction: `That CONFIG was invalid: ${errors.join('; ')}. Return a corrected gp.card/v1 JSON only.` });
  }

  // 4) persist audit, then hand the CONFIG to the client (which opens the builder for review)
  await audit({ clubId: ctx.clubId, prompt, produced: cfg, valid: errors.length === 0 });
  return cfg as CardConfig;            // client opens it in the editor; user saves when happy
}

function buildSystemPrompt(catalog: Map<string, CatalogMetric>): string {
  const lines = [...catalog.values()]
    .map(m => `${m.id} — ${m.name} — ${m.unit} — ${m.kind} — ${(m as any).group ?? ''}${m.is_custom ? ' — custom' : ''}`)
    .join('\n');
  return SYSTEM_TEMPLATE.replace('{{METRIC_CATALOG}}', lines);
}
```

### Operational notes
- **Structured output**: use your provider's JSON / tool-use mode bound to `gp.card.schema.json` so the model returns parseable JSON.
- **Fallback**: if the model is unavailable or keeps failing validation, fall back to the heuristic parser (`parsePrompt()` from the prototype's `gps-dash.js`) — same output shape.
- **Privacy**: send only the prompt + catalog *metadata*. Never athlete PII.
- **Guardrails**: rate-limit per user; cache identical (prompt, catalog-hash) results; log everything to `ai_card_generations` for evaluation.
- **Human-in-the-loop is mandatory**: the generated CONFIG always opens in the builder for review before it becomes a saved card.
