-- Migration 037: extend rehab_sessions with block metadata + exercises jsonb
-- Additive — does not break existing inserts.

alter table rehab_sessions
  add column if not exists phase_number  int,
  add column if not exists block_type    text,       -- str/warmup/mob/act/…
  add column if not exists owner         text,       -- 'sc' | 'physio' | 'coach' | name
  add column if not exists rpe_target    numeric,
  add column if not exists volume_sets   int,
  add column if not exists au            int,
  add column if not exists context_note  text,       -- e.g. "Avoid lockout"
  add column if not exists exercises     jsonb;      -- [{name,sets:[{reps,load,tempo,rest}],side,flag}]
