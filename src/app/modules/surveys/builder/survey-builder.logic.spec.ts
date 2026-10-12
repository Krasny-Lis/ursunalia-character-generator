import { describe, expect, it } from 'vitest';
import { DEMO_SURVEY } from '../data/demo-survey';
import { validateSurveyDefinition } from '../validation/survey-validation';
import {
  createField, parseImportedSurvey, relocateField, relocateSection, updateField, updateSection,
} from './survey-builder.logic';

describe('Edytor ankiet v26 - operacje na strukturze', () => {
  it('przenosi sekcje bez modyfikowania oryginalu', () => {
    const swapped = relocateSection(DEMO_SURVEY, 'character', 'identity');
    expect(swapped.sections.map(s => s.id)).toEqual(['character', 'identity']);
    expect(DEMO_SURVEY.sections.map(s => s.id)).toEqual(['identity', 'character']);
  });
  it('przenosi pytania miedzy sekcjami bez duplikatow', () => {
    const moved = relocateField(DEMO_SURVEY, 'identity', 'name', 'character', 'history');
    expect(moved.sections[0].fields.some(f => f.id === 'name')).toBe(false);
    expect(moved.sections[1].fields.findIndex(f => f.id === 'name')).toBe(2);
    expect(validateSurveyDefinition(moved)).toEqual([]);
  });
  it('przenosi pytanie na koniec sekcji', () => {
    const moved = relocateField(DEMO_SURVEY, 'identity', 'name', 'identity');
    expect(moved.sections[0].fields.at(-1)?.id).toBe('name');
  });
  it('nie modyfikuje definicji jesli wskazano nieistniejace pytanie', () => {
    expect(relocateField(DEMO_SURVEY, 'identity', 'missing', 'character')).toBe(DEMO_SURVEY);
  });
  it('zmienia sekcje i pytanie bez utraty identyfikatorow', () => {
    const section = updateSection(DEMO_SURVEY, 'identity', { title: 'Nowy tytul' });
    const changed = updateField(section, 'identity', 'name', { label: 'Nowa nazwa' });
    expect(changed.sections[0].id).toBe('identity');
    expect(changed.sections[0].fields[0].id).toBe('name');
    expect(changed.sections[0].fields[0].type).toBe('short-text');
    expect(validateSurveyDefinition(changed)).toEqual([]);
  });
  it('tworzy wszystkie typy pytan z prawidlowymi polami', () => {
    const types = ['short-text', 'long-text', 'single-choice', 'multi-choice', 'rating', 'info'] as const;
    const fields = types.map(createField);
    expect(new Set(fields.map(f => f.id)).size).toBe(6);
    expect(validateSurveyDefinition({ ...DEMO_SURVEY, sections: [{ ...DEMO_SURVEY.sections[0], fields }] })).toEqual([]);
  });
  it('importuje definicje i wymusza status szkicu', () => {
    const imported = parseImportedSurvey(JSON.stringify({ ...DEMO_SURVEY, status: 'published' }));
    expect(imported.status).toBe('draft');
    expect(imported.sections).toHaveLength(2);
  });
  it('odrzuca niepoprawny plik zamiast przekazac go do renderera', () => {
    expect(() => parseImportedSurvey('not json')).toThrow('JSON');
    expect(() => parseImportedSurvey('{"sections":[]}')).toThrow('schemat');
    const broken = structuredClone(DEMO_SURVEY);
    (broken.sections[0].fields[1] as { options: unknown }).options = null;
    expect(() => parseImportedSurvey(JSON.stringify(broken))).toThrow();
  });
});
