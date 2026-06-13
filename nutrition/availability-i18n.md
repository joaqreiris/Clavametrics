# Availability.html — Traducción de UI a inglés

Aplicar todos estos find/replace. Son textos de UI visible (no tocar lógica ni comentarios).

---

### 1. Selector de categoría — "Cargando…"
**Buscar:**
```
<option value="">Cargando…</option>
```
**Reemplazar:**
```
<option value="">Loading…</option>
```

### 2. Preset — Microciclo actual
**Buscar:**
```
>Microciclo actual</button>
```
**Reemplazar:**
```
>Current microcycle</button>
```

### 3. Preset — Última semana
**Buscar:**
```
>Última semana</button>
```
**Reemplazar:**
```
>Last week</button>
```

### 4. Preset — Últimas 2 semanas
**Buscar:**
```
>Últimas 2 semanas</button>
```
**Reemplazar:**
```
>Last 2 weeks</button>
```

### 5. Preset — Último mes
**Buscar:**
```
>Último mes</button>
```
**Reemplazar:**
```
>Last month</button>
```

### 6. Label — Personalizado
**Buscar:**
```
>Personalizado</label>
```
**Reemplazar:**
```
>Custom</label>
```

### 7. Vista de hoy
**Buscar:**
```
>Vista de hoy — próximamente.</div>
```
**Reemplazar:**
```
>Today view — coming soon.</div>
```

### 8. Label nombre — Rango personalizado
**Buscar:**
```
if (nameEl) nameEl.textContent = 'Rango personalizado';
```
**Reemplazar:**
```
if (nameEl) nameEl.textContent = 'Custom range';
```

### 9. Label picker — Rango
**Buscar:**
```
if (pickerEl) pickerEl.textContent = 'Rango';
```
**Reemplazar:**
```
if (pickerEl) pickerEl.textContent = 'Range';
```

### 10. Selector — Sin categorías
**Buscar:**
```
sel.innerHTML='<option value="">Sin categorías</option>'; return;
```
**Reemplazar:**
```
sel.innerHTML='<option value="">No teams</option>'; return;
```

### 11. Stats — Calculando
**Buscar:**
```
>Calculando estadísticas…</div>
```
**Reemplazar:**
```
>Calculating stats…</div>
```

### 12. Stats — Sin rango
**Buscar:**
```
>Sin rango seleccionado.</div>
```
**Reemplazar:**
```
>No range selected.</div>
```

### 13. Stats — Sin jugadores
**Buscar:**
```
>No hay jugadores en esta categoría.</div>
```
**Reemplazar:**
```
>No players in this team.</div>
```

### 14. KPI — Disponibilidad media
**Buscar:**
```
${kpi('ti-circle-check','Disponibilidad media', availPct+'<span style="font-size:17px">%</span>', `${tAvail} de ${tTotal} días-jugador`, 'var(--cm-success)')}
```
**Reemplazar:**
```
${kpi('ti-circle-check','Avg availability', availPct+'<span style="font-size:17px">%</span>', `${tAvail} of ${tTotal} player-days`, 'var(--cm-success)')}
```

### 15. KPI — Días perdidos lesión
**Buscar:**
```
${kpi('ti-bandage','Días perdidos · lesión', tInjury, tTotal?`${Math.round(tInjury/tTotal*100)}% del período`:'', 'var(--cm-danger)')}
```
**Reemplazar:**
```
${kpi('ti-bandage','Days lost · injury', tInjury, tTotal?`${Math.round(tInjury/tTotal*100)}% of period`:'', 'var(--cm-danger)')}
```

### 16. KPI — Días perdidos enfermedad
**Buscar:**
```
${kpi('ti-virus','Días perdidos · enfermedad', tIllness, tTotal?`${Math.round(tIllness/tTotal*100)}% del período`:'', 'var(--cm-violet)')}
```
**Reemplazar:**
```
${kpi('ti-virus','Days lost · illness', tIllness, tTotal?`${Math.round(tIllness/tTotal*100)}% of period`:'', 'var(--cm-violet)')}
```

