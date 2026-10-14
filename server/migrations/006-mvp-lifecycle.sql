CREATE TABLE character_controls(
  character_id TEXT PRIMARY KEY NOT NULL REFERENCES characters(id),
  locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0,1)),
  disposition TEXT NOT NULL DEFAULT 'active' CHECK(disposition IN ('active','archived','deleted'))
);
CREATE TABLE character_archives(
  character_id TEXT PRIMARY KEY NOT NULL REFERENCES characters(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  event_id TEXT NOT NULL REFERENCES events(id),
  event_snapshot TEXT NOT NULL CHECK(json_valid(event_snapshot) AND json_type(event_snapshot)='object'),
  schema_snapshot TEXT NOT NULL CHECK(json_valid(schema_snapshot) AND json_type(schema_snapshot)='object'),
  answers TEXT NOT NULL CHECK(json_valid(answers) AND json_type(answers)='object'),
  status TEXT NOT NULL CHECK(status IN ('draft','submitted','changes','accepted','rejected')),
  archived_at TEXT NOT NULL,
  character_revision INTEGER NOT NULL CHECK(character_revision>0)
);
CREATE TABLE notifications(
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  event_id TEXT NOT NULL REFERENCES events(id),
  character_id TEXT NOT NULL REFERENCES characters(id),
  decision_id TEXT NOT NULL UNIQUE REFERENCES character_decisions(id),
  kind TEXT NOT NULL CHECK(kind IN ('accepted','changes','rejected','unlock')),
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX notifications_owner ON notifications(user_id,created_at);
-- DATA BACKFILL
INSERT INTO character_controls(character_id) SELECT id FROM characters;
