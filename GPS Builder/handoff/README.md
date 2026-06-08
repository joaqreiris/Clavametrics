# handoff/ — integración a producción

Artefactos listos para el repo. Todo gira alrededor del contrato **`gp.card/v1`**.

| Archivo | Qué es | Dónde va |
|---|---|---|
| `gp.card.schema.json` | **JSON Schema** del CONFIG. Valida forma + regla pico (por ítem) + conteo de métricas por tipo (if/then). | Compartido cliente + servidor (Ajv). Validá al **escribir** card y al recibir salida de la **IA**. |
| `config-to-query.ts` | **Resolver** (stub): `validateConfig` (reglas de negocio), `noDataReason`, `configToQuery` (CONFIG→SQL), `resolveCard`, `normalize`. | Backend, detrás de `POST /api/cards/resolve`. Conectá tus tablas/columnas reales. |
| `ai-generate-card.md` | **System prompt** del modelo (con catálogo inyectado) + orquestación validar→reparar→auditar. | Backend, detrás de `POST /api/ai/generate-card`. |

## Orden sugerido
1. Publicá el **schema** y validá con Ajv en cliente y servidor (Fase 0 del `MIGRATION.md`).
2. Implementá `config-to-query.ts` contra tu warehouse → así las cards dejan de ser mock (Fase 2).
3. Enchufá la IA con `ai-generate-card.md`; cae en el mismo editor para revisión humana (Fase 4).

> El parser heurístico del prototipo (`parsePrompt()` en `gps-dash.js`) queda como **fallback offline** de la IA — misma forma de salida.

Detalle completo del plan: ver `../MIGRATION.md`.
