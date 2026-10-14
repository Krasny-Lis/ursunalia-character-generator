import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiFixture, seed, newCharacter } from './test-fixtures/api.mjs';

test('incomplete drafts persist with sessions; one character per event under competing creates and closed registration', async t => {
  const f = await apiFixture(t);
  const user = await f.register('player');
  assert.equal((await f.save('player', newCharacter())).status, 403);
  await f.join('player');
  const membership = f.db.prepare('SELECT * FROM event_memberships WHERE user_id=?').get(user.id);
  assert.equal((await f.request('admin', `/api/events/${seed.event.id}`, 'PATCH', { expectedRevision: 1, registrationsOpen: false })).status, 200);
  const results = await Promise.all([f.save('player', newCharacter(undefined, { name: 'Incomplete' })), f.save('player', newCharacter())]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const character = results.find(r => r.status === 200).data;
  assert.equal(character.status, 'draft');
  assert.equal(character.revision, 1);
  assert.equal((await f.submit('player', character)).status, 422);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM characters').get().n, 1);
  assert.throws(() => f.db.prepare(`INSERT INTO characters(id,event_id,user_id,form_id,form_revision,answers,status,updated_at)
    VALUES('duplicate',?,?,?,1,'{}','draft','2026-10-14')`).run(seed.event.id, user.id, seed.forms[0].id), /UNIQUE/);
  await f.restart();
  const restored = (await f.request('player', `/api/characters/${character.id}`)).data;
  assert.deepEqual(restored, character);
  assert.deepEqual(f.db.prepare('SELECT * FROM event_memberships WHERE user_id=?').get(user.id), membership);
  assert.equal((await f.request('player', '/api/bootstrap')).data.user.id, user.id);
  f.db.prepare(`INSERT INTO characters(id,event_id,user_id,form_id,form_revision,answers,status,updated_at,deleted_at)
    VALUES('retained-inactive',?,?,?,1,'{}','draft','2026-10-14','2026-10-14')`).run(seed.event.id, user.id, seed.forms[0].id);
  assert.equal((await f.request('player', '/api/bootstrap')).data.characters.length, 1);
  assert.equal((await f.save('player', newCharacter())).status, 409);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM characters').get().n, 2);
});

test('opening and no-op save keep submitted status/revision; actual player changes retract it, with stale writes rejected', async t => {
  const f = await apiFixture(t);
  await f.register('player'); await f.join('player');
  const answers = { ...seed.example };
  const optional = seed.forms[0].sections.flatMap(s => s.fields).find(f => !f.required && f.type === 'text');
  assert.ok(optional); delete answers[optional.id];
  let c = (await f.save('player', newCharacter(undefined, answers))).data;
  c = (await f.submit('player', c)).data;
  assert.equal(c.status, 'submitted');
  assert.deepEqual((await f.request('player', `/api/characters/${c.id}`)).data, c);
  const reordered = Object.fromEntries(Object.entries(c.answers).reverse());
  reordered.traits = [...reordered.traits].reverse();
  reordered[optional.id] = ''; // Returning an unanswered optional control to empty is also a no-op.
  assert.deepEqual((await f.save('player', c, reordered)).data, c);
  const changed = await f.save('player', c, { ...c.answers, name: 'New name' });
  assert.equal(changed.status, 200);
  assert.equal(changed.data.status, 'draft');
  assert.equal(changed.data.revision, c.revision + 1);
  assert.equal(changed.data.submittedAt, c.submittedAt);
  assert.equal((await f.save('player', c, { ...c.answers, name: 'Stale player' })).status, 409);
  assert.equal((await f.submit('player', c)).status, 409);
  assert.equal((await f.request('player', '/api/characters', 'POST', { ...c, answers: {} })).status, 400);
  assert.equal((await f.request('player', `/api/characters/${c.id}`)).data.answers.name, 'New name');
});

test('all five states: rejected/changes can be edited and resubmitted, accepted is locked until explicit GM unlock', async t => {
  const f = await apiFixture(t);
  await f.register('player'); await f.join('player');
  let c = (await f.save('player', newCharacter(undefined, seed.example))).data;
  assert.equal((await f.decide('admin', c, 'accepted')).status, 409);
  c = (await f.submit('player', c)).data;
  assert.equal((await f.submit('player', c)).status, 409);
  for (const status of ['rejected', 'changes']) {
    const decision = await f.decide('admin', c, status); // No comment required.
    assert.equal(decision.status, 200);
    c = decision.data;
    assert.equal(c.status, status);
    assert.equal(c.history.at(-1).comment, '');
    const edited = await f.save('player', c, { ...c.answers, name: `Edited ${status}` });
    assert.equal(edited.status, 200); c = edited.data;
    assert.equal(c.status, status);
    c = (await f.submit('player', c)).data;
    assert.equal(c.status, 'submitted');
  }
  c = (await f.decide('admin', c, 'accepted', 'OK')).data;
  assert.equal((await f.save('player', c, { ...c.answers, name: 'Blocked' })).status, 409);
  assert.equal((await f.submit('player', c)).status, 409);
  const unlocked = await f.request('admin', `/api/organizer/characters/${c.id}/unlock`, 'POST', { expectedRevision: c.revision });
  assert.equal(unlocked.status, 200); c = unlocked.data;
  assert.equal(c.status, 'changes');
  assert.equal(c.history.at(-1).action, 'unlock');
  assert.equal(c.history.at(-1).fromStatus, 'accepted');
  assert.equal((await f.save('player', c, { ...c.answers, name: 'Allowed' })).status, 200);
  assert.equal((await f.request('player', `/api/characters/${c.id}`)).data.history.length, 4);
});

test('GM edits preserve every status, including accepted; each new acceptance validates the pinned schema', async t => {
  const f = await apiFixture(t);
  await f.register('player'); await f.join('player');
  let c = (await f.save('player', newCharacter(undefined, seed.example))).data;
  const edit = answers => f.request('admin', `/api/organizer/characters/${c.id}`, 'PATCH', { expectedRevision: c.revision, expectedSchemaRevision: c.form.revision, answers });
  assert.equal((await edit({ ...seed.example, name: 'Hidden draft' })).status, 404);
  for (const status of ['submitted','changes','rejected','accepted']) {
    if (status === 'submitted') c = (await f.submit('player', c)).data;
    else if (status !== 'draft') c = (await f.decide('admin', c, status)).data;
    const saved = await edit({ ...seed.example, name: `GM ${status}` });
    assert.equal(saved.status, 200); c = saved.data;
    assert.equal(c.status, status);
  }
  const invalidated = await edit({ ...c.answers, name: '' });
  assert.equal(invalidated.status, 200); c = invalidated.data;
  assert.equal(c.status, 'accepted');
  const before = f.db.prepare('SELECT * FROM characters WHERE id=?').get(c.id);
  const history = c.history;
  const denied = await f.decide('admin', c, 'accepted');
  assert.equal(denied.status, 422);
  assert.ok(denied.data.issues.name);
  assert.deepEqual(f.db.prepare('SELECT * FROM characters WHERE id=?').get(c.id), before);
  assert.deepEqual((await f.request('admin', `/api/organizer/characters/${c.id}`)).data.history, history);
  c = (await edit({ ...c.answers, name: 'Fixed' })).data;
  assert.equal((await f.decide('admin', c, 'accepted')).status, 200);
});

test('decisions, history and revisions commit atomically; failures and competing GM/player saves cannot overwrite', async t => {
  const f = await apiFixture(t);
  await f.register('player'); await f.join('player');
  let c = (await f.save('player', newCharacter(undefined, seed.example))).data;
  c = (await f.submit('player', c)).data;
  const before = f.db.prepare('SELECT * FROM characters WHERE id=?').get(c.id);
  // Fault injection only in this isolated fixture, never in a migration.
  f.db.exec("CREATE TRIGGER fail_history BEFORE INSERT ON character_decisions BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");
  assert.equal((await f.decide('admin', c, 'accepted')).status, 500);
  assert.deepEqual(f.db.prepare('SELECT * FROM characters WHERE id=?').get(c.id), before);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM character_decisions').get().n, 0);
  f.db.exec('DROP TRIGGER fail_history');
  const raced = await Promise.all([f.decide('admin', c, 'accepted', 'Atomic'), f.save('player', c, { ...c.answers, name: 'Concurrent' })]);
  assert.deepEqual(raced.map(r => r.status).sort(), [200, 409]);
  const actual = (await f.request('player', `/api/characters/${c.id}`)).data;
  assert.equal(actual.revision, c.revision + 1);
  assert.equal(actual.history.length, actual.status === 'accepted' ? 1 : 0);
  const decision = actual.history[0];
  if (decision) {
    assert.equal(decision.characterRevision, actual.revision);
    assert.equal(decision.actorName, 'Organizator');
    assert.equal(decision.status, actual.status);
    assert.equal(decision.comment, 'Atomic');
    assert.ok(Number.isFinite(Date.parse(decision.decidedAt)));
  }
});

test('event-scoped GM authorization covers list, detail, editing, decisions, unlocking and schema selection', async t => {
  const f = await apiFixture(t);
  const gm = await f.register('gm'); await f.register('player'); await f.join('player');
  let a = (await f.save('player', newCharacter(undefined, seed.example))).data;
  a = (await f.submit('player', a)).data;
  await f.grant('admin', seed.event.id, gm.id, 'gm');
  await f.request('admin', '/api/events', 'POST', { id: 'beta', name: 'Beta', published: true, registrationsOpen: true });
  const form = (await f.request('admin', '/api/forms', 'POST', { ...seed.forms[0], id: 'beta-form', eventId: 'beta' })).data;
  assert.equal((await f.request('admin', '/api/events/beta/character-form', 'PUT', { formId: form.id, formRevision: form.revision })).status, 200);
  await f.join('player', 'beta');
  let b = (await f.save('player', newCharacter(form, seed.example))).data;
  b = (await f.submit('player', b)).data;
  assert.deepEqual((await f.request('gm', '/api/organizer/characters')).data.map(c => c.id), [a.id]);
  assert.equal((await f.request('gm', '/api/organizer/characters?eventId=beta')).status, 403);
  for (const [suffix, method, body] of [
    ['', 'GET', undefined], ['', 'PATCH', { answers: {} }],
    ['/decision', 'POST', { status: 'rejected' }], ['/unlock', 'POST', {}],
  ]) assert.equal((await f.request('gm', `/api/organizer/characters/${b.id}${suffix}`, method,
    body && { ...body, expectedRevision: b.revision })).status, 403);
  assert.equal((await f.request('gm', '/api/events/beta/character-form', 'PUT', { formId: form.id, formRevision: 1 })).status, 403);
  assert.equal((await f.request('gm', `/api/events/${seed.event.id}/character-form`, 'PUT', { formId: seed.forms[1].id, formRevision: 1 })).status, 403);
  assert.equal((await f.request('gm', `/api/characters/${a.id}`)).status, 404); // Owner route never exposes someone else's data.
  assert.equal((await f.request('player', `/api/organizer/characters/${a.id}`)).status, 403);
  assert.equal((await f.request('', '/api/organizer/characters')).status, 401);
  assert.equal((await f.request('gm', `/api/organizer/characters/${a.id}/decision`, 'POST',
    { expectedRevision: a.revision, status: 'accepted' }, 'https://attacker.test')).status, 403);
  assert.equal((await f.decide('gm', a, 'changes')).status, 200);
  assert.equal((await f.request('player', `/api/characters/${a.id}`)).data.history[0].actorId, gm.id);
  await f.grant('admin', seed.event.id, gm.id);
  assert.equal((await f.request('gm', `/api/organizer/characters/${a.id}`)).status, 403);
  await f.restart();
  assert.equal((await f.request('gm', '/api/organizer/characters')).status, 403);
});

test('GM search and status filter stay inside granted events; forged status/owner/revision/schema are ignored or rejected', async t => {
  const f = await apiFixture(t);
  await f.register('player'); await f.join('player');
  const created = await f.save('player', { ...newCharacter(undefined, { name: 'Żaneta' }), status: 'accepted', userId: 'forged', eventId: 'forged' });
  assert.equal(created.status, 200);
  const c = created.data;
  assert.equal(c.status, 'draft'); assert.equal(c.eventId, seed.event.id);
  assert.equal((await f.request('admin', '/api/organizer/characters?status=draft&q=%C5%BCANETA')).data.length, 0);
  assert.equal((await f.request('admin', '/api/organizer/characters?status=submitted')).data.length, 0);
  assert.equal((await f.request('admin', '/api/organizer/characters?status=unknown')).status, 400);
  assert.equal((await f.save('player', c, { portrait: 'https://tracker.test/img.png' })).status, 400);
  assert.equal((await f.save('player', { ...c, form: { ...c.form, revision: 999 } }, {})).status, 409);
  assert.equal((await f.request('player', '/api/characters', 'POST', { id: c.id, form: {}, answers: {}, expectedRevision: 1 })).status, 400);
  assert.equal((await f.request('player', '/api/applications', 'POST', newCharacter(undefined, {}))).status, 409);
  assert.equal((await f.request('admin', `/api/events/${seed.event.id}/character-form`, 'PUT', { formId: seed.forms[1].id, formRevision: 1 })).status, 409);
  const ready = (await f.save('player', c, { ...seed.example, name: 'Żaneta' })).data;
  assert.equal((await f.submit('player', ready)).status, 200);
  assert.equal((await f.request('admin', '/api/organizer/characters?status=submitted&q=%C5%BCANETA')).data.length, 1);
});

test('never-sent and retracted drafts stay out of every GM queue view, and reappear only after resubmission', async t => {
  const f = await apiFixture(t);
  await f.register('player'); await f.join('player');
  let c = (await f.save('player', newCharacter(undefined, seed.example))).data;
  const assertHidden = async () => {
    for (const query of ['', '?status=draft', '?status=submitted', `?eventId=${seed.event.id}`, '?q=Alena']) {
      const response = await f.request('admin', '/api/organizer/characters' + query);
      assert.equal(response.status, 200); assert.deepEqual(response.data, []);
    }
    assert.equal((await f.request('player', '/api/bootstrap')).data.characters[0].id, c.id);
  };
  await assertHidden();
  c = (await f.submit('player', c)).data;
  assert.deepEqual((await f.request('admin', '/api/organizer/characters?status=submitted')).data.map(r => r.id), [c.id]);
  assert.equal((await f.save('player', c, c.answers)).data.status, 'submitted');
  const pending = c;
  c = (await f.save('player', c, { ...c.answers, name: 'Alena retracted' })).data;
  assert.equal(c.status, 'draft');
  await assertHidden();
  assert.equal((await f.decide('admin', pending, 'accepted')).status, 409);
  assert.deepEqual(c.history, []);
  await f.restart(); await assertHidden();
  const resubmitted = await f.submit('player', c);
  assert.equal(resubmitted.status, 200); c = resubmitted.data;
  assert.equal(c.status, 'submitted');
  assert.deepEqual((await f.request('admin', '/api/organizer/characters?status=submitted')).data.map(r => r.id), [c.id]);
});

test('GM edits persist minimal actor/time/character/revision metadata, distinct from decisions and without snapshotting personal data', async t => {
  const f = await apiFixture(t);
  const gm = await f.register('gm'); await f.register('player'); await f.join('player');
  await f.grant('admin', seed.event.id, gm.id, 'gm');
  let c = (await f.save('player', newCharacter(undefined, seed.example))).data;
  c = (await f.submit('player', c)).data;
  const before = c;
  const response = await f.request('gm', `/api/organizer/characters/${c.id}`, 'PATCH', {
    expectedRevision: c.revision, expectedSchemaRevision: c.form.revision, answers: { ...c.answers, history: 'Private character biography '.repeat(5) },
  });
  assert.equal(response.status, 200); c = response.data;
  assert.equal(c.status, before.status);
  assert.deepEqual(c.history, before.history);
  assert.equal(c.editHistory.length, 1);
  const event = c.editHistory[0];
  assert.equal(event.actorId, gm.id); assert.equal(event.actorName, 'gm');
  assert.equal(event.characterId, c.id); assert.equal(event.characterRevision, c.revision);
  assert.equal(event.editedAt, c.updatedAt); assert.ok(Number.isFinite(Date.parse(event.editedAt)));
  const stored = f.db.prepare('SELECT * FROM character_edits').all();
  assert.deepEqual(Object.keys(stored[0]).sort(), ['actor_id','character_id','character_revision','edited_at','id']);
  assert.equal(JSON.stringify(stored).includes('Private character biography'), false);
  assert.equal(JSON.stringify(stored).includes('@example.test'), false);
  assert.equal((await f.request('gm', `/api/organizer/characters/${c.id}`, 'PATCH', {
    expectedRevision: c.revision, expectedSchemaRevision: c.form.revision, answers: c.answers,
  })).data.editHistory.length, 1); // A no-op is not a new edit.
  assert.equal((await f.request('gm', `/api/organizer/characters/${c.id}`, 'PATCH', {
    expectedRevision: before.revision, expectedSchemaRevision: before.form.revision, answers: before.answers,
  })).status, 409);
  assert.equal((await f.save('player', c, { ...c.answers, name: 'Player changed' })).status, 200);
  assert.deepEqual(f.db.prepare('SELECT * FROM character_edits').all(), stored); // Player edits are not attributed to MG.
  await f.restart();
  const owned = (await f.request('player', `/api/characters/${c.id}`)).data;
  assert.deepEqual(owned.editHistory, c.editHistory);
  assert.deepEqual(owned.history, before.history);
  const bootstrap = (await f.request('player', '/api/bootstrap')).data;
  assert.deepEqual(bootstrap.characters[0].editHistory, c.editHistory);
  await f.register('outsider');
  assert.equal((await f.request('outsider', `/api/characters/${c.id}`)).status, 404);
  assert.equal((await f.request('outsider', `/api/organizer/characters/${c.id}`)).status, 403);
  assert.deepEqual((await f.request('', '/api/bootstrap')).data.characters, []);
  assert.equal((await f.request('outsider', `/api/organizer/characters/${c.id}`, 'PATCH', {
    expectedRevision: owned.revision, expectedSchemaRevision: owned.form.revision, answers: owned.answers,
  })).status, 403);
  assert.deepEqual(f.db.prepare('SELECT * FROM character_edits').all(), stored);
});

test('a failed GM edit audit rolls back answers and revision; invalid inputs and stale/conflicting edits never append history', async t => {
  const f = await apiFixture(t);
  await f.register('player'); await f.join('player');
  let c = (await f.save('player', newCharacter(undefined, seed.example))).data;
  c = (await f.submit('player', c)).data;
  const before = f.db.prepare('SELECT * FROM characters WHERE id=?').get(c.id);
  const edit = (answers) => f.request('admin', `/api/organizer/characters/${c.id}`, 'PATCH', { expectedRevision: c.revision, expectedSchemaRevision: c.form.revision, answers });
  assert.equal((await edit({ ...c.answers, portrait: 'https://tracker.test/img.png' })).status, 400);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM character_edits').get().n, 0);
  f.db.exec("CREATE TRIGGER fail_edit_audit BEFORE INSERT ON character_edits BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");
  assert.equal((await edit({ ...c.answers, name: 'Rolled back' })).status, 500);
  assert.deepEqual(f.db.prepare('SELECT * FROM characters WHERE id=?').get(c.id), before);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM character_edits').get().n, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM character_decisions').get().n, 0);
  f.db.exec('DROP TRIGGER fail_edit_audit');
  const raced = await Promise.all([edit({ ...c.answers, name: 'GM A' }), edit({ ...c.answers, name: 'GM B' })]);
  assert.deepEqual(raced.map(r => r.status).sort(), [200, 409]);
  const actual = (await f.request('admin', `/api/organizer/characters/${c.id}`)).data;
  assert.equal(actual.status, 'submitted'); assert.equal(actual.revision, c.revision + 1);
  assert.equal(actual.editHistory.length, 1); assert.deepEqual(actual.history, []);
  assert.equal(actual.editHistory[0].characterRevision, actual.revision);
});
