import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiFixture, seed, newCharacter } from './test-fixtures/api.mjs';
const path = `/api/events/${seed.event.id}/character-schema`;
const current = async f => (await f.request('admin', path)).data;
const preview = (f, definition, expectedRevision = definition.revision) => f.request('admin', path + '/preview', 'POST', { definition, expectedRevision });
const save = (f, definition, extra = {}) => f.request('admin', path, 'PUT', { definition, expectedRevision: definition.revision, ...extra });
async function participant(f, name, status = 'draft') {
  await f.register(name); await f.join(name);
  let c = (await f.save(name, newCharacter(await current(f), seed.example))).data;
  if (status !== 'draft') c = (await f.submit(name, c)).data;
  if (!['draft','submitted'].includes(status)) c = (await f.decide('admin', c, status)).data;
  return c;
}

test('one live schema updates all active statuses while archived snapshots and original forms remain unchanged', async t => {
  const f = await apiFixture(t), original = await current(f), characters = [];
  for (const status of ['draft','submitted','changes','accepted','rejected']) characters.push(await participant(f, status, status));
  const deleted = await participant(f, 'deleted');
  const archived = (await f.request('deleted', `/api/characters/${deleted.id}/archive`, 'POST', { expectedRevision: deleted.revision, confirmArchive: true })).data;
  const retired = f.db.prepare('SELECT * FROM characters WHERE id=?').get(deleted.id);
  const legacyForms = f.db.prepare('SELECT * FROM forms').all();
  const target = structuredClone(original);
  target.sections[0].fields.push({ id: 'new-required', type: 'text', label: 'Nowe wymagane', required: true });
  assert.equal((await save(f, target)).status, 200);
  for (const c of characters) {
    const actual = f.db.prepare('SELECT * FROM characters WHERE id=?').get(c.id);
    assert.equal(actual.status, c.status); assert.equal(actual.revision, c.revision + 1);
    assert.deepEqual(JSON.parse(actual.answers), c.answers);
  }
  const existing = (await f.request('accepted', `/api/characters/${characters[3].id}`)).data;
  assert.equal(existing.form.revision, 2); assert.ok(existing.form.sections[0].fields.some(x => x.id === 'new-required'));
  assert.equal(existing.answers['new-required'], undefined);
  assert.equal((await f.decide('admin', existing, 'accepted')).status, 422);
  const draft = (await f.request('draft', `/api/characters/${characters[0].id}`)).data;
  assert.equal((await f.submit('draft', draft)).status, 422);
  assert.equal((await f.save('draft', characters[0], characters[0].answers)).status, 409);
  assert.equal((await f.save('draft', { ...draft, form: original }, draft.answers)).status, 409);
  assert.deepEqual(f.db.prepare('SELECT * FROM forms').all(), legacyForms);
  assert.equal((await f.request('admin', '/api/forms', 'POST', target)).status, 409);
  assert.deepEqual(f.db.prepare('SELECT * FROM characters WHERE id=?').get(deleted.id), retired);
  assert.deepEqual((await f.request('deleted','/api/archives')).data[0], archived);
  const fresh = await participant(f, 'fresh'); assert.equal(fresh.form.revision, 2);
  await f.restart(); assert.equal((await current(f)).revision, 2);
});

