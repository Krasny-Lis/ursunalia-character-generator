import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash, scryptSync, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAppServer } from './server.mjs';
import { MIGRATIONS, migrateDatabase, preflightDatabase, MigrationError } from './migrations.mjs';

const seed = JSON.parse(readFileSync(new URL('../public/data/platform.json', import.meta.url)));
const legacySql = readFileSync(new URL('./test-fixtures/v27.2-schema.sql', import.meta.url), 'utf8');
const origin = 'http://localhost:3000';
const password = 'fixture-password-12345';
const appId = () => `application-${randomUUID()}`;
function folder(t) {
  const path = mkdtempSync(join(tmpdir(), 'ursunalia-events-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'ursunalia-events-'));
  const path = join(directory, 'events.sqlite');
  const options = { dbPath: path, origin, adminEmail: 'admin@example.test', adminPassword: password };
  let app, base;
  const cookies = {};
  async function start() {
    app = await createAppServer(options);
    await new Promise(r => app.server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${app.server.address().port}`;
  }
  await start();
  t.after(async () => { await app.close(); rmSync(directory, { recursive: true, force: true }); });
  async function request(as, path, method = 'GET', body, requestOrigin = origin) {
    const res = await fetch(base + path, {
      method, headers: { Origin: requestOrigin, ...(cookies[as] ? { Cookie: cookies[as] } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookie = res.headers.get('set-cookie');
    if (cookie && as) cookies[as] = cookie.split(';')[0];
    return { status: res.status, data: await res.json() };
  }
  async function register(as, extra = {}) {
    assert.equal((await request(as, '/api/auth/register', 'POST', {
      name: as, email: `${as}@example.test`, password, ...extra,
    })).status, 201);
    return (await request(as, '/api/bootstrap')).data.user;
  }
  assert.equal((await request('admin', '/api/auth/login', 'POST', { email: options.adminEmail, password })).status, 200);
  const admin = (await request('admin', '/api/bootstrap')).data.user;
  return {
    request, register, admin, get db() { return app.db; },
    restart: async () => { await app.close(); await start(); },
  };
}
const eventBody = (id, extra = {}) => ({ id, name: `Event ${id}`, ...extra });
const formBody = (id, eventId) => ({ ...structuredClone(seed.forms[0]), id, eventId });
const joinEvent = (f, as, id = seed.event.id) => f.request(as, `/api/events/${id}/join`, 'POST', {});
const grant = (f, as, eventId, userId, role) => f.request(as, `/api/events/${eventId}/grants/${userId}`, 'PUT', { role });
async function submitted(f, as, form) {
  assert.equal((await joinEvent(f, as, form.eventId)).status, 200);
  const draft = { id: appId(), form, answers: seed.example };
  assert.equal((await f.request(as, '/api/applications', 'POST', draft)).status, 200);
  assert.equal((await f.request(as, `/api/applications/${draft.id}/submit`, 'POST', {})).status, 200);
  return draft;
}

test('registration, event participation and application status are independent; closure is idempotent for old members', async t => {
  const f = await fixture(t);
  await f.register('member');
  await f.register('newcomer');
  const initial = (await f.request('member', '/api/bootstrap')).data;
  assert.deepEqual(initial.memberships, []);
  assert.deepEqual(initial.applications, []);
  const draft = { id: appId(), form: seed.forms[0], answers: seed.example };
  assert.equal((await f.request('member', '/api/applications', 'POST', draft)).status, 403);
  const joined = await joinEvent(f, 'member');
  assert.equal(joined.status, 200);
  assert.equal(joined.data.source, 'explicit');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM applications').get().n, 0);
  const closed = await f.request('admin', `/api/events/${seed.event.id}`, 'PATCH', { expectedRevision: 1, registrationsOpen: false });
  assert.equal(closed.status, 200);
  assert.equal(closed.data.registrationsOpen, false);
  assert.deepEqual((await joinEvent(f, 'member')).data, joined.data);
  assert.equal((await joinEvent(f, 'newcomer')).status, 409);
  assert.equal((await f.request('newcomer', '/api/applications', 'POST', { ...draft, id: appId() })).status, 403);
  // An already joined player may create their first draft after registration closes.
  assert.equal((await f.request('member', '/api/applications', 'POST', draft)).status, 200);
  assert.equal((await f.request('member', `/api/applications/${draft.id}/submit`, 'POST', {})).status, 200);
  assert.equal((await f.request('admin', `/api/organizer/applications/${draft.id}`, 'PATCH', { status: 'changes', feedback: 'Fixture change' })).status, 200);
  assert.equal((await f.request('member', '/api/applications', 'POST', { ...draft, answers: { ...seed.example, name: 'Edited' } })).status, 200);
  assert.deepEqual((await f.request('member', '/api/bootstrap')).data.memberships, [joined.data]);
  await f.restart();
  assert.equal((await f.request('admin', `/api/events/${seed.event.id}`)).data.registrationsOpen, false);
  assert.deepEqual((await joinEvent(f, 'member')).data, joined.data);
  assert.equal((await f.request('member', '/api/bootstrap')).data.user.id, initial.user.id);
  const opened = await f.request('admin', `/api/events/${seed.event.id}`, 'PATCH', { expectedRevision: closed.data.revision, registrationsOpen: true });
  assert.equal(opened.status, 200);
  assert.equal((await joinEvent(f, 'newcomer')).status, 200);
});

test('publication and persistent event metadata are controlled per event, with revision and input validation', async t => {
  const f = await fixture(t);
  const p = await f.register('player', { role: 'organizer' });
  assert.equal(p.role, 'participant');
  assert.equal((await f.request('player', '/api/events', 'POST', eventBody('forged'))).status, 403);
  const draft = await f.request('admin', '/api/events', 'POST', eventBody('private'));
  assert.equal(draft.status, 201);
  assert.equal(draft.data.published, false);
  assert.equal((await f.request('', '/api/events/private')).status, 404);
  assert.equal((await f.request('player', '/api/events')).data.some(e => e.id === 'private'), false);
  assert.equal((await f.request('player', '/api/bootstrap')).data.eventGrants.length, 0);
  assert.equal((await joinEvent(f, 'admin', 'private')).status, 409);
  const form = await f.request('admin', '/api/forms', 'POST', formBody('private-form', 'private'));
  assert.equal(form.status, 201);
  assert.equal((await f.request('', '/api/bootstrap')).data.forms.some(x => x.id === form.data.id), false);
  const publish = await f.request('admin', '/api/events/private', 'PATCH', { expectedRevision: 1, published: true, name: 'Persistent name' });
  assert.equal(publish.status, 200);
  assert.equal((await f.request('', '/api/events/private')).data.name, 'Persistent name');
  assert.equal((await joinEvent(f, 'player', 'private')).status, 409);
  assert.equal((await f.request('admin', '/api/events/private', 'PATCH', { expectedRevision: 1, name: 'Stale' })).status, 409);
  assert.equal((await f.request('admin', '/api/events/private', 'PATCH', { expectedRevision: 2, registrationsOpen: 'yes' })).status, 400);
  assert.equal((await f.request('admin', '/api/events/private', 'PATCH', { expectedRevision: 2, id: 'moved' })).status, 400);
  assert.equal((await f.request('admin', '/api/events/private', 'PATCH', { expectedRevision: 2, registrationsOpen: true })).status, 200);
  assert.equal((await joinEvent(f, 'player', 'private')).status, 200);
  await f.restart();
  assert.equal((await f.request('player', '/api/events/private')).data.name, 'Persistent name');
  assert.equal((await f.request('player', '/api/events/private')).data.registrationsOpen, true);
});

test('GM and global organizers cannot read, review, publish or grant permissions in another event', async t => {
  const f = await fixture(t);
  const gm = await f.register('gm');
  const ownerB = await f.register('owner-b');
  await f.register('player-a');
  await f.register('player-b');
  // Represent another pre-existing platform organizer in the isolated fixture only.
  f.db.prepare("UPDATE users SET role='organizer' WHERE id=?").run(ownerB.id);
  assert.equal((await f.request('owner-b', '/api/events', 'POST', eventBody('beta', { published: true, registrationsOpen: true }))).status, 201);
  const bForm = (await f.request('owner-b', '/api/forms', 'POST', formBody('beta-form', 'beta'))).data;
  const a = await submitted(f, 'player-a', seed.forms[0]);
  const b = await submitted(f, 'player-b', bForm);
  assert.equal((await grant(f, 'admin', seed.event.id, gm.id, 'gm')).status, 200);
  assert.equal((await f.request('gm', '/api/bootstrap')).data.user.role, 'participant');
  assert.equal((await f.request('gm', '/api/bootstrap')).data.memberships.length, 0);
  const inbox = await f.request('gm', '/api/organizer/applications');
  assert.equal(inbox.status, 200);
  assert.deepEqual(inbox.data.map(x => x.id), [a.id]);
  assert.equal(JSON.stringify(inbox.data).includes('player-b@example.test'), false);
  assert.equal((await f.request('gm', '/api/organizer/applications?eventId=beta')).status, 403);
  assert.equal((await f.request('admin', '/api/organizer/applications?eventId=beta')).status, 403);
  assert.deepEqual((await f.request('owner-b', '/api/organizer/applications')).data.map(x => x.id), [b.id]);
  for (const actor of ['gm', 'admin']) {
    assert.equal((await f.request(actor, `/api/organizer/applications/${b.id}`, 'PATCH', { status: 'accepted', feedback: '' })).status, 403);
    assert.equal((await f.request(actor, '/api/forms', 'POST', bForm)).status, 403);
    assert.equal((await f.request(actor, '/api/events/beta', 'PATCH', { expectedRevision: 1, registrationsOpen: false })).status, 403);
    assert.equal((await grant(f, actor, 'beta', gm.id, 'organizer')).status, 403);
  }
  assert.equal((await f.request('gm', '/api/forms', 'POST', seed.forms[0])).status, 403);
  assert.equal((await grant(f, 'gm', seed.event.id, gm.id, 'organizer')).status, 403);
  assert.equal((await f.request('gm', `/api/organizer/applications/${a.id}`, 'PATCH', { status: 'accepted', feedback: '' })).status, 200);
  assert.equal((await f.request('player-b', '/api/bootstrap')).data.applications[0].status, 'submitted');
  assert.equal((await grant(f, 'owner-b', 'beta', f.admin.id, 'organizer')).status, 200);
  assert.equal((await f.request('admin', '/api/forms', 'POST', { ...seed.forms[0], eventId: 'beta' })).status, 409);
  assert.equal((await f.request('player-a', '/api/bootstrap')).data.applications[0].form.eventId, seed.event.id);
});

test('revoked event grants stay revoked across startup and cannot remove the final organizer', async t => {
  const f = await fixture(t);
  const gm = await f.register('gm');
  const replacement = await f.register('replacement');
  assert.equal((await grant(f, 'admin', seed.event.id, gm.id, 'gm')).status, 200);
  assert.equal((await f.request('gm', '/api/organizer/applications')).status, 200);
  assert.equal((await f.request('admin', `/api/events/${seed.event.id}/grants/${gm.id}`, 'DELETE', {})).status, 200);
  assert.equal((await f.request('gm', '/api/organizer/applications')).status, 403);
  assert.equal((await f.request('admin', `/api/events/${seed.event.id}/grants/${f.admin.id}`, 'DELETE', {})).status, 409);
  assert.equal((await grant(f, 'admin', seed.event.id, f.admin.id, 'gm')).status, 409);
  assert.equal((await grant(f, 'admin', seed.event.id, replacement.id, 'organizer')).status, 200);
  assert.equal((await f.request('admin', `/api/events/${seed.event.id}/grants/${f.admin.id}`, 'DELETE', {})).status, 200);
  await f.restart(); // ADMIN_EMAIL bootstrap must not restore revoked permissions.
  const state = (await f.request('admin', '/api/bootstrap')).data;
  assert.equal(state.user.id, f.admin.id);
  assert.equal(state.user.role, 'organizer');
  assert.deepEqual(state.eventGrants, []);
  assert.equal((await f.request('admin', '/api/organizer/applications')).status, 403);
  assert.equal((await f.request('replacement', '/api/organizer/applications')).status, 200);
});

test('join/grant writes reject anonymity, forged actors and cross-origin requests', async t => {
  const f = await fixture(t);
  const p = await f.register('player');
  assert.equal((await joinEvent(f, '')).status, 401);
  assert.equal((await f.request('player', `/api/events/${seed.event.id}/join`, 'POST', { userId: f.admin.id, role: 'organizer' })).status, 400);
  assert.equal((await f.request('player', `/api/events/${seed.event.id}/join`, 'POST', {}, 'https://attacker.test')).status, 403);
  assert.equal((await grant(f, 'player', seed.event.id, p.id, 'organizer')).status, 403);
  assert.equal((await grant(f, 'admin', seed.event.id, p.id, 'superadmin')).status, 400);
  assert.equal((await grant(f, 'admin', seed.event.id, 'absent-user', 'gm')).status, 404);
  assert.equal((await f.request('player', '/api/bootstrap')).data.memberships.length, 0);
  assert.equal((await f.request('player', '/api/bootstrap')).data.eventGrants.length, 0);
});

function legacyFixture(path) {
  const db = new DatabaseSync(path);
  db.exec(legacySql);
  const encoded = 'fixture-salt:' + scryptSync(password, 'fixture-salt', 64).toString('hex');
  for (const [id, role] of [['player', 'participant'], ['staff', 'organizer'], ['unused', 'participant']])
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id, id, `${id}@example.test`, encoded, role);
  for (const form of seed.forms)
    db.prepare('INSERT INTO forms VALUES(?,?,?)').run(form.id, form.revision, JSON.stringify(form, null, 2));
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update('legacy-token').digest('hex'), 'player', Date.now() + 86400000);
  for (const [i, form] of seed.forms.entries())
    db.prepare('INSERT INTO applications VALUES(?,?,?,?,?,?,?,?,?)').run(appId(), 'player', form.id, form.revision,
      JSON.stringify(i ? {} : seed.example, null, 2), i ? 'draft' : 'submitted', '2026-10-01T12:00:00.000Z', i ? null : '2026-10-01T11:00:00.000Z', 'Preserve feedback');
  return db;
}
function originalRows(db) {
  return Object.fromEntries(['users', 'sessions', 'forms', 'applications'].map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
}

test('legacy and version-1 upgrade preserve all records and sessions, with one inferred membership and event-only staff rights', async t => {
  for (const versioned of [false, true]) await t.test(versioned ? 'version 1' : 'unversioned v27.2', async t => {
    const path = join(folder(t), 'upgrade.sqlite');
    let db = legacyFixture(path);
    if (versioned) migrateDatabase(db, { migrations: [MIGRATIONS[0]] });
    const before = originalRows(db);
    const firstLog = versioned ? db.prepare('SELECT * FROM schema_migrations WHERE version=1').get() : null;
    const upgraded = migrateDatabase(db);
    assert.equal(upgraded.currentVersion, 2);
    assert.deepEqual(originalRows(db), before);
    if (firstLog) assert.deepEqual(db.prepare('SELECT * FROM schema_migrations WHERE version=1').get(), firstLog);
    assert.deepEqual(db.prepare('SELECT event_id,user_id,source,status FROM event_memberships').all().map(r => ({ ...r })),
      [{ event_id: seed.event.id, user_id: 'player', source: 'legacy_application', status: 'joined' }]);
    assert.deepEqual(db.prepare('SELECT * FROM event_grants').all().map(r => ({ ...r })),
      [{ event_id: seed.event.id, user_id: 'staff', role: 'organizer' }]);
    const memberships = db.prepare('SELECT * FROM event_memberships').all();
    const log = db.prepare('SELECT * FROM schema_migrations ORDER BY version').all();
    assert.deepEqual(migrateDatabase(db).appliedVersions, []);
    assert.deepEqual(db.prepare('SELECT * FROM event_memberships').all(), memberships);
    assert.deepEqual(db.prepare('SELECT * FROM schema_migrations ORDER BY version').all(), log);
    db.close();
    const app = await createAppServer({ dbPath: path, origin });
    try {
      assert.deepEqual(originalRows(app.db), before);
      await new Promise(r => app.server.listen(0, '127.0.0.1', r));
      const response = await fetch(`http://127.0.0.1:${app.server.address().port}/api/bootstrap`, { headers: { Cookie: 'ursunalia_session=legacy-token' } });
      const state = await response.json();
      assert.equal(state.user.id, 'player');
      assert.equal(state.applications.length, 2);
      assert.equal(state.memberships.length, 1);
      assert.equal(state.memberships[0].source, 'legacy_application');
    } finally { await app.close(); }
  });
});

