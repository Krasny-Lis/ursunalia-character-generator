import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preflightDatabase } from './migrations.mjs';

export function preflightFile(path) {
  // readOnly refuses missing files; a typo must not create an empty database.
  const db = new DatabaseSync(path, { readOnly: true });
  try { return preflightDatabase(db); }
  finally { db.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    console.error('Usage: node server/preflight.mjs /path/to/database.sqlite');
    process.exitCode = 2;
  } else {
    try {
      const report = preflightFile(resolve(process.argv[2]));
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = report.ok ? 0 : 1;
    } catch {
      console.error('Cannot inspect database. Check its path, permissions and SQLite format.');
      process.exitCode = 1;
    }
  }
}
