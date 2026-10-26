-- Run on testing first, then production after approval. No data mapping or deletion.
-- Existing programme/year values and vote audiences remain untouched.
BEGIN;
ALTER TABLE student_classes ALTER COLUMN programme DROP NOT NULL;
ALTER TABLE student_classes ALTER COLUMN year DROP NOT NULL;
ALTER TABLE student_classes ADD COLUMN IF NOT EXISTS class_name text;
ALTER TABLE student_classes ADD COLUMN IF NOT EXISTS review_required boolean NOT NULL DEFAULT false;
ALTER TABLE student_classes DROP CONSTRAINT IF EXISTS student_classes_canonical_name_check;
ALTER TABLE student_classes ADD CONSTRAINT student_classes_canonical_name_check
  CHECK (class_name IS NULL OR class_name IN ('S1', 'S2', 'G1', 'G2', 'G3', 'G4', 'Pre-IB 1', 'Pre-IB 2', 'Pre-IB 3', 'IBDP 1', 'IBDP 2', 'IBDP 3'));
ALTER TABLE student_classes DROP CONSTRAINT IF EXISTS student_classes_assignment_shape_check;
ALTER TABLE student_classes ADD CONSTRAINT student_classes_assignment_shape_check CHECK (
  (programme IS NULL AND year IS NULL) OR (programme IS NOT NULL AND year IS NOT NULL AND class_name IS NULL)
);
ALTER TABLE vote_classes DROP CONSTRAINT IF EXISTS vote_classes_class_name_check;
-- NOT VALID preserves any unexpected historical labels as well. It still checks new writes.
ALTER TABLE vote_classes ADD CONSTRAINT vote_classes_class_name_check CHECK (class_name IN (
  'S1', 'S2', 'G1', 'G2', 'G3', 'G4', 'Pre-IB 1', 'Pre-IB 2', 'Pre-IB 3', 'IBDP 1', 'IBDP 2', 'IBDP 3',
  'Gym 1', 'Gym 2', 'Gym 3', 'Gym 4', 'Gym 5', 'Gym 6',
  'Int 1', 'Int 2', 'Int 3', 'Int 4', 'Int 5', 'Int 6', 'IB 1', 'IB 2'
)) NOT VALID;
COMMIT;