### 17. KPI — Días modificados
**Buscar:**
```
${kpi('ti-adjustments','Días modificados', tPartial, tTotal?`${Math.round(tPartial/tTotal*100)}% del período`:'', 'var(--cm-warning)')}
```
**Reemplazar:**
```
${kpi('ti-adjustments','Modified days', tPartial, tTotal?`${Math.round(tPartial/tTotal*100)}% of period`:'', 'var(--cm-warning)')}
```

### 18. Ranking por jugador
**Buscar:**
```
>Ranking por jugador</span>
```
**Reemplazar:**
```
>Player ranking</span>
```

### 19. Columna — Disp.
**Buscar:**
```
cursor:pointer">Disp.</th>
```
**Reemplazar:**
```
cursor:pointer">Avail.</th>
```

### 20. Columna — Les.
**Buscar:**
```
cursor:pointer">Les.</th>
```
**Reemplazar:**
```
cursor:pointer">Inj.</th>
```

### 21. Columna — Enf.
**Buscar:**
```
cursor:pointer">Enf.</th>
```
**Reemplazar:**
```
cursor:pointer">Ill.</th>
```

### 22. Columna — % Disponibilidad
**Buscar:**
```
min-width:130px">% Disponibilidad</th>
```
**Reemplazar:**
```
min-width:130px">% Availability</th>
```

### 23. Desglose del equipo
**Buscar:**
```
>Desglose del equipo</div>
```
**Reemplazar:**
```
>Team breakdown</div>
```

### 24. Donut centro — disponible
**Buscar:**
```
margin-top:2px">disponible</div>
```
**Reemplazar:**
```
margin-top:2px">available</div>
```

### 25. Hint — click en columna
**Buscar:**
```
>click en columna para ordenar</span>
```
**Reemplazar:**
```
>click a column to sort</span>
```

### 26-30. Labels del área chart (trend)
**Buscar:**
```
mk('Disponible', tsAvail, '#16A34A'),
```
**Reemplazar:**
```
mk('Available', tsAvail, '#16A34A'),
```

**Buscar:**
```
mk('Modificado', tsPartial, '#D97706'),
```
**Reemplazar:**
```
mk('Modified', tsPartial, '#D97706'),
```

**Buscar:**
```
mk('Lesión', tsInjury, '#DC2626'),
```
**Reemplazar:**
```
mk('Injury', tsInjury, '#DC2626'),
```

**Buscar:**
```
mk('Enfermedad', tsIllness, '#7C3AED')
```
**Reemplazar:**
```
mk('Illness', tsIllness, '#7C3AED')
```

### 31-34. Labels del donut
**Buscar:**
```
{ label:'Disponible', val:tAvail, color:'#16A34A' },
```
**Reemplazar:**
```
{ label:'Available', val:tAvail, color:'#16A34A' },
```

**Buscar:**
```
{ label:'Modificado', val:tPartial, color:'#D97706' },
```
**Reemplazar:**
```
{ label:'Modified', val:tPartial, color:'#D97706' },
```

**Buscar:**
```
{ label:'Lesión', val:tInjury, color:'#DC2626' },
```
**Reemplazar:**
```
{ label:'Injury', val:tInjury, color:'#DC2626' },
```

**Buscar:**
```
{ label:'Enfermedad', val:tIllness, color:'#7C3AED' }
```
**Reemplazar:**
```
{ label:'Illness', val:tIllness, color:'#7C3AED' }
```

### 35. Título — Evolución de disponibilidad
**Buscar:**
```
>Evolución de disponibilidad</span>
```
**Reemplazar:**
```
>Availability trend</span>
```

---

**Nota:** La columna "Mod." queda igual (es la misma abreviatura en inglés). Verificar al final que no quede ningún texto en español buscando: Disponib, Día, Lesión, Enfermedad, Rango, Microciclo.
