# ClavaMetrics — Nutrition Module · Especificación completa (Blueprint)

> Documento maestro para construir el módulo de Nutrition desde cero.
> Estado actual: la página `Nutrition.html` es ~90% mock (datos hardcodeados). Solo la lista de jugadores y el donut de intake usan datos reales (tabla `nutrition`).
> **REGLA: todo el texto de UI en INGLÉS** (la web es en inglés, se traduce vía i18n).

---

## 1. Visión del módulo

Módulo de nutrición completo para staff de clubes:
1. **Base de alimentos global** (catálogo maestro compartido entre todos los clubes) con contenido nutricional aproximado.
2. **Meal plans por template + tipo de día** (MD, MD-1, MD-2, rest...) que se asignan a varios jugadores.
3. **Escalado individual**: cada jugador tiene su target calórico (calculado con modelos científicos), y el template se escala a sus necesidades.
4. **Generación con IA**: crear/sugerir planes según gustos y necesidades del jugador (usando la base de alimentos).
5. **Seguimiento**: weigh-ins / composición corporal, evolución, KPIs.

---

## 2. Decisiones de diseño tomadas

| Decisión | Resolución |
|---|---|
| Base de alimentos | **Global compartida** (sin club_id) — catálogo maestro a nivel plataforma |
| Estructura de meal plan | **Templates por tipo de día** (MD/MD-1/MD-2/rest) que se asignan a fechas |
| Asignación | **Plan base reutilizable + ajuste individual** (se asigna a varios jugadores, cada uno con su escalado/override) |
| Target calórico | **Calculado por fórmula científica** (varios modelos, el nutri elige) **+ ajuste manual** |
| Modelos RMR | **Ofrecer todos** con explicación breve + cita al paper |

---

## 3. Modelo de datos (tablas)

### 3.1 `foods` — catálogo global de alimentos (SIN club_id)
```sql
create table public.foods (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text,                    -- protein | carb | fat | vegetable | fruit | dairy | supplement | other
  -- valores por 100g (estándar de referencia)
  kcal          numeric not null,
  protein_g     numeric not null default 0,
  carbs_g       numeric not null default 0,
  fats_g        numeric not null default 0,
  fiber_g       numeric default 0,
  -- presentación
  default_unit  text default 'g',        -- g | ml | unit
  per_unit_grams numeric,                -- si default_unit='unit', cuántos gramos pesa 1 unidad (ej. 1 banana = 120g)
  source        text,                    -- 'USDA' | 'manual' | 'ai' (procedencia del dato)
  is_verified   boolean default false,   -- si un admin validó el dato nutricional
  created_at    timestamptz default now()
);
-- Catálogo global: lectura para todos los usuarios autenticados, escritura solo super-admin.
alter table public.foods enable row level security;
create policy foods_read on public.foods for select using (auth.role() = 'authenticated');
-- (escritura vía service role / super-admin; definir policy específica)
```

### 3.2 `nutrition_targets` — objetivos por jugador
```sql
create table public.nutrition_targets (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references public.players(id) on delete cascade,
  club_id         uuid not null references public.clubs(id) on delete cascade,
  -- modelo usado para el cálculo
  rmr_model       text not null default 'ten_haaf',  -- ten_haaf | cunningham | de_lorenzo | harris_benedict | mifflin
  rmr_kcal        numeric,                 -- RMR calculado
  activity_factor numeric default 1.6,     -- multiplicador para TDEE (ajustable por carga)
  tdee_kcal       numeric,                 -- RMR × activity_factor (gasto total estimado)
  -- targets (pueden ser auto-calculados o ajustados a mano)
  kcal_target     numeric,
  protein_g       numeric,
  carbs_g         numeric,
  fats_g          numeric,
  hydration_ml    numeric,
  body_fat_target_pct numeric,
  target_date     date,                    -- fecha objetivo (ej. body fat 8.5% by Jul 1)
  manual_override boolean default false,   -- si el nutri ajustó a mano (no recalcular automáticamente)
  notes           text,
  updated_by      uuid references public.profiles(id),
  updated_at      timestamptz default now(),
  created_at      timestamptz default now(),
  unique(player_id)                        -- un target activo por jugador (o quitar unique si se versiona)
);
alter table public.nutrition_targets enable row level security;
-- RLS por club (mismo patrón que el resto)
```

### 3.3 `meal_plan_templates` — plantilla por tipo de día (por club)
```sql
create table public.meal_plan_templates (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  name          text not null,            -- "MD-1 carb loading", "Rest day", etc.
  day_type      text,                     -- MD | MD-1 | MD-2 | MD-3 | MD+1 | rest | custom
  base_kcal     numeric,                  -- kcal de referencia del template (para escalar)
  notes         text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz default now()
);
alter table public.meal_plan_templates enable row level security;
```

