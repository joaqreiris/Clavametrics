# Cómo restaurar

> Un backup que nunca se probó no es un backup. Hacé el simulacro del final **antes**
> de necesitarlo, no el día que se rompa algo.

## Qué cubre cada cosa

| | Backup diario de Supabase (Pro) | `scripts/backup.mjs` |
|---|---|---|
| Tablas, funciones, policies, triggers | Sí | Sí |
| **Archivos de Storage** (fotos, adjuntos, documentos médicos) | **No** | **Sí** |
| Retención | 7 días | las últimas 4 copias |
| Sobrevive si se borra el proyecto | No | Sí |
| Restaurar una sola tabla | No (es todo o nada) | Sí |
| Granularidad | 1 por día | cuando lo corras |

Los backups de Supabase guardan solo los *metadatos* de Storage (la tabla `storage.objects`),
no los archivos. Si se pierden los archivos, restaurar desde el panel deja la base
apuntando a archivos que ya no existen.

## Caso 1 — se rompió algo hoy y hay que volver atrás horas

Panel: **Database → Backups**, elegir el backup diario anterior al problema y restaurar.

- El proyecto queda **inaccesible** mientras dura. Avisá antes.
- Se pierde todo lo cargado desde ese backup: hasta 24 h de trabajo del cuerpo técnico.
- Si hay roles personalizados, sus contraseñas no vienen en el backup: hay que resetearlas.
- Realtime se maneja solo; otros slots de replicación hay que borrarlos y rehacerlos.

## Caso 2 — se borró una tabla o unas filas concretas

No restaures el proyecto entero por esto. Usá el dump lógico:

```bash
# ver qué hay adentro
grep -n "CREATE TABLE public.availability" backups/2026-09-05/db-2026-09-05.sql

# extraer solo lo de esa tabla a un archivo aparte y revisarlo ANTES de correrlo
psql "$SUPABASE_DB_URL" -f solo-esa-tabla.sql
```

Restaurar el dump entero encima de una base con datos **duplica o pisa**. Extraé solo
lo que necesitás.

## Caso 3 — se perdieron archivos de Storage

Solo lo cubre `scripts/backup.mjs`. Los archivos quedan en
`backups/<fecha>/storage/<bucket>/<ruta>`, con la misma estructura de rutas que en
producción, así que las filas que los referencian siguen valiendo al volver a subirlos.

## Caso 4 — probar sin tocar producción (hacé esto)

Panel: **Database → Backups → Restore to new project**. Levanta una copia aparte.
Entrá, mirá que estén los datos del día anterior, y borrala. Cuesta unos minutos y es
la única forma de saber que el backup sirve.

## Simulacro recomendado, una vez

1. Corré `node scripts/backup.mjs --apply` y mirá que el `.sql` tenga tus tablas y que
   `storage/` tenga los archivos.
2. Restaurá a un proyecto nuevo desde el panel y entrá a ver.
3. Anotá cuánto tardó. Ese número es tu tiempo real de recuperación.
