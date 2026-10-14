import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { definitionIssues } from '../shared/validation.mjs';
import { validEventDefinition } from './events.mjs';
import { characterMappingReport } from './character-mapping.mjs';
import { liveSchemaMappingReport } from './live-schema-mapping.mjs';
import { withoutImages } from '../shared/archive-data.mjs';

// Immutable baseline: the four tables shipped in Royal Manuscript v27.2.
const baseline = `
CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('participant','organizer')));
CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
CREATE TABLE forms(id TEXT NOT NULL,revision INTEGER NOT NULL,definition TEXT NOT NULL,PRIMARY KEY(id,revision));
CREATE TABLE applications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),form_id TEXT NOT NULL,form_revision INTEGER NOT NULL,answers TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('draft','submitted','accepted','changes')),updated_at TEXT NOT NULL,submitted_at TEXT,feedback TEXT NOT NULL DEFAULT '',UNIQUE(user_id,form_id),FOREIGN KEY(form_id,form_revision) REFERENCES forms(id,revision));
`;
const registry = `CREATE TABLE schema_migrations(
  version INTEGER PRIMARY KEY CHECK(version > 0),
  name TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL CHECK(length(checksum) = 64),
  applied_at TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('initialize','adopt','apply'))
);`;
const eventSql = readFileSync(new URL('./migrations/002-events.sql', import.meta.url), 'utf8');
const eventSchema = eventSql.split('-- DATA BACKFILL')[0];
const characterSql = readFileSync(new URL('./migrations/003-characters.sql', import.meta.url), 'utf8');
const editSql = readFileSync(new URL('./migrations/004-character-edits.sql', import.meta.url), 'utf8');
const liveSql = readFileSync(new URL('./migrations/005-live-schema.sql', import.meta.url), 'utf8');
const lifecycleSql = readFileSync(new URL('./migrations/006-mvp-lifecycle.sql', import.meta.url), 'utf8');
export const MIGRATIONS = Object.freeze([
  Object.freeze({ version: 1, name: 'baseline_v27_2', sql: baseline, schemaSql: baseline }),
  Object.freeze({ version: 2, name: 'event_memberships_v1', sql: eventSql, schemaSql: baseline + eventSchema }),
  Object.freeze({ version: 3, name: 'characters_review_v1', sql: characterSql,
    schemaSql: baseline + eventSchema + characterSql.split('-- DATA BACKFILL')[0] }),
  Object.freeze({ version: 4, name: 'character_edits_v1', sql: editSql,
    schemaSql: baseline + eventSchema + characterSql.split('-- DATA BACKFILL')[0] + editSql }),
  Object.freeze({ version: 5, name: 'live_character_schema_v1', sql: liveSql,
    schemaSql: baseline + eventSchema + characterSql.split('-- DATA BACKFILL')[0] + editSql + liveSql.split('-- DATA BACKFILL')[0] }),
  Object.freeze({ version: 6, name: 'mvp_character_lifecycle_v1', sql: lifecycleSql,
    schemaSql: baseline + eventSchema + characterSql.split('-- DATA BACKFILL')[0] + editSql + liveSql.split('-- DATA BACKFILL')[0] + lifecycleSql.split('-- DATA BACKFILL')[0] }),
]);

export function migrationChecksum(migration) {
  return createHash('sha256')
    .update(JSON.stringify([migration.version, migration.name, migration.sql, migration.schemaSql]))
    .digest('hex');
}

function validateDefinitions(migrations) {
  if (!migrations.length || migrations.some((m, i) =>
    m.version !== i + 1 || !/^[a-z0-9_]+$/.test(m.name) ||
    typeof m.sql !== 'string' || !m.sql.trim() || typeof m.schemaSql !== 'string' || !m.schemaSql.trim(),
  ) || new Set(migrations.map(m => m.name)).size !== migrations.length)
    throw new Error('Invalid migration definitions.');
  // A later migration must never redefine the baseline used to recognize legacy databases.
  if (migrationChecksum(migrations[0]) !== migrationChecksum(MIGRATIONS[0]))
    throw new Error('The legacy baseline must remain unchanged.');
  for (const migration of migrations) {
    for (const sql of [migration.sql, migration.schemaSql]) {
      let statementStart = true;
      for (const token of sqlTokens(sql)) {
        if (statementStart && /^(begin|commit|end|rollback|savepoint|release|vacuum|attach|detach|pragma)$/i.test(token))
          throw new Error('Migration SQL must not control transactions, pragmas or attached databases.');
        statementStart = token === ';';
      }
    }
  }
}

