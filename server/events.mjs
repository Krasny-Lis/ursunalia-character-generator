const fail = (status, message) => Object.assign(new Error(message), { status });
const fields = ['id', 'name', 'subtitle', 'date', 'location', 'locationNote', 'description'];
export function validEventDefinition(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    typeof value.id === 'string' &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(value.id) &&
    !['__proto__', 'constructor', 'prototype'].includes(value.id) &&
    fields.every(field => typeof value[field] === 'string' && value[field].length <= (field === 'description' ? 10000 : 500)) &&
    !!value.name.trim();
}
export function eventOperations(db) {
  const transaction = work => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  };
  const record = id => {
    const row = db.prepare('SELECT * FROM events WHERE id=?').get(id);
    if (!row) throw fail(404, 'Nie znaleziono wydarzenia.');
    return row;
  };
  const role = (user, id) => user
    ? db.prepare('SELECT role FROM event_grants WHERE event_id=? AND user_id=?').get(id, user.id)?.role ?? null
    : null;
  const membership = (user, id) => user
    ? db.prepare('SELECT event_id AS eventId,status,joined_at AS joinedAt,source FROM event_memberships WHERE event_id=? AND user_id=?').get(id, user.id) ?? null
    : null;
  const requireGrant = (user, id, manage = false) => {
    if (!user) throw fail(401, 'Zaloguj się, aby kontynuować.');
    record(id);
    const granted = role(user, id);
    if (!(manage ? ['organizer'] : ['organizer', 'gm']).includes(granted))
      throw fail(403, 'Brak uprawnień do tego wydarzenia.');
  };
  const dto = row => {
    const definition = JSON.parse(row.definition);
    return {
      ...Object.fromEntries(fields.map(field => [field, definition[field]])), published: !!row.published,
      registrationsOpen: !!row.registrations_open, revision: row.revision,
      status: row.registrations_open ? 'Zapisy otwarte' : 'Zapisy zamknięte',
    };
  };
  const visible = (user, id) => !!record(id).published || !!role(user, id) || !!membership(user, id);
  const grants = user => user
    ? db.prepare('SELECT event_id AS eventId,role FROM event_grants WHERE user_id=? ORDER BY event_id').all(user.id) : [];
  const memberships = user => user
    ? db.prepare('SELECT event_id AS eventId,status,joined_at AS joinedAt,source FROM event_memberships WHERE user_id=? ORDER BY event_id').all(user.id) : [];
  const list = user => db.prepare(`SELECT e.* FROM events e
    WHERE e.published=1 OR EXISTS(SELECT 1 FROM event_grants g WHERE g.event_id=e.id AND g.user_id=?)
    OR EXISTS(SELECT 1 FROM event_memberships m WHERE m.event_id=e.id AND m.user_id=?) ORDER BY e.rowid`)
    .all(user?.id ?? null, user?.id ?? null).map(dto);
  const get = (user, id) => {
    if (!visible(user, id)) throw fail(404, 'Nie znaleziono wydarzenia.');
    return dto(record(id));
  };
  const requireMembership = (user, id) => {
    record(id);
    if (!membership(user, id)) throw fail(403, 'Najpierw dołącz do wydarzenia.');
  };
  function validateBody(body, allowed) {
    if (Object.keys(body).some(key => !allowed.includes(key))) throw fail(400, 'Nieznane dane wydarzenia.');
    for (const key of ['published', 'registrationsOpen'])
      if (body[key] !== undefined && typeof body[key] !== 'boolean') throw fail(400, 'Nieprawidłowy stan wydarzenia.');
  }
  function create(user, body) {
    // Legacy platform organizers may create an event, but receive rights only to their own event.
    if (user.role !== 'organizer') throw fail(403, 'Tylko organizator może utworzyć wydarzenie.');
    validateBody(body, [...fields, 'published', 'registrationsOpen']);
    const definition = Object.fromEntries(fields.map(field => [field, body[field] ?? '']));
    if (!validEventDefinition(definition)) throw fail(400, 'Nieprawidłowe dane wydarzenia.');
    const published = body.published ?? false, open = body.registrationsOpen ?? false;
    if (open && !published) throw fail(400, 'Opublikuj wydarzenie przed otwarciem zapisów.');
    return transaction(() => {
      if (db.prepare('SELECT id FROM events WHERE id=?').get(definition.id)) throw fail(409, 'Wydarzenie już istnieje.');
      db.prepare('INSERT INTO events VALUES(?,?,?,?,?)').run(definition.id, JSON.stringify(definition), Number(published), Number(open), 1);
      db.prepare('INSERT INTO event_grants VALUES(?,?,?)').run(definition.id, user.id, 'organizer');
      return dto(record(definition.id));
    });
  }
  function update(user, id, body) {
    validateBody(body, [...fields.filter(field => field !== 'id'), 'published', 'registrationsOpen', 'expectedRevision']);
    if (!Number.isInteger(body.expectedRevision)) throw fail(400, 'Podaj rewizję wydarzenia.');
    return transaction(() => {
      requireGrant(user, id, true);
      const row = record(id);
      if (row.revision !== body.expectedRevision) throw fail(409, 'Wydarzenie zmieniło się. Odśwież dane.');
      const definition = JSON.parse(row.definition);
      for (const field of fields.filter(field => field !== 'id'))
        if (body[field] !== undefined) definition[field] = body[field];
      if (!validEventDefinition(definition)) throw fail(400, 'Nieprawidłowe dane wydarzenia.');
      const published = body.published ?? !!row.published, open = body.registrationsOpen ?? !!row.registrations_open;
      if (open && !published) throw fail(400, 'Zamknij zapisy przed wycofaniem publikacji.');
      db.prepare('UPDATE events SET definition=?,published=?,registrations_open=?,revision=revision+1 WHERE id=?')
        .run(JSON.stringify(definition), Number(published), Number(open), id);
      return dto(record(id));
    });
  }
  function join(user, id, body) {
    validateBody(body, []);
    return transaction(() => {
      const row = record(id);
      const existing = membership(user, id);
      if (existing) return existing; // closing registration never removes existing participation
      if (!row.published || !row.registrations_open) throw fail(409, 'Zapisy na wydarzenie są zamknięte.');
      db.prepare('INSERT INTO event_memberships VALUES(?,?,?,?,?)').run(id, user.id, 'joined', new Date().toISOString(), 'explicit');
      return membership(user, id);
    });
  }
  function changeGrant(user, id, target, body, remove = false) {
    validateBody(body, remove ? [] : ['role']);
    if (!remove && !['organizer', 'gm'].includes(body.role)) throw fail(400, 'Nieprawidłowe uprawnienie.');
    return transaction(() => {
      requireGrant(user, id, true);
      if (!db.prepare('SELECT id FROM users WHERE id=?').get(target)) throw fail(404, 'Nie znaleziono konta.');
      const old = db.prepare('SELECT role FROM event_grants WHERE event_id=? AND user_id=?').get(id, target);
      if (old?.role === 'organizer' && (remove || body.role !== 'organizer') &&
        db.prepare("SELECT COUNT(*) n FROM event_grants WHERE event_id=? AND role='organizer'").get(id).n === 1)
        throw fail(409, 'Nie można odebrać praw ostatniemu organizatorowi.');
      if (remove) db.prepare('DELETE FROM event_grants WHERE event_id=? AND user_id=?').run(id, target);
      else db.prepare('INSERT INTO event_grants VALUES(?,?,?) ON CONFLICT(event_id,user_id) DO UPDATE SET role=excluded.role')
        .run(id, target, body.role);
      return { eventId: id, userId: target, role: remove ? null : body.role };
    });
  }
  const withGrant = (user, id, manage, work) => transaction(() => {
    requireGrant(user, id, manage);
    return work();
  });
  return { role, membership, requireGrant, requireMembership, visible, list, get, grants, memberships, create, update, join, changeGrant, withGrant };
}
