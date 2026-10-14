import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { MIGRATIONS, migrateDatabase, preflightDatabase, MigrationError } from './migrations.mjs';
import { createAppServer } from './server.mjs';
import { seed } from './test-fixtures/api.mjs';
const legacySql = readFileSync(new URL('./test-fixtures/v27.2-schema.sql', import.meta.url), 'utf8');
const snapshot = db => Object.fromEntries(['users','sessions','forms','applications'].map(table =>
  [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));

test('version-4 upgrade preserves version-3 data/decisions and registry, creates no invented past edits, and is repeatable', () => {
  const db = new DatabaseSync(':memory:');
  try {
    legacy(db); migrateDatabase(db, { migrations: MIGRATIONS.slice(0, 3) });
    const id = db.prepare('SELECT id FROM characters').get().id;
    db.prepare("UPDATE characters SET revision=2,status='changes' WHERE id=?").run(id);
    db.prepare('INSERT INTO character_decisions VALUES(?,?,?,?,?,?,?,?,?,?)').run(
      'existing-decision', id, 'gm', 'Historical GM name', '2026-10-14T00:00:00.000Z', 'decision', 'accepted', 'changes', 'Preserve', 2);
    const tables = ['users','sessions','forms','applications','events','event_memberships','event_grants',
      'event_character_forms','characters','character_decisions'];
    const capture = () => Object.fromEntries(tables.map(name => [name, db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()]));
    const before = capture(), log = db.prepare('SELECT * FROM schema_migrations ORDER BY version').all();
    assert.deepEqual(preflightDatabase(db, { migrations: MIGRATIONS.slice(0, 4) }).pendingVersions, [4]);
    assert.deepEqual(migrateDatabase(db, { migrations: MIGRATIONS.slice(0, 4) }).appliedVersions, [4]);
    assert.deepEqual(capture(), before);
    assert.deepEqual(db.prepare('SELECT * FROM schema_migrations WHERE version<4 ORDER BY version').all(), log);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM character_edits').get().n, 0);
    const afterLog = db.prepare('SELECT * FROM schema_migrations ORDER BY version').all();
    assert.deepEqual(migrateDatabase(db, { migrations: MIGRATIONS.slice(0, 4) }).appliedVersions, []);
    assert.deepEqual(capture(), before);
    assert.deepEqual(db.prepare('SELECT * FROM schema_migrations ORDER BY version').all(), afterLog);
    assert.equal(preflightDatabase(db).counts.character_edits, 0);
  } finally { db.close(); }
});

test('a failed version-4 migration rolls back only the new table/registry and leaves version-3 data usable', () => {
  const db = new DatabaseSync(':memory:');
  try {
    legacy(db); migrateDatabase(db, { migrations: MIGRATIONS.slice(0, 3) });
    const before = snapshot(db), characters = db.prepare('SELECT * FROM characters').all();
    const log = db.prepare('SELECT * FROM schema_migrations ORDER BY version').all();
    const failing = [...MIGRATIONS.slice(0, 3), { ...MIGRATIONS[3], sql: MIGRATIONS[3].sql + '\nINSERT INTO missing_table VALUES(1);' }];
    assert.throws(() => migrateDatabase(db, { migrations: failing }), /no such table/);
    assert.deepEqual(snapshot(db), before);
    assert.deepEqual(db.prepare('SELECT * FROM characters').all(), characters);
    assert.deepEqual(db.prepare('SELECT * FROM schema_migrations ORDER BY version').all(), log);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_schema WHERE name='character_edits'").get().n, 0);
    assert.equal(preflightDatabase(db, { migrations: MIGRATIONS.slice(0, 3) }).ok, true);
    assert.deepEqual(migrateDatabase(db, { migrations: MIGRATIONS.slice(0, 4) }).appliedVersions, [4]);
  } finally { db.close(); }
});

test('preflight rejects an edit revision newer than its character without modifying the audit', () => {
  const db = new DatabaseSync(':memory:');
  try {
    legacy(db); migrateDatabase(db);
    const id = db.prepare('SELECT id FROM characters').get().id;
    db.prepare('INSERT INTO character_edits VALUES(?,?,?,?,?)').run('invalid-edit', id, 'gm', '2026-10-14T00:00:00.000Z', 3);
    const before = db.prepare('SELECT * FROM character_edits').all();
    assert.ok(preflightDatabase(db).issues.some(i => i.code === 'INVALID_CHARACTER_EDIT_REVISION'));
    assert.throws(() => migrateDatabase(db), MigrationError);
    assert.deepEqual(db.prepare('SELECT * FROM character_edits').all(), before);
  } finally { db.close(); }
});
function legacy(db) {
  db.exec(legacySql);
  db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('player', 'Test', 'private@example.test', 'preserve-password-hash', 'participant');
  db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('gm', 'Test GM', 'gm@example.test', 'preserve-gm-hash', 'organizer');
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update('existing-session').digest('hex'), 'player', Date.now() + 86400000);
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update('gm-session').digest('hex'), 'gm', Date.now() + 86400000);
  for (const form of seed.forms) db.prepare('INSERT INTO forms VALUES(?,?,?)').run(form.id, form.revision, JSON.stringify(form, null, 2));
  const revised = { ...structuredClone(seed.forms[0]), revision: 2 };
  revised.sections[0].fields[0].label = 'Preserved revised name label';
  db.prepare('INSERT INTO forms VALUES(?,?,?)').run(revised.id, revised.revision, JSON.stringify(revised));
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?,?,?,?,?)').run('application-00000000-0000-0000-0000-000000000001', 'player', seed.forms[0].id, 1,
    JSON.stringify({ name: 123, removedAnswer: 'sensitive-preserved-answer', traits: ['old-option'] }, null, 2),
    'accepted', '2026-09-01T10:00:00.000Z', '2026-08-31T12:00:00.000Z', 'Original feedback');
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?,?,?,?,?)').run('old-logistics', 'player', seed.forms[1].id, 1,
    JSON.stringify({ arrival: '2027-04-22', historicExtra: 'preserve-questionnaire' }, null, 2),
    'draft', '2026-09-02T10:00:00.000Z', null, '');
}

