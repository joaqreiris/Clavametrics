-- Injury category and sub-classification columns
-- Evidence-based: BAMIC (Pollock 2014), ACL (van Melick 2016),
-- Ligament (Kerkhoffs 2012, Tassignon 2021), Tendon (Cook & Purdam 2009),
-- Bone (Boden & Osbahr 2000)

ALTER TABLE injuries
  ADD COLUMN IF NOT EXISTS injury_category TEXT
    CHECK (injury_category IN ('muscular','acl','ligament','tendon','bone','other'));

ALTER TABLE injuries
  ADD COLUMN IF NOT EXISTS sub_classification TEXT;

COMMENT ON COLUMN injuries.injury_category IS
  'Evidence-based category: muscular=BAMIC, acl=7-phase, ligament=Grade I/II/III, tendon=Cook/Purdam Stage 1-3, bone=stress/complete';

COMMENT ON COLUMN injuries.sub_classification IS
  'Sub-classification within category: grade_i/ii/iii (ligament), reactive/disrepair/degenerative (tendon), stress_low/stress_high/complete (bone)';
