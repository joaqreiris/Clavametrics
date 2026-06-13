# ClavaMetrics — Limpieza de idioma a INGLÉS (todo lo que falta)

> **Availability.html NO está acá** (ya lo tenés en su propio MD).
> Correr de a poco, paso por paso. Son textos de UI visible. NO tocar comentarios ni lógica.
> Al final de cada archivo, verificar que no quede español buscando: `Cargando`, `Sin categorías`, `Categoría`, `Elegí`, `próximamente`.

---

## PASO 1 — assets/sidebar.js (chat panel)

**1.1** Buscar:
```
      html += `<div class="cm-cp-sect-lbl">Recientes</div>`;
```
Reemplazar:
```
      html += `<div class="cm-cp-sect-lbl">Recent</div>`;
```

**1.2** Buscar:
```
      html = '<div class="cm-cp-empty">No hay conversaciones</div>';
```
Reemplazar:
```
      html = '<div class="cm-cp-empty">No conversations</div>';
```

---

## PASO 2 — GPS Analysis.html

**2.1** `<option value="">Cargando…</option>` → `<option value="">Loading…</option>`

**2.2** Buscar:
```
>Elegí una sesión de referencia para comparar.</div>
```
Reemplazar:
```
>Pick a reference session to compare.</div>
```

**2.3** Buscar:
```
${card('ti-adjustments-alt','Crear a medida','Elegí métricas, tipo y agregación · abre el Chart builder.','',active==='custom','custom')}
```
Reemplazar:
```
${card('ti-adjustments-alt','Build custom','Pick metrics, type and aggregation · opens the Chart builder.','',active==='custom','custom')}
```

**2.4** Buscar:
```
<span class="t">Crear a medida</span>
```
Reemplazar:
```
<span class="t">Build custom</span>
```

**2.5** Buscar:
```
<span class="d">Elegí las métricas, el tipo de gráfico y la agregación. Se abre el Chart builder con un lienzo en blanco.</span>
```
Reemplazar:
```
<span class="d">Pick the metrics, chart type and aggregation. The Chart builder opens with a blank canvas.</span>
```

**2.6** Buscar:
```
if (!card) { showToast(`${name}: card no disponible`, true); return; }
```
Reemplazar:
```
if (!card) { showToast(`${name}: card unavailable`, true); return; }
```

**2.7** Buscar (aparece 2 veces, reemplazar ambas):
```
showToast('Error al guardar layout — revisá la consola', true);
```
Reemplazar:
```
showToast('Failed to save layout — check the console', true);
```

**2.8** Buscar:
```
if (!ctx) { showToast('Error al guardar — sesión no disponible', true); return; }
```
Reemplazar:
```
if (!ctx) { showToast('Failed to save — session unavailable', true); return; }
```

**2.9** Buscar:
```
if (error) { console.error('_svSave:', error); showToast('Error al guardar vista', true); return; }
```
Reemplazar:
```
if (error) { console.error('_svSave:', error); showToast('Failed to save view', true); return; }
```

**2.10** Buscar:
```
if (!ctx) { showToast('Error al cargar — sesión no disponible', true); return; }
```
Reemplazar:
```
if (!ctx) { showToast('Failed to load — session unavailable', true); return; }
```

**2.11** Buscar:
```
}).catch(e => { console.error('_svList:', e); showToast('Error al cargar vistas', true); });
```
Reemplazar:
```
}).catch(e => { console.error('_svList:', e); showToast('Failed to load views', true); });
```

**2.12** `sel.innerHTML='<option value="">Sin categorías</option>'; return;` → `sel.innerHTML='<option value="">No teams</option>'; return;`

**2.13** Buscar:
```
<i class="ti ti-alert-triangle" style="font-size:14px;flex-shrink:0"></i>Error al cargar esta tarjeta</div>
```
Reemplazar:
```
<i class="ti ti-alert-triangle" style="font-size:14px;flex-shrink:0"></i>Failed to load this card</div>
```

**2.14** Buscar:
```
Sin sesiones ${matchKey} equivalentes suficientes (encontradas: ${equivalents.length}, mínimo: ${_ZT_MIN}).
```
Reemplazar:
```
Not enough equivalent ${matchKey} sessions (found: ${equivalents.length}, minimum: ${_ZT_MIN}).
```