// Compare all DDL, including CHECK/UNIQUE/FK/defaults and extra triggers/indexes.
// Only insignificant whitespace, comments and unquoted identifier case are normalized.
function sqlTokens(sql) {
  return (sql.match(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|\[[^\]]*\]|[a-zA-Z_][a-zA-Z_0-9]*|[0-9]+|[^\s]/g) ?? [])
    .filter(t => !t.startsWith('--') && !t.startsWith('/*'));
}
function normalizeSql(sql) {
  return JSON.stringify(sqlTokens(sql)
    .filter(t => t !== ';')
    .map(t => /^[a-zA-Z_]/.test(t) ? t.toLowerCase() : t)
    .filter((t, i, all) => !(t === 'if' && all[i + 1] === 'not' && all[i + 2] === 'exists') &&
      !(t === 'not' && all[i - 1] === 'if' && all[i + 1] === 'exists') &&
      !(t === 'exists' && all[i - 2] === 'if' && all[i - 1] === 'not')));
}
function schema(db) {
  return db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' ORDER BY type,name")
    .all().map(row => ({ ...row, sql: normalizeSql(row.sql ?? '') }));
}
function expectedSchema(schemaSql, withRegistry) {
  const reference = new DatabaseSync(':memory:');
  try {
    reference.exec(schemaSql);
    if (withRegistry) reference.exec(registry);
    return schema(reference);
  } finally { reference.close(); }
}

