import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'public', 'data');
const expected = {
  'roles.json': 7,
  'regions.json': 5,
  'cultures.json': 4,
  'trait-categories.json': 5,
  'traits.json': 38,
  'hooks.json': 19,
  'pillars.json': 6,
  'game-styles.json': 3,
  'residencies.json': 2,
  'relation-openness.json': 3,
};
const read = (filename) => JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'));
const ids = {};
for (const [filename, count] of Object.entries(expected)) {
  const data = read(filename);
  if (!Array.isArray(data) || data.length !== count) {
    throw new Error(`${filename}: oczekiwano ${count} wpisów, otrzymano ${data.length}`);
  }
  const seen = new Set();
  for (const record of data) {
    if (!record.id || !record.name || !String(record.name).trim()) throw new Error(`${filename}: brak id/nazwy`);
    if (filename !== 'trait-categories.json' && !String(record.description || '').trim()) {
      throw new Error(`${filename}: wpis ${record.id} nie ma opisu`);
    }
    if (seen.has(record.id)) throw new Error(`${filename}: powtórzone id ${record.id}`);
    seen.add(record.id);
  }
  ids[filename] = seen;
  console.log(`OK ${filename}: ${data.length}`);
}
for (const trait of read('traits.json')) {
  if (!ids['trait-categories.json'].has(trait.categoryId)) {
    throw new Error(`Nieznana kategoria cechy: ${trait.name}`);
  }
}
console.log('Wszystkie katalogi mają poprawną strukturę.');
