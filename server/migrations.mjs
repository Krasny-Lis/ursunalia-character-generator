import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { definitionIssues } from '../shared/validation.mjs';

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
export const MIGRATIONS = Object.freeze([
  Object.freeze({ version: 1, name: 'baseline_v27_2', sql: baseline, schemaSql: baseline }),
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
      for (const row of db.prepare('SELECT id,revision,definition FROM forms').iterate()) {
        try {
          const form = JSON.parse(row.definition);
          if (definitionIssues(form).length || form.id !== row.id || form.revision !== row.revision)
            invalidForms++;
        } catch { invalidForms++; }
      }
      if (invalidForms) issue('INVALID_FORM_DEFINITIONS', invalidForms);
      let invalidAnswers = 0;
      for (const row of db.prepare('SELECT answers FROM applications').iterate()) {
        try {
          const value = JSON.parse(row.answers);
          if (!value || typeof value !== 'object' || Array.isArray(value)) invalidAnswers++;
        } catch { invalidAnswers++; }
      }
      if (invalidAnswers) issue('INVALID_ANSWERS_JSON', invalidAnswers);
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
