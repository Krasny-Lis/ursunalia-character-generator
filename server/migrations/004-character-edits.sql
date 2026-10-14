CREATE TABLE character_edits(
  id TEXT PRIMARY KEY NOT NULL,
  character_id TEXT NOT NULL REFERENCES characters(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  edited_at TEXT NOT NULL,
  character_revision INTEGER NOT NULL CHECK(character_revision > 1),
  UNIQUE(character_id,character_revision)
);
