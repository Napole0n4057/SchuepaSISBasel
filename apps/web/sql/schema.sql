-- Create required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Auth tables
CREATE TABLE IF NOT EXISTS auth_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE,
  "emailVerified" timestamp,
  image text
);

CREATE TABLE IF NOT EXISTS auth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid,
  provider text,
  type text,
  "providerAccountId" text,
  access_token text,
  expires_at bigint,
  refresh_token text,
  id_token text,
  scope text,
  session_state text,
  token_type text,
  password text
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid,
  expires timestamp,
  "sessionToken" text UNIQUE
);

CREATE TABLE IF NOT EXISTS auth_verification_token (
  identifier text,
  expires timestamp,
  token text,
  PRIMARY KEY (identifier, token)
);

-- App tables
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  designation text,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp
);

CREATE TABLE IF NOT EXISTS allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  created_at timestamp DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  profile_picture text,
  default_anonymous boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text,
  content text,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp
);

CREATE TABLE IF NOT EXISTS forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text,
  content text,
  is_anonymous boolean DEFAULT false,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp
);

CREATE TABLE IF NOT EXISTS forum_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid,
  user_id uuid,
  content text,
  is_anonymous boolean DEFAULT false,
  created_at timestamp DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid,
  comment_id uuid,
  user_id uuid,
  vote_type integer
);

CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  description text,
  created_by uuid,
  admin_only boolean DEFAULT false,
  ends_at timestamp,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vote_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id uuid,
  option_text text
);

CREATE TABLE IF NOT EXISTS user_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id uuid,
  option_id uuid,
  user_id uuid,
  voted_at timestamp DEFAULT NOW(),
  UNIQUE (vote_id, user_id)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_user_id ON forum_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_comments_post_id ON forum_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_votes_post_id ON forum_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_votes_comment_id ON forum_votes(comment_id);
CREATE INDEX IF NOT EXISTS idx_vote_options_vote_id ON vote_options(vote_id);
CREATE INDEX IF NOT EXISTS idx_user_votes_vote_id ON user_votes(vote_id);
