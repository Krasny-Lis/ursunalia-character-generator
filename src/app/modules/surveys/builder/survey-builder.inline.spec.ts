import { describe, expect, it } from 'vitest';
import { DEMO_SURVEY } from '../data/demo-survey';
import { relocateFieldRelative, relocateSectionRelative } from './survey-builder.logic';

describe('Edytor kart v26.1 - upuszczanie przed / po', () => {
  it('przesuwa sekcje na obie strony celu bez zmiany oryginalu', () => {
    const a = relocateSectionRelative(DEMO_SURVEY, 'identity', 'character', 'after');
    expect(a.sections.map(s => s.id)).toEqual(['character', 'identity']);
    const b = relocateSectionRelative(a, 'identity', 'character', 'before');
    expect(b.sections.map(s => s.id)).toEqual(['identity', 'character']);
    expect(DEMO_SURVEY.sections.map(s => s.id)).toEqual(['identity', 'character']);
  });
  it('przenosi pole za wskazana karte bez tworzenia duplikatow', () => {
    const fromSection = DEMO_SURVEY.sections[0];
    const firstId = fromSection.fields[0].id;
    const secondId = fromSection.fields[1].id;
    const moved = relocateFieldRelative(DEMO_SURVEY, fromSection.id, firstId, fromSection.id, secondId, 'after');
    expect(moved.sections[0].fields[0].id).toBe(secondId);
    expect(moved.sections[0].fields[1].id).toBe(firstId);
    expect(DEMO_SURVEY.sections[0].fields[0].id).toBe(firstId);
  });
  it('przenosi pole pomiedzy sekcjami i zachowuje unikalne identyfikatory', () => {
    const first = DEMO_SURVEY.sections[0];
    const second = DEMO_SURVEY.sections[1];
    const id = first.fields[0].id;
    const target = second.fields[0].id;
    const moved = relocateFieldRelative(DEMO_SURVEY, first.id, id, second.id, target, 'after');
    expect(moved.sections[1].fields[1].id).toBe(id);
    expect(moved.sections.flatMap(s => s.fields).filter(f => f.id === id)).toHaveLength(1);
  });
  it('upuszczenie pola na sama siebie nie zmienia danych', () => {
    const section = DEMO_SURVEY.sections[0];
    const id = section.fields[0].id;
    expect(relocateFieldRelative(DEMO_SURVEY, section.id, id, section.id, id, 'after')).toBe(DEMO_SURVEY);
  });
});
