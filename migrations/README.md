# Migraciones — ClavaMetrics

## ⚠️ Fuente de verdad del esquema: [`../db/schema.sql`](../db/schema.sql)

El esquema **vivo y completo** de la base (104 tablas, FKs, RLS, triggers, funciones,
vistas) está reconstruido por introspección en vivo en **[`db/schema.sql`](../db/schema.sql)**.
Ese es el archivo único que describe la DB. El diagrama por dominio está en
[`docs/schema-diagram.md`](../docs/schema-diagram.md) y la auditoría en
[`docs/migrations-audit.md`](../docs/migrations-audit.md).

## Estructura

```
migrations/
├── README.md          ← este archivo
├── applied/           ← histórico: 106 migraciones YA aplicadas a prod (read-only)
└── legacy/            ← predecesores sin numerar del esquema base (read-only)
```

- **`applied/`** — todas las migraciones que ya corrieron en la DB de producción
  (004→103, con algunos números duplicados y headers con número equivocado, fruto de
  aplicarlas a mano sin runner). Se conservan como **registro histórico**. NO re-aplicar,
  NO renumerar: ya están reflejadas en `db/schema.sql`.
- **`legacy/`** — SQL viejos sin numerar que crearon parte del esquema base.

## Cómo hacer cambios de esquema de ahora en más

No agregar archivos sueltos a mano. Usar el runner de Supabase, que numera por timestamp
y evita los duplicados/olvidos del pasado:

```bash
supabase migration new <nombre_descriptivo>   # crea supabase/migrations/<ts>_<nombre>.sql
# editar el SQL...
supabase db push                              # aplica a la DB linkeada
```

Tras aplicar, **regenerar `db/schema.sql`** para que la fuente de verdad quede al día
(ver el método en `docs/migrations-audit.md` §7, Paso 1).
