# Prompt 00 — Preparación

Copia y pega esto como primer mensaje a Claude Code en VSCode:

---

```
Hola. Vamos a hacer una migración de 7 pantallas nuevas + componentes de
soporte al repo Clavametrics. El plan completo está en
`migration-package/MIGRATION_PLAN.md` — leelo primero.

Reglas críticas (de CLAUDE_RULES.md):
- NO reescribir archivos existentes
- NO tocar CSS existente
- Modificaciones quirúrgicas únicamente
- Reutilizar helpers de supabase-init.js

Antes de empezar la Fase 1 (Billing), hacé esto:

1. Verificá que el repo está limpio (`git status`).
2. Verificá que `npm test` pasa (baseline antes de tocar nada).
3. Listá los archivos en `migration-package/files-to-add/` para confirmar
   que están presentes.
4. Leé `MIGRATION_PLAN.md` completo y devolveme un resumen en 5 bullets
   de qué vamos a hacer.

NO copies ningún archivo todavía. Solo prep + entender.
```

---

## Qué esperar de Claude Code

Debería:
1. Correr `git status` y `npm test`.
2. Listar el contenido de `migration-package/`.
3. Devolverte un resumen del plan.

Si algo no pasa (tests rojos, archivos faltantes), **parar y resolver antes de continuar.**

Cuando todo esté verde, pasar a `01-billing.md`.
