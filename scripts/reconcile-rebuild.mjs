#!/usr/bin/env node
/**
 * Import a complete Ursunalia ZIP checkout into a CLEAN Git working tree.
 * Only Git-tracked files absent from this delivery are deleted.
 * Untracked files and the .git directory are never removed.
 * Dry-run by default; --apply to make changes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, copyFileSync, rmSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const source = resolve(import.meta.dirname, '..');
const target = resolve(process.argv[2] ?? '.');
const apply = process.argv.includes('--apply');
const branchName = 'feature/royal-manuscript-rebuild';
const ignored = new Set(['.git', 'node_modules', '.angular', '.env', 'var']);
const git = (...args) => execFileSync('git', args, { cwd: target, encoding: 'utf8' }).trim();

function walk(directory, prefix = '') {
  const files = [];
  for (const ent of readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(ent.name)) continue;
    const name = prefix ? prefix + '/' + ent.name : ent.name;
    if (ent.isDirectory()) files.push(...walk(join(directory, ent.name), name));
    else if (ent.isFile()) files.push(name);
    else throw new Error(`Nieobsługiwane dowiązanie w paczce: ${name}`);
  }
  return files;
}

try {
  if (!existsSync(join(target, '.git'))) throw new Error('Katalog docelowy nie jest repozytorium Git.');
  if (realpathSync(source) === realpathSync(target)) throw new Error('Źródło i cel to ten sam katalog.');
  if (git('status', '--porcelain')) throw new Error('Repozytorium zawiera zmiany. Użyj czystego klona.');
  if (git('branch', '--show-current') !== branchName) {
    throw new Error(`Przełącz się najpierw na gałąź ${branchName}.`);
  }
  const files = walk(source).filter((p) => p !== 'SHA256SUMS.txt');
  const sourcePaths = new Set(files);
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: target, encoding: 'utf8' })
    .split('\0').filter(Boolean);
  const deletions = tracked.filter((name) => !sourcePaths.has(name) && !name.startsWith('.git/'));
  // SHA256SUMS only describes the downloaded ZIP, not the Git working tree.
  console.log(`Źródło: ${source}`);
  console.log(`Repo: ${target}`);
  console.log(`Pliki do skopiowania: ${files.length}`);
  console.log(`Stare pliki śledzone do usunięcia: ${deletions.length}`);
  deletions.forEach((name) => console.log('  USUŃ ' + name));
  if (!apply) {
    console.log('Podgląd bez zmian. Dodaj --apply, aby wykonać import.');
    process.exit(0);
  }
  for (const name of deletions) {
    const path = resolve(target, name);
    if (!path.startsWith(target + sep)) throw new Error('Ścieżka poza repozytorium: ' + name);
    rmSync(path, { force: true });
  }
  for (const name of files) {
    const dest = resolve(target, name);
    if (!dest.startsWith(target + sep)) throw new Error('Ścieżka poza repozytorium: ' + name);
    mkdirSync(dirname(dest), { recursive: true });
    if (existsSync(dest) && lstatSync(dest).isSymbolicLink()) {
      throw new Error('Odmowa zapisu przez dowiązanie symboliczne: ' + name);
    }
    copyFileSync(join(source, name), dest);
  }
  console.log('Import ukończony. Uruchom: git status --short, npm ci, npm run verify, git add -A.');
} catch (error) {
  console.error('Błąd importu:', error.message);
  process.exitCode = 1;
}