test('fresh schema and legacy/version-2 backfill preserve exact original JSON, statuses, accounts, sessions and questionnaires', async t => {
  for (const kind of ['empty','legacy','version2']) await t.test(kind, () => {
    const db = new DatabaseSync(':memory:');
    try {
      if (kind !== 'empty') legacy(db);
      if (kind === 'version2') migrateDatabase(db, { migrations: MIGRATIONS.slice(0, 2) });
      const before = kind === 'empty' ? null : snapshot(db);
      const report = preflightDatabase(db);
      assert.equal(report.ok, true);
      if (before) {
        assert.equal(report.characterMapping.characterCount, 1);
        assert.equal(report.characterMapping.retainedQuestionnaireCount, 1);
        assert.ok(report.characterMapping.preservedAnswerWarnings[0].unknownFieldIds.includes('removedAnswer'));
        assert.ok(report.characterMapping.preservedAnswerWarnings[0].invalidFieldIds.includes('traits'));
        assert.equal(JSON.stringify(report).includes('sensitive-preserved-answer'), false);
      }
      assert.equal(migrateDatabase(db).currentVersion, 5);
      if (before) {
        assert.deepEqual(snapshot(db), before);
        const original = before.applications[0], migrated = db.prepare('SELECT * FROM characters').get();
        for (const key of ['id','user_id','form_id','form_revision','answers','status','updated_at','submitted_at','feedback'])
          assert.equal(migrated[key], original[key]);
        assert.equal(migrated.event_id, seed.event.id);
        assert.equal(migrated.legacy_application_id, original.id);
        assert.equal(migrated.revision, 2);
        assert.equal(db.prepare('SELECT COUNT(*) n FROM character_decisions').get().n, 0);
        assert.equal(db.prepare('SELECT COUNT(*) n FROM applications').get().n, 2);
      }
      const log = db.prepare('SELECT * FROM schema_migrations ORDER BY version').all();
      const characters = db.prepare('SELECT * FROM characters').all();
      assert.deepEqual(migrateDatabase(db).appliedVersions, []);
      assert.deepEqual(db.prepare('SELECT * FROM characters').all(), characters);
      assert.deepEqual(db.prepare('SELECT * FROM schema_migrations ORDER BY version').all(), log);
      assert.equal(preflightDatabase(db).ok, true);
    } finally { db.close(); }
  });
});

