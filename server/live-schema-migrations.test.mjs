import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS, migrateDatabase, preflightDatabase, MigrationError } from './migrations.mjs';
import { seed } from './test-fixtures/api.mjs';
function source() {
  const db = new DatabaseSync(':memory:');
  migrateDatabase(db, { migrations: MIGRATIONS.slice(0, 4) });
  db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('owner','Preserve','owner@example.test','preserve-hash','participant');
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('preserve-session-hash','owner',Date.now()+100000);
  for (const form of seed.forms) db.prepare('INSERT INTO forms VALUES(?,?,?)').run(form.id,form.revision,JSON.stringify(form));
  const target = { ...structuredClone(seed.forms[0]), revision: 2 };
  target.sections[0].fields[0].label = 'Current label';
  db.prepare('INSERT INTO forms VALUES(?,?,?)').run(target.id,2,JSON.stringify(target));
  db.prepare('INSERT INTO event_character_forms VALUES(?,?,?)').run(seed.event.id,target.id,2);
  db.prepare('INSERT INTO event_memberships VALUES(?,?,?,?,?)').run(seed.event.id,'owner','joined','2026-10-14','explicit');
  db.prepare(`INSERT INTO characters(id,event_id,user_id,form_id,form_revision,answers,status,updated_at)
    VALUES('historical',?,'owner',?,1,?,'accepted','2026-10-14')`).run(seed.event.id,target.id,JSON.stringify({ ...seed.example, unknownLegacyKey:'keep' },null,2));
  return db;
}
test('safe adoption uses the one selected current schema, preserves exact original records and all accounts/sessions, and repeats without writes', () => {
  const db=source();
  try {
    const before = db.prepare('SELECT * FROM characters').get(), users=db.prepare('SELECT * FROM users').all(), sessions=db.prepare('SELECT * FROM sessions').all();
    const log = db.prepare('SELECT * FROM schema_migrations').all(), forms=db.prepare('SELECT * FROM forms').all();
    assert.equal(preflightDatabase(db).ok,true); assert.deepEqual(preflightDatabase(db).liveSchemaMapping.conflicts,[]);
    assert.deepEqual(migrateDatabase(db, { migrations: MIGRATIONS.slice(0,5) }).appliedVersions,[5]);
    const original = JSON.parse(db.prepare('SELECT original_record FROM character_schema_origins').get().original_record);
    assert.deepEqual(original,{ ...before });
    const after=db.prepare('SELECT * FROM characters').get();
    assert.equal(after.answers,before.answers); assert.equal(after.status,before.status); assert.equal(after.revision,before.revision+1);
    assert.deepEqual(db.prepare('SELECT * FROM users').all(),users); assert.deepEqual(db.prepare('SELECT * FROM sessions').all(),sessions);
    assert.deepEqual(db.prepare('SELECT * FROM forms').all(),forms); assert.deepEqual(db.prepare('SELECT * FROM schema_migrations WHERE version<5').all(),log);
    assert.equal(JSON.parse(db.prepare('SELECT definition FROM character_schemas').get().definition).revision,2);
    assert.deepEqual(migrateDatabase(db, { migrations: MIGRATIONS.slice(0,5) }).appliedVersions,[]); assert.deepEqual(db.prepare('SELECT * FROM characters').get(),after);
  } finally { db.close(); }
});
test('removed answers, removed selected options, changed types and unknown-key collisions block adoption with a private metadata report', async t => {
  for (const kind of ['field','option','type','collision','option_collision']) await t.test(kind, () => {
    const db=source();
    try {
      const form=JSON.parse(db.prepare('SELECT definition FROM forms WHERE revision=2 AND id=?').get(seed.forms[0].id).definition);
      if(kind==='field') form.sections[0].fields=form.sections[0].fields.filter(f=>f.id!=='name');
      if(kind==='type') form.sections[0].fields[0].type='textarea';
      if(kind==='option') { const f=form.sections.flatMap(s=>s.fields).find(f=>f.id==='traits'); f.options=f.options.filter(o=>o.id!==seed.example.traits[0]); }
      if(kind==='collision') form.sections[0].fields.push({id:'unknownLegacyKey',type:'text',label:'New meaning',required:false});
      if(kind==='option_collision') {
        const row=db.prepare('SELECT answers FROM characters').get(), answers=JSON.parse(row.answers);
        answers.traits=['unknown-old-option']; db.prepare('UPDATE characters SET answers=?').run(JSON.stringify(answers));
        form.sections.flatMap(s=>s.fields).find(f=>f.id==='traits').options.push({id:'unknown-old-option',label:'New meaning'});
      }
      db.prepare('UPDATE forms SET definition=? WHERE id=? AND revision=2').run(JSON.stringify(form),form.id);
      const before=db.prepare('SELECT * FROM characters').all(), log=db.prepare('SELECT * FROM schema_migrations').all();
      const report=preflightDatabase(db); assert.equal(report.ok,false);
      assert.ok(report.issues.some(i=>i.code==='LIVE_SCHEMA_MAPPING_REQUIRED'));
      assert.equal(report.liveSchemaMapping.conflicts[0].characterId,'historical');
      assert.equal(JSON.stringify(report).includes('owner@example.test'),false); assert.equal(JSON.stringify(report).includes('preserve-hash'),false);
      assert.throws(()=>migrateDatabase(db, { migrations: MIGRATIONS.slice(0,5) }),MigrationError); assert.deepEqual(db.prepare('SELECT * FROM characters').all(),before);
      assert.deepEqual(db.prepare('SELECT * FROM schema_migrations').all(),log);
      assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_schema WHERE name='character_schemas'").get().n,0);
    } finally { db.close(); }
  });
});
test('failed adoption rolls back origins, current schema and revision increments without losing originals', () => {
  const db=source();
  try {
    const before=db.prepare('SELECT * FROM characters').all(), log=db.prepare('SELECT * FROM schema_migrations').all();
    const failing=[...MIGRATIONS.slice(0,4),{...MIGRATIONS[4],sql:MIGRATIONS[4].sql+'\nINSERT INTO nonexistent VALUES(1);'}];
    assert.throws(()=>migrateDatabase(db,{migrations:failing}),/no such table/);
    assert.deepEqual(db.prepare('SELECT * FROM characters').all(),before); assert.deepEqual(db.prepare('SELECT * FROM schema_migrations').all(),log);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_schema WHERE name IN ('character_schemas','character_schema_origins')").get().n,0);
    assert.deepEqual(migrateDatabase(db, { migrations: MIGRATIONS.slice(0,5) }).appliedVersions,[5]);
  } finally { db.close(); }
});
