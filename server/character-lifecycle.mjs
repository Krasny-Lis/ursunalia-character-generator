import { randomUUID } from 'node:crypto';
import { withoutImages, textAnswers, reusableAnswers } from '../shared/archive-data.mjs';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const time = () => new Date().toISOString();
export function lifecycleOperations(db, events, characters) {
  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  }
  function current(id) {
    const value = db.prepare(`SELECT c.*,k.locked,k.disposition FROM characters c
      JOIN character_controls k ON k.character_id=c.id WHERE c.id=?`).get(id);
    if (!value) fail(404, 'Nie znaleziono postaci.');
    return value;
  }
  function owned(user, id) {
    const value = current(id);
    if (value.user_id !== user.id || value.disposition === 'deleted') fail(404, 'Nie znaleziono postaci.');
    return value;
  }
  function revision(value, expected) {
    if (!Number.isSafeInteger(expected) || expected < 1) fail(400, 'Podaj rewizję postaci.');
    if (value.revision !== expected) fail(409, 'Postać zmieniła się. Odśwież dane przed ponownym potwierdzeniem.');
  }
  function batch(user, eventId, body) {
    events.requireGrant(user, eventId, true);
    if (!Array.isArray(body.characters) || !body.characters.length || body.characters.length > 500 ||
      body.characters.some(c => !c || typeof c.id !== 'string') || new Set(body.characters.map(c => c.id)).size !== body.characters.length)
      fail(400, 'Wybierz od 1 do 500 różnych postaci.');
    return body.characters.map(c => {
      const value = current(c.id);
      if (value.event_id !== eventId) fail(404, 'Postać należy do innego wydarzenia.');
      revision(value, c.expectedRevision);
      if (value.disposition !== 'active') fail(409, 'Postać nie jest już aktywna. Odśwież listę kart.');
      return value;
    });
  }
  function files(value) {
    return db.prepare('SELECT definition FROM forms WHERE id=?').all(value.form_id)
      .flatMap(r => JSON.parse(r.definition).sections.flatMap(s => s.fields.filter(f => f.type === 'file').map(f => f.id)));
  }
  function scrub(value, deleting) {
    const fileIds = files(value);
    if (value.legacy_application_id) {
      const legacy = db.prepare('SELECT * FROM applications WHERE id=?').get(value.legacy_application_id);
      const form = JSON.parse(db.prepare('SELECT definition FROM forms WHERE id=? AND revision=?').get(legacy.form_id,legacy.form_revision).definition);
      db.prepare('UPDATE applications SET answers=?,feedback=? WHERE id=?').run(
        JSON.stringify(deleting ? {} : textAnswers(form, JSON.parse(legacy.answers), fileIds)), deleting ? '' : withoutImages(legacy.feedback), legacy.id);
    }
    const origin = db.prepare('SELECT original_record FROM character_schema_origins WHERE character_id=?').get(value.id);
    if (origin) {
      if (deleting) db.prepare('DELETE FROM character_schema_origins WHERE character_id=?').run(value.id);
      else {
        const original = JSON.parse(origin.original_record);
        const form = JSON.parse(db.prepare('SELECT definition FROM forms WHERE id=? AND revision=?').get(original.form_id,original.form_revision).definition);
        original.answers = JSON.stringify(textAnswers(form, JSON.parse(original.answers), fileIds));
        db.prepare('UPDATE character_schema_origins SET original_record=? WHERE character_id=?').run(JSON.stringify(withoutImages(original)), value.id);
      }
    }
    for (const d of db.prepare('SELECT id,comment FROM character_decisions WHERE character_id=?').all(value.id))
      db.prepare('UPDATE character_decisions SET comment=? WHERE id=?').run(deleting ? '' : withoutImages(d.comment), d.id);
  }
  function archive(value, timestamp) {
    const form = JSON.parse(db.prepare('SELECT definition FROM character_schemas WHERE event_id=?').get(value.event_id).definition);
    const answers = textAnswers(form, JSON.parse(value.answers), files(value));
    const event = events.get({ id: value.user_id }, value.event_id);
    db.prepare('INSERT INTO character_archives VALUES(?,?,?,?,?,?,?,?,?)').run(value.id, value.user_id, value.event_id,
      JSON.stringify(withoutImages(event)), JSON.stringify(withoutImages(form)), JSON.stringify(answers), value.status, timestamp, value.revision + 1);
    scrub(value, false);
    retire(value, timestamp, 'archived');
  }
  function retire(value, timestamp, disposition) {
    db.prepare("UPDATE characters SET answers='{}',feedback='',deleted_at=?,updated_at=?,revision=revision+1 WHERE id=?")
      .run(timestamp, timestamp, value.id);
    db.prepare('UPDATE character_controls SET disposition=?,locked=0 WHERE character_id=?').run(disposition, value.id);
  }
  function archiveDTO(row) {
    return { id: row.character_id, eventId: row.event_id, event: JSON.parse(row.event_snapshot), form: JSON.parse(row.schema_snapshot),
      answers: JSON.parse(row.answers), status: row.status, archivedAt: row.archived_at, revision: current(row.character_id).revision };
  }
  const archiveRows = (column, id) => db.prepare(`SELECT * FROM character_archives WHERE ${column}=? ORDER BY archived_at DESC,character_id`).all(id).map(archiveDTO);
  return {
    ownArchives: user => user ? archiveRows('user_id', user.id) : [],
    adminList(user, eventId) {
      events.requireGrant(user, eventId, true);
      // Administrative metadata only: even here, unsent answers are not disclosed.
      return db.prepare(`SELECT c.id,c.revision,c.status,k.locked,u.name userName,u.email userEmail FROM characters c
        JOIN character_controls k ON k.character_id=c.id JOIN users u ON u.id=c.user_id WHERE c.event_id=? AND c.deleted_at IS NULL ORDER BY u.name,c.id`)
        .all(eventId).map(r => ({ ...r, locked: !!r.locked }));
    },
    lock(user, eventId, body) {
      if (typeof body.locked !== 'boolean') fail(400, 'Podaj stan blokady.');
      return transaction(() => {
        const values = batch(user, eventId, body);
        for (const value of values) if (!!value.locked !== body.locked) {
          db.prepare('UPDATE character_controls SET locked=? WHERE character_id=?').run(Number(body.locked), value.id);
          db.prepare('UPDATE characters SET revision=revision+1,updated_at=? WHERE id=?').run(time(), value.id);
        }
        return values.map(v => { const c = current(v.id); return { id: c.id, revision: c.revision, status: c.status, locked: !!c.locked }; });
      });
    },
    delete(user, id, body) {
      if (body.confirmDelete !== true) fail(400, 'Potwierdź nieodwracalne usunięcie postaci i jej kopii wewnętrznych.');
      return transaction(() => {
        const value = owned(user, id); revision(value, body.expectedRevision);
        scrub(value, true);
        db.prepare('DELETE FROM character_archives WHERE character_id=?').run(id);
        retire(value, time(), 'deleted');
        return { id, deleted: true };
      });
    },
    archive(user, id, body) {
      if (body.confirmArchive !== true) fail(400, 'Potwierdź archiwizację bez możliwości przywrócenia i usunięcie zdjęcia.');
      return transaction(() => {
        const value = owned(user, id); revision(value, body.expectedRevision);
        if (value.disposition !== 'active') fail(409, 'Postać jest już w archiwum.');
        archive(value, time());
        return this.ownArchives(user).find(a => a.id === id);
      });
    },
    archiveMany(user, eventId, body) {
      if (body.confirmArchive !== true || body.confirmCompleted !== true) fail(400, 'Potwierdź zakończenie wydarzenia i archiwizację bez zdjęć.');
      return transaction(() => {
        const values = batch(user, eventId, body), event = events.get(user, eventId);
        if (event.registrationsOpen) fail(409, 'Zamknij zapisy przed archiwizacją po wydarzeniu.');
        if (event.revision !== body.expectedEventRevision) fail(409, 'Wydarzenie zmieniło się. Potwierdź operację na aktualnych danych.');
        const timestamp = time();
        for (const value of values) archive(value, timestamp);
        return { archived: values.map(v => v.id) };
      });
    },
    reuse(user, id, body) {
      if (typeof body.eventId !== 'string' || !Number.isSafeInteger(body.expectedSchemaRevision) || body.expectedSchemaRevision < 1)
        fail(400, 'Wybierz wydarzenie i jego aktualną rewizję formularza.');
      return transaction(() => {
        const value = owned(user, id);
        const archived = db.prepare('SELECT * FROM character_archives WHERE character_id=?').get(id);
        if (!archived) fail(404, 'Nie znaleziono postaci w archiwum.');
        if (body.eventId === value.event_id) fail(400, 'Wybierz inne wydarzenie.');
        const schema = db.prepare('SELECT * FROM character_schemas WHERE event_id=?').get(body.eventId);
        if (!schema) fail(404, 'Nie znaleziono formularza docelowego wydarzenia.');
        events.requireMembership(user, body.eventId);
        if (body.expectedSchemaRevision !== schema.revision) fail(409, 'Formularz docelowego wydarzenia zmienił się.');
        const form = JSON.parse(schema.definition), before = JSON.parse(archived.schema_snapshot);
        return characters.save(user, { id: `application-${randomUUID()}`, form, expectedRevision: 0,
          answers: reusableAnswers(before, form, JSON.parse(archived.answers)) });
      });
    },
  };
}
export function notificationOperations(db) {
  return {
    list(user) {
      if (!user) return [];
      return db.prepare(`SELECT n.id,n.event_id eventId,n.character_id characterId,n.kind,n.created_at createdAt,n.read_at readAt,
        d.comment,k.disposition FROM notifications n JOIN character_decisions d ON d.id=n.decision_id
        JOIN character_controls k ON k.character_id=n.character_id WHERE n.user_id=? ORDER BY n.created_at DESC,n.id`).all(user.id)
        .map(n => ({ ...n, characterAvailable: n.disposition === 'active', archiveAvailable: n.disposition === 'archived' }));
    },
    read(user, id) {
      const row = db.prepare('SELECT id FROM notifications WHERE id=? AND user_id=?').get(id, user.id);
      if (!row) fail(404, 'Nie znaleziono powiadomienia.');
      db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?').run(time(), id, user.id);
      return this.list(user).find(n => n.id === id);
    },
  };
}