### 3.4 `meal_plan_meals` — las comidas de un template
```sql
create table public.meal_plan_meals (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.meal_plan_templates(id) on delete cascade,
  meal_order    int not null default 0,   -- orden (1=breakfast, 2=snack, ...)
  name          text not null,            -- "Breakfast", "Pre-training", "Lunch", ...
  time_hint     text                      -- "08:00", "pre-training", etc.
);
alter table public.meal_plan_meals enable row level security;
```

### 3.5 `meal_plan_items` — alimentos de cada comida
```sql
create table public.meal_plan_items (
  id            uuid primary key default gen_random_uuid(),
  meal_id       uuid not null references public.meal_plan_meals(id) on delete cascade,
  food_id       uuid not null references public.foods(id),
  quantity_g    numeric not null,         -- cantidad en gramos (o ml)
  -- los macros se CALCULAN de foods × (quantity_g / 100), no se guardan duplicados
  note          text
);
alter table public.meal_plan_items enable row level security;
```

### 3.6 `player_meal_assignments` — template asignado a jugador
```sql
create table public.player_meal_assignments (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players(id) on delete cascade,
  club_id       uuid not null references public.clubs(id) on delete cascade,
  template_id   uuid not null references public.meal_plan_templates(id) on delete cascade,
  -- asignación: por fecha concreta O por tipo de día (auto-aplica)
  assigned_date date,                      -- si es para un día puntual
  day_type      text,                      -- si auto-aplica a todos los días de ese tipo
  scale_factor  numeric default 1.0,       -- escalado vs el target del jugador (auto)
  custom_overrides jsonb,                  -- ajustes finos manuales (ej. swap de alimentos)
  created_at    timestamptz default now()
);
alter table public.player_meal_assignments enable row level security;
```

### 3.7 `body_composition` — weigh-ins / evolución
```sql
create table public.body_composition (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players(id) on delete cascade,
  club_id       uuid not null references public.clubs(id) on delete cascade,
  measured_date date not null,
  weight_kg     numeric,
  body_fat_pct  numeric,
  lean_mass_kg  numeric,                   -- calculable: weight × (1 - bf/100)
  method        text,                      -- 'skinfold' | 'bia' | 'dexa' | 'scale'
  notes         text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz default now()
);
alter table public.body_composition enable row level security;
```

### 3.8 `nutrition` (YA EXISTE) — log diario de consumo real
```
player_id, club_id, log_date, calories, protein, carbs, fats, hydration, notes
```
Se mantiene como está. Es el consumo real registrado (alimenta "intake vs target").

---

## 4. Modelos de RMR (con fórmulas y citas)

El nutri elige el modelo. Mostrar nombre + explicación breve + cita. **Default: Ten-Haaf.**

> Referencia general de selección: O'Neill JER, Corish CA, Horner K. *Accuracy of Resting Metabolic Rate Prediction Equations in Athletes: A Systematic Review with Meta-analysis.* Sports Medicine 2023. DOI: 10.1007/s40279-023-01896-z. — Concluye que Ten-Haaf es la más precisa (80.2% dentro de ±10% de lo medido), y que Cunningham, Harris-Benedict, De Lorenzo y Ten-Haaf no difieren significativamente de los valores medidos en atletas.

### Ten-Haaf (2014) — DEFAULT recomendado
- **Variables:** peso, altura, edad, sexo. No requiere composición corporal.
- **Por qué:** la más precisa y consistente en atletas (sin la heterogeneidad de las otras).
- **Caución:** validada en rangos ~68–84 kg (hombres); verificar que el jugador encaje.
- **Cita:** ten Haaf T, Weijs PJ. *Resting energy expenditure prediction in recreational athletes of 18–35 years.* PLoS ONE 2014;9(9):e108460.
- **Fórmula (peso+altura+edad, ec. validada):** confirmar coeficientes exactos del paper PMC4183531 al implementar.

### Cunningham (1980 / 1991) — mejor con composición corporal
- **Variables:** masa magra (LBM/FFM). Requiere `body_fat_pct`.
- **Por qué:** más precisa en atletas con alta masa muscular (músculo = metabólicamente activo). Avalada por ACSM.
- **Fórmula (1980):** RMR = 500 + 22 × LBM(kg). *(confirmar al implementar)*
- **LBM si hay % graso:** LBM = peso × (1 − bodyfat/100).
- **Cita:** Cunningham JJ. *Am J Clin Nutr* 1980/1991.

### De Lorenzo (1999) — específica de atletas
- **Variables:** peso, altura, edad.
- **Cita:** De Lorenzo A et al. *J Sports Med Phys Fitness* 1999.

### Harris-Benedict (1918) — clásica, avalada por ACSM
- **Variables:** peso, altura, edad, sexo.
- **Cita:** Harris JA, Benedict FG. 1918.

