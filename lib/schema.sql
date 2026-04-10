CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  github_id TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  avatar TEXT,
  access_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS github_commits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo TEXT NOT NULL,
  sha TEXT NOT NULL,
  message TEXT,
  date TIMESTAMPTZ NOT NULL,
  additions INTEGER NOT NULL DEFAULT 0,
  deletions INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, sha)
);

CREATE TABLE IF NOT EXISTS github_prs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT,
  state TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  merged_at TIMESTAMPTZ,
  UNIQUE(user_id, repo, number)
);

CREATE TABLE IF NOT EXISTS github_issues (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT,
  state TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  UNIQUE(user_id, repo, number)
);

CREATE TABLE IF NOT EXISTS github_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL,
  UNIQUE(user_id, repo, pr_number, submitted_at)
);

CREATE TABLE IF NOT EXISTS weekly_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  content TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_github_commits_user_date ON github_commits(user_id, date);
CREATE INDEX IF NOT EXISTS idx_github_prs_user_opened ON github_prs(user_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_github_issues_user_opened ON github_issues(user_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_github_reviews_user_submitted ON github_reviews(user_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_week ON weekly_reports(user_id, week_start);

-- Spotify tokens (separate from users table to keep concerns clean)
CREATE TABLE IF NOT EXISTS spotify_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recently played tracks (last ~50 per sync)
CREATE TABLE IF NOT EXISTS spotify_plays (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  track_name TEXT NOT NULL,
  artist_names TEXT NOT NULL,  -- comma-separated
  album_name TEXT NOT NULL,
  played_at TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER NOT NULL,
  UNIQUE(user_id, played_at)
);

-- Top tracks (short/medium/long term snapshots)
CREATE TABLE IF NOT EXISTS spotify_top_tracks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  track_name TEXT NOT NULL,
  artist_names TEXT NOT NULL,
  time_range TEXT NOT NULL,  -- short_term, medium_term, long_term
  rank INTEGER NOT NULL,
  snapshot_date DATE NOT NULL,
  UNIQUE(user_id, time_range, snapshot_date, rank)
);

-- Top artists (short/medium/long term snapshots)
CREATE TABLE IF NOT EXISTS spotify_top_artists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_id TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  genres TEXT NOT NULL,  -- comma-separated
  time_range TEXT NOT NULL,
  rank INTEGER NOT NULL,
  snapshot_date DATE NOT NULL,
  UNIQUE(user_id, time_range, snapshot_date, rank)
);

CREATE INDEX IF NOT EXISTS idx_spotify_plays_user_played ON spotify_plays(user_id, played_at);
CREATE INDEX IF NOT EXISTS idx_spotify_top_tracks_user ON spotify_top_tracks(user_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_spotify_top_artists_user ON spotify_top_artists(user_id, snapshot_date);
