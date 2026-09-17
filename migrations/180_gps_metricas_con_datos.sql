-- Migración 180: saber qué métricas tienen datos, en una sola consulta.
--
-- El Chart Builder marca «sin datos» las métricas que no tienen ni un valor cargado, y lo
-- averiguaba con UNA CONSULTA POR MÉTRICA: trece a gps_reports (una por columna) más una a
-- gps_report_metrics por cada métrica propia del club. En la red de un club real eran ~15
-- consultas de ~0,9 kB haciendo cola sólo para decidir qué ofrecer en el panel de campos.
--
-- Acá va todo junto. Cada EXISTS corta en cuanto encuentra la primera fila, así que el costo es el
-- de trece búsquedas que paran al primer acierto: medido en ese club, ~1 ms.
--
-- SECURITY INVOKER a propósito: la respuesta tiene que ser lo que ESTE usuario puede ver. Con
-- DEFINER saltearía la RLS y el builder ofrecería métricas de datos que el usuario no alcanza.
CREATE OR REPLACE FUNCTION public.gps_metricas_con_datos(p_club_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_remove(ARRAY[
    CASE WHEN EXISTS(SELECT 1 FROM gps_reports r WHERE r.club_id = p_club_id AND r.total_distance           IS NOT NULL) THEN 'total_distance'           END,
    CASE WHEN EXISTS(SELECT 1 FROM gps_reports r WHERE r.club_id = p_club_id AND r.high_speed_distance      IS NOT NULL) THEN 'high_speed_distance'      END,
    CASE WHEN EXISTS(SELECT 1 FROM gps_reports r WHERE r.club_id = p_club_id AND r.sprint_distance          IS NOT NULL) THEN 'sprint_distance'          END,
    CASE WHEN EXISTS(SELECT 1 FROM gps_reports r WHERE r.club_id = p_club_id AND r.accelerations            IS NOT NULL) THEN 'accelerations'            END,
    CASE WHEN EXISTS(SELECT 1 FROM gps_reports r WHERE r.club_id = p_club_id AND r.decelerations            IS NOT NULL) THEN 'decelerations'            END,
    CASE WHEN EXISTS(SELECT 1 FROM gps_reports r WHERE r.club_id = p_club_id AND r.max_speed                IS NOT NULL) THEN 'max_speed'                END,
    CASE WHEN EXISTS(SELECT 1 FROM gps_reports r WHERE r.club_id = p_club_id AND r.player_load              IS NOT NULL) THEN 'player_load'              END,
    CASE WHEN EXISTS(SELECT 1 FROM gps_reports r WHERE r.club_id = p_club_id AND r.avg_speed                IS NOT NULL) THEN 'avg_speed'                END,
    CASE WHEN EXISTS(SELECT 1 FROM gps_reports r WHERE r.club_id = p_club_id AND r.very_high_speed_distance IS NOT NULL) THEN 'very_high_speed_distance' END,
    CASE WHEN EXISTS(SELECT 1 FROM gps_reports r WHERE r.club_id = p_club_id AND r.hmld                     IS NOT NULL) THEN 'hmld'                     END,
    CASE WHEN EXISTS(SELECT 1 FROM gps_reports r WHERE r.club_id = p_club_id AND r.time_played              IS NOT NULL) THEN 'time_played'              END,
    CASE WHEN EXISTS(SELECT 1 FROM gps_reports r WHERE r.club_id = p_club_id AND r.sprint_count             IS NOT NULL) THEN 'sprint_count'             END,
    CASE WHEN EXISTS(SELECT 1 FROM gps_reports r WHERE r.club_id = p_club_id AND r.distance_per_minute      IS NOT NULL) THEN 'distance_per_minute'      END
  ], NULL), '{}')
  ||
  COALESCE((SELECT array_agg(DISTINCT m.metric_key)
              FROM gps_report_metrics m
             WHERE m.club_id = p_club_id AND m.value IS NOT NULL), '{}');
$$;

GRANT EXECUTE ON FUNCTION public.gps_metricas_con_datos(uuid) TO authenticated;
