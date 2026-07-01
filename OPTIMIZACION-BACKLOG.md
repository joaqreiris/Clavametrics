# ClavaMetrics — Backlog de optimización y mantenimiento

> Notas para el futuro. Ninguno es urgente. Anotado el 2026-06-15.

---

## ✅ Hecho (referencia)

- **Skeletons (shimmer)** en cards durante la carga → percepción de velocidad.
- **Build step (esbuild):** `npm run build` compila los `.jsx` → `.js` minificado (IIFE).
- **Babel eliminado** de las 43 páginas (codemod) → React production + `defer`. ~3 MB menos por página.
- **`defer`** en Chart.js + scripts `gps-*` → no bloquean el parseo.
- **Caché de roster por equipo** (`_gpRoster`) → ~15 fetches de `players` a 1-2.
- **Caché de catálogo** (`_gpCatalog`) ya existía (1 sola lectura al inicio).
- **Service worker** ya cachea bien lo same-origin → recargas rápidas.

**Flujo nuevo:** editar `.jsx` → `npm run build` → commitear el `.js`. Los `.jsx` son la fuente.

---

## 🟡 Pendiente — Base de datos / índices (bajo riesgo)

### 1. Falta índice de microciclo (el único hueco real)
Las cards del dashboard de microciclo filtran `training_sessions` por `(club_id, microcycle_id)` y hoy van sin índice.

```sql
create index if not exists idx_training_sessions_club_microcycle
  on training_sessions (club_id, microcycle_id);
```
Aditivo, seguro, no toca datos.

### 2. Índices redundantes (limpieza opcional — mejora un poco los inserts)
Hay duplicados que solo cuestan en escritura/almacenamiento:

- **`gps_reports`:**
  - `idx_gps_reports_player_session (player_id, session_id)` duplica al unique `gps_reports_player_id_session_id_key (player_id, session_id)`.
  - `gps_reports_session_id_idx (session_id)` queda cubierto por `idx_gps_reports_session (session_id, player_id)`.
- **`training_sessions`:**
  - `training_sessions_date_idx (club_id, session_date DESC)` duplica a `idx_training_sessions_club_date (club_id, session_date)`.
  - `training_sessions_club_id_idx (club_id)` queda cubierto por los compuestos que arrancan en `club_id`.

> ⚠️ Dropear índices es más delicado que agregarlos: verificar con `EXPLAIN (ANALYZE)` sobre las queries calientes que ninguna los prefiera, y hacerlo de a uno. No urgente.

---

## 🔵 Pendiente — Salud del código (NO acelera; mejora mantenibilidad/robustez)

### #3 — DRY (matar duplicación)
- `CORE_COLS` definido 5×. **No unificar a ciegas:** dos copias (`_ZT_`, `_VS_`) excluyen `avg_speed`, `hmld`, `distance_per_minute` a propósito. Si se unifica, hacerlo consciente de esa diferencia (o dejarlas separadas con un comentario).
- Roster ya unificado (`_gpRoster`).

### #4 — Unificar los dos sistemas de cards (mayor retorno a mediano plazo)
Conviven el resolver/builder (limpio, config-driven, `gp.card/v1`) y ~10 cards bespoke hechas a mano (cada una con su fetch+render). Migrar las bespoke al resolver donde la ciencia lo permita → un solo pipeline, caché compartido, features nuevas una vez en lugar de diez.
- **Dejar bespoke:** ACWR, CTL/ATL/TSB, velocity zones (ciencia que no encaja en el builder genérico).
- Refactor grande → hacerlo de a una card, con prueba de fuego.

### #5 — Partir el monolito
`GPS Analysis.html` ~12.000 líneas en un solo archivo. Separar en módulos ES por tema (filtros, cards, resolver, import) → más fácil de navegar y habilita carga on-demand. Bajo retorno de runtime, alto de mantenibilidad.

### #7 — Error boundaries por card
Envolver cada render en `try/catch` con un estado "no se pudo cargar". Una card que falla no debería romper el dashboard ni fallar en silencio. Robustez + más fácil de debuggear.

### (Opcional, percepción) Lazy-render de cards fuera de pantalla
Con `IntersectionObserver`: cada card fetchea/dibuja recién al entrar en el viewport. Recorta trabajo inicial en dashboards largos. Cambio más profundo (toca el montaje de cards).

---

## Orden sugerido cuando se retome
1. Índice de microciclo (5 min, gana algo de velocidad real).
2. #7 Error boundaries (robustez, contenido).
3. #4 Unificar cards, de a una (el de más retorno a futuro).
4. #5 Partir el monolito.
5. Limpieza de índices redundantes (con cuidado).