**2.15** Buscar (aparece 3 veces, reemplazar todas):
```
>Error al calcular.</div>
```
Reemplazar:
```
>Calculation failed.</div>
```

**2.16** Buscar:
```
>Elegí una fecha comparativa para ver el heatmap de outliers.</div>
```
Reemplazar:
```
>Pick a comparison date to see the outlier heatmap.</div>
```

**2.17** Buscar:
```
sel.innerHTML = `<option value="">Sin sesiones ${mdCode} disponibles</option>`;
```
Reemplazar:
```
sel.innerHTML = `<option value="">No ${mdCode} sessions available</option>`;
```

**2.18** Buscar:
```
>Elegí una sesión de referencia en el selector de arriba.</div>
```
Reemplazar:
```
>Pick a reference session in the selector above.</div>
```

---

## PASO 3 — RPE.html

**3.1** `<div ...>Cargando…</div>` (hay varios) → cambiar cada `Cargando…` por `Loading…`

**3.2** Buscar (aparece 2 veces):
```
<option value="">Elegí una sesión…</option>
```
Reemplazar:
```
<option value="">Pick a session…</option>
```

**3.3** Buscar:
```
<label style="display:block;font:500 12px/1 var(--cm-font-sans);color:var(--cm-fg-muted);margin-bottom:6px">Categoría</label>
```
Reemplazar:
```
<label style="display:block;font:500 12px/1 var(--cm-font-sans);color:var(--cm-fg-muted);margin-bottom:6px">Team</label>
```

**3.4** Buscar:
```
sel.innerHTML = '<option>Cargando…</option>';
```
Reemplazar:
```
sel.innerHTML = '<option>Loading…</option>';
```

**3.5** Buscar:
```
if (!teams.length) { sel.innerHTML = '<option value="">Sin categorías</option>'; return; }
```
Reemplazar:
```
if (!teams.length) { sel.innerHTML = '<option value="">No teams</option>'; return; }
```

> Nota: hay un par de `Cargando…` sueltos en RPE (líneas ~285 y ~880). Cambiar todos a `Loading…`.

---

## PASO 4 — Evaluations.html

**4.1** `<option value="">Cargando…</option>` → `<option value="">Loading…</option>`

**4.2** Buscar:
```
if (total<=14) { riskLevel='ALTO RIESGO de lesión'; riskCls='developing'; riskColor='#B91C1C'; }
```
Reemplazar:
```
if (total<=14) { riskLevel='HIGH injury risk'; riskCls='developing'; riskColor='#B91C1C'; }
```

**4.3** Buscar:
```
else if (total<=16) { riskLevel='Riesgo moderado'; riskCls='intermediate'; riskColor='#B45309'; }
```
Reemplazar:
```
else if (total<=16) { riskLevel='Moderate risk'; riskCls='intermediate'; riskColor='#B45309'; }
```

**4.4** Buscar:
```
else { riskLevel='Rango óptimo'; riskCls='elite'; riskColor='#15803D'; }
```
Reemplazar:
```
else { riskLevel='Optimal range'; riskCls='elite'; riskColor='#15803D'; }
```

**4.5** Buscar:
```
<div class="pa-section" style="margin-top:0">Desglose por test</div>
```
Reemplazar:
```
<div class="pa-section" style="margin-top:0">Breakdown by test</div>
```

**4.6** Buscar:
```
Score ≤ 14 → ALTO RIESGO de lesión (OR 11.7)<br>Score 15–16 → Riesgo moderado<br>Score 17–21 → Rango óptimo<br>
```
Reemplazar:
```
Score ≤ 14 → HIGH injury risk (OR 11.7)<br>Score 15–16 → Moderate risk<br>Score 17–21 → Optimal range<br>
```

**4.7** Buscar:
```
<div class="pa-section" style="margin-top:0">Rangos · Weight-Bearing Lunge Test</div>
```
Reemplazar:
```
<div class="pa-section" style="margin-top:0">Ranges · Weight-Bearing Lunge Test</div>
```

**4.8** Buscar:
```
<div class="pa-section" style="margin-top:0">Rangos normales en atletas · Lerebours et al. (2016)</div>
```
Reemplazar:
```
<div class="pa-section" style="margin-top:0">Normal athlete ranges · Lerebours et al. (2016)</div>
```