function inspect(db, migrations) {
  const report = { ok: false, kind: 'unknown', currentVersion: 0, pendingVersions: [], counts: {}, issues: [] };
  const issue = (code, count) => report.issues.push({ code, ...(count === undefined ? {} : { count }) });
  try {
    if (db.prepare('PRAGMA integrity_check').all().some(row => row.integrity_check !== 'ok'))
      issue('SQLITE_INTEGRITY');
    const foreignKeys = db.prepare('PRAGMA foreign_key_check').all();
    if (foreignKeys.length) issue('FOREIGN_KEY_VIOLATIONS', foreignKeys.length);
    // These fields were never used by v27.2. Do not adopt another application's database.
    if (db.prepare('PRAGMA user_version').get().user_version !== 0 ||
      db.prepare('PRAGMA application_id').get().application_id !== 0) issue('UNKNOWN_DATABASE_HEADER');
    const actual = schema(db);
    const hasRegistry = actual.some(row => row.type === 'table' && row.name === 'schema_migrations');
    let expected;
    if (!actual.length) {
      report.kind = 'empty';
      expected = [];
    } else if (!hasRegistry) {
      expected = expectedSchema(migrations[0].schemaSql, false);
      report.kind = 'legacy';
    } else {
      report.kind = 'versioned';
      const registrySchema = expectedSchema('', true);
      if (JSON.stringify(actual.filter(row => row.name === 'schema_migrations')) !== JSON.stringify(registrySchema)) {
        issue('REGISTRY_SCHEMA_MISMATCH');
        return report;
      }
      const history = db.prepare('SELECT * FROM schema_migrations ORDER BY version').all();
      if (!history.length) issue('EMPTY_MIGRATION_HISTORY');
      for (const [i, row] of history.entries()) {
        if (row.version !== i + 1) issue('MIGRATION_HISTORY_GAP');
        const migration = migrations[row.version - 1];
        if (!migration) issue('UNKNOWN_MIGRATION_VERSION');
        else if (row.name !== migration.name || row.checksum !== migrationChecksum(migration))
          issue('MIGRATION_CHECKSUM_MISMATCH');
        if (!Number.isFinite(Date.parse(row.applied_at)) ||
          (row.version === 1 ? !['initialize', 'adopt'].includes(row.operation) : row.operation !== 'apply'))
          issue('INVALID_MIGRATION_METADATA');
      }
      if (report.issues.length) return report;
      report.currentVersion = history.at(-1).version;
      expected = expectedSchema(migrations[report.currentVersion - 1].schemaSql, true);
    }
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      issue('SCHEMA_MISMATCH');
      report.kind = 'unknown';
      return report;
    }
    if (report.kind !== 'empty') {
      for (const table of ['users', 'sessions', 'forms', 'applications'])
        report.counts[table] = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
      let invalidForms = 0;
      const formEvents = new Map();
      for (const row of db.prepare('SELECT id,revision,definition FROM forms').iterate()) {
        try {
          const form = JSON.parse(row.definition);
          if (definitionIssues(form).length || form.id !== row.id || form.revision !== row.revision)
            invalidForms++;
          else {
            if (formEvents.has(form.id) && formEvents.get(form.id) !== form.eventId)
              issue('INCONSISTENT_FORM_EVENT');
            formEvents.set(form.id, form.eventId);
          }
        } catch { invalidForms++; }
      }
      if (invalidForms) issue('INVALID_FORM_DEFINITIONS', invalidForms);
      const eventsPlanned = migrations.some(m => m.name === 'event_memberships_v1');
      const eventsApplied = migrations.slice(0, report.currentVersion).some(m => m.name === 'event_memberships_v1');
      if (eventsPlanned) {
        const missingIdentities = db.prepare('SELECT COUNT(*) n FROM users WHERE id IS NULL').get().n;
        if (missingIdentities) issue('INVALID_USER_IDENTIFIERS', missingIdentities);
      }
      if (eventsPlanned && !eventsApplied && [...formEvents.values()].some(id => id !== 'ursunalia-2027'))
        issue('EVENT_MAPPING_REQUIRED');
      if (eventsApplied) {
        for (const table of ['events', 'event_memberships', 'event_grants'])
          report.counts[table] = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
        const eventIds = new Set();
        let invalidEvents = 0;
        for (const row of db.prepare('SELECT id,definition FROM events').iterate()) {
          eventIds.add(row.id);
          try {
            const event = JSON.parse(row.definition);
            if (!validEventDefinition(event) || event.id !== row.id) invalidEvents++;
          } catch { invalidEvents++; }
        }
        if (invalidEvents) issue('INVALID_EVENT_DEFINITIONS', invalidEvents);
        if ([...formEvents.values()].some(id => !eventIds.has(id))) issue('UNKNOWN_FORM_EVENT');
        const missingMemberships = db.prepare(`SELECT COUNT(*) n FROM applications a JOIN forms f
          ON f.id=a.form_id AND f.revision=a.form_revision LEFT JOIN event_memberships m
          ON m.event_id=json_extract(f.definition,'$.eventId') AND m.user_id=a.user_id WHERE m.user_id IS NULL`).get().n;
        if (missingMemberships) issue('MISSING_EVENT_MEMBERSHIPS', missingMemberships);
      }
      let invalidAnswers = 0;
      for (const row of db.prepare('SELECT answers FROM applications').iterate()) {
        try {
          const value = JSON.parse(row.answers);
          if (!value || typeof value !== 'object' || Array.isArray(value)) invalidAnswers++;
        } catch { invalidAnswers++; }
      }
      if (invalidAnswers) issue('INVALID_ANSWERS_JSON', invalidAnswers);
      const charactersPlanned = migrations.some(m => m.name === 'characters_review_v1');
      const charactersApplied = migrations.slice(0, report.currentVersion).some(m => m.name === 'characters_review_v1');
      if (charactersPlanned && !charactersApplied && !invalidForms && !invalidAnswers) {
        report.characterMapping = characterMappingReport(db);
        if (report.characterMapping.unresolved.length)
          issue('CHARACTER_MAPPING_REQUIRED', report.characterMapping.unresolved.length);
        if (report.characterMapping.conflicts.length)
          issue('CHARACTER_MAPPING_CONFLICT', report.characterMapping.conflicts.length);
        if (db.prepare('SELECT COUNT(*) n FROM applications WHERE id IS NULL').get().n)
          issue('INVALID_APPLICATION_IDENTIFIERS');
      }
      if (charactersApplied) {
        for (const table of ['event_character_forms', 'characters', 'character_decisions'])
          report.counts[table] = db.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count;
        const mismatches = db.prepare(`SELECT COUNT(*) n FROM characters c JOIN forms f
          ON f.id=c.form_id AND f.revision=c.form_revision LEFT JOIN event_character_forms m
          ON m.event_id=c.event_id WHERE json_extract(f.definition,'$.eventId')!=c.event_id
          OR m.form_id IS NULL OR m.form_id!=c.form_id`).get().n;
        if (mismatches) issue('INVALID_CHARACTER_MAPPING', mismatches);
        const invalidMappings = db.prepare(`SELECT COUNT(*) n FROM event_character_forms m JOIN forms f
          ON f.id=m.form_id AND f.revision=m.form_revision WHERE json_extract(f.definition,'$.eventId')!=m.event_id`).get().n;
        if (invalidMappings) issue('INVALID_CHARACTER_FORM', invalidMappings);
        const missingCharacters = db.prepare(`SELECT COUNT(*) n FROM applications a LEFT JOIN characters c
          ON c.legacy_application_id=a.id WHERE a.form_id='character-2027' AND c.id IS NULL`).get().n;
        if (missingCharacters) issue('MISSING_MIGRATED_CHARACTERS', missingCharacters);
        const invalidProvenance = db.prepare(`SELECT COUNT(*) n FROM characters c JOIN applications a
          ON a.id=c.legacy_application_id WHERE c.id!=a.id OR c.user_id!=a.user_id
          OR c.form_id!=a.form_id OR c.form_revision!=a.form_revision`).get().n;
        if (invalidProvenance) issue('INVALID_CHARACTER_PROVENANCE', invalidProvenance);
      }
      if (migrations.slice(0, report.currentVersion).some(m => m.name === 'character_edits_v1')) {
        report.counts.character_edits = db.prepare('SELECT COUNT(*) count FROM character_edits').get().count;
        const invalidEdits = db.prepare(`SELECT COUNT(*) n FROM character_edits e JOIN characters c
          ON c.id=e.character_id WHERE e.character_revision>c.revision`).get().n;
        if (invalidEdits) issue('INVALID_CHARACTER_EDIT_REVISION', invalidEdits);
      }
      const livePlanned = migrations.some(m => m.name === 'live_character_schema_v1');
      const liveApplied = migrations.slice(0, report.currentVersion).some(m => m.name === 'live_character_schema_v1');
      if (livePlanned && !liveApplied && !invalidForms && !invalidAnswers && !report.issues.length) {
        report.liveSchemaMapping = liveSchemaMappingReport(db, !charactersApplied);
        if (report.liveSchemaMapping?.conflicts.length) issue('LIVE_SCHEMA_MAPPING_REQUIRED', report.liveSchemaMapping.conflicts.length);
      }
      if (liveApplied) {
        for (const name of ['character_schemas','character_schema_origins'])
          report.counts[name] = db.prepare(`SELECT COUNT(*) count FROM ${name}`).get().count;
        let invalid = 0;
        for (const row of db.prepare('SELECT * FROM character_schemas').all()) {
          const definition = JSON.parse(row.definition);
          const mapping = db.prepare('SELECT form_id FROM event_character_forms WHERE event_id=?').get(row.event_id);
          if (definitionIssues(definition).length || definition.id !== row.form_id || definition.eventId !== row.event_id || definition.revision !== row.revision || mapping?.form_id !== row.form_id) invalid++;
        }
        if (invalid) issue('INVALID_LIVE_SCHEMAS', invalid);
        if (db.prepare(`SELECT COUNT(*) n FROM characters c LEFT JOIN character_schemas s ON s.event_id=c.event_id WHERE s.event_id IS NULL`).get().n)
          issue('MISSING_LIVE_SCHEMAS');
      }
      const lifecycleApplied = migrations.slice(0, report.currentVersion).some(m => m.name === 'mvp_character_lifecycle_v1');
      if (charactersApplied && !lifecycleApplied && migrations.some(m => m.name === 'mvp_character_lifecycle_v1')) {
        const inactive = db.prepare('SELECT id FROM characters WHERE deleted_at IS NOT NULL ORDER BY id').all();
        if (inactive.length) { report.inactiveCharacters = inactive.map(r => r.id); issue('LEGACY_INACTIVE_MAPPING_REQUIRED', inactive.length); }
      }
      if (lifecycleApplied) {
        for (const name of ['character_controls','character_archives','notifications'])
          report.counts[name] = db.prepare(`SELECT COUNT(*) count FROM ${name}`).get().count;
        if (db.prepare(`SELECT COUNT(*) n FROM characters c LEFT JOIN character_controls k ON k.character_id=c.id
          WHERE k.character_id IS NULL OR (k.disposition='active')!=(c.deleted_at IS NULL)
          OR (k.disposition!='active' AND (c.answers!='{}' OR c.feedback!=''))`).get().n) issue('INVALID_CHARACTER_LIFECYCLE');
        if (db.prepare(`SELECT COUNT(*) n FROM character_controls k LEFT JOIN character_archives a ON a.character_id=k.character_id
          WHERE (k.disposition='archived')!=(a.character_id IS NOT NULL)`).get().n) issue('INVALID_CHARACTER_ARCHIVES');
        if (db.prepare(`SELECT COUNT(*) n FROM notifications n JOIN characters c ON c.id=n.character_id
          JOIN character_decisions d ON d.id=n.decision_id WHERE n.user_id!=c.user_id OR n.event_id!=c.event_id OR d.character_id!=c.id`).get().n)
          issue('INVALID_NOTIFICATIONS');
        let invalidArchives = 0;
        for (const a of db.prepare(`SELECT a.*,c.user_id owner,c.event_id event,c.status character_status,c.revision FROM character_archives a JOIN characters c ON c.id=a.character_id`).all()) {
          const answers = JSON.parse(a.answers), form = JSON.parse(a.schema_snapshot), event = JSON.parse(a.event_snapshot);
          if (a.user_id !== a.owner || a.event_id !== a.event || a.status !== a.character_status || a.character_revision !== a.revision ||
            form.eventId !== a.event_id || event.id !== a.event_id || JSON.stringify(withoutImages([answers,form,event])) !== JSON.stringify([answers,form,event]) ||
            form.sections.some(s => s.fields.some(f => f.type === 'file' && answers[f.id]))) invalidArchives++;
        }
        if (invalidArchives) issue('INVALID_ARCHIVE_SNAPSHOTS', invalidArchives);
        if (db.prepare(`SELECT COUNT(*) n FROM character_controls k JOIN characters c ON c.id=k.character_id
          LEFT JOIN applications a ON a.id=c.legacy_application_id LEFT JOIN character_schema_origins o ON o.character_id=c.id
          WHERE k.disposition='deleted' AND (a.answers!='{}' OR a.feedback!='' OR o.character_id IS NOT NULL
          OR EXISTS(SELECT 1 FROM character_decisions d WHERE d.character_id=c.id AND d.comment!=''))`).get().n) issue('RETIRED_CHARACTER_CONTENT');
      }
    }
    report.pendingVersions = migrations.slice(report.currentVersion).map(m => m.version);
    report.ok = !report.issues.length;
  } catch {
    // SQLite errors can contain values from damaged records. Report codes only.
    issue('DATABASE_UNREADABLE');
  }
  return report;
}

