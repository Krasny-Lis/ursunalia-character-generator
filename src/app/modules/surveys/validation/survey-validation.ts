import type { SurveyAnswers, SurveyDefinition, SurveyField, SurveyOption } from '../models/survey.model';

export interface SurveyIssue {
  fieldId: string;
  message: string;
}

function uniqueOptions(options: readonly SurveyOption[]): Set<string> {
  return new Set(options.map(option => option.id));
}

/** Bezpieczna walidacja odpowiedzi - niezalezna od formularzy Angulara. */
export function validateSurveyAnswers(survey: SurveyDefinition, answers: SurveyAnswers): SurveyIssue[] {
  const issues: SurveyIssue[] = [];
  for (const section of survey.sections) {
    for (const field of section.fields) {
      if (field.type === 'info') continue;
      const value = answers[field.id];
      const empty = value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && !value.length);
      if (empty) {
        if (field.required) issues.push({ fieldId: field.id, message: 'To pole jest wymagane.' });
        continue;
      }
      let message: string | null = null;
      switch (field.type) {
        case 'short-text':
        case 'long-text': {
          if (typeof value !== 'string') { message = 'Nieprawidłowy tekst.'; break; }
          const length = value.trim().length;
          if (field.minLength !== undefined && length < field.minLength) message = `Minimum ${field.minLength} znaków.`;
          else if (field.maxLength !== undefined && length > field.maxLength) message = `Maksimum ${field.maxLength} znaków.`;
          break;
        }
        case 'single-choice': {
          if (typeof value !== 'string' || !uniqueOptions(field.options).has(value)) message = 'Wybierz odpowiedź z listy.';
          break;
        }
        case 'multi-choice': {
          const ids = uniqueOptions(field.options);
          if (!Array.isArray(value) || !value.every(id => typeof id === 'string' && ids.has(id)) || new Set(value).size !== value.length) {
            message = 'Nieprawidłowy wybór.';
          } else if (field.minSelections !== undefined && value.length < field.minSelections) {
            message = `Wybierz co najmniej ${field.minSelections}.`;
          } else if (field.maxSelections !== undefined && value.length > field.maxSelections) {
            message = `Wybierz nie więcej niż ${field.maxSelections}.`;
          }
          break;
        }
        case 'rating': {
          if (typeof value !== 'number' || !Number.isInteger(value) || value < field.min || value > field.max) message = 'Ocena spoza dozwolonego zakresu.';
          break;
        }
      }
      if (message) issues.push({ fieldId: field.id, message });
    }
  }
  return issues;
}

/** Walidacja definicji - blokuje niejednoznaczne ID i nieprawidlowe zakresy. */
export function validateSurveyDefinition(survey: SurveyDefinition): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  if (survey.schemaVersion !== 1) problems.push('Nieobsługiwana wersja schematu.');
  if (!survey.id.trim() || !survey.title.trim()) problems.push('Ankieta wymaga identyfikatora i tytułu.');
  if (!Number.isInteger(survey.revision) || survey.revision < 1) problems.push('Numer rewizji musi być dodatni.');
  for (const section of survey.sections) {
    checkId(section.id);
    if (!section.title.trim()) problems.push('Sekcja wymaga tytułu.');
    for (const field of section.fields) {
      checkId(field.id);
      if (field.type === 'info') continue;
      if (!field.label.trim()) problems.push(`Pytanie ${field.id} wymaga etykiety.`);
      if (field.type === 'rating' && (!Number.isInteger(field.min) || !Number.isInteger(field.max) || field.max < field.min || field.max - field.min > 20)) problems.push(`Niepoprawna skala: ${field.id}.`);
      if ((field.type === 'short-text' || field.type === 'long-text') && (field.minLength !== undefined && field.minLength < 0 || field.maxLength !== undefined && field.maxLength < 1 || field.maxLength !== undefined && field.minLength !== undefined && field.minLength > field.maxLength)) problems.push(`Niepoprawna długość: ${field.id}.`);
      if (field.type === 'single-choice' || field.type === 'multi-choice') {
        if (!field.options.length || field.options.some(option => !option.id.trim() || !option.label.trim()) || new Set(field.options.map(option => option.id)).size !== field.options.length) problems.push(`Niepoprawne opcje: ${field.id}.`);
        if (field.type === 'multi-choice' && (field.minSelections !== undefined && (field.minSelections < 0 || field.minSelections > field.options.length) || field.maxSelections !== undefined && (field.maxSelections < 1 || field.maxSelections > field.options.length) || field.maxSelections !== undefined && field.minSelections !== undefined && field.minSelections > field.maxSelections)) problems.push(`Niepoprawne limity: ${field.id}.`);
      }
    }
  }
  function checkId(id: string): void {
    if (!id.trim() || ids.has(id)) problems.push(`Pusty lub powtórzony identyfikator: ${id}.`);
    ids.add(id);
  }
  return problems;
}

export function surveyFieldCount(survey: SurveyDefinition): number {
  return survey.sections.reduce((sum, section) => sum + section.fields.filter((field: SurveyField) => field.type !== 'info').length, 0);
}