**4.9** Buscar:
```
if (has(er)&&(ir+er)<80) alerts.push({lv:'warn',msg:`🟡 Rango total ${side} = ${ir+er}° — Revisar movilidad de cadera`});
```
Reemplazar:
```
if (has(er)&&(ir+er)<80) alerts.push({lv:'warn',msg:`🟡 Total range ${side} = ${ir+er}° — Review hip mobility`});
```

**4.10** `if (!teams.length) { sel.innerHTML='<option value="">Sin categorías</option>'; return; }` → `... 'No teams' ...`

---

## PASO 5 — Selectores simples (mismo patrón en varios archivos)

En **CADA** uno de estos archivos hacer los 2 reemplazos:
- `<option value="">Cargando…</option>` → `<option value="">Loading…</option>`
- `'<option value="">Sin categorías</option>'` → `'<option value="">No teams</option>'`

Archivos:
- **Injuries.html**
- **Load Monitor.html**
- **Match Reports.html**
- **Gym Planner.html**
- **Sessions History.html**
- **Daily Planning.html** (el Cargando está en `<option value="">Cargando…</option>`)
- **lineup.js** (solo tiene el de "Sin categorías")
- **Calendar.html** (tiene `<option value="">Cargando…</option>` y el de Sin categorías)

---

## PASO 6 — Calendar.html (extra)

Buscar (aparece 2 veces, reemplazar ambas):
```
Sin planificación cargada en esta categoría todavía.
```
Reemplazar:
```
No plan loaded for this team yet.
```

---

## PASO 7 — Admin.html

**7.1** Cambiar todos los `Cargando…` por `Loading…` (líneas ~642, 688, 713, 1171, 1645 — son varios `<div>...Cargando…</div>` y `<td>...Cargando…</td>`).

**7.2** Buscar (aparece 2 veces — en "Sections" y "Security & SSO"):
```
<span class="sub">próximamente</span>
```
Reemplazar:
```
<span class="sub">coming soon</span>
```

**7.3** Buscar:
```
<div ...>No hay categorías. Creá categorías primero en "Add club / category".</div>
```
Reemplazar:
```
<div ...>No teams yet. Create teams first in "Add club / category".</div>
```
(mantener los estilos inline tal cual, solo cambiar el texto)

**7.4** Buscar:
```
_rowMenu.innerHTML = _rmItem('ti-shield-check','Change role') + _rmItem('ti-layout-grid','Edit sections') + _rmItem('ti-users-group','Categorías') + _rmItem('ti-mail','Copy email');
```
Reemplazar:
```
_rowMenu.innerHTML = _rmItem('ti-shield-check','Change role') + _rmItem('ti-layout-grid','Edit sections') + _rmItem('ti-users-group','Teams') + _rmItem('ti-mail','Copy email');
```

**7.5** Buscar:
```
      else if (act === 'Categorías') openMemberTeamsModal(id2);
```
Reemplazar:
```
      else if (act === 'Teams') openMemberTeamsModal(id2);
```

**7.6** Buscar:
```
<label style="display:block;font:500 12px/1 var(--cm-font-sans);color:var(--cm-fg-muted);margin-bottom:6px">Categorías / planteles</label>
```
Reemplazar:
```
<label style="display:block;font:500 12px/1 var(--cm-font-sans);color:var(--cm-fg-muted);margin-bottom:6px">Teams / squads</label>
```

**7.7** Buscar:
```
<div style="font:600 15px/1 var(--cm-font-sans);color:var(--cm-fg-strong)">Categorías · <span id="mtModalName">—</span></div>
```
Reemplazar:
```
<div style="font:600 15px/1 var(--cm-font-sans);color:var(--cm-fg-strong)">Teams · <span id="mtModalName">—</span></div>
```

---

## PASO 8 — Sessions Library.html

Buscar:
```
<span class="l">Categoría</span>
```
Reemplazar:
```
<span class="l">Team</span>
```

---

## VERIFICACIÓN FINAL

Después de correr todos los pasos, buscar en todo el repo estos términos para confirmar que no quede UI en español (ignorar los que estén dentro de comentarios `//` o `/* */`):

```
Cargando · Sin categorías · Categoría · Elegí · próximamente · Rango óptimo · ALTO RIESGO · Riesgo moderado · Desglose · No hay · Sin planificación · Sin sesiones · Recientes
```

Los que aparezcan en **comentarios de código** se pueden dejar (no son UI). Los que estén en texto visible, traducir.
