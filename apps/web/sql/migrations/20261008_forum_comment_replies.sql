-- Add threaded replies without changing any existing forum comment rows.
ALTER TABLE forum_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'forum_comments_parent_comment_id_fkey'
      AND conrelid = 'forum_comments'::regclass
  ) THEN
    ALTER TABLE forum_comments
      ADD CONSTRAINT forum_comments_parent_comment_id_fkey
      FOREIGN KEY (parent_comment_id)
      REFERENCES forum_comments(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_forum_comments_parent_comment_id
  ON forum_comments(parent_comment_id);
