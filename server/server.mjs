import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scrypt, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { readFileSync, statSync, createReadStream, mkdirSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { definitionIssues, answerIssues, cleanAnswers } from '../shared/validation.mjs';
import { migrateDatabase } from './migrations.mjs';
import { eventOperations } from './events.mjs';
import { characterOperations } from './characters.mjs';
const derive = promisify(scrypt);
const hash = (s) => createHash('sha256').update(s).digest('hex');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seed = JSON.parse(readFileSync(resolve(root, 'public/data/platform.json'), 'utf8'));
const httpError = (status, message) => Object.assign(new Error(message), { status });
const now = () => new Date().toISOString();
const publicUser = (row) =>
  row ? { id: row.id, name: row.name, email: row.email, role: row.role } : null;
async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + Buffer.from(await derive(password, salt, 64)).toString('hex');
}
async function passwordMatches(password, stored) {
  const [salt, value] = stored.split(':');
  const actual = Buffer.from(await derive(password, salt, 64));
  const expected = Buffer.from(value, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export async function createAppServer({
  dbPath = resolve(root, 'var/ursunalia.sqlite'),
  distPath = resolve(root, 'dist/ursunalia-character-generator/browser'),
  origin = 'http://localhost:3000',
  production = false,
  adminEmail = '',
  adminPassword = '',
} = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    migrateDatabase(db);
    db.exec('PRAGMA journal_mode=WAL');
  } catch (error) {
    db.close();
    throw error;
  }
  const events = eventOperations(db);
  for (const form of seed.forms)
    db.prepare('INSERT OR IGNORE INTO forms VALUES(?,?,?)').run(
      form.id,
      form.revision,
      JSON.stringify(form),
    );
  const characters = characterOperations(db, events);
  characters.ensureSeedMapping();
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 12 || adminPassword.length > 128)
      throw new Error('ADMIN_PASSWORD musi mieć od 12 do 128 znaków.');
    const email = adminEmail.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email);
    if (!existing) {
      const id = randomUUID(), encoded = await passwordHash(adminPassword);
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id, 'Organizator', email, encoded, 'organizer');
        db.prepare('INSERT INTO event_grants VALUES(?,?,?)').run(seed.event.id, id, 'organizer');
        db.exec('COMMIT');
      } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); throw error; }
    }
  }
  const attempts = new Map();
  function limit(req) {
    const key = req.socket.remoteAddress;
    const t = Date.now();
    let v = attempts.get(key);
    if (!v || v.until < t) {
      v = { count: 0, until: t + 15 * 60 * 1000 };
      attempts.set(key, v);
    }
    if (++v.count > 25) throw httpError(429, 'Zbyt wiele prób. Spróbuj ponownie za 15 minut.');
    if (attempts.size > 10000)
      for (const [key, value] of attempts) if (value.until < t) attempts.delete(key);
  }
  function session(req) {
    const token = String(req.headers.cookie ?? '')
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('ursunalia_session='))
      ?.slice(18);
    if (!token) return null;
    return db
      .prepare(
        'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?',
      )
      .get(hash(token), Date.now());
  }
  function requireUser(req) {
    const user = session(req);
    if (!user) throw httpError(401, 'Zaloguj się, aby kontynuować.');
    return user;
  }
  function cookie(res, token, expire = false) {
    res.setHeader(
      'Set-Cookie',
      `ursunalia_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${expire ? 0 : 604800}${production ? '; Secure' : ''}`,
    );
  }
  async function createSession(res, userId) {
    db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(
      hash(token),
      userId,
      Date.now() + 604800000,
    );
    cookie(res, token);
  }
  function forms() {
    return db
      .prepare(
        'SELECT f.definition FROM forms f WHERE f.revision=(SELECT MAX(g.revision) FROM forms g WHERE g.id=f.id) ORDER BY f.rowid',
      )
      .all()
      .map((r) => JSON.parse(r.definition));
  }
  function application(row, organizer = false) {
    if (!row) return null;
    const form = db
      .prepare('SELECT definition FROM forms WHERE id=? AND revision=?')
      .get(row.form_id, row.form_revision);
    const app = {
      id: row.id,
      kind: 'survey',
      form: JSON.parse(form.definition),
      answers: JSON.parse(row.answers),
      status: row.status,
      updatedAt: row.updated_at,
      submittedAt: row.submitted_at ?? undefined,
      feedback: row.feedback,
    };
    if (organizer) {
      const user = db.prepare('SELECT name,email FROM users WHERE id=?').get(row.user_id);
      app.userName = user.name;
      app.userEmail = user.email;
      app.userId = row.user_id;
    }
    return app;
  }
  function owned(req, id) {
    const user = requireUser(req);
    const row = db.prepare('SELECT * FROM applications WHERE id=? AND user_id=?').get(id, user.id);
    if (!row) throw httpError(404, 'Nie znaleziono zgłoszenia.');
    return row;
  }
  async function readJson(req) {
    if (!String(req.headers['content-type'] ?? '').startsWith('application/json'))
      throw httpError(415, 'Wymagany format JSON.');
    let chunks = [],
      size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) throw httpError(413, 'Zgłoszenie jest zbyt duże (maks. 2 MB).');
      chunks.push(chunk);
    }
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
      return body;
    } catch {
      throw httpError(400, 'Nieprawidłowy JSON.');
    }
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    );
    if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const json = (value, status = 200) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(value));
    };
    try {
      const requestUrl = new URL(req.url, 'http://localhost');
      const path = requestUrl.pathname;
      if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(req.method) && req.headers.origin !== origin)
        throw httpError(403, 'Nieprawidłowe źródło żądania.');
      if (path === '/runtime-config.json' && req.method === 'GET') return json({ mode: 'server' });
      if (path === '/api/bootstrap' && req.method === 'GET') {
        const user = session(req);
        return json({
          forms: forms().filter(form => events.visible(user, form.eventId)),
          events: events.list(user),
          memberships: events.memberships(user),
          eventGrants: events.grants(user),
          characterForms: characters.mappings().filter(m => events.visible(user, m.eventId)),
          user: publicUser(user),
          applications: user
            ? db
                .prepare(`SELECT * FROM applications WHERE user_id=? AND id NOT IN
                  (SELECT legacy_application_id FROM characters WHERE legacy_application_id IS NOT NULL) ORDER BY updated_at DESC`)
                .all(user.id)
                .map((r) => application(r))
            : [],
          characters: characters.ownList(user),
        });
      }
      if (path === '/api/events' && req.method === 'GET') return json(events.list(session(req)));
      if (path === '/api/events' && req.method === 'POST') {
        const body = await readJson(req);
        return json(events.create(requireUser(req), body), 201);
      }
      const eventPath = path.match(/^\/api\/events\/([^/]+)$/);
      if (eventPath && req.method === 'GET') return json(events.get(session(req), eventPath[1]));
      if (eventPath && req.method === 'PATCH') {
        const body = await readJson(req);
        return json(events.update(requireUser(req), eventPath[1], body));
      }
      const join = path.match(/^\/api\/events\/([^/]+)\/join$/);
      if (join && req.method === 'POST') {
        const body = await readJson(req);
        return json(events.join(requireUser(req), join[1], body));
      }
      const characterForm = path.match(/^\/api\/events\/([^/]+)\/character-form$/);
      if (characterForm && req.method === 'PUT')
        return json(characters.configure(requireUser(req), characterForm[1], await readJson(req)));
      if (path === '/api/characters' && req.method === 'POST')
        return json(characters.save(requireUser(req), await readJson(req)));
      const character = path.match(/^\/api\/characters\/([^/]+)$/);
      if (character && req.method === 'GET') return json(characters.get(requireUser(req), character[1]));
      const sendCharacter = path.match(/^\/api\/characters\/([^/]+)\/submit$/);
      if (sendCharacter && req.method === 'POST')
        return json(characters.submit(requireUser(req), sendCharacter[1], await readJson(req)));
      if (path === '/api/organizer/characters' && req.method === 'GET')
        return json(characters.list(requireUser(req), requestUrl.searchParams));
      const gmCharacter = path.match(/^\/api\/organizer\/characters\/([^/]+)$/);
      if (gmCharacter && req.method === 'GET') return json(characters.get(requireUser(req), gmCharacter[1], true));
      if (gmCharacter && req.method === 'PATCH')
        return json(characters.editByGM(requireUser(req), gmCharacter[1], await readJson(req)));
      const decision = path.match(/^\/api\/organizer\/characters\/([^/]+)\/(decision|unlock)$/);
      if (decision && req.method === 'POST')
        return json(characters.decide(requireUser(req), decision[1], await readJson(req), decision[2] === 'unlock'));
      const grant = path.match(/^\/api\/events\/([^/]+)\/grants\/([^/]+)$/);
      if (grant && ['PUT', 'DELETE'].includes(req.method)) {
        const body = await readJson(req);
        return json(events.changeGrant(requireUser(req), grant[1], grant[2], body, req.method === 'DELETE'));
      }
      if (path === '/api/auth/register' && req.method === 'POST') {
        limit(req);
        const body = await readJson(req);
        const email = String(body.email ?? '')
            .trim()
            .toLowerCase(),
          name = String(body.name ?? '').trim(),
          password = body.password;
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          email.length > 254 ||
          !name ||
          name.length > 100 ||
          typeof password !== 'string' ||
          password.length < 12 ||
          password.length > 128
        )
          throw httpError(400, 'Podaj imię, prawidłowy e-mail i hasło od 12 do 128 znaków.');
        if (db.prepare('SELECT id FROM users WHERE email=?').get(email))
          throw httpError(409, 'Konto już istnieje. Zaloguj się.');
        const id = randomUUID(),
          encoded = await passwordHash(password);
        try {
          db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(
            id,
            name,
            email,
            encoded,
            'participant',
          );
        } catch (e) {
          if (e.code?.startsWith('ERR_SQLITE'))
            throw httpError(409, 'Konto już istnieje. Zaloguj się.');
          throw e;
        }
        await createSession(res, id);
        return json({ ok: true }, 201);
      }
      if (path === '/api/auth/login' && req.method === 'POST') {
        limit(req);
        const body = await readJson(req);
        if (
          typeof body.email !== 'string' ||
          typeof body.password !== 'string' ||
          body.password.length > 128
        )
          throw httpError(400, 'Nieprawidłowe dane logowania.');
        const user = db
          .prepare('SELECT * FROM users WHERE email=?')
          .get(body.email.trim().toLowerCase());
        // Run the same password work for unknown accounts.
        const encoded = user?.password ?? '00000000000000000000000000000000:' + '00'.repeat(64);
        const valid = await passwordMatches(body.password, encoded);
        if (!user || !valid) throw httpError(401, 'Nieprawidłowy e-mail lub hasło.');
        await createSession(res, user.id);
        return json({ ok: true });
      }
      if (path === '/api/auth/logout' && req.method === 'POST') {
        await readJson(req);
        const token = String(req.headers.cookie ?? '')
          .split(';')
          .map((x) => x.trim())
          .find((x) => x.startsWith('ursunalia_session='))
          ?.slice(18);
        if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));
        cookie(res, '', true);
        return json({ ok: true });
      }
      if (path === '/api/forms' && req.method === 'POST') {
        const body = await readJson(req);
        const user = requireUser(req);
        if (JSON.stringify(body).length > 400000)
          throw httpError(413, 'Definicja ankiety jest zbyt duża.');
        const errors = definitionIssues(body);
        if (errors.length) throw httpError(400, errors[0]);
        const published = events.withGrant(user, body.eventId, true, () => {
          const previousForms = db.prepare('SELECT definition FROM forms WHERE id=?').all(body.id);
          if (previousForms.some(row => JSON.parse(row.definition).eventId !== body.eventId))
            throw httpError(409, 'Nie można przenieść ankiety do innego wydarzenia.');
          const last = db.prepare('SELECT MAX(revision) AS revision FROM forms WHERE id=?').get(body.id);
          const form = { ...body, status: 'published', revision: (last.revision ?? 0) + 1 };
          db.prepare('INSERT INTO forms VALUES(?,?,?)').run(form.id, form.revision, JSON.stringify(form));
          // New characters use the new snapshot; existing characters retain their pinned schema in this stage.
          db.prepare('UPDATE event_character_forms SET form_revision=? WHERE event_id=? AND form_id=?')
            .run(form.revision, form.eventId, form.id);
          return form;
        });
        return json(published, 201);
      }
      if (path === '/api/applications' && req.method === 'POST') {
        const user = requireUser(req);
        const body = await readJson(req);
        if (
          typeof body.id !== 'string' ||
          !/^application-[a-f0-9-]{36}$/.test(body.id) ||
          !body.form ||
          typeof body.form.id !== 'string' ||
          !Number.isInteger(body.form.revision) ||
          !body.answers ||
          typeof body.answers !== 'object' ||
          Array.isArray(body.answers)
        )
          throw httpError(400, 'Nieprawidłowe zgłoszenie.');
        const existing = db.prepare('SELECT * FROM applications WHERE id=?').get(body.id);
        if (existing && existing.user_id !== user.id)
          throw httpError(404, 'Nie znaleziono zgłoszenia.');
        if (db.prepare('SELECT id FROM characters WHERE legacy_application_id=?').get(body.id))
          throw httpError(409, 'Historyczny rekord jest zachowany. Korzystaj z API postaci i jej rewizji.');
        if (existing && !['draft', 'changes'].includes(existing.status))
          throw httpError(409, 'Wysłane zgłoszenie nie może być edytowane.');
        if (
          existing &&
          (body.form.id !== existing.form_id || body.form.revision !== existing.form_revision)
        )
          throw httpError(409, 'Wersja ankiety nie zgadza się ze szkicem.');
        const definition = db
          .prepare('SELECT definition FROM forms WHERE id=? AND revision=?')
          .get(body.form.id, body.form.revision);
        if (!definition) throw httpError(400, 'Nieznana wersja ankiety.');
        const form = JSON.parse(definition.definition);
        events.requireMembership(user, form.eventId);
        if (db.prepare('SELECT event_id FROM event_character_forms WHERE form_id=?').get(form.id))
          throw httpError(409, 'Formularz postaci korzysta z API /api/characters.');
        const answers = cleanAnswers(form, body.answers);
        // Drafts may be incomplete; supplied values must still satisfy type/length/option limits.
        const draftForm = {
          ...form,
          sections: form.sections.map((s) => ({
            ...s,
            fields: s.fields.map((f) => ({
              ...f,
              required: false,
              minLength: 0,
              minSelections: 0,
            })),
          })),
        };
        const issues = answerIssues(draftForm, answers);
        if (Object.keys(issues).length) throw httpError(400, Object.values(issues)[0]);
        if (
          !existing &&
          db
            .prepare('SELECT id FROM applications WHERE user_id=? AND form_id=?')
            .get(user.id, form.id)
        )
          throw httpError(
            409,
            'Masz już zgłoszenie do tej ankiety. Odśwież listę swoich zgłoszeń.',
          );
        if (existing)
          db.prepare('UPDATE applications SET answers=?,updated_at=? WHERE id=?').run(
            JSON.stringify(answers),
            now(),
            body.id,
          );
        else
          db.prepare(
            'INSERT INTO applications(id,user_id,form_id,form_revision,answers,status,updated_at) VALUES(?,?,?,?,?,?,?)',
          ).run(body.id, user.id, form.id, form.revision, JSON.stringify(answers), 'draft', now());
        return json(application(db.prepare('SELECT * FROM applications WHERE id=?').get(body.id)));
      }
      const submit = path.match(/^\/api\/applications\/([^/]+)\/submit$/);
      if (submit && req.method === 'POST') {
        await readJson(req);
        const row = owned(req, submit[1]);
        if (db.prepare('SELECT id FROM characters WHERE legacy_application_id=?').get(row.id))
          throw httpError(409, 'Historyczny rekord jest zachowany. Korzystaj z API postaci.');
        if (!['draft', 'changes'].includes(row.status))
          throw httpError(409, 'Zgłoszenie zostało już wysłane.');
        const app = application(row);
        events.requireMembership(requireUser(req), app.form.eventId);
        const issues = answerIssues(app.form, app.answers);
        if (Object.keys(issues).length)
          return json({ error: 'Uzupełnij wymagane pola.', issues }, 422);
        db.prepare(
          "UPDATE applications SET status='submitted',submitted_at=?,updated_at=? WHERE id=?",
        ).run(now(), now(), row.id);
        return json(application(db.prepare('SELECT * FROM applications WHERE id=?').get(row.id)));
      }
      if (path === '/api/organizer/applications' && req.method === 'GET') {
        const user = requireUser(req);
        const eventId = requestUrl.searchParams.get('eventId');
        if (eventId !== null) events.requireGrant(user, eventId);
        else if (!events.grants(user).length) throw httpError(403, 'Brak uprawnień do wydarzeń.');
        return json(
          db
            .prepare(`SELECT a.* FROM applications a JOIN forms f ON f.id=a.form_id AND f.revision=a.form_revision
              JOIN event_grants g ON g.event_id=json_extract(f.definition,'$.eventId') AND g.user_id=?
              WHERE g.role IN ('organizer','gm') AND a.status!='draft' AND a.id NOT IN
              (SELECT legacy_application_id FROM characters WHERE legacy_application_id IS NOT NULL)
              AND (? IS NULL OR g.event_id=?) ORDER BY a.submitted_at DESC`)
            .all(user.id, eventId, eventId)
            .map((r) => application(r, true)),
        );
      }
      const review = path.match(/^\/api\/organizer\/applications\/([^/]+)$/);
      if (review && req.method === 'PATCH') {
        const body = await readJson(req);
        const user = requireUser(req);
        if (
          !['accepted', 'changes'].includes(body.status) ||
          typeof body.feedback !== 'string' ||
          body.feedback.length > 2000 ||
          (body.status === 'changes' && !body.feedback.trim())
        )
          throw httpError(400, 'Podaj decyzję oraz uwagi do poprawek.');
        const row = db
          .prepare("SELECT * FROM applications WHERE id=? AND status!='draft'")
          .get(review[1]);
        if (!row) throw httpError(404, 'Nie znaleziono wysłanego zgłoszenia.');
        if (db.prepare('SELECT id FROM characters WHERE legacy_application_id=?').get(row.id))
          throw httpError(409, 'Historyczny rekord jest zachowany. Decyzję zapisz w API postaci.');
        const updated = events.withGrant(user, application(row).form.eventId, false, () => {
          db.prepare('UPDATE applications SET status=?,feedback=?,updated_at=? WHERE id=?')
            .run(body.status, body.feedback, now(), row.id);
          return application(db.prepare('SELECT * FROM applications WHERE id=?').get(row.id), true);
        });
        return json(updated);
      }
      if (path.startsWith('/api/')) throw httpError(404, 'Nie znaleziono zasobu.');
      if (req.method !== 'GET' && req.method !== 'HEAD')
        throw httpError(405, 'Metoda niedozwolona.');
      const file = resolve(distPath, '.' + decodeURIComponent(path === '/' ? '/index.html' : path));
      if (!file.startsWith(resolve(distPath) + sep)) throw httpError(404, 'Nie znaleziono pliku.');
      let stat;
      try {
        stat = statSync(file);
      } catch {
        throw httpError(404, 'Nie znaleziono pliku. Zbuduj aplikację poleceniem npm run build.');
      }
      if (!stat.isFile()) throw httpError(404, 'Nie znaleziono pliku.');
      const mime =
        {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.ico': 'image/x-icon',
          '.woff2': 'font/woff2',
        }[extname(file)] ?? 'application/octet-stream';
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Length', stat.size);
      res.setHeader(
        'Cache-Control',
        extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600',
      );
      if (req.method === 'HEAD') res.end();
      else createReadStream(file).pipe(res);
    } catch (error) {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      json(
        { error: error.status ? error.message : 'Wewnętrzny błąd serwera.', ...(error.status && error.issues ? { issues: error.issues } : {}) },
        error.status ?? 500,
      );
      if (!error.status) console.error('Request failed:', error.code ?? error.name);
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return {
    server,
    db,
    close: () =>
      new Promise((resolve) =>
        server.close(() => {
          db.close();
          resolve();
        }),
      ),
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000),
    production = process.env.NODE_ENV === 'production';
  if (production && !process.env.APP_ORIGIN)
    throw new Error('Ustaw APP_ORIGIN na adres HTTPS aplikacji.');
  if (production && !process.env.APP_ORIGIN?.startsWith('https://'))
    throw new Error('Produkcja wymaga HTTPS w APP_ORIGIN.');
  const app = await createAppServer({
    dbPath: process.env.DATABASE_PATH,
    origin: process.env.APP_ORIGIN ?? `http://localhost:${port}`,
    production,
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD,
  });
  app.server.listen(port, process.env.HOST ?? '127.0.0.1', () =>
    console.log(`Ursunalia: ${production ? process.env.APP_ORIGIN : `http://localhost:${port}`}`),
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, async () => {
      await app.close();
      process.exit(0);
    });
}
