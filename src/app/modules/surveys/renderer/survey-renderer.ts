import { Component, Input, computed, signal } from '@angular/core';
import type { SurveyAnswers, SurveyDefinition, SurveyField } from '../models/survey.model';
import {
  validateSurveyAnswers,
  validateSurveyDefinition,
  type SurveyIssue,
} from '../validation/survey-validation';

/** Uniwersalny renderer v25 - nie zapisuje danych ani nie wysyla HTTP. */
@Component({
  selector: 'app-survey-renderer',
  standalone: true,
  templateUrl: './survey-renderer.html',
  styleUrl: './survey-renderer.scss',
})
export class SurveyRenderer {
  @Input({ required: true }) survey!: SurveyDefinition;

  protected readonly answers = signal<SurveyAnswers>({});
  protected readonly attempted = signal(false);
  protected readonly collapsed = signal<Record<string, boolean>>({});
  protected readonly successfulPreview = signal(false);
  protected readonly issues = computed(() =>
    this.survey ? validateSurveyAnswers(this.survey, this.answers()) : [],
  );

  protected get definitionIssues(): string[] {
    return this.survey ? validateSurveyDefinition(this.survey) : ['Brak ankiety.'];
  }
  protected issueFor(id: string): SurveyIssue | undefined {
    return this.attempted() ? this.issues().find((issue) => issue.fieldId === id) : undefined;
  }
  protected isCollapsed(id: string): boolean {
    return this.collapsed()[id] === true;
  }
  protected toggleSection(id: string): void {
    this.collapsed.update((all) => ({ ...all, [id]: !all[id] }));
  }
  protected textAnswer(id: string): string {
    const value = this.answers()[id];
    return typeof value === 'string' ? value : '';
  }
  protected isChosen(fieldId: string, optionId: string): boolean {
    const value = this.answers()[fieldId];
    return typeof value === 'string'
      ? value === optionId
      : Array.isArray(value) && value.includes(optionId);
  }
  protected ratingValue(id: string): number | undefined {
    const value = this.answers()[id];
    return typeof value === 'number' ? value : undefined;
  }
  protected ratingSteps(min: number, max: number): number[] {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min || max - min > 20) return [];
    return Array.from({ length: max - min + 1 }, (_, index) => min + index);
  }
  protected updateText(id: string, event: Event): void {
    this.setAnswer(id, (event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }
  protected updateSelect(id: string, event: Event): void {
    this.setAnswer(id, (event.target as HTMLSelectElement).value || null);
  }
  protected updateMulti(id: string, optionId: string, event: Event): void {
    const selected = (event.target as HTMLInputElement).checked;
    const old = this.answers()[id];
    const current = Array.isArray(old) ? old : [];
    this.setAnswer(
      id,
      selected
        ? [...new Set([...current, optionId])]
        : current.filter((value) => value !== optionId),
    );
  }
  protected setAnswer(id: string, value: string | number | string[] | null): void {
    this.answers.update((all) => ({ ...all, [id]: value }));
    this.successfulPreview.set(false);
  }
  protected resetPreview(): void {
    this.answers.set({});
    this.attempted.set(false);
    this.successfulPreview.set(false);
  }
  protected validatePreview(): void {
    this.attempted.set(true);
    const valid = this.definitionIssues.length === 0 && this.issues().length === 0;
    this.successfulPreview.set(valid);
    if (!valid && typeof document !== 'undefined') {
      const firstIssue = this.issues()[0];
      if (firstIssue) {
        this.collapsed.update((all) => {
          const section = this.survey.sections.find((s) =>
            s.fields.some((field) => field.id === firstIssue.fieldId),
          );
          return section ? { ...all, [section.id]: false } : all;
        });
        // Następny cykl renderowania otwiera sekcję zanim przejdziemy do pola.
        queueMicrotask(() => {
          const target = document.getElementById(`survey-field-${firstIssue.fieldId}`);

          if (typeof target?.scrollIntoView === 'function') {
            target.scrollIntoView({
              block: 'center',
              behavior: 'auto',
            });
          }
        });
      }
    }
  }
  protected readonly fieldId = (field: SurveyField): string => `survey-field-${field.id}`;
}