test('unresolved forms and potential duplicate characters produce a report and block without choosing or modifying records', () => {
  const db = new DatabaseSync(':memory:');
  try {
    legacy(db);
    const other = { ...seed.forms[0], id: 'second-character-form' };
    db.prepare('INSERT INTO forms VALUES(?,?,?)').run(other.id, 1, JSON.stringify(other));
    db.prepare('INSERT INTO applications VALUES(?,?,?,?,?,?,?,?,?)').run('potential-second-character', 'player', other.id, 1,
      JSON.stringify(seed.example), 'submitted', '2026-10-01', '2026-10-01', '');
    migrateDatabase(db, { migrations: MIGRATIONS.slice(0, 2) });
    const before = snapshot(db), log = db.prepare('SELECT * FROM schema_migrations').all();
    const report = preflightDatabase(db);
    assert.equal(report.ok, false);
    assert.ok(report.issues.some(i => i.code === 'CHARACTER_MAPPING_REQUIRED'));
    assert.ok(report.issues.some(i => i.code === 'CHARACTER_MAPPING_CONFLICT'));
    assert.deepEqual(report.characterMapping.unresolved, [{ applicationId: 'potential-second-character', formId: other.id, eventId: seed.event.id }]);
    assert.deepEqual(report.characterMapping.conflicts[0].applicationIds.sort(), ['application-00000000-0000-0000-0000-000000000001','potential-second-character']);
    const safeJson = JSON.stringify(report);
    for (const secret of ['private@example.test','sensitive-preserved-answer','preserve-password-hash','existing-session']) assert.equal(safeJson.includes(secret), false);
    assert.throws(() => migrateDatabase(db), MigrationError);
    assert.deepEqual(snapshot(db), before);
    assert.deepEqual(db.prepare('SELECT * FROM schema_migrations').all(), log);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_schema WHERE name='characters'").get().n, 0);
  } finally { db.close(); }
});

test('failed version-3 data backfill rolls back all new tables and registry, retaining deployed versions 1/2', () => {
  const db = new DatabaseSync(':memory:');
  try {
    legacy(db); migrateDatabase(db, { migrations: MIGRATIONS.slice(0, 2) });
    const before = snapshot(db), log = db.prepare('SELECT * FROM schema_migrations').all();
    const failing = [...MIGRATIONS.slice(0, 2), { ...MIGRATIONS[2], sql: MIGRATIONS[2].sql +
      "\nINSERT INTO characters SELECT * FROM characters;" }];
    assert.throws(() => migrateDatabase(db, { migrations: failing }), /UNIQUE/);
    assert.deepEqual(snapshot(db), before);
    assert.deepEqual(db.prepare('SELECT * FROM schema_migrations').all(), log);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_schema WHERE name IN ('characters','character_decisions','event_character_forms')").get().n, 0);
    assert.equal(db.isTransaction, false);
    assert.equal(migrateDatabase(db).currentVersion, 5);
  } finally { db.close(); }
});

test('migrated accepted state is not newly validated or assigned fabricated history; originals cannot be written through old API', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'ursunalia-migrated-characters-'));
  const path = join(directory, 'fixture.sqlite');
  const db = new DatabaseSync(path); legacy(db); const before = snapshot(db); db.close();
  const app = await createAppServer({ dbPath: path });
  t.after(async () => { await app.close(); rmSync(directory, { recursive: true, force: true }); });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const request = async (path, method = 'GET', body, token = 'existing-session') => {
    const response = await fetch(base + path, { method, headers: { Origin: 'http://localhost:3000', Cookie: `ursunalia_session=${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  };
  const state = (await request('/api/bootstrap')).data;
  assert.equal(state.user.id, 'player');
  assert.equal(state.characters[0].status, 'accepted');
  assert.equal(state.characters[0].migrated, true);
  assert.deepEqual(state.characters[0].history, []);
  assert.equal(state.characters[0].form.revision, 2);
  assert.equal(state.applications[0].id, 'old-logistics');
  assert.equal((await request('/api/characters', 'POST', { ...state.characters[0], expectedRevision: 2 })).status, 409);
  assert.equal((await request('/api/applications/application-00000000-0000-0000-0000-000000000001/submit', 'POST', {})).status, 409);
  const attempt = { id: 'application-00000000-0000-0000-0000-000000000001', form: state.characters[0].form, answers: {} };
  assert.equal((await request('/api/applications', 'POST', attempt)).status, 409);
  assert.equal((await request('/api/organizer/applications/' + attempt.id, 'PATCH', { status: 'accepted', feedback: '' }, 'gm-session')).status, 409);
  assert.equal((await request('/api/organizer/characters/' + attempt.id + '/decision', 'POST', { expectedRevision: 2, status: 'accepted' }, 'gm-session')).status, 422);
  assert.deepEqual(snapshot(app.db), before);
  // Unknown historical answers survive a permitted new edit; they are never passed through destructive cleanAnswers.
  const unlocked = await request('/api/organizer/characters/' + attempt.id + '/unlock', 'POST', { expectedRevision: 2 }, 'gm-session');
  assert.equal(unlocked.status, 200);
  const edited = await request('/api/characters', 'POST', { ...state.characters[0], answers: seed.example, expectedRevision: 3 });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.answers.removedAnswer, 'sensitive-preserved-answer');
  assert.deepEqual(snapshot(app.db), before);
});
