import type { FormDefinition, Answers } from '../src/app/platform/models';
export function definitionIssues(form: unknown): string[];
export function answerIssues(form: FormDefinition, answers: Answers): Record<string, string>;
export function isPortrait(value: unknown): boolean;
export function cleanAnswers(form: FormDefinition, answers: Answers): Answers;
