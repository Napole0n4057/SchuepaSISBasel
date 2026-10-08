-- Add soft deletion and class associations without changing existing vote data.
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS deleted_at timestamp;

CREATE TABLE IF NOT EXISTS vote_classes (
  vote_id uuid NOT NULL REFERENCES votes(id),
  class_name text NOT NULL CHECK (class_name IN (
    'S1', 'S2', 'G1', 'G2', 'G3', 'G4',
    'Pre-IB 1', 'Pre-IB 2', 'IBDP 1', 'IBDP 2', 'IB 1', 'IB 2'
  )),
  PRIMARY KEY (vote_id, class_name)
);