test('destructive preview counts active characters and leaves immutable archives outside schema changes', async t => {
  const f = await apiFixture(t);
  const a = await participant(f, 'a', 'accepted'), b = await participant(f, 'b', 'submitted');
  const archived = (await f.request('b', `/api/characters/${b.id}/archive`, 'POST', { expectedRevision: b.revision, confirmArchive: true })).data;
  const target = await current(f);
  target.sections[0].fields = target.sections[0].fields.filter(x => x.id !== 'name');
  const multi = target.sections.flatMap(s => s.fields).find(f => f.id === 'traits');
  multi.options = multi.options.filter(o => o.id !== a.answers.traits[0]);
  const description = await preview(f, target);
  assert.equal(description.status, 200);
  assert.equal(description.data.affectedCharacters, 1); assert.equal(description.data.affectedDeletedCharacters, 0);
  assert.equal(description.data.affectedAnswers, 2);
  const before = f.db.prepare('SELECT * FROM characters ORDER BY id').all();
  assert.equal((await save(f, target)).status, 409);
  assert.deepEqual(f.db.prepare('SELECT * FROM characters ORDER BY id').all(), before);
  assert.equal((await save(f, target, { confirmLoss: true, confirmationToken: description.data.confirmationToken })).status, 200);
  for (const c of [a]) {
    const row = f.db.prepare('SELECT * FROM characters WHERE id=?').get(c.id), answers = JSON.parse(row.answers);
    assert.equal(answers.name, undefined); assert.deepEqual(answers.traits, c.answers.traits.slice(1));
    assert.equal(answers.history, c.answers.history); assert.equal(row.status, c.status);
  }
  assert.deepEqual((await f.request('b','/api/archives')).data[0], archived);
});

test('confirmation is bound to exact changes, actor, schema and character state; concurrent writes invalidate previews', async t => {
  const f = await apiFixture(t), c = await participant(f, 'owner');
  const target = await current(f); target.sections[0].fields = target.sections[0].fields.filter(x => x.id !== 'name');
  const p = (await preview(f, target)).data;
  const other = await f.register('other-organizer');
  await f.grant('admin', seed.event.id, other.id, 'organizer');
  assert.equal((await f.request('other-organizer',path,'PUT',{definition:target,expectedRevision:target.revision,
    confirmLoss:true,confirmationToken:p.confirmationToken})).status,409);
  const modified = structuredClone(target); modified.title += ' different';
  assert.equal((await save(f, modified, { confirmLoss: true, confirmationToken: p.confirmationToken })).status, 409);
  await f.save('owner', c, { ...c.answers, surname: 'Concurrent' });
  assert.equal((await save(f, target, { confirmLoss: true, confirmationToken: p.confirmationToken })).status, 409);
  const updated = (await preview(f, target)).data;
  await participant(f, 'newcomer');
  assert.equal((await save(f, target, { confirmLoss: true, confirmationToken: updated.confirmationToken })).status, 409);
  const ready = (await preview(f, target)).data;
  await f.restart();
  assert.equal((await save(f, target, { confirmLoss: true, confirmationToken: ready.confirmationToken })).status, 409);
  const next = (await preview(f, target)).data;
  assert.equal((await save(f, target, { confirmLoss: true, confirmationToken: next.confirmationToken })).status, 200);
  assert.equal((await save(f, target, { confirmLoss: true, confirmationToken: next.confirmationToken })).status, 409);
});

