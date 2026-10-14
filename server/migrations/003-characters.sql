CREATE TABLE event_character_forms(
  event_id TEXT PRIMARY KEY NOT NULL REFERENCES events(id),
  form_id TEXT NOT NULL,
  form_revision INTEGER NOT NULL,
  FOREIGN KEY(form_id,form_revision) REFERENCES forms(id,revision)
);
CREATE TABLE characters(
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  form_revision INTEGER NOT NULL,
  answers TEXT NOT NULL CHECK(json_valid(answers) AND json_type(answers)='object'),
  status TEXT NOT NULL CHECK(status IN ('draft','submitted','changes','accepted','rejected')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  updated_at TEXT NOT NULL,
  submitted_at TEXT,
  feedback TEXT NOT NULL DEFAULT '',
  deleted_at TEXT,
  legacy_application_id TEXT UNIQUE REFERENCES applications(id),
  FOREIGN KEY(event_id,user_id) REFERENCES event_memberships(event_id,user_id),
  FOREIGN KEY(form_id,form_revision) REFERENCES forms(id,revision)
);
CREATE UNIQUE INDEX one_active_character ON characters(user_id,event_id) WHERE deleted_at IS NULL;
CREATE TABLE character_decisions(
  id TEXT PRIMARY KEY NOT NULL,
  character_id TEXT NOT NULL REFERENCES characters(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  actor_name TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('decision','unlock')),
  from_status TEXT NOT NULL CHECK(from_status IN ('draft','submitted','changes','accepted','rejected')),
  status TEXT NOT NULL CHECK(status IN ('changes','accepted','rejected')),
  comment TEXT NOT NULL CHECK(length(comment) <= 2000),
  character_revision INTEGER NOT NULL CHECK(character_revision > 1),
  UNIQUE(character_id,character_revision)
);
-- DATA BACKFILL
-- Only the explicitly identified v27.2 character form is mapped. Other questionnaires remain intact.
INSERT INTO event_character_forms(event_id,form_id,form_revision)
SELECT 'ursunalia-2027',id,MAX(revision) FROM forms
WHERE id='character-2027' GROUP BY id;
INSERT INTO characters(id,event_id,user_id,form_id,form_revision,answers,status,updated_at,submitted_at,feedback,legacy_application_id)
SELECT a.id,json_extract(f.definition,'$.eventId'),a.user_id,a.form_id,a.form_revision,
       a.answers,a.status,a.updated_at,a.submitted_at,a.feedback,a.id
FROM applications a JOIN forms f ON f.id=a.form_id AND f.revision=a.form_revision
WHERE a.form_id='character-2027';
