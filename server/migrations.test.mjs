import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync, backup } from 'node:sqlite';
import { createHash, scryptSync, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { MIGRATIONS as ALL_MIGRATIONS, migrateDatabase as runMigrations, migrationChecksum, preflightDatabase as runPreflight, MigrationError } from './migrations.mjs';
import { preflightFile } from './preflight.mjs';
import { createAppServer } from './server.mjs';

// Keep the version-1 contract tests independent from later data migrations.
const MIGRATIONS = [ALL_MIGRATIONS[0]];
const migrateDatabase = (db, options = {}) => runMigrations(db, { migrations: MIGRATIONS, ...options });
const preflightDatabase = (db, options = {}) => runPreflight(db, { migrations: MIGRATIONS, ...options });

const legacySql = readFileSync(new URL('./test-fixtures/v27.2-schema.sql', import.meta.url), 'utf8');
const seed = JSON.parse(readFileSync(new URL('../public/data/platform.json', import.meta.url), 'utf8'));
const fixtureToken = 'test-only-existing-session';
const fixturePassword = 'test-only-legacy-password';
const digest = value => createHash('sha256').update(value).digest('hex');
function temp(t) {
  const folder = mkdtempSync(join(tmpdir(), 'ursunalia-migrations-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  return folder;
}
function legacy(db) {
  db.exec(legacySql);
  const salt = 'test-only-salt';
  const encoded = salt + ':' + scryptSync(fixturePassword, salt, 64).toString('hex');
  for (let i = 0; i < 4; i++)
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?)')
      .run(`user-${i}`, `Fixture ${i}`, `fixture-${i}@example.test`, encoded, i === 3 ? 'organizer' : 'participant');
  for (const form of seed.forms)
    db.prepare('INSERT INTO forms VALUES(?,?,?)').run(form.id, form.revision, JSON.stringify(form));
  const revised = { ...structuredClone(seed.forms[0]), revision: 2, title: 'Preserved legacy revision' };
  db.prepare('INSERT INTO forms VALUES(?,?,?)').run(revised.id, revised.revision, JSON.stringify(revised, null, 2));
  db.prepare('INSERT INTO sessions VALUES(?,?,?)')
    .run(digest(fixtureToken), 'user-0', Date.now() + 86400000);
  for (const [i, status] of ['draft', 'submitted', 'accepted', 'changes'].entries())
    db.prepare('INSERT INTO applications VALUES(?,?,?,?,?,?,?,?,?)').run(
      `application-${randomUUID()}`, `user-${i}`, seed.forms[0].id, i % 2 + 1,
      JSON.stringify({ ...seed.example, name: `Fixture ${i}`, surname: `History ${i}` }, null, 2),
      status, '2026-10-01T10:00:00.000Z', i ? '2026-10-01T09:00:00.000Z' : null, i ? 'Preserved feedback' : '',
    );
}
function snapshot(db) {
  return Object.fromEntries(['users', 'sessions', 'forms', 'applications'].map(table =>
    [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
}
function history(db) { return db.prepare('SELECT * FROM schema_migrations ORDER BY version').all(); }
function rejection(db, code) {
  const report = preflightDatabase(db);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some(issue => issue.code === code), JSON.stringify(report));
  const before = db.prepare('SELECT type,name,sql FROM sqlite_schema ORDER BY name').all();
  assert.throws(() => migrateDatabase(db), MigrationError);
  assert.deepEqual(db.prepare('SELECT type,name,sql FROM sqlite_schema ORDER BY name').all(), before);
  assert.equal(db.isTransaction, false);
}
function extraMigration(version, sql, extraSchema = '') {
  return { version, name: `test_${version}`, sql, schemaSql: MIGRATIONS[0].schemaSql + extraSchema };
}

test('empty database initializes the unchanged schema and registry exactly once', () => {
  const db = new DatabaseSync(':memory:');
  try {
    assert.equal(preflightDatabase(db).kind, 'empty');
    const report = migrateDatabase(db);
    assert.deepEqual(report.appliedVersions, [1]);
    assert.equal(report.currentVersion, 1);
    assert.equal(history(db)[0].operation, 'initialize');
    assert.equal(history(db)[0].checksum, migrationChecksum(MIGRATIONS[0]));
    assert.deepEqual(report.counts, { users: 0, sessions: 0, forms: 0, applications: 0 });
    const before = history(db);
    assert.deepEqual(migrateDatabase(db).appliedVersions, []);
    assert.deepEqual(history(db), before);
  } finally { db.close(); }
});

test('legacy adoption and reopening preserve every original row and exact JSON bytes', t => {
  const path = join(temp(t), 'existing.sqlite');
  let db = new DatabaseSync(path);
  legacy(db);
  const before = snapshot(db);
  const report = preflightDatabase(db);
  assert.equal(report.ok, true);
  assert.equal(report.kind, 'legacy');
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE name='schema_migrations'").get().n, 0);
  migrateDatabase(db);
  assert.equal(history(db)[0].operation, 'adopt');
  assert.deepEqual(snapshot(db), before);
  const adopted = history(db);
  db.close();
  db = new DatabaseSync(path);
  try {
    assert.deepEqual(migrateDatabase(db).appliedVersions, []);
    assert.deepEqual(history(db), adopted);
    assert.deepEqual(snapshot(db), before);
  } finally { db.close(); }
});

test('adopted users, original sessions, submitted records and hashes still work over HTTP after restart', async t => {
  const path = join(temp(t), 'http.sqlite');
  const db = new DatabaseSync(path);
  legacy(db);
  const before = snapshot(db);
  db.close();
  for (let i = 0; i < 2; i++) {
    const app = await createAppServer({ dbPath: path });
    try {
      assert.deepEqual(snapshot(app.db), before);
      await new Promise(r => app.server.listen(0, '127.0.0.1', r));
      const base = `http://127.0.0.1:${app.server.address().port}`;
      const res = await fetch(base + '/api/bootstrap', { headers: { Cookie: `ursunalia_session=${fixtureToken}` } });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.user.id, 'user-0');
      assert.equal(body.applications.length, 1);
      assert.equal(body.applications[0].answers.name, 'Fixture 0');
      assert.equal(body.applications[0].form.revision, 1);
      const forbidden = await fetch(base + '/api/organizer/applications', { headers: { Cookie: `ursunalia_session=${fixtureToken}` } });
      assert.equal(forbidden.status, 403);
      const anonymous = await fetch(base + '/api/bootstrap');
      assert.equal((await anonymous.json()).applications.length, 0);
      if (i === 1) {
        const login = await fetch(base + '/api/auth/login', {
          method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'fixture-0@example.test', password: fixturePassword }),
        });
        assert.equal(login.status, 200);
      }
    } finally { await app.close(); }
  }
});

test('read-only file preflight leaves data and registry untouched and does not create missing paths', t => {
  const folder = temp(t), path = join(folder, 'readonly.sqlite');
  const db = new DatabaseSync(path);
  legacy(db);
  db.close();
  const bytes = readFileSync(path);
  const report = preflightFile(path);
  assert.equal(report.kind, 'legacy');
  assert.equal(report.ok, true);
  assert.deepEqual(readFileSync(path), bytes);
  const output = JSON.stringify(report);
  for (const secret of [fixtureToken, fixturePassword, 'fixture-0@example.test', 'Preserved feedback'])
    assert.equal(output.includes(secret), false);
  const cli = spawnSync(process.execPath, [new URL('./preflight.mjs', import.meta.url).pathname, path], { encoding: 'utf8' });
  assert.equal(cli.status, 0);
  assert.equal(JSON.parse(cli.stdout).kind, 'legacy');
  const missing = join(folder, 'does-not-exist.sqlite');
  assert.throws(() => preflightFile(missing));
  assert.equal(existsSync(missing), false);
  const failure = spawnSync(process.execPath, [new URL('./preflight.mjs', import.meta.url).pathname, missing], { encoding: 'utf8' });
  assert.equal(failure.status, 1);
  assert.equal(existsSync(missing), false);
});

test('preflight rejects partial/foreign schemas, changed checks, added indexes and triggers without repair', async t => {
  for (const [name, sql] of [
    ['partial', 'CREATE TABLE users(id TEXT PRIMARY KEY)'],
    ['foreign', 'CREATE TABLE other(id TEXT)'],
    ['weakened check', legacySql.replace("CHECK(role IN ('participant','organizer'))", '')],
    ['missing uniqueness', legacySql.replace(',UNIQUE(user_id,form_id)', '')],
    ['missing foreign key', legacySql.replace(' REFERENCES users(id) ON DELETE CASCADE', '')],
    ['changed default', legacySql.replace("DEFAULT ''", "DEFAULT 'changed'")],
    ['extra index', legacySql + 'CREATE INDEX unexpected ON users(name)'],
    ['extra trigger', legacySql + 'CREATE TRIGGER unexpected AFTER INSERT ON users BEGIN DELETE FROM sessions; END;'],
  ]) await t.test(name, () => {
    const db = new DatabaseSync(':memory:');
    try { db.exec(sql); rejection(db, 'SCHEMA_MISMATCH'); }
    finally { db.close(); }
  });
});

test('preflight rejects foreign-key orphans and malformed JSON without exposing their contents', async t => {
  for (const [name, sql, code] of [
    ['orphan', "PRAGMA foreign_keys=OFF; UPDATE applications SET user_id='missing' WHERE user_id='user-0';", 'FOREIGN_KEY_VIOLATIONS'],
    ['malformed definition', "UPDATE forms SET definition='{sensitive-invalid-json';", 'INVALID_FORM_DEFINITIONS'],
    ['identity mismatch', "UPDATE forms SET definition=json_set(definition,'$.revision',999);", 'INVALID_FORM_DEFINITIONS'],
    ['malformed answers', "UPDATE applications SET answers='{sensitive-invalid-json';", 'INVALID_ANSWERS_JSON'],
    ['answers not object', "UPDATE applications SET answers='[]';", 'INVALID_ANSWERS_JSON'],
  ]) await t.test(name, () => {
    const db = new DatabaseSync(':memory:');
    try {
      legacy(db); db.exec(sql);
      const before = snapshot(db);
      rejection(db, code);
      assert.deepEqual(snapshot(db), before);
      assert.equal(JSON.stringify(preflightDatabase(db)).includes('sensitive-invalid-json'), false);
    } finally { db.close(); }
  });
});

test('registry tampering, gaps, unknown versions and missing history are rejected', async t => {
  for (const [name, sql, code] of [
    ['checksum', "UPDATE schema_migrations SET checksum=printf('%064d',0)", 'MIGRATION_CHECKSUM_MISMATCH'],
    ['name', "UPDATE schema_migrations SET name='other'", 'MIGRATION_CHECKSUM_MISMATCH'],
    ['unknown version', 'UPDATE schema_migrations SET version=2', 'UNKNOWN_MIGRATION_VERSION'],
    ['empty history', 'DELETE FROM schema_migrations', 'EMPTY_MIGRATION_HISTORY'],
    ['timestamp', "UPDATE schema_migrations SET applied_at='bad-date'", 'INVALID_MIGRATION_METADATA'],
    ['operation', "UPDATE schema_migrations SET operation='apply'", 'INVALID_MIGRATION_METADATA'],
  ]) await t.test(name, () => {
    const db = new DatabaseSync(':memory:');
    try {
      legacy(db); migrateDatabase(db); db.exec(sql);
      const before = snapshot(db), log = history(db);
      rejection(db, code);
      assert.deepEqual(snapshot(db), before);
      assert.deepEqual(history(db), log);
    } finally { db.close(); }
  });
});

test('registry structure and database header drift are rejected', () => {
  const db = new DatabaseSync(':memory:');
  try {
    legacy(db);
    db.exec('CREATE TABLE schema_migrations(version INTEGER)');
    rejection(db, 'REGISTRY_SCHEMA_MISMATCH');
  } finally { db.close(); }
  const other = new DatabaseSync(':memory:');
  try {
    legacy(other); other.exec('PRAGMA user_version=42');
    rejection(other, 'UNKNOWN_DATABASE_HEADER');
  } finally { other.close(); }
});

test('migration source checksums and version ordering are enforced', () => {
  const db = new DatabaseSync(':memory:');
  const extraSchema = 'CREATE TABLE migration_probe(id INTEGER PRIMARY KEY);';
  const second = extraMigration(2, extraSchema, extraSchema);
  try {
    migrateDatabase(db, { migrations: [...MIGRATIONS, second] });
    const changed = { ...second, sql: second.sql + '\n-- edited after deployment' };
    assert.equal(preflightDatabase(db, { migrations: [...MIGRATIONS, changed] }).ok, false);
    assert.throws(() => migrateDatabase(db, { migrations: [...MIGRATIONS, changed] }), MigrationError);
    assert.throws(() => migrateDatabase(db, { migrations: [...MIGRATIONS, { ...second, version: 3 }] }), /Invalid migration definitions/);
    assert.throws(() => migrateDatabase(db, { migrations: [{ ...MIGRATIONS[0], sql: 'SELECT 1' }] }), /baseline must remain unchanged/);
    assert.throws(() => migrateDatabase(db, { migrations: [...MIGRATIONS, { ...second, sql: 'COMMIT; SELECT 1;' }] }), /must not control transactions/);
    assert.throws(() => migrateDatabase(db, { migrations: [...MIGRATIONS, { ...second, sql: 'PRAGMA ignore_check_constraints=ON;' }] }), /must not control transactions/);
  } finally { db.close(); }
});

test('a failing later migration rolls back all pending DDL, data changes and registry entries', t => {
  const path = join(temp(t), 'rollback.sqlite');
  let db = new DatabaseSync(path);
  legacy(db); migrateDatabase(db);
  const before = snapshot(db), log = history(db);
  const schemaSql = 'CREATE TABLE migration_probe(id INTEGER PRIMARY KEY);';
  const second = extraMigration(2, schemaSql + "UPDATE users SET name='must roll back';", schemaSql);
  const third = extraMigration(3, 'CREATE TABLE rollback_probe(id INTEGER); INSERT INTO missing_table VALUES(1);', schemaSql);
  assert.throws(() => migrateDatabase(db, { migrations: [...MIGRATIONS, second, third] }));
  assert.equal(db.isTransaction, false);
  assert.deepEqual(snapshot(db), before);
  assert.deepEqual(history(db), log);
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE name IN ('migration_probe','rollback_probe')").get().n, 0);
  db.close();
  db = new DatabaseSync(path);
  try {
    assert.equal(preflightDatabase(db).ok, true);
    assert.deepEqual(snapshot(db), before);
    assert.deepEqual(history(db), log);
  } finally { db.close(); }
});

test('failed initialization/adoption leaves no registry and no partial schema', () => {
  for (const existing of [false, true]) {
    const db = new DatabaseSync(':memory:');
    try {
      if (existing) legacy(db);
      const before = existing ? snapshot(db) : null;
      const failing = extraMigration(2, 'CREATE TABLE rollback_probe(id INTEGER); SELECT * FROM missing_table;');
      assert.throws(() => migrateDatabase(db, { migrations: [...MIGRATIONS, failing] }));
      assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE name IN ('schema_migrations','rollback_probe')").get().n, 0);
      if (existing) assert.deepEqual(snapshot(db), before);
      else assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*'").get().n, 0);
    } finally { db.close(); }
  }
});

test('postflight integrity violations roll back a migration even if its SQL succeeds', () => {
  const db = new DatabaseSync(':memory:');
  try {
    legacy(db); migrateDatabase(db);
    const before = snapshot(db), log = history(db);
    const added = 'CREATE TABLE deferred_probe(user_id TEXT REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED);';
    const bad = extraMigration(2, added + "INSERT INTO deferred_probe VALUES('absent');", added);
    assert.throws(() => migrateDatabase(db, { migrations: [...MIGRATIONS, bad] }), MigrationError);
    assert.deepEqual(snapshot(db), before);
    assert.deepEqual(history(db), log);
  } finally { db.close(); }
});

test('postflight schema mismatch rolls back unregistered DDL', () => {
  const db = new DatabaseSync(':memory:');
  try {
    legacy(db); migrateDatabase(db);
    const log = history(db), before = snapshot(db);
    const bad = extraMigration(2, 'CREATE TABLE undocumented(id INTEGER);');
    assert.throws(() => migrateDatabase(db, { migrations: [...MIGRATIONS, bad] }), MigrationError);
    assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE name='undocumented'").get().n, 0);
    assert.deepEqual(history(db), log);
    assert.deepEqual(snapshot(db), before);
  } finally { db.close(); }
});

test('caller transactions are not committed or rolled back by the runner', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('BEGIN');
    assert.throws(() => migrateDatabase(db), /own transaction/);
    assert.equal(db.isTransaction, true);
    assert.equal(preflightDatabase(db).kind, 'empty');
    assert.equal(db.isTransaction, true);
    db.exec('ROLLBACK');
  } finally { db.close(); }
});

