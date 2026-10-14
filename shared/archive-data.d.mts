import type { Answers, FormDefinition } from '../src/app/platform/models';
export function withoutImages<T>(value: T): T;
export function textAnswers(form: FormDefinition, answers: Answers, historicalFileIds?: string[]): Answers;
export function reusableAnswers(before: FormDefinition, after: FormDefinition, answers: Answers): Answers;
