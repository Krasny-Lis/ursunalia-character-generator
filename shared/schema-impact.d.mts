import type { FormDefinition, Answers } from '../src/app/platform/models';
export interface SchemaChange { kind: string; fieldId?: string; sectionId?: string; optionIds?: string[]; }
export function schemaChanges(before: FormDefinition, after: FormDefinition): SchemaChange[];
export function transformAnswers(before: FormDefinition, after: FormDefinition, source: Answers): { answers: Answers; lostFieldIds: string[] };
