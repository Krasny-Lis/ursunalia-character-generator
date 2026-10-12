/**
 * Ursunalia 2027 — migracja na wspólną nawigację krokową.
 * Uruchom JEDEN RAZ z katalogu projektu: node scripts/apply-flow-navigation.mjs
 * Idempotentna: drugie uruchomienie nie dubluje przycisków.
 * Nie usuwa pól formularzy, prawego panelu danych ani logiki CharacterStore.
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
const identityTs = 'src/app/features/character-identity/character-identity.ts';
const identityScss = 'src/app/features/character-identity/character-identity.scss';
const writes = [];

function removeNavigationalAnchors(source) {
  // Wyłącznie stare linki skrótów w prawym panelu; nie dotyka odnośników "Edytuj".
  return source.replace(/^[ \t]*<a\b(?=[^>]*\bclass="[^"]*\b(?:side-link|traits-link|return-identity)\b)[^>]*>[\s\S]*?<\/a>\s*\n/gm, '');
}
function removeOldFooter(source) {
  // Kontenery zawierają wyłącznie nawigację lub notkę o automatycznym zapisie.
  return source.replace(/^[ \t]*<div class="(?:next-step|form-actions|bottom-actions)">[\s\S]*?<\/div>\s*\n/gm, '');
}

for (const path of views) {
  const original = readFileSync(resolve(path), 'utf8');
  if (original.includes('<header class="topbar">')) {
    throw new Error(`${path}: najpierw uruchom migrację App Shell: node scripts/apply-app-shell.mjs`);
  }
  let updated = removeNavigationalAnchors(original);
  if (!path.includes('character-identity/')) updated = removeOldFooter(updated);

  if (path.includes('character-identity/')) {
    const before = '<button type="button" class="secondary" (click)="setStep(step()-1)" [disabled]="step() === 0">← Wstecz</button>';
    const after = '@if (step() > 0) { <button type="button" class="secondary" (click)="setStep(step()-1)">← Wstecz</button> }';
    if (updated.includes(before)) updated = updated.replace(before, after);
    else if (!updated.includes(after)) throw new Error(`${path}: nieznana struktura przycisku Wstecz`);
    // Oznaczenie kierunku dla animacji wewnętrznych pięciu kroków tożsamości.
    updated = updated.replace('class="formbox" [formGroup]="form"',
      'class="formbox" [class.step-backwards]="stepDirection() === \'backward\'" [formGroup]="form"');
  }
  if (updated !== original) writes.push([path, updated]);
}

{
  const path = identityTs;
  const original = readFileSync(resolve(path), 'utf8');
  let updated = original;
  if (!updated.includes('ActivatedRoute')) {
    updated = updated.replace("import { RouterLink } from '@angular/router';", "import { ActivatedRoute, RouterLink } from '@angular/router';");
    if (updated === original) throw new Error(`${path}: nie odnaleziono importu RouterLink`);
  }
  const originalStep = '  protected readonly step = signal(0);';
  const newStep = `  private readonly route = inject(ActivatedRoute);\n  protected readonly step = signal(this.route.snapshot.queryParamMap.get('step') === '4' ? 4 : 0);\n  protected readonly stepDirection = signal<'forward' | 'backward'>('forward');`;
  if (updated.includes(originalStep)) updated = updated.replace(originalStep, newStep);
  else if (!updated.includes('protected readonly stepDirection = signal<')) throw new Error(`${path}: nieznana struktura stanu kroku`);
  const originalSetter = `  protected setStep(next: number): void {\n    this.step.set(Math.max(0, Math.min(STEP_LABELS.length - 1, next)));\n    this.scrollTop();\n  }`;
  const newSetter = `  protected setStep(next: number): void {\n    const clamped = Math.max(0, Math.min(STEP_LABELS.length - 1, next));\n    if (clamped === this.step()) return;\n    this.stepDirection.set(clamped < this.step() ? 'backward' : 'forward');\n    this.step.set(clamped);\n    this.scrollTop();\n  }`;
  if (updated.includes(originalSetter)) updated = updated.replace(originalSetter, newSetter);
  else if (!updated.includes('const clamped = Math.max(0')) throw new Error(`${path}: nieznana struktura setStep`);
  if (updated !== original) writes.push([path, updated]);
}

{
  const path = identityScss;
  const original = readFileSync(resolve(path), 'utf8');
  const marker = '/* Ursunalia 2027 — animacja podkroków tożsamości */';
  const addition = `\n${marker}\n.actions > .primary:only-child { margin-left: auto; }\n.formbox > :is(h2, .help, .choices, .subfield, label[for], .text-input, .error) {\n  animation: urs-identity-step-in .25s ease-out both;\n}\n.formbox.step-backwards > :is(h2, .help, .choices, .subfield, label[for], .text-input, .error) {\n  animation-name: urs-identity-step-back;\n}\n@keyframes urs-identity-step-in {\n  from { opacity: .4; transform: translateX(22px); }\n  to { opacity: 1; transform: translateX(0); }\n}\n@keyframes urs-identity-step-back {\n  from { opacity: .4; transform: translateX(-22px); }\n  to { opacity: 1; transform: translateX(0); }\n}\n@media (prefers-reduced-motion: reduce) {\n  .formbox > :is(h2, .help, .choices, .subfield, label[for], .text-input, .error) { animation: none; }\n}\n`;
  if (!original.includes(marker)) writes.push([path, original + addition]);
}

// Dopiero po walidacji całego zestawu zapisujemy pliki.
for (const [path, content] of writes) {
  writeFileSync(resolve(path), content, 'utf8');
  console.log(`Zaktualizowano: ${path}`);
}
console.log(`Gotowe. Zmieniono ${writes.length} plików. Na kolejnych ekranach działa wspólna nawigacja Wstecz / Dalej.`);
