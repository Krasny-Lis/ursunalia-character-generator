-- Captured from server/server.mjs before introducing the migration runner.
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('participant','organizer')));
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS forms(id TEXT NOT NULL,revision INTEGER NOT NULL,definition TEXT NOT NULL,PRIMARY KEY(id,revision));
CREATE TABLE IF NOT EXISTS applications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),form_id TEXT NOT NULL,form_revision INTEGER NOT NULL,answers TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('draft','submitted','accepted','changes')),updated_at TEXT NOT NULL,submitted_at TEXT,feedback TEXT NOT NULL DEFAULT '',UNIQUE(user_id,form_id),FOREIGN KEY(form_id,form_revision) REFERENCES forms(id,revision));
