-- Migration: Add Collections and Update Entities
-- Created at: 2026-04-12 (Manual Patch)

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  model_id INTEGER NOT NULL REFERENCES models(id),
  description TEXT,
  icon TEXT,
  sort INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Handle entities table upgrade
-- SQLite doesn't support complex ALTER TABLE well, so we add the column safely
ALTER TABLE entities ADD COLUMN collection_id INTEGER REFERENCES collections(id);
