import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS, migrateDatabase, migrationChecksum, preflightDatabase, MigrationError } from './migrations.mjs';
import { seed } from './test-fixtures/api.mjs';
function version5() {
  const db=new DatabaseSync(':memory:');
  migrateDatabase(db,{migrations:MIGRATIONS.slice(0,2)});
  db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('owner','Owner','owner@example.test','unchanged-password-hash','participant');
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('unchanged-session-hash','owner',Date.now()+600000);
  for(const form of seed.forms) db.prepare('INSERT INTO forms VALUES(?,?,?)').run(form.id,form.revision,JSON.stringify(form));
  db.prepare('INSERT INTO event_memberships VALUES(?,?,?,?,?)').run(seed.event.id,'owner','joined','2026-10-14','explicit');
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?,?,?,?,?)').run('historical','owner',seed.forms[0].id,1,JSON.stringify({...seed.example,unknown:'Historical text'},null,2),'accepted','2026-10-14','2026-10-14','Keep feedback');
  migrateDatabase(db,{migrations:MIGRATIONS.slice(0,5)});
  return db;
}
const beforeTables=['users','sessions','forms','applications','events','event_memberships','event_grants','characters','character_decisions','character_edits','character_schemas','character_schema_origins','schema_migrations'];
const snapshot=db=>Object.fromEntries(beforeTables.map(t=>[t,db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()]));
test('migration 6 initializes a new database and upgrades version 5 additively without changing any existing rows, checksums, accounts or sessions', () => {
  for(const existing of [false,true]) {
    const db=existing?version5():new DatabaseSync(':memory:');
    try {
      const before=existing?snapshot(db):null;
      assert.deepEqual(migrateDatabase(db).appliedVersions,existing?[6]:[1,2,3,4,5,6]);
      if(existing) {
        for(const table of beforeTables.filter(t=>t!=='schema_migrations')) assert.deepEqual(db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),before[table]);
        assert.deepEqual(db.prepare('SELECT * FROM schema_migrations WHERE version<=5').all(),before.schema_migrations);
        assert.deepEqual({...db.prepare('SELECT * FROM character_controls').get()},{character_id:'historical',locked:0,disposition:'active'});
      }
      assert.equal(db.prepare('SELECT COUNT(*) n FROM character_archives').get().n,0);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM notifications').get().n,0); // never fabricate past notifications
      const after=snapshot(db); assert.deepEqual(migrateDatabase(db).appliedVersions,[]); assert.deepEqual(snapshot(db),after);
      assert.equal(preflightDatabase(db).ok,true);
    } finally { db.close(); }
  }
});
test('failed version 6 DDL and backfill roll back all new tables and registry rows, preserving versions 1–5 and exact source data', () => {
  for(const postflight of [false,true]) {
    const db=version5();
    try {
      const before=snapshot(db), version=MIGRATIONS[5];
      const sql=version.sql+(postflight?"\nUPDATE character_controls SET disposition='deleted';":"\nINSERT INTO nonexistent VALUES(1);");
      assert.throws(()=>migrateDatabase(db,{migrations:[...MIGRATIONS.slice(0,5),{...version,sql}]}),postflight?MigrationError:/no such table/);
      assert.deepEqual(snapshot(db),before);
      assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_schema WHERE name IN ('character_controls','character_archives','notifications')").get().n,0);
      assert.deepEqual(migrateDatabase(db).appliedVersions,[6]);
    } finally { db.close(); }
  }
});
test('unknown inactive legacy characters require an explicit mapping decision; preflight reports IDs without content and never archives/deletes automatically', () => {
  const db=version5();
  try {
    db.prepare('UPDATE characters SET deleted_at=?').run('2026-10-14');
    const before=snapshot(db), report=preflightDatabase(db);
    assert.equal(report.ok,false); assert.deepEqual(report.inactiveCharacters,['historical']);
    assert.ok(report.issues.some(i=>i.code==='LEGACY_INACTIVE_MAPPING_REQUIRED'));
    for(const privateData of ['Owner','owner@example.test','Historical text','unchanged-password-hash']) assert.equal(JSON.stringify(report).includes(privateData),false);
    assert.throws(()=>migrateDatabase(db),MigrationError); assert.deepEqual(snapshot(db),before);
  } finally { db.close(); }
});
test('migration 6 checksum and lifecycle consistency remain enforced, including missing controls and retained deleted character contents', () => {
  const db=version5();
  try {
    migrateDatabase(db);
    const changed=[...MIGRATIONS.slice(0,5),{...MIGRATIONS[5],sql:MIGRATIONS[5].sql+'\n-- changed'}];
    assert.notEqual(migrationChecksum(changed[5]),migrationChecksum(MIGRATIONS[5]));
    assert.ok(preflightDatabase(db,{migrations:changed}).issues.some(i=>i.code==='MIGRATION_CHECKSUM_MISMATCH'));
    db.prepare('DELETE FROM character_controls').run();
    assert.ok(preflightDatabase(db).issues.some(i=>i.code==='INVALID_CHARACTER_LIFECYCLE'));
    db.prepare("INSERT INTO character_controls VALUES('historical',0,'deleted')").run();
    db.prepare("UPDATE characters SET deleted_at='2026-10-14',answers='{}',feedback=''").run();
    assert.ok(preflightDatabase(db).issues.some(i=>i.code==='RETIRED_CHARACTER_CONTENT'));
  } finally { db.close(); }
});

test('published migration checksums 1–5 remain exactly pinned', () => {
  assert.deepEqual(MIGRATIONS.slice(0,5).map(migrationChecksum),[
    '601e552ac919205dab675fb12d6dd742eaf4c77024ee31bf0c079aeda7673a3a',
    'a6a931d98360fb86efa601439befd052a741d2a3cc703bf396d917690d867b6f',
    'c93d3fd81aa96b1eea53885c9b7446bd713f7b453c0f1a49770a1fb20c2a274d',
    '681450bd976206ab19a87d292181d5230c58df6ab25478f7a80faca1d311949f',
    '45be979b42eefbb2d18e4b4fb0280cf48dd076af3493702bdc7aef9b26575b94',
  ]);
});
