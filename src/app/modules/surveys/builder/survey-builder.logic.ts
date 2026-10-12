import type { SurveyDefinition, SurveyField, SurveySection } from '../models/survey.model';
import { validateSurveyDefinition } from '../validation/survey-validation';

/** Pure transformations; the editor never mutates the previous survey definition. */
export function relocateSection(survey: SurveyDefinition, sourceId: string, targetId: string): SurveyDefinition {
  if (sourceId === targetId) return survey;
  const sections = [...survey.sections];
  const source = sections.findIndex(s => s.id === sourceId);
  const target = sections.findIndex(s => s.id === targetId);
  if (source < 0 || target < 0) return survey;
  const [item] = sections.splice(source, 1);
  sections.splice(sections.findIndex(s => s.id === targetId), 0, item);
  return { ...survey, sections };
}

/** Moves a field immediately before another field, or to the end of a section. */
export function relocateField(
  survey: SurveyDefinition, fromSectionId: string, fieldId: string,
  toSectionId: string, beforeFieldId?: string,
): SurveyDefinition {
  const from = survey.sections.find(s => s.id === fromSectionId);
  const to = survey.sections.find(s => s.id === toSectionId);
  if (!from || !to || (fromSectionId === toSectionId && fieldId === beforeFieldId)) return survey;
  const field = from.fields.find(f => f.id === fieldId);
  if (!field || (beforeFieldId && !to.fields.some(f => f.id === beforeFieldId))) return survey;
  const sections = survey.sections.map(section => ({ ...section, fields: [...section.fields] }));
  const oldSection = sections.find(s => s.id === fromSectionId)!;
  oldSection.fields = oldSection.fields.filter(f => f.id !== fieldId);
  const newSection = sections.find(s => s.id === toSectionId)!;
  const target = beforeFieldId ? newSection.fields.findIndex(f => f.id === beforeFieldId) : newSection.fields.length;
  newSection.fields.splice(target < 0 ? newSection.fields.length : target, 0, field);
  return { ...survey, sections };
}

export function updateSection(
  survey: SurveyDefinition, id: string, patch: Partial<Pick<SurveySection, 'title' | 'description' | 'collapsible'>>,
): SurveyDefinition {
  return { ...survey, sections: survey.sections.map(s => s.id === id ? { ...s, ...patch } : s) };
}