test('concurrent schema edits use CAS and failure in answers update rolls back schema and every character', async t => {
  const f = await apiFixture(t); await participant(f, 'owner');
  const target = await current(f); target.title = 'New title';
  const old = f.db.prepare('SELECT * FROM characters').all();
  f.db.exec("CREATE TRIGGER fail_schema BEFORE UPDATE ON characters BEGIN SELECT RAISE(ABORT,'fixture'); END;");
  assert.equal((await save(f, target)).status, 500); assert.equal((await current(f)).title, seed.forms[0].title);
  assert.deepEqual(f.db.prepare('SELECT * FROM characters').all(), old);
  f.db.exec('DROP TRIGGER fail_schema');
  const results = await Promise.all([save(f, target), save(f, { ...target, title: 'Other editor' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200,409]);
});

test('section/type changes are destructive and counted; labels, order and new required validation do not remove answers', async t => {
  const f = await apiFixture(t); await participant(f, 'owner');
  const target = await current(f);
  target.sections = target.sections.filter(s => s.id !== 'history');
  target.sections[0].fields[0].type = 'textarea';
  const p = (await preview(f, target)).data;
  assert.ok(p.changes.some(c => c.kind === 'section_removed'));
  assert.ok(p.changes.some(c => c.kind === 'type_changed'));
  assert.equal(p.affectedCharacters, 1); assert.ok(p.affectedAnswers >= 2);
  assert.equal((await save(f, target, { confirmLoss: true, confirmationToken: p.confirmationToken })).status, 200);
});

test('full export is organizer-only, consistent and includes drafts and archived text with both histories, without secrets or fabricated notes', async t => {
  const f = await apiFixture(t);
  const gm = await f.register('gm'), c = await participant(f, 'owner', 'submitted');
  await f.grant('admin', seed.event.id, gm.id, 'gm');
  const edited = (await f.request('gm', `/api/organizer/characters/${c.id}`, 'PATCH', { expectedRevision: c.revision,
    expectedSchemaRevision: c.form.revision, answers: { ...c.answers, name: 'GM edit' } })).data;
  const accepted = (await f.decide('gm', edited, 'accepted')).data;
  const draft = await participant(f, 'draft');
  assert.equal((await f.request('owner', `/api/characters/${accepted.id}/archive`, 'POST', { expectedRevision: accepted.revision, confirmArchive: true })).status, 200);
  for (const actor of ['','owner','gm']) assert.equal((await f.request(actor, path + '/export')).status, actor ? 403 : 401);
  const exported = (await f.request('admin', path + '/export')).data;
  assert.equal(exported.characters.length, 1);
  const old = exported.archives.find(c => c.characterId === accepted.id);
  assert.ok(old.archivedAt); assert.equal(old.history.length, 1); assert.equal(old.editHistory.length, 1);
  assert.ok(exported.characters.some(c => c.id === draft.id && c.status === 'draft'));
  assert.deepEqual(exported.gmNotes, []); assert.equal(exported.gmNotesAvailable, false);
  const json = JSON.stringify(exported);
  for (const secret of ['password','token_hash','sessions','test-password-long-enough']) assert.equal(json.includes(secret), false);
  assert.equal((await f.request('gm', path + '/preview', 'POST', { definition: seed.forms[0], expectedRevision: 1 })).status, 403);
  assert.equal((await f.request('owner', path, 'PUT', { definition: seed.forms[0], expectedRevision: 1 })).status, 403);
  await f.request('admin', '/api/events', 'POST', { id: 'other', name: 'Other', published: true });
  assert.equal((await f.request('gm', '/api/events/other/character-schema/export')).status, 403);
});

test('initial schema creation is event-scoped, establishes one stable anchor and supports current definitions for new characters', async t => {
  const f=await apiFixture(t);
  await f.request('admin','/api/events','POST',{id:'new-event',name:'New event',published:true,registrationsOpen:true});
  const definition={...structuredClone(seed.forms[0]),id:'new-event-character',eventId:'new-event'};
  const url='/api/events/new-event/character-schema';
  assert.equal((await f.request('admin',url,'PUT',{definition,expectedRevision:0})).status,200);
  assert.equal((await f.request('admin',url,'PUT',{definition,expectedRevision:0})).status,409);
  const changed={...definition,title:'Updated',revision:1};
  assert.equal((await f.request('admin',url,'PUT',{definition:changed,expectedRevision:1})).status,200);
  await f.register('owner'); await f.join('owner','new-event');
  const live=(await f.request('owner',url)).data;
  const character=(await f.save('owner',newCharacter(live,seed.example))).data;
  assert.equal(character.form.revision,2);
  assert.equal(f.db.prepare('SELECT form_revision FROM characters WHERE id=?').get(character.id).form_revision,1);
  await f.restart(); assert.equal((await f.request('owner',url)).data.revision,2);
});

test('an unsaved new character based on an old schema receives 409 without inserting or losing persisted data', async t => {
  const f=await apiFixture(t); await f.register('owner'); await f.join('owner');
  const original=await current(f), draft=newCharacter(original,{name:'Local unsaved work'});
  assert.equal((await save(f,{...original,title:'Changed schema'})).status,200);
  const response=await f.save('owner',draft);
  assert.equal(response.status,409);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM characters').get().n,0);
  const fresh=await current(f);
  assert.equal((await f.save('owner',{...draft,form:fresh})).status,200);
});