/** Read-only inspection in a consistent snapshot; never creates tables or repairs data. */
export function preflightDatabase(db, { migrations = MIGRATIONS } = {}) {
  validateDefinitions(migrations);
  const ownTransaction = !db.isTransaction;
  if (ownTransaction) db.exec('BEGIN');
  try { return inspect(db, migrations); }
  finally { if (ownTransaction) db.exec('ROLLBACK'); }
}

export class MigrationError extends Error {
  constructor(report) {
    super(`SQLite preflight failed: ${report.issues.map(issue => issue.code).join(', ')}`);
    this.name = 'MigrationError';
    this.report = report;
  }
}

/** All pending operations and their registry records commit together or roll back together. */
export function migrateDatabase(db, { migrations = MIGRATIONS } = {}) {
  validateDefinitions(migrations);
  if (db.isTransaction) throw new Error('Migrations require their own transaction.');
  db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');
  try {
    const before = preflightDatabase(db, { migrations });
    if (!before.ok) throw new MigrationError(before);
    if (before.kind !== 'versioned') db.exec(registry);
    const applied = [];
    for (const migration of migrations.slice(before.currentVersion)) {
      const operation = migration.version === 1
        ? (before.kind === 'legacy' ? 'adopt' : 'initialize') : 'apply';
      if (operation !== 'adopt') db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations(version,name,checksum,applied_at,operation) VALUES(?,?,?,?,?)')
        .run(migration.version, migration.name, migrationChecksum(migration), new Date().toISOString(), operation);
      applied.push(migration.version);
    }
    const after = preflightDatabase(db, { migrations });
    if (!after.ok) throw new MigrationError(after);
    db.exec('COMMIT');
    return { ...after, appliedVersions: applied };
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
}
