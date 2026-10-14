import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { definitionIssues } from '../shared/validation.mjs';
import { schemaChanges, transformAnswers } from '../shared/schema-impact.mjs';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const same = (a, b) => JSON.stringify({ ...a, revision: 0, status: 'published' }) === JSON.stringify({ ...b, revision: 0, status: 'published' });
export function liveSchemaOperations(db, events, characters) {
  const secret = randomBytes(32);
  function transaction(work, write = false) {
    db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  }
  const stored = id => db.prepare('SELECT * FROM character_schemas WHERE event_id=?').get(id);
  function prepare(user, eventId, body) {
    events.requireGrant(user, eventId, true);
    const current = stored(eventId);
    if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) fail(400, 'Podaj rewizję formularza.');
    if ((current?.revision ?? 0) !== body.expectedRevision) fail(409, 'Formularz zmienił się na serwerze. Zachowaj lokalną pracę i odśwież dane.');
    const definition = body.definition;
    if (JSON.stringify(definition)?.length > 400000) fail(413, 'Definicja jest zbyt duża.');
    const issues = definitionIssues(definition);
    if (issues.length) fail(400, issues[0]);
    if (definition.eventId !== eventId || (current && definition.id !== current.form_id)) fail(400, 'Nie można zmienić wydarzenia ani identyfikatora formularza.');
    const target = { ...definition, revision: (current?.revision ?? 0) + 1, status: 'published' };
    const before = current ? JSON.parse(current.definition) : target;
    const rows = db.prepare('SELECT * FROM characters WHERE event_id=? AND deleted_at IS NULL ORDER BY id').all(eventId);
    const updates = rows.map(row => ({ row, ...transformAnswers(before, target, JSON.parse(row.answers)) }));
    const changes = schemaChanges(before, target);
    const affected = updates.filter(u => u.lostFieldIds.length);
    const destructive = changes.length > 0 || affected.length > 0;
    return { current, target, rows, updates, unchanged: !!current && same(before, target),
      impact: { destructive, changes, affectedCharacters: affected.filter(u => u.row.deleted_at === null).length,
        affectedDeletedCharacters: affected.filter(u => u.row.deleted_at !== null).length,
        affectedAnswers: affected.reduce((n, u) => n + u.lostFieldIds.length, 0) } };
  }
  function signature(user, eventId, state, timestamp) {
    return createHmac('sha256', secret).update(JSON.stringify([user.id, eventId, timestamp,
      state.current?.revision ?? 0, state.target, state.rows.map(r => [r.id,r.revision,r.answers,r.deleted_at])])).digest('hex');
  }
  return {
    initialize() {
      db.prepare(`INSERT OR IGNORE INTO character_schemas SELECT m.event_id,m.form_id,m.form_revision,f.definition
        FROM event_character_forms m JOIN forms f ON f.id=m.form_id AND f.revision=m.form_revision`).run();
    },
    get(user, eventId) {
      events.get(user, eventId);
      const row = stored(eventId);
      if (!row) fail(404, 'Formularz postaci nie jest jeszcze skonfigurowany.');
      return JSON.parse(row.definition);
    },
    preview(user, eventId, body) {
      return transaction(() => {
        const state = prepare(user, eventId, body), time = Date.now();
        return { ...state.impact, expectedRevision: state.current?.revision ?? 0,
          confirmationToken: `${time}.${signature(user, eventId, state, time)}` };
      });
    },
    save(user, eventId, body) {
      return transaction(() => {
        const state = prepare(user, eventId, body);
        if (state.impact.destructive) {
          const [time, token] = String(body.confirmationToken ?? '').split('.');
          const timestamp = Number(time), expected = signature(user, eventId, state, timestamp);
          if (body.confirmLoss !== true || !Number.isSafeInteger(timestamp) || Date.now() - timestamp > 300000 || timestamp > Date.now() ||
            !/^[a-f0-9]{64}$/.test(token ?? '') || !timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex')))
            fail(409, 'Potwierdź aktualną analizę utraty odpowiedzi. Dane lub formularz mogły się zmienić.');
        }
        if (state.unchanged) return JSON.parse(state.current.definition);
        if (!state.current) {
          if (db.prepare('SELECT id FROM forms WHERE id=?').get(state.target.id)) fail(409, 'Identyfikator należy do istniejącej ankiety. Użyj jawnego przypisania lub planu migracji.');
          db.prepare('INSERT INTO forms VALUES(?,?,?)').run(state.target.id, 1, JSON.stringify(state.target));
          db.prepare('INSERT INTO event_character_forms VALUES(?,?,?)').run(eventId, state.target.id, 1);
        }
        db.prepare(`INSERT INTO character_schemas VALUES(?,?,?,?) ON CONFLICT(event_id)
          DO UPDATE SET revision=excluded.revision,definition=excluded.definition`).run(eventId, state.target.id, state.target.revision, JSON.stringify(state.target));
        const time = new Date().toISOString();
        for (const u of state.updates) db.prepare('UPDATE characters SET answers=?,revision=revision+1,updated_at=? WHERE id=?')
          .run(JSON.stringify(u.answers) === JSON.stringify(JSON.parse(u.row.answers)) ? u.row.answers : JSON.stringify(u.answers), time, u.row.id);
        return state.target;
      }, true);
    },
    export(user, eventId) {
      return transaction(() => {
        events.requireGrant(user, eventId, true);
        const current = stored(eventId);
        if (!current) fail(404, 'Nie znaleziono formularza postaci.');
        return { format: 'ursunalia-character-schema-backup', formatVersion: 1, exportedAt: new Date().toISOString(),
          event: events.get(user, eventId), definition: JSON.parse(current.definition), characters: characters.forExport(eventId),
          archives: db.prepare('SELECT * FROM character_archives WHERE event_id=? ORDER BY character_id').all(eventId)
            .map(a => ({ characterId: a.character_id, userId: a.user_id, event: JSON.parse(a.event_snapshot), form: JSON.parse(a.schema_snapshot), answers: JSON.parse(a.answers), status: a.status, archivedAt: a.archived_at,
              history: db.prepare('SELECT * FROM character_decisions WHERE character_id=? ORDER BY character_revision').all(a.character_id),
              editHistory: db.prepare('SELECT * FROM character_edits WHERE character_id=? ORDER BY character_revision').all(a.character_id) })),
          retiredCharacters: db.prepare(`SELECT c.id,c.event_id eventId,c.user_id userId,c.revision,c.deleted_at retiredAt,k.disposition
            FROM characters c JOIN character_controls k ON k.character_id=c.id WHERE c.event_id=? AND c.deleted_at IS NOT NULL ORDER BY c.id`).all(eventId),
          migrationOrigins: db.prepare(`SELECT o.* FROM character_schema_origins o JOIN characters c ON c.id=o.character_id WHERE c.event_id=?`).all(eventId)
            .map(o => ({ characterId: o.character_id, originalRecord: JSON.parse(o.original_record) })),
          legacyForms: db.prepare('SELECT definition FROM forms WHERE id=? ORDER BY revision').all(current.form_id).map(r => JSON.parse(r.definition)),
          legacyApplications: db.prepare('SELECT a.* FROM applications a JOIN characters c ON c.legacy_application_id=a.id WHERE c.event_id=?').all(eventId),
          gmNotes: [], gmNotesAvailable: false };
      });
    },
  };
}
