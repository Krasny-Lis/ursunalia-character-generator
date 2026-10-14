import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from './server.mjs';
import { answerIssues, definitionIssues } from '../shared/validation.mjs';
const origin = 'http://localhost:3000';
const seed = JSON.parse(readFileSync(new URL('../public/data/platform.json', import.meta.url)));
let app, base, folder;
const cookies = {};
before(async () => {
  folder = mkdtempSync(join(tmpdir(), 'ursunalia-test-'));
  app = await createAppServer({
    dbPath: join(folder, 'test.sqlite'),
    origin,
    adminEmail: 'admin@example.test',
    adminPassword: 'very-long-test-password',
  });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(async () => {
  await app.close();
  rmSync(folder, { recursive: true, force: true });
});
async function request(path, { as = '', method = 'GET', body, requestOrigin = origin } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      Origin: requestOrigin,
      ...(cookies[as] ? { Cookie: cookies[as] } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const cookie = res.headers.get('set-cookie');
  if (cookie && as) cookies[as] = cookie.split(';')[0];
  const data = await res.json();
  return { status: res.status, data, cookie };
}
const register = (as) =>
  request('/api/auth/register', {
    as,
    method: 'POST',
    body: { name: as, email: `${as}@example.test`, password: 'very-long-test-password' },
  });
test('seed definitions and the full example satisfy the same browser/server validation', () => {
  for (const form of seed.forms) assert.deepEqual(definitionIssues(form), []);
  assert.deepEqual(answerIssues(seed.forms[0], seed.example), {});
});
test('reject malformed definitions, duplicate IDs, invalid dates, selections and short biographies', () => {
  const f = structuredClone(seed.forms[0]);
  f.sections[0].fields[1].id = f.sections[0].fields[0].id;
  assert.ok(definitionIssues(f).length);
  assert.ok(answerIssues(seed.forms[0], { ...seed.example, history: 'Too short' }).history);
  assert.ok(answerIssues(seed.forms[0], { ...seed.example, traits: ['not-in-catalog'] }).traits);
  assert.ok(answerIssues(seed.forms[1], { arrival: '2027-02-31', transport: 'own' }).arrival);
});
test('complete workflow: register, durable draft, submit, owner isolation, organizer review, changes and resubmit', async () => {
  assert.equal((await request('/api/organizer/applications')).status, 401);
  const registered = await register('alena');
  assert.equal(registered.status, 201);
  assert.match(registered.cookie, /HttpOnly/);
  assert.match(registered.cookie, /SameSite=Strict/);
  assert.equal((await register('other')).status, 201);
  assert.equal((await request('/api/organizer/applications', { as: 'alena' })).status, 403);
  const state = await request('/api/bootstrap', { as: 'alena' });
  assert.equal(state.data.user.role, 'participant');
  assert.equal(state.data.applications.length, 0);
  assert.equal(state.data.memberships.length, 0);
  assert.equal((await request('/api/events/ursunalia-2027/join', { as: 'alena', method: 'POST', body: {} })).status, 200);
  assert.equal(
    (await request('/api/forms', { as: 'alena', method: 'POST', body: seed.forms[0] })).status,
    403,
  );
  const id = `application-${randomUUID()}`;
  const draft = { id, form: seed.forms[0], answers: { name: 'Alena' } };
  assert.equal(
    (await request('/api/applications', { as: 'alena', method: 'POST', body: draft })).status,
    200,
  );
  assert.equal(
    (await request(`/api/applications/${id}/submit`, { as: 'alena', method: 'POST', body: {} }))
      .status,
    422,
  );
  assert.equal(
    (await request('/api/applications', { as: 'other', method: 'POST', body: draft })).status,
    404,
  );
  assert.equal(
    (await request(`/api/applications/${id}/submit`, { as: 'other', method: 'POST', body: {} }))
      .status,
    404,
  );
  assert.equal((await request('/api/bootstrap', { as: 'other' })).data.applications.length, 0);
  draft.answers = { ...seed.example, extra: 'not permitted' };
  const saved = await request('/api/applications', { as: 'alena', method: 'POST', body: draft });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.answers.extra, undefined);
  assert.equal(
    (await request('/api/bootstrap', { as: 'alena' })).data.applications[0].answers.name,
    'Alena',
  );
  const submitted = await request(`/api/applications/${id}/submit`, {
    as: 'alena',
    method: 'POST',
    body: {},
  });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.data.status, 'submitted');
  assert.equal(
    (await request('/api/applications', { as: 'alena', method: 'POST', body: draft })).status,
    409,
  );
  assert.equal(
    (
      await request('/api/auth/login', {
        as: 'admin',
        method: 'POST',
        body: { email: 'admin@example.test', password: 'very-long-test-password' },
      })
    ).status,
    200,
  );
  const inbox = await request('/api/organizer/applications', { as: 'admin' });
  assert.equal(inbox.data.length, 1);
  assert.equal(inbox.data[0].userEmail, 'alena@example.test');
  const changedForm = structuredClone(seed.forms[0]);
  changedForm.sections[0].fields[0].label = 'New name label';
  const published = await request('/api/forms', { as: 'admin', method: 'POST', body: changedForm });
  assert.equal(published.status, 201);
  assert.equal(published.data.revision, 2);
  const oldApp = (await request('/api/bootstrap', { as: 'alena' })).data.applications[0];
  assert.equal(oldApp.form.revision, 1);
  assert.equal(oldApp.form.sections[0].fields[0].label, 'Imię postaci');
  const review = await request(`/api/organizer/applications/${id}`, {
    as: 'admin',
    method: 'PATCH',
    body: { status: 'changes', feedback: 'Dopisz przydomek.' },
  });
  assert.equal(review.status, 200);
  assert.equal(review.data.status, 'changes');
  draft.answers.surname = 'z Północy';
  assert.equal(
    (await request('/api/applications', { as: 'alena', method: 'POST', body: draft })).status,
    200,
  );
  assert.equal(
    (await request(`/api/applications/${id}/submit`, { as: 'alena', method: 'POST', body: {} }))
      .data.status,
    'submitted',
  );
  assert.equal(
    (
      await request(`/api/organizer/applications/${id}`, {
        as: 'admin',
        method: 'PATCH',
        body: { status: 'accepted', feedback: 'Przyjęto.' },
      })
    ).data.status,
    'accepted',
  );
  assert.equal(
    (await request('/api/bootstrap', { as: 'alena' })).data.applications[0].status,
    'accepted',
  );
  const duplicate = { ...draft, id: `application-${randomUUID()}` };
  assert.equal(
    (await request('/api/applications', { as: 'alena', method: 'POST', body: duplicate })).status,
    409,
  );
  await request('/api/auth/logout', { as: 'alena', method: 'POST', body: {} });
  assert.equal((await request('/api/bootstrap', { as: 'alena' })).data.user, null);
});
test('server rejects cross-origin writes, forged schemas, unsafe images and unknown versions', async () => {
  assert.equal(
    (
      await request('/api/auth/register', {
        method: 'POST',
        requestOrigin: 'https://attacker.test',
        body: {},
      })
    ).status,
    403,
  );
  assert.equal((await register('validation')).status, 201);
  assert.equal((await request('/api/events/ursunalia-2027/join', { as: 'validation', method: 'POST', body: {} })).status, 200);
  const draft = {
    id: `application-${randomUUID()}`,
    form: structuredClone(seed.forms[0]),
    answers: { portrait: 'https://tracker.test/image.png' },
  };
  assert.equal(
    (await request('/api/applications', { as: 'validation', method: 'POST', body: draft })).status,
    400,
  );
  draft.answers = {};
  draft.form.sections = [];
  const saved = await request('/api/applications', {
    as: 'validation',
    method: 'POST',
    body: draft,
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.form.sections.length, 7);
  assert.equal(
    (
      await request(`/api/applications/${draft.id}/submit`, {
        as: 'validation',
        method: 'POST',
        body: {},
      })
    ).status,
    422,
  );
  draft.form.revision = 999;
  assert.equal(
    (await request('/api/applications', { as: 'validation', method: 'POST', body: draft })).status,
    409,
  );
});
test('runtime marks server mode and never returns static demo configuration', async () => {
  const res = await request('/runtime-config.json');
  assert.equal(res.status, 200);
  assert.equal(res.data.mode, 'server');
});
test('applications, users and survey revisions survive server/database restart', async () => {
  await app.close();
  app = await createAppServer({ dbPath: join(folder, 'test.sqlite'), origin });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  assert.equal(
    (
      await request('/api/auth/login', {
        as: 'persisted',
        method: 'POST',
        body: { email: 'alena@example.test', password: 'very-long-test-password' },
      })
    ).status,
    200,
  );
  const state = await request('/api/bootstrap', { as: 'persisted' });
  assert.equal(state.data.applications[0].status, 'accepted');
  assert.equal(state.data.forms.find((f) => f.id === 'character-2027').revision, 2);
});
