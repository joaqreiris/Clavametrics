-- Clava FC (club de prueba) y Lorca Deportiva arrancan de cero, por decisión de producto: sus
-- dashboards quedan vacíos y se rearman con el builder.
--
-- Se deja el layout en '[]' y NO se borra la fila. La diferencia importa: una fila ausente el
-- cargador la lee como «primera carga» y vuelve a sembrar; un array vacío significa «esto se
-- vació a propósito» y no siembra nada (ver applyDefaultLayoutGeneric). Con el layout vacío,
-- cualquier card que siga existiendo queda guardada fuera del grid, no visible.
update gps_dashboard_layouts
set layout = '[]'::jsonb, updated_at = now()
where club_id in (
  select id from clubs where name in ('Clava FC', 'Club de Fútbol Lorca Deportiva')
);
