import { Component, inject, signal, computed, afterNextRender } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlatformStore, downloadJson } from './platform.store';
import { FieldControl } from './field.control';
import { Icon } from './icon';
import { CharacterHistory } from './character-history';
import { answerIssues } from '../../../shared/validation.mjs';
@Component({
  standalone: true,
  imports: [RouterLink, FieldControl, Icon, CharacterHistory],
  templateUrl: './form.page.html',
})
export class FormPage {
  readonly store = inject(PlatformStore);
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly attempted = signal(false);
  readonly collapsed = signal(new Set<string>());
  readonly current = signal('identity');
  readonly issues = computed(() =>
    this.store.active()
      ? answerIssues(this.store.active()!.form, this.store.active()!.answers)
      : {},
  );
  readonly completed = computed(
    () =>
      this.store.active()?.form.sections.filter((s) => s.fields.every((f) => !this.issues()[f.id]))
        .length ?? 0,
  );
  constructor() {
    const id = this.route.snapshot.queryParamMap.get('id');
    if (id && this.store.applications().some((a) => a.id === id)) this.store.open(id);
    afterNextRender(() => {
      const section = this.route.snapshot.queryParamMap.get('section');
      if (section) this.go(section);
    });
  }
  ready(id: string) {
    return this.store
      .active()
      ?.form.sections.find((s) => s.id === id)
      ?.fields.every((f) => !this.issues()[f.id]);
  }
  toggle(id: string) {
    this.collapsed.update((all) => {
      const s = new Set(all);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }
  go(id: string) {
    this.collapsed.update((all) => {
      const s = new Set(all);
      s.delete(id);
      return s;
    });
    this.current.set(id);
    setTimeout(() => {
      document
        .getElementById('section-' + id)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }
  review() {
    this.attempted.set(true);
    if (Object.keys(this.issues()).length) {
      const section = this.store
        .active()!
        .form.sections.find((s) => s.fields.some((f) => this.issues()[f.id]));
      if (section) this.go(section.id);
      this.store.notice.set('Sprawdź oznaczone pola. Możesz też otworzyć podgląd niepełnej karty.');
    } else void this.router.navigate(['/karta-postaci']);
  }
  next() {
    const sections = this.store.active()!.form.sections;
    const i = sections.findIndex((s) => s.id === this.current());
    if (i < sections.length - 1) this.go(sections[i + 1].id);
    else this.review();
  }
  export() {
    downloadJson('ursunalia-szkic.json', this.store.active());
  }
}
