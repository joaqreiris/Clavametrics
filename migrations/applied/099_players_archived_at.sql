-- Migration 099: soft-delete para players. archived_at IS NULL = activo; non-null = archivado
-- (oculto de rosters/pickers/búsqueda, data preservada y reversible). Distinto de `status`
-- (que es disponibilidad). Migra el viejo truco status='inactive' al mecanismo nuevo. Idempotente.

alter table public.players
  add column if not exists archived_at timestamptz;

-- migrar los que ya estaban "archivados" con el truco viejo
update public.players
  set archived_at = now()
  where status = 'inactive' and archived_at is null;
