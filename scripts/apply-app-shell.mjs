/**
 * Jednorazowa migracja Ursunalia 2027: usuwa powielone nagłówki i kontrolki
 * wyboru postaci w widokach. Po instalacji panel górny app.html przejmuje
 * odpowiedzialność za nawigację i wybór postaci. Kontekstowe prawe panele
 * (zaznaczenia, przewijanie, kroki, oceny) pozostają bez zmian.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const views = [
  'src/app/features/character-identity/character-identity.html',
  'src/app/features/traits-lab/traits-lab.html',
  'src/app/features/character-hooks/character-hooks.html',
  'src/app/features/character-history/character-history.html',
  'src/app/features/character-pillars/character-pillars.html',
  'src/app/features/character-gameplay/character-gameplay.html',
  'src/app/features/character-relations/character-relations.html',
  'src/app/features/character-review/character-review.html',
];

// Wzorce celowo wąskie: nie dotykają paneli cech, haków i pól formularza.
const headerPattern = /<header class="topbar">[\s\S]*?<\/header>\s*/g;
const switcherPattern = /<label\s+for="[^"]+">Wybierz postać(?: do testowania)?<\/label>\s*<select\b[^>]*>[\s\S]*?<\/select>\s*<button\b[^>]*\(click\)="createCharacter\(\)"[^>]*>[\s\S]*?<\/button>\s*/g;

const nextContents = [];
let changed = 0;
let alreadyUpdated = 0;

for (const file of views) {
  const absolute = resolve(file);
  const original = readFileSync(absolute, 'utf8');
  const headCount = [...original.matchAll(headerPattern)].length;
  const switchCount = [...original.matchAll(switcherPattern)].length;
  if (headCount === 0 && switchCount === 0) {
    alreadyUpdated++;
    continue;
  }
  if (headCount !== 1 || switchCount !== 1) {
    throw new Error(`Przerwano bez zapisywania zmian: ${file}, nagłówek=${headCount}, selektor=${switchCount}. Skontaktuj się przed kontynuacją.`);
  }
  const withoutHeader = original.replace(headerPattern, '');
  const updated = withoutHeader.replace(switcherPattern, '');
  nextContents.push([absolute, updated, file]);
}

// Sprawdzenie wszystkich widoków zakończone — dopiero teraz zapisujemy pliki.
for (const [absolute, updated, name] of nextContents) {
  writeFileSync(absolute, updated, 'utf8');
  console.log(`Zaktualizowano: ${name}`);
  changed++;
}
console.log(`Gotowe: ${changed} widoków zaktualizowanych, ${alreadyUpdated} już było aktualnych.`);
