CREATE TABLE events(
  id TEXT PRIMARY KEY,
  definition TEXT NOT NULL CHECK(json_valid(definition) AND json_type(definition)='object'),
  published INTEGER NOT NULL CHECK(published IN (0,1)),
  registrations_open INTEGER NOT NULL CHECK(registrations_open IN (0,1)),
  revision INTEGER NOT NULL CHECK(revision > 0),
  CHECK(registrations_open=0 OR published=1)
);
CREATE TABLE event_memberships(
  event_id TEXT NOT NULL REFERENCES events(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK(status='joined'),
  joined_at TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('legacy_application','explicit')),
  PRIMARY KEY(event_id,user_id)
);
CREATE TABLE event_grants(
  event_id TEXT NOT NULL REFERENCES events(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK(role IN ('organizer','gm')),
  PRIMARY KEY(event_id,user_id)
);

-- DATA BACKFILL
-- Frozen v27.2 event snapshot. Unknown event mappings are refused by preflight.
INSERT INTO events VALUES(
  'ursunalia-2027',
  '{"id":"ursunalia-2027","name":"Ursunalia 2027","subtitle":"Nowe początki. Stare długi.","date":"22–24 kwietnia 2027","location":"Krywulka · Ziemie Braci","locationNote":"Miejsce w świecie gry. Adres wydarzenia poda organizator.","description":"Na północnych rubieżach Kisleva budzi się wiosna. Do Krywulki przybywają żołnierze, kupcy i pielgrzymi. Łączy ich święto. Dzielą stare długi. Jaką historię napiszesz Ty?"}',
  1,1,1
);
INSERT INTO event_memberships(event_id,user_id,status,joined_at,source)
SELECT json_extract(f.definition,'$.eventId'),a.user_id,'joined',MIN(COALESCE(a.submitted_at,a.updated_at)),'legacy_application'
FROM applications a JOIN forms f ON f.id=a.form_id AND f.revision=a.form_revision
GROUP BY json_extract(f.definition,'$.eventId'),a.user_id;
INSERT INTO event_grants(event_id,user_id,role)
SELECT 'ursunalia-2027',id,'organizer' FROM users WHERE role='organizer';
