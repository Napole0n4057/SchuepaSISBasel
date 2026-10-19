-- Expand accepted labels without rewriting any existing vote audience.
-- Legacy labels (including the existing G4 association) remain restricted.
-- Do not infer a Gym/Int mapping: any data conversion needs a separate,
-- explicitly reviewed migration after the school confirms the intended class.
BEGIN;
ALTER TABLE vote_classes DROP CONSTRAINT IF EXISTS vote_classes_class_name_check;
ALTER TABLE vote_classes ADD CONSTRAINT vote_classes_class_name_check CHECK (class_name IN (
  'Gym 1', 'Gym 2', 'Gym 3', 'Gym 4', 'Gym 5', 'Gym 6',
  'Int 1', 'Int 2', 'Int 3', 'Int 4', 'Int 5', 'Int 6',
  'S1', 'S2', 'G1', 'G2', 'G3', 'G4',
  'Pre-IB 1', 'Pre-IB 2', 'IBDP 1', 'IBDP 2', 'IB 1', 'IB 2'
));
COMMIT;