test('an unknown database is refused by server startup before seeding or journal-mode changes', async t => {
  const path = join(temp(t), 'unknown.sqlite');
  const db = new DatabaseSync(path);
  db.exec("CREATE TABLE unrelated(secret TEXT); INSERT INTO unrelated VALUES('preserve');");
  db.close();
  const bytes = readFileSync(path);
  await assert.rejects(createAppServer({ dbPath: path }), MigrationError);
  assert.deepEqual(readFileSync(path), bytes);
});

test('unreadable SQLite and a failed CLI check return a nonzero outcome', t => {
  const path = join(temp(t), 'corrupt.sqlite');
  writeFileSync(path, 'not a SQLite database');
  const cli = spawnSync(process.execPath, [new URL('./preflight.mjs', import.meta.url).pathname, path], { encoding: 'utf8' });
  assert.equal(cli.status, 1);
  assert.equal(readFileSync(path, 'utf8'), 'not a SQLite database');
});

test('SQLite backup includes committed WAL data and restores intact rows and sessions', async t => {
  const folder = temp(t), path = join(folder, 'wal.sqlite');
  const db = new DatabaseSync(path);
  let expected;
  try {
    db.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0');
    legacy(db); migrateDatabase(db);
    db.prepare('UPDATE applications SET feedback=?').run('Committed in WAL');
    expected = snapshot(db);
    assert.ok(readFileSync(path + '-wal').length > 0);
    const source = new DatabaseSync(path, { readOnly: true });
    try { await backup(source, join(folder, 'backup.sqlite')); }
    finally { source.close(); }
    assert.equal(preflightFile(join(folder, 'backup.sqlite')).ok, true);
  } finally { db.close(); }
  const restored = join(folder, 'restored.sqlite');
  copyFileSync(join(folder, 'backup.sqlite'), restored);
  const app = await createAppServer({ dbPath: restored });
  try {
    assert.deepEqual(snapshot(app.db), expected);
    assert.deepEqual(runMigrations(app.db).appliedVersions, []);
    await new Promise(r => app.server.listen(0, '127.0.0.1', r));
    const result = await fetch(`http://127.0.0.1:${app.server.address().port}/api/bootstrap`, {
      headers: { Cookie: `ursunalia_session=${fixtureToken}` },
    });
    assert.equal((await result.json()).user.id, 'user-0');
  } finally { await app.close(); }
});
