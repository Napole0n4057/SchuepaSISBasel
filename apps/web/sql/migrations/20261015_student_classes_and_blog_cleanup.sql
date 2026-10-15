-- Remove the unfinished blog-image metadata table, if an earlier draft migration
-- created it. This does not touch blog_posts, profile pictures, or stored objects.
DROP TABLE IF EXISTS blog_images;

CREATE TABLE IF NOT EXISTS student_classes (
  user_id uuid PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
  programme text NOT NULL CHECK (programme IN ('Gym', 'Int')),
  year smallint NOT NULL CHECK (year BETWEEN 1 AND 6),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_class_rollovers (
  academic_year text PRIMARY KEY,
  effective_on date NOT NULL UNIQUE,
  processed_at timestamptz NOT NULL DEFAULT NOW()
);
