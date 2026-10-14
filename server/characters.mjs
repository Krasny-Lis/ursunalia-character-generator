import { randomUUID } from 'node:crypto';
import { answerIssues, cleanAnswers } from '../shared/validation.mjs';

const fail = (status, message, issues) => {
  throw Object.assign(new Error(message), { status, ...(issues ? { issues } : {}) });
};
const now = () => new Date().toISOString();
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);

export function characterOperations(db, events) {
  function transaction(work) {
    // Reuse calls save inside its own IMMEDIATE transaction, with the same authorization checks.
    if (db.isTransaction) return work();
    db.exec('BEGIN IMMEDIATE');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  }
  const rowById = id => db.prepare('SELECT * FROM characters WHERE id=? AND deleted_at IS NULL').get(id);
  function row(id) {
    const value = rowById(id);
    if (!value) fail(404, 'Nie znaleziono postaci.');
    return value;
  }
  function owned(user, id) {
    const value = row(id);
    if (value.user_id !== user.id) fail(404, 'Nie znaleziono postaci.');
    events.requireMembership(user, value.event_id);
    return value;
  }
  function revision(value, expected) {
    if (!Number.isSafeInteger(expected) || expected < 1) fail(400, 'Podaj rewizję postaci.');
    if (value.revision !== expected) fail(409, 'Postać zmieniła się na serwerze. Zachowaj swoją kopię i odśwież dane przed ponownym zapisem.');
  }
  function definition(value) {
    return JSON.parse(db.prepare('SELECT definition FROM character_schemas WHERE event_id=?')
      .get(value.event_id).definition);
  }
  function dto(value, reviewer = false) {
    const character = {
      id: value.id, kind: 'character', eventId: value.event_id, revision: value.revision,
      form: definition(value), answers: JSON.parse(value.answers), status: value.status,
      updatedAt: value.updated_at, submittedAt: value.submitted_at ?? undefined, feedback: value.feedback,
      migrated: value.legacy_application_id !== null,
      deletedAt: value.deleted_at ?? undefined,
      locked: !!db.prepare('SELECT locked FROM character_controls WHERE character_id=?').get(value.id)?.locked,
      history: db.prepare(`SELECT id,actor_id actorId,actor_name actorName,decided_at decidedAt,
        action,from_status fromStatus,status,comment,character_revision characterRevision
        FROM character_decisions WHERE character_id=? ORDER BY character_revision`).all(value.id),
      editHistory: db.prepare(`SELECT e.id,e.character_id characterId,e.actor_id actorId,u.name actorName,
        e.edited_at editedAt,e.character_revision characterRevision FROM character_edits e
        JOIN users u ON u.id=e.actor_id WHERE e.character_id=? ORDER BY e.character_revision`).all(value.id),
    };
    if (reviewer) {
      const owner = db.prepare('SELECT id,name,email FROM users WHERE id=?').get(value.user_id);
      Object.assign(character, { userId: owner.id, userName: owner.name, userEmail: owner.email });
    }
    return character;
  }
  function validate(form, answers, complete = false) {
    const target = complete ? form : { ...form, sections: form.sections.map(s => ({ ...s,
      fields: s.fields.map(f => ({ ...f, required: false, minLength: 0, minSelections: 0 })) })) };
    const issues = answerIssues(target, answers);
    if (Object.keys(issues).length) fail(complete ? 422 : 400,
      complete ? 'Uzupełnij wymagane pola.' : Object.values(issues)[0], issues);
  }
  // Retain historical/unknown answers; an ordinary edit must never erase them.
  function updatedAnswers(value, input) {
    if (!record(input)) fail(400, 'Nieprawidłowe odpowiedzi.');
    const form = definition(value), previous = JSON.parse(value.answers);
    const allowed = new Set(form.sections.flatMap(s => s.fields.filter(f => f.type !== 'info').map(f => f.id)));
    const preserved = Object.fromEntries(Object.entries(previous).filter(([key]) => !allowed.has(key)));
    const answers = { ...preserved, ...cleanAnswers(form, input) };
    validate(form, answers);
    return answers;
  }
  function sameAnswers(value, next) {
    const multiple = new Set(definition(value).sections.flatMap(s => s.fields.filter(f => f.type === 'multi').map(f => f.id)));
    const canonical = answers => JSON.stringify(Object.entries(answers)
      .filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, multiple.has(key) && Array.isArray(value) ? [...value].sort() : value]));
    return canonical(JSON.parse(value.answers)) === canonical(next);
  }
  function edit(value, answers, player) {
    if (sameAnswers(value, answers)) return value;
    const status = player && value.status === 'submitted' ? 'draft' : value.status;
    db.prepare('UPDATE characters SET answers=?,status=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?')
      .run(JSON.stringify(answers), status, now(), value.id, value.revision);
    return row(value.id);
  }
  function mappings() {
    return db.prepare('SELECT event_id eventId,form_id formId,revision formRevision FROM character_schemas').all();
  }
  return {
    mappings,
    // Called after the existing seed has been inserted, including on a fresh empty database.
    ensureSeedMapping() {
      db.prepare(`INSERT OR IGNORE INTO event_character_forms(event_id,form_id,form_revision)
        SELECT 'ursunalia-2027',id,MAX(revision) FROM forms WHERE id='character-2027' GROUP BY id`).run();
    },
    configure(user, eventId, body) {
      return transaction(() => {
        events.requireGrant(user, eventId, true);
        if (typeof body.formId !== 'string' || !Number.isSafeInteger(body.formRevision) || body.formRevision < 1)
          fail(400, 'Podaj identyfikator i rewizję formularza.');
        const live = db.prepare('SELECT * FROM character_schemas WHERE event_id=?').get(eventId);
        if (live) {
          if (live.form_id !== body.formId || live.revision !== body.formRevision)
            fail(409, 'Wydarzenie ma już żywy formularz. Zapisz jego zmiany z analizą skutków.');
          return mappings().find(m => m.eventId === eventId);
        }
        const found = db.prepare('SELECT definition FROM forms WHERE id=? AND revision=?').get(body.formId, body.formRevision);
        if (!found) fail(400, 'Nieznany formularz postaci.');
        const form = JSON.parse(found.definition);
        if (form.eventId !== eventId || form.status !== 'published') fail(400, 'Formularz musi należeć do tego wydarzenia i być opublikowany.');
        const current = db.prepare('SELECT * FROM event_character_forms WHERE event_id=?').get(eventId);
        if (current && current.form_id !== body.formId && db.prepare('SELECT id FROM characters WHERE event_id=? LIMIT 1').get(eventId))
          fail(409, 'Zmiana formularza istniejących postaci wymaga osobnego planu migracji.');
        if (db.prepare(`SELECT a.id FROM applications a WHERE a.form_id=? AND NOT EXISTS
          (SELECT 1 FROM characters c WHERE c.legacy_application_id=a.id) LIMIT 1`).get(body.formId))
          fail(409, 'Ankieta zawiera historyczne odpowiedzi. Przypisanie wymaga jawnego planu migracji.');
        const latest = db.prepare('SELECT MAX(revision) revision FROM forms WHERE id=?').get(body.formId).revision;
        if (latest !== body.formRevision) fail(409, 'Wybierz najnowszą opublikowaną rewizję formularza.');
        db.prepare(`INSERT INTO event_character_forms VALUES(?,?,?) ON CONFLICT(event_id)
          DO UPDATE SET form_id=excluded.form_id,form_revision=excluded.form_revision`).run(eventId, body.formId, body.formRevision);
        db.prepare('INSERT INTO character_schemas VALUES(?,?,?,?)').run(eventId, form.id, form.revision, JSON.stringify(form));
        return mappings().find(m => m.eventId === eventId);
      });
    },
    ownList(user) {
      return user ? db.prepare('SELECT * FROM characters WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC').all(user.id).map(r => dto(r)) : [];
    },
    forExport(eventId) {
      return db.prepare('SELECT * FROM characters WHERE event_id=? AND deleted_at IS NULL ORDER BY id').all(eventId).map(r => dto(r, true));
    },
    get(user, id, reviewer = false) {
      const value = reviewer ? row(id) : owned(user, id);
      if (reviewer) { events.requireGrant(user, value.event_id); if (value.status === 'draft') fail(404, 'Szkic nie został wysłany do MG.'); }
      return dto(value, reviewer);
    },
    save(user, body) {
      return transaction(() => {
        if (typeof body.id !== 'string' || !record(body.form) || typeof body.form.id !== 'string'
          || !Number.isSafeInteger(body.form.revision) || body.form.revision < 1 || !record(body.answers))
          fail(400, 'Nieprawidłowa postać.');
        let value = rowById(body.id);
        if (value) {
          value = owned(user, body.id);
          revision(value, body.expectedRevision);
          if (db.prepare('SELECT locked FROM character_controls WHERE character_id=?').get(value.id)?.locked) fail(409, 'Karta zablokowana');
          if (value.status === 'accepted') fail(409, 'Zaakceptowaną postać może odblokować MG.');
          const form = definition(value);
          if (body.form.id !== form.id || body.form.revision !== form.revision) fail(409, 'Rewizja aktualnego formularza nie zgadza się z postacią.');
          return dto(edit(value, updatedAnswers(value, body.answers), true));
        }
        const retired = db.prepare('SELECT user_id FROM characters WHERE id=?').get(body.id);
        if (retired) fail(retired.user_id === user.id ? 409 : 404, 'Ta postać nie jest aktywna. Nie można jej przywrócić.');
        if (!/^application-[a-f0-9-]{36}$/.test(body.id) || body.expectedRevision !== 0) fail(400, 'Nieprawidłowa nowa postać lub rewizja.');
        // Never shadow a historical survey/application with a forged matching ID.
        if (db.prepare('SELECT id FROM applications WHERE id=?').get(body.id)) fail(409, 'Identyfikator należy do historycznego zgłoszenia.');
        const found = db.prepare('SELECT definition FROM character_schemas WHERE form_id=?').get(body.form.id);
        if (!found) fail(400, 'Nieznany formularz postaci.');
        const form = JSON.parse(found.definition);
        events.requireMembership(user, form.eventId);
        if (form.revision !== body.form.revision) fail(409, 'Schemat zmienił się od rozpoczęcia szkicu. Zachowaj swoją kopię i wczytaj aktualny formularz.');
        const mapping = db.prepare('SELECT * FROM event_character_forms WHERE event_id=?').get(form.eventId);
        if (!mapping || mapping.form_id !== form.id) fail(409, 'Wybierz obowiązujący formularz postaci wydarzenia.');
        if (db.prepare('SELECT id FROM characters WHERE event_id=? AND user_id=? AND deleted_at IS NULL').get(form.eventId, user.id)) fail(409, 'Masz już aktywną postać na to wydarzenie. Odśwież listę swoich postaci.');
        const answers = cleanAnswers(form, body.answers);
        validate(form, answers);
        db.prepare(`INSERT INTO characters(id,event_id,user_id,form_id,form_revision,answers,status,updated_at)
          VALUES(?,?,?,?,?,?,'draft',?)`).run(body.id, form.eventId, user.id, mapping.form_id, mapping.form_revision, JSON.stringify(answers), now());
        db.prepare('INSERT INTO character_controls(character_id) VALUES(?)').run(body.id);
        return dto(row(body.id));
      });
    },
    submit(user, id, body) {
      return transaction(() => {
        const value = owned(user, id);
        revision(value, body.expectedRevision);
        if (db.prepare('SELECT locked FROM character_controls WHERE character_id=?').get(value.id)?.locked) fail(409, 'Karta zablokowana');
        if (!['draft', 'changes', 'rejected'].includes(value.status)) fail(409, 'Postać nie jest gotowa do ponownej wysyłki.');
        validate(definition(value), JSON.parse(value.answers), true);
        const time = now();
        db.prepare("UPDATE characters SET status='submitted',submitted_at=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?")
          .run(time, time, id, value.revision);
        return dto(row(id));
      });
    },
    list(user, params) {
      const eventId = params.get('eventId');
      if (eventId !== null) events.requireGrant(user, eventId);
      else if (!events.grants(user).length) fail(403, 'Brak uprawnień do wydarzeń.');
      const status = params.get('status');
      if (status !== null && !['draft','submitted','changes','accepted','rejected'].includes(status)) fail(400, 'Nieprawidłowy status.');
      const query = params.get('q')?.trim().toLocaleLowerCase('pl') ?? '';
      if (query.length > 200) fail(400, 'Zapytanie jest zbyt długie.');
      return db.prepare(`SELECT c.* FROM characters c JOIN event_grants g ON g.event_id=c.event_id
        AND g.user_id=? WHERE g.role IN ('organizer','gm') AND c.deleted_at IS NULL AND c.status!='draft' AND (? IS NULL OR c.event_id=?)
        AND (? IS NULL OR c.status=?) ORDER BY c.updated_at DESC,c.id`).all(user.id, eventId, eventId, status, status)
        .map(r => dto(r, true)).filter(c => !query || [c.userName,c.userEmail,c.answers.name,c.answers.surname]
          .some(v => String(v ?? '').toLocaleLowerCase('pl').includes(query)));
    },
    editByGM(user, id, body) {
      return transaction(() => {
        const value = row(id);
        events.requireGrant(user, value.event_id);
        if (value.status === 'draft') fail(404, 'Szkic nie został wysłany do MG.');
        revision(value, body.expectedRevision);
        if (body.expectedSchemaRevision !== definition(value).revision) fail(409, 'Schemat zmienił się podczas edycji. Zachowaj lokalną pracę i odśwież postać.');
        const edited = edit(value, updatedAnswers(value, body.answers), false);
        if (edited.revision !== value.revision)
          db.prepare('INSERT INTO character_edits VALUES(?,?,?,?,?)')
            .run(randomUUID(), edited.id, user.id, edited.updated_at, edited.revision);
        return dto(edited, true);
      });
    },
    decide(user, id, body, unlock = false) {
      return transaction(() => {
        const value = row(id);
        events.requireGrant(user, value.event_id);
        revision(value, body.expectedRevision);
        const status = unlock ? 'changes' : body.status;
        const feedback = body.feedback ?? '';
        if (!['accepted','changes','rejected'].includes(status) || typeof feedback !== 'string' || feedback.length > 2000)
          fail(400, 'Nieprawidłowa decyzja lub komentarz (maks. 2000 znaków).');
        if (unlock ? value.status !== 'accepted' : value.status === 'draft') fail(409, unlock ? 'Tylko zaakceptowana postać wymaga odblokowania.' : 'Szkic musi zostać wysłany przed podjęciem decyzji.');
        if (status === 'accepted') validate(definition(value), JSON.parse(value.answers), true);
        if (!unlock && status === value.status && feedback === value.feedback) return dto(value, true);
        const time = now();
        db.prepare('UPDATE characters SET status=?,feedback=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?')
          .run(status, feedback, time, id, value.revision);
        const decisionId = randomUUID();
        db.prepare(`INSERT INTO character_decisions VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
          decisionId, id, user.id, user.name, time, unlock ? 'unlock' : 'decision', value.status, status, feedback, value.revision + 1);
        db.prepare('INSERT INTO notifications VALUES(?,?,?,?,?,?,?,NULL)').run(
          randomUUID(), value.user_id, value.event_id, id, decisionId, unlock ? 'unlock' : status, time);
        return dto(row(id), true);
      });
    },
    decideMany(user, body) {
      return transaction(() => {
        if (typeof body.eventId !== 'string' || !Array.isArray(body.characters) || !body.characters.length || body.characters.length > 500 ||
          body.characters.some(c => !c || typeof c.id !== 'string') || new Set(body.characters.map(c => c.id)).size !== body.characters.length)
          fail(400, 'Wybierz od 1 do 500 postaci jednego wydarzenia.');
        events.requireGrant(user, body.eventId);
        for (const c of body.characters) {
          const value = row(c.id);
          if (value.event_id !== body.eventId) fail(404, 'Postać należy do innego wydarzenia.');
          revision(value, c.expectedRevision);
        }
        return body.characters.map(c => this.decide(user, c.id, { status: body.status, feedback: body.feedback, expectedRevision: c.expectedRevision }));
      });
    },
  };
}
