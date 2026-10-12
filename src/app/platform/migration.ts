import { FormDefinition, Field } from './models';
import { definitionIssues } from '../../../shared/validation.mjs';
/** Converts the exported v25/v26 questionnaire format; original storage is never removed. */
export function migrateSurvey(value: any): FormDefinition {
  if (value?.schemaVersion !== 1) return value as FormDefinition;
  if (!Array.isArray(value.sections)) throw new Error('Nieprawidłowe sekcje starej ankiety.');
  const form: FormDefinition = {
    id: value.id,
    eventId: 'ursunalia-2027',
    revision: value.revision,
    status: 'draft',
    title: value.title,
    description: value.description,
    sections: value.sections.map((s: any) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      fields: s.fields.map((f: any): Field => {
        if (f.type === 'info')
          return {
            id: f.id,
            type: 'info',
            label: f.title,
            description: (f.paragraphs ?? []).join('\n'),
            required: false,
          };
        const map: Record<string, Field['type']> = {
          'short-text': 'text',
          'long-text': 'textarea',
          'single-choice': f.appearance === 'select' ? 'select' : 'single',
          'multi-choice': 'multi',
          rating: 'rating',
        };
        if (!map[f.type]) throw new Error('Nieobsługiwany rodzaj pola starej ankiety.');
        return {
          id: f.id,
          type: map[f.type],
          label: f.label,
          description: f.description,
          required: f.required,
          options: f.options,
          min: f.min,
          max: f.max,
          minLength: f.minLength,
          maxLength: f.maxLength,
          minSelections: f.minSelections,
          maxSelections: f.maxSelections,
          placeholder: f.placeholder,
        };
      }),
    })),
  };
  const errors = definitionIssues(form);
  if (errors.length) throw new Error(errors[0]);
  return form;
}
/** A draft can contain blank labels or empty sections while the organizer is editing. */
export function isEditorDraft(v: any): v is FormDefinition {
  return (
    !!v &&
    typeof v.id === 'string' &&
    typeof v.eventId === 'string' &&
    typeof v.title === 'string' &&
    typeof v.revision === 'number' &&
    Array.isArray(v.sections) &&
    v.sections.every(
      (s: any) =>
        typeof s.id === 'string' &&
        typeof s.title === 'string' &&
        Array.isArray(s.fields) &&
        s.fields.every(
          (f: any) =>
            typeof f.id === 'string' &&
            typeof f.label === 'string' &&
            typeof f.required === 'boolean' &&
            [
              'text',
              'textarea',
              'single',
              'multi',
              'select',
              'rating',
              'date',
              'file',
              'info',
            ].includes(f.type) &&
            (!['single', 'multi', 'select'].includes(f.type) ||
              (Array.isArray(f.options) &&
                f.options.every(
                  (o: any) => typeof o.id === 'string' && typeof o.label === 'string',
                ))),
        ),
    )
  );
}