export function updateField(
  survey: SurveyDefinition, sectionId: string, fieldId: string, patch: Record<string, unknown>,
): SurveyDefinition {
  return { ...survey, sections: survey.sections.map(s => s.id !== sectionId ? s : {
    ...s, fields: s.fields.map(f => f.id === fieldId ? { ...f, ...patch } as SurveyField : f),
  }) };
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export const FIELD_TYPES = [
  { id: 'short-text', label: 'Krótki tekst', description: 'Nazwa, fach, miejsce' },
  { id: 'long-text', label: 'Długi tekst', description: 'Historia i opisy' },
  { id: 'single-choice', label: 'Jeden wybór', description: 'Radio, lista, kafelki' },
  { id: 'multi-choice', label: 'Wiele wyborów', description: 'Zaznaczanie kilku opcji' },
  { id: 'rating', label: 'Ocena', description: 'Skala punktowa' },
  { id: 'info', label: 'Informacja', description: 'Instrukcja bez odpowiedzi' },
] as const;
export type EditableFieldType = (typeof FIELD_TYPES)[number]['id'];

export function createField(type: EditableFieldType): SurveyField {
  const id = newId('field');
  switch (type) {
    case 'short-text': return { id, type, label: 'Nowe pytanie', required: false, placeholder: '' };
    case 'long-text': return { id, type, label: 'Nowy opis', required: false, placeholder: '' };
    case 'single-choice':
    case 'multi-choice': return {
      id, type, label: 'Nowy wybór', required: false, appearance: type === 'multi-choice' ? 'cards' : 'radio',
      options: [{ id: newId('option'), label: 'Opcja 1' }, { id: newId('option'), label: 'Opcja 2' }],
    };
    case 'rating': return { id, type, label: 'Nowa ocena', required: false, min: 1, max: 5 };
    case 'info': return { id, type, title: 'Informacja', paragraphs: ['Wpisz treść informacji.'] };
  }
}

/** Treat imported JSON as hostile unknown data; never send it directly to the Angular renderer. */
export function parseImportedSurvey(json: string, requireValid = true): SurveyDefinition {
  if (json.length > 400_000) throw new Error('Plik jest zbyt duży (maksymalnie 400 KB).');
  let data: unknown;
  try { data = JSON.parse(json); }
  catch { throw new Error('Niepoprawny plik JSON.'); }
  if (!isRecord(data) || data['schemaVersion'] !== 1 || typeof data['id'] !== 'string'
    || typeof data['title'] !== 'string' || !Number.isInteger(data['revision'])
    || !['draft', 'published', 'archived'].includes(String(data['status']))
    || (data['description'] !== undefined && typeof data['description'] !== 'string')
    || !Array.isArray(data['sections']) || data['sections'].length > 40) {
    throw new Error('To nie jest zgodna definicja ankiety (schemat v1).');
  }
  let count = 0;
  for (const section of data['sections']) {
    if (!isRecord(section) || typeof section['id'] !== 'string' || typeof section['title'] !== 'string'
      || typeof section['collapsible'] !== 'boolean'
      || (section['description'] !== undefined && typeof section['description'] !== 'string')
      || !Array.isArray(section['fields']) || section['fields'].length > 120) {
      throw new Error('Nieprawidłowa sekcja ankiety.');
    }
    count += section['fields'].length;
    if (count > 400) throw new Error('Ankieta przekracza limit 400 elementów.');
    for (const field of section['fields']) {
      if (!isRecord(field) || typeof field['id'] !== 'string' || typeof field['type'] !== 'string') {
        throw new Error('Nieprawidłowe pole ankiety.');
      }
      if (field['type'] === 'info') {
        if (typeof field['title'] !== 'string' || !isStringArray(field['paragraphs'], 50)) throw new Error('Nieprawidłowy blok informacyjny.');
        continue;
      }
      if (typeof field['label'] !== 'string' || typeof field['required'] !== 'boolean'
        || (field['description'] !== undefined && typeof field['description'] !== 'string')
        || (field['help'] !== undefined && (!isRecord(field['help']) || typeof field['help']['title'] !== 'string'
          || !isStringArray(field['help']['paragraphs'], 50)))) {
        throw new Error('Nieprawidłowe ustawienia pytania.');
      }
      if (field['type'] === 'short-text' || field['type'] === 'long-text') {
        if (!isOptString(field['placeholder']) || !isOptNonNegativeInt(field['minLength']) || !isOptNonNegativeInt(field['maxLength'])) throw new Error('Nieprawidłowe ustawienia tekstu.');
      } else if (field['type'] === 'single-choice' || field['type'] === 'multi-choice') {
        if (!Array.isArray(field['options']) || field['options'].length > 200
          || !field['options'].every((opt: unknown) => isRecord(opt) && typeof opt['id'] === 'string'
            && typeof opt['label'] === 'string' && isOptString(opt['description']))
          || (field['appearance'] !== undefined && !['radio', 'select', 'cards'].includes(String(field['appearance'])))
          || !isOptNonNegativeInt(field['minSelections']) || !isOptNonNegativeInt(field['maxSelections'])) throw new Error('Nieprawidłowe opcje wyboru.');
      } else if (field['type'] === 'rating') {
        if (!Number.isInteger(field['min']) || !Number.isInteger(field['max'])
          || !isOptString(field['minLabel']) || !isOptString(field['maxLabel'])) throw new Error('Nieprawidłowa skala ocen.');
      } else throw new Error(`Nieobsługiwany rodzaj pola: ${field['type']}`);
    }
  }
  // Runtime guard above establishes the structural shape; the existing validator checks semantics.
  const survey = data as unknown as SurveyDefinition;
  const issues = validateSurveyDefinition(survey);
  if (requireValid && issues.length) throw new Error(`Definicja zawiera błędy: ${issues.slice(0, 3).join(' ')}`);
  return { ...survey, status: 'draft' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isStringArray(value: unknown, max: number): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every(v => typeof v === 'string');
}
function isOptString(value: unknown): boolean { return value === undefined || typeof value === 'string'; }
function isOptNonNegativeInt(value: unknown): boolean { return value === undefined || (Number.isInteger(value) && (value as number) >= 0); }

/** Wstawia sekcje przed lub po wskazanej; bez efektu przy upuszczeniu na siebie. */
export function relocateSectionRelative(
  survey: SurveyDefinition, sourceId: string, targetId: string, edge: 'before' | 'after',
): SurveyDefinition {
  if (sourceId === targetId) return survey;
  const source = survey.sections.find(s => s.id === sourceId);
  if (!source || !survey.sections.some(s => s.id === targetId)) return survey;
  const result = survey.sections.filter(s => s.id !== sourceId);
  const targetIndex = result.findIndex(s => s.id === targetId);
  result.splice(targetIndex + (edge === 'after' ? 1 : 0), 0, source);
  return { ...survey, sections: result };
}

/** Wstawia pole przed/po innej karcie lub na koncu wskazanej sekcji. */
export function relocateFieldRelative(
  survey: SurveyDefinition, fromSectionId: string, fieldId: string,
  toSectionId: string, targetFieldId?: string, edge: 'before' | 'after' = 'before',
): SurveyDefinition {
  const target = survey.sections.find(s => s.id === toSectionId);
  if (!target) return survey;
  if (!targetFieldId) return relocateField(survey, fromSectionId, fieldId, toSectionId);
  if (fieldId === targetFieldId && fromSectionId === toSectionId) return survey;
  if (edge === 'before') return relocateField(survey, fromSectionId, fieldId, toSectionId, targetFieldId);
  const remaining = target.fields.filter(f => !(fromSectionId === toSectionId && f.id === fieldId));
  const index = remaining.findIndex(f => f.id === targetFieldId);
  if (index < 0) return survey;
  const nextId = remaining[index + 1]?.id;
  return relocateField(survey, fromSectionId, fieldId, toSectionId, nextId);
}

/** Pure indexed relocation for CDK sortable lists. Does not mutate the input survey. */
export function moveFieldByIndex(
  survey: SurveyDefinition, fromSectionId: string, fromIndex: number,
  toSectionId: string, toIndex: number,
): SurveyDefinition {
  const from = survey.sections.find(s => s.id === fromSectionId);
  const to = survey.sections.find(s => s.id === toSectionId);
  if (!from || !to || fromIndex < 0 || fromIndex >= from.fields.length || toIndex < 0 || toIndex > to.fields.length) return survey;
  if (fromSectionId === toSectionId && fromIndex === toIndex) return survey;
  const sections = survey.sections.map(s => ({ ...s, fields: [...s.fields] }));
  const source = sections.find(s => s.id === fromSectionId)!;
  const target = sections.find(s => s.id === toSectionId)!;
  const [field] = source.fields.splice(fromIndex, 1);
  target.fields.splice(Math.min(toIndex, target.fields.length), 0, field);
  return { ...survey, sections };
}
