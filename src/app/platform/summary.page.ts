import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { PlatformStore, downloadJson } from './platform.store';
import { Field, Section } from './models';
import { Icon } from './icon';
import { answerIssues, isPortrait } from '../../../shared/validation.mjs';
@Component({
  standalone: true,
  imports: [RouterLink, Icon, A11yModule],
  templateUrl: './summary.page.html',
})
export class SummaryPage {
  readonly store = inject(PlatformStore);
  readonly confirmOpen = signal(false);
  readonly issues = computed(() =>
    this.store.active()
      ? answerIssues(this.store.active()!.form, this.store.active()!.answers)
      : {},
  );
  readonly sections = computed(() => this.store.active()?.form.sections ?? []);
  readonly completed = computed(() => this.sections().filter((s) => this.ready(s)).length);
  readonly complete = computed(() => this.completed() === this.sections().length);
  readonly portrait = computed(() => {
    const value = this.store.active()?.answers['portrait'];
    return isPortrait(value) ? String(value) : null;
  });
  ready(section: Section) {
    return section.fields.every((f) => !this.issues()[f.id]);
  }
  text(id: string) {
    const app = this.store.active();
    if (!app) return '';
    const field = app.form.sections.flatMap((s) => s.fields).find((f) => f.id === id);
    const value = app.answers[id];
    if (Array.isArray(value))
      return value.map((v) => field?.options?.find((o) => o.id === v)?.label ?? v).join(', ');
    if (field?.options) return field.options.find((o) => o.id === value)?.label ?? '';
    return value === undefined ? '' : String(value);
  }
  values(field: Field) {
    const value = this.store.active()?.answers[field.id];
    return Array.isArray(value)
      ? value.map((v) => field.options?.find((o) => o.id === v)?.label ?? v)
      : [];
  }
  icon(id: string) {
    return (
      (
        {
          identity: 'user',
          origin: 'pin',
          traits: 'star',
          history: 'book',
          relations: 'people',
          preferences: 'grid',
          consents: 'file',
        } as Record<string, string>
      )[id] ?? 'file'
    );
  }
  description(id: string) {
    const field = this.store
      .active()
      ?.form.sections.flatMap((s) => s.fields)
      .find((f) => f.id === id);
    const value = this.store.active()?.answers[id];
    return field?.options?.find((o) => o.id === value)?.description ?? '';
  }
  fields(section: Section) {
    return section.fields.filter((f) => f.type !== 'file' && f.type !== 'info');
  }
  async send() {
    this.confirmOpen.set(false);
    await this.store.submit();
  }
  export() {
    downloadJson('ursunalia-zgloszenie.json', this.store.active());
  }
  print() {
    window.print();
  }
}
