-- 107_normalize_gps_period_reports_metres.sql
-- ⚠️ MANUAL, ONE-TIME DATA FIX — run by hand in the Supabase SQL editor, PER CLUB,
--    step by step (inspect → update → verify → outliers). This is NOT a schema change
--    and should not be applied blindly by a migration runner.
--
-- WHY: gps_period_reports.total_distance for legacy data is in KM (the importer used to
-- store total_distance as km). gps_reports was already normalised to METRES; periods were
-- missed. Until fixed, v_gps_task_analysis shows total_distance_per_min ≈ 0 (garbage).
-- Only total_distance is affected — HSR/VHSR/sprint/hmld already arrive in metres from
-- Catapult (same as gps_reports). The importer now stores periods in metres (shared
-- normalizeMetrics, conv:1) — see supabase/functions/gps-sync/index.ts.
--
-- SAFETY: the UPDATE is self-guarded by `total_distance < 100`, so re-running it does
-- nothing (km×1000 lands in the thousands, no longer < 100). EDGE CASE: a genuinely short
-- drill measured in metres COULD be < 100 m (e.g. a 1-min rondo). For MOI ~99.7% of rows
-- are km, so < 100 is safe there — but ALWAYS run the inspect step first, and for other
-- clubs prefer the per-minute variant at the bottom (distinguishes km from metres by speed).

-- Replace with the target club each time:
--   MOI = 54ea81f9-9371-4588-9518-55cfdd63f43e

-- ── PART A.1 · inspect the rows that already look like METRES (>= 1 km) ──────────────
-- These are NOT touched by the update (< 100 filter). Review them: a few may be real
-- (a long drill ~1–9 km is plausible); any impossible ones go to PART C.
SELECT id, player_id, session_id, period_name, duration_seconds, total_distance
FROM gps_period_reports
WHERE club_id = '54ea81f9-9371-4588-9518-55cfdd63f43e'
  AND total_distance >= 1000
ORDER BY total_distance DESC;

-- ── PART A.2 · normalise km → metres (only the km rows: 0 < td < 100) ────────────────
UPDATE gps_period_reports
SET total_distance = total_distance * 1000
WHERE club_id = '54ea81f9-9371-4588-9518-55cfdd63f43e'
  AND total_distance < 100
  AND total_distance > 0;

-- ── PART A.3 · verify (expect ~9000–12000 m, NOT 9–12) ──────────────────────────────
SELECT round(max(total_distance)) AS max_total_distance_m,
       round(avg(total_distance)) AS avg_total_distance_m
FROM gps_period_reports
WHERE club_id = '54ea81f9-9371-4588-9518-55cfdd63f43e';

-- ── PART C · period outliers (GPS-in-vehicle noise) ─────────────────────────────────
-- Same threshold as the session importer: > 25 km in a single period is impossible.
-- (gps_period_reports has no is_invalid column, and v_gps_task_analysis already drops
--  these at read time via its speed cap total_distance/duration <= 13 m/s — so deleting
--  is optional cleanup, not required for correct analysis.)
-- 1) inspect:
SELECT id, player_id, session_id, period_name, duration_seconds, total_distance,
       round(total_distance / NULLIF(duration_seconds, 0), 2) AS m_per_s
FROM gps_period_reports
WHERE club_id = '54ea81f9-9371-4588-9518-55cfdd63f43e'
  AND total_distance > 25000
ORDER BY total_distance DESC;
-- 2) after reviewing, delete the confirmed-noise rows (uncomment to run):
-- DELETE FROM gps_period_reports
-- WHERE club_id = '54ea81f9-9371-4588-9518-55cfdd63f43e'
--   AND total_distance > 25000;

-- ── SAFER per-minute variant (recommended for OTHER clubs / mixed data) ─────────────
-- Instead of the < 100 heuristic, normalise only rows whose implied speed is impossibly
-- low when read as metres (i.e. they must be km). A real metres drill is ~1–4 m/s; a km
-- value read as metres is ~0.001–0.05 m/s. 0.5 m/s is a safe cutoff and never catches a
-- legit short drill. (Run the inspect first; then the UPDATE.)
-- SELECT id, period_name, duration_seconds, total_distance,
--        round(total_distance / NULLIF(duration_seconds,0), 4) AS m_per_s
-- FROM gps_period_reports
-- WHERE club_id = '<CLUB_ID>'
--   AND total_distance > 0 AND duration_seconds > 0
--   AND (total_distance / duration_seconds) < 0.5
-- ORDER BY total_distance DESC;
--
-- UPDATE gps_period_reports
-- SET total_distance = total_distance * 1000
-- WHERE club_id = '<CLUB_ID>'
--   AND total_distance > 0 AND duration_seconds > 0
--   AND (total_distance / duration_seconds) < 0.5;