### Mifflin-St. Jeor (1990) — la más usada, cautela en atletas
- **Variables:** peso, altura, edad, sexo.
- **Fórmula:** RMR = (10 × peso kg) + (6.25 × altura cm) − (5 × edad) + s  (s = +5 hombres, −161 mujeres).
- **Caución:** tiende a subestimar en atletas.
- **Cita:** Mifflin MD, St Jeor ST et al. *Am J Clin Nutr* 1990.

### TDEE (gasto total)
TDEE = RMR × activity_factor. El `activity_factor` puede ajustarse por la carga del día (conectar con datos GPS/sesión: día MD pesa más que rest). Esto da el `kcal_target` que escala los templates.

> **IMPORTANTE al implementar:** confirmar los coeficientes EXACTOS de cada fórmula leyendo el paper original. NO usar coeficientes de memoria — verificar contra la fuente (PubMed/PMC).

---

## 5. Cómo se conecta con la UI actual (qué reemplaza cada mock)

| Sección mock actual | Fuente real nueva |
|---|---|
| KPIs (active plans, hydration %, body comp, flags) | Calculados de `nutrition_targets` + `nutrition` + `body_composition` + assignments |
| Panel jugador (peso, edad, targets) | `players` + `nutrition_targets` + último `body_composition` |
| Today · intake vs target (donut) | `nutrition` (real, hoy) vs `nutrition_targets` |
| Targets (kcal, water, body fat) | `nutrition_targets` |
| Today's meal plan (5 platos) | template asignado al día (`player_meal_assignments` → `meal_plan_meals` → `meal_plan_items` → `foods`) |
| Gráfico evolución peso/grasa | `body_composition` (serie temporal) |
| Attention notes | derivadas (jugador lejos del target, sin weigh-in reciente, etc.) o tabla de flags |

---

## 6. Plan de construcción por fases

**Fase A — Fundaciones de datos**
1. Crear las 7 tablas nuevas (SQL de arriba) + RLS por club.
2. Sembrar `foods` con un set inicial (USDA o IA): ~100-200 alimentos comunes con macros por 100g.
3. Helper de cálculo: función JS que dado un `meal_plan_item` (food + quantity) devuelve kcal/macros.

**Fase B — Targets + calculadora RMR**
1. UI para definir target por jugador: elegir modelo RMR, mostrar explicación+cita, calcular, permitir override manual.
2. Implementar las fórmulas (confirmando coeficientes del paper).
3. Cablear el panel del jugador (reemplazar mock por `nutrition_targets` real).

**Fase C — Templates + meal plans**
1. UI para crear templates por tipo de día.
2. Editor de comidas: agregar comidas → buscar alimentos en `foods` → setear cantidades → ver macros calculados en vivo.
3. Asignar template a jugadores (con escalado al target).
4. Cablear "Today's meal plan" (reemplazar los 5 platos hardcodeados).

**Fase D — Composición corporal + evolución**
1. UI para registrar weigh-ins (`body_composition`).
2. Cablear el gráfico de evolución (reemplazar el SVG hardcodeado).

**Fase E — KPIs reales + flags**
1. Calcular los 4 KPIs de datos reales.
2. Lógica de flags/attention.

**Fase F — IA (generación de planes)**
1. Botón "Generate plan with AI": dado un jugador (target, gustos, restricciones), llamar a Claude para que arme un meal plan eligiendo de `foods`.
2. Insertar el resultado como template + items.
3. Conecta con la capacidad de "Claude en Artifacts/API" que ya manejás.

---

## 7. Coherencia con el resto de ClavaMetrics

- **Por categoría:** la lista de jugadores ya se filtra por `cal_active_team` (hecho). Targets, assignments y body_comp cuelgan de player_id → se aíslan solos.
- **`foods` es global** (como un catálogo de plataforma), igual criterio que las bibliotecas de ejercicios son club-wide.
- **Templates son por club** (cada club arma los suyos), como Sessions/Gym Library.
- **Texto UI en inglés** por regla.
- **Patrón de escalado** (template base → ajuste individual) es análogo a cómo Daily Planning escala cargas por jugador.

---

## 8. Preguntas abiertas para próximas sesiones

1. ¿`nutrition_targets` se versiona (historial de targets) o es uno activo por jugador? (hoy: unique por player_id).
2. ¿Los gustos/restricciones del jugador (alergias, vegetariano, no le gusta X) se guardan en una tabla aparte (`player_food_preferences`) para alimentar la IA? — probablemente SÍ.
3. ¿El jugador puede ver su propio plan (vía link tokenizado, como wellness/RPE survey)?
4. Activity factor: ¿manual, o auto desde la carga GPS/sesión del día?
5. Seed de `foods`: ¿USDA FoodData Central (público) como fuente inicial?
