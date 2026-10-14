CREATE TABLE character_schemas(
  event_id TEXT PRIMARY KEY NOT NULL REFERENCES events(id),
  form_id TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL CHECK(revision > 0),
  definition TEXT NOT NULL CHECK(json_valid(definition) AND json_type(definition)='object')
);
CREATE TABLE character_schema_origins(
  character_id TEXT PRIMARY KEY NOT NULL REFERENCES characters(id),
  original_record TEXT NOT NULL CHECK(json_valid(original_record) AND json_type(original_record)='object')
);
-- DATA BACKFILL
INSERT INTO character_schemas(event_id,form_id,revision,definition)
SELECT m.event_id,m.form_id,m.form_revision,f.definition FROM event_character_forms m
JOIN forms f ON f.id=m.form_id AND f.revision=m.form_revision;
INSERT INTO character_schema_origins(character_id,original_record)
SELECT id,json_object('id',id,'event_id',event_id,'user_id',user_id,'form_id',form_id,
  'form_revision',form_revision,'answers',answers,'status',status,'revision',revision,
  'updated_at',updated_at,'submitted_at',submitted_at,'feedback',feedback,
  'deleted_at',deleted_at,'legacy_application_id',legacy_application_id) FROM characters;
UPDATE characters SET revision=revision+1;