test('unmapped or inconsistent event definitions fail preflight before migration without touching legacy data', async t => {
  for (const inconsistent of [false, true]) await t.test(inconsistent ? 'changed event between revisions' : 'unknown event', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(legacySql);
      const form = formBody('unknown-form', 'unmapped-event');
      db.prepare('INSERT INTO forms VALUES(?,?,?)').run(form.id, form.revision, JSON.stringify(form));
      if (inconsistent) db.prepare('INSERT INTO forms VALUES(?,?,?)').run(form.id, 2, JSON.stringify({ ...form, revision: 2, eventId: seed.event.id }));
      const before = originalRows(db);
      const report = preflightDatabase(db);
      assert.equal(report.ok, false);
      assert.ok(report.issues.some(i => i.code === (inconsistent ? 'INCONSISTENT_FORM_EVENT' : 'EVENT_MAPPING_REQUIRED')));
      assert.throws(() => migrateDatabase(db), MigrationError);
      assert.deepEqual(originalRows(db), before);
      assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_schema WHERE name IN ('events','schema_migrations')").get().n, 0);
    } finally { db.close(); }
  });
});

test('nullable legacy primary keys are diagnosed before new grant constraints can fail', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(legacySql);
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(null, 'Fixture', 'fixture@example.test', 'fixture-hash', 'organizer');
    const before = originalRows(db);
    assert.ok(preflightDatabase(db).issues.some(i => i.code === 'INVALID_USER_IDENTIFIERS'));
    assert.throws(() => migrateDatabase(db), MigrationError);
    assert.deepEqual(originalRows(db), before);
  } finally { db.close(); }
});

test('event preflight detects corrupted definitions, lost memberships and version-2 checksum drift without repair', async t => {
  for (const [code, sql] of [
    ['INVALID_EVENT_DEFINITIONS', "UPDATE events SET definition=json_set(definition,'$.id','other')"],
    ['MISSING_EVENT_MEMBERSHIPS', 'DELETE FROM event_memberships'],
    ['MIGRATION_CHECKSUM_MISMATCH', "UPDATE schema_migrations SET checksum=printf('%064d',0) WHERE version=2"],
  ]) await t.test(code, t => {
    const db = legacyFixture(join(folder(t), 'bad.sqlite'));
    try {
      migrateDatabase(db); db.exec(sql);
      const before = originalRows(db);
      const report = preflightDatabase(db);
      assert.equal(report.ok, false);
      assert.ok(report.issues.some(i => i.code === code));
      assert.throws(() => migrateDatabase(db), MigrationError);
      assert.deepEqual(originalRows(db), before);
    } finally { db.close(); }
  });
});
