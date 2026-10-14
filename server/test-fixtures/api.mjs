import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createAppServer } from '../server.mjs';

export const seed = JSON.parse(readFileSync(new URL('../../public/data/platform.json', import.meta.url), 'utf8'));
export const newCharacter = (form = seed.forms[0], answers = {}) => ({ id: `application-${randomUUID()}`, form, answers, expectedRevision: 0 });
export async function apiFixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'ursunalia-characters-'));
  const options = { dbPath: join(directory, 'test.sqlite'), origin: 'http://localhost:3000',
    adminEmail: 'admin@example.test', adminPassword: 'test-password-long-enough' };
  const cookies = new Map();
  let app, base;
  async function start() {
    app = await createAppServer(options);
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${app.server.address().port}`;
  }
  await start();
  t.after(async () => { await app.close(); rmSync(directory, { recursive: true, force: true }); });
  async function request(as, path, method = 'GET', body, origin = options.origin) {
    const res = await fetch(base + path, { method, headers: { Origin: origin,
      ...(cookies.has(as) ? { Cookie: cookies.get(as) } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const cookie = res.headers.get('set-cookie');
    if (cookie) cookies.set(as, cookie.split(';')[0]);
    return { status: res.status, data: await res.json() };
  }
  async function register(as) {
    assert.equal((await request(as, '/api/auth/register', 'POST', { name: as, email: `${as}@example.test`, password: options.adminPassword })).status, 201);
    return (await request(as, '/api/bootstrap')).data.user;
  }
  assert.equal((await request('admin', '/api/auth/login', 'POST', { email: options.adminEmail, password: options.adminPassword })).status, 200);
  return { request, register, get db() { return app.db; },
    join: (as, id = seed.event.id) => request(as, `/api/events/${id}/join`, 'POST', {}),
    save: (as, c, answers = c.answers, expectedRevision = c.revision ?? 0) => request(as, '/api/characters', 'POST', { ...c, answers, expectedRevision }),
    submit: (as, c) => request(as, `/api/characters/${c.id}/submit`, 'POST', { expectedRevision: c.revision }),
    decide: (as, c, status, feedback) => request(as, `/api/organizer/characters/${c.id}/decision`, 'POST', { expectedRevision: c.revision, status, feedback }),
    restart: async () => { await app.close(); await start(); },
  };
}
