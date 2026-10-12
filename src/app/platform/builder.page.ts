import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  DragDropModule,
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { A11yModule } from '@angular/cdk/a11y';
import { PlatformStore, uid, downloadJson } from './platform.store';
import { Field, FieldType, FormDefinition, Section, Answers } from './models';
import { FieldControl } from './field.control';
import { Icon } from './icon';
import { migrateSurvey, isEditorDraft } from './migration';
import { definitionIssues } from '../../../shared/validation.mjs';
export const FIELD_TYPES: { type: FieldType; label: string; description: string; icon: string }[] =
  [
    {
      type: 'text',
      label: 'Krótka odpowiedź',
      description: 'Jednowierszowe pole tekstowe',
      icon: 'list',
    },
    {
      type: 'textarea',
      label: 'Długa odpowiedź',
      description: 'Wielowierszowe pole tekstowe',
      icon: 'file',
    },
    {
      type: 'single',
      label: 'Wybór jednokrotny',
      description: 'Jedna odpowiedź z listy',
      icon: 'radio',
    },
    {
      type: 'multi',
      label: 'Wybór wielokrotny',
      description: 'Wiele odpowiedzi z listy',
      icon: 'checkbox',
    },
    {
      type: 'select',
      label: 'Lista rozwijana',
      description: 'Wybór z rozwijanej listy',
      icon: 'chevron',
    },
    { type: 'rating', label: 'Skala ocen', description: 'Ocena w skali (np. 1–5)', icon: 'star' },
    { type: 'date', label: 'Data', description: 'Wybór daty z kalendarza', icon: 'calendar' },
    {
      type: 'file',
      label: 'Portret / obraz',
      description: 'Obraz JPG, PNG lub WebP',
      icon: 'file',
    },
    { type: 'info', label: 'Informacja', description: 'Opis bez pola odpowiedzi', icon: 'info' },
  ];
@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, DragDropModule, A11yModule, FieldControl, Icon],
  templateUrl: './builder.page.html',
})
export class BuilderPage {
  readonly store = inject(PlatformStore);
  readonly route = inject(ActivatedRoute);
  readonly types = FIELD_TYPES;
  readonly form = signal<FormDefinition>(this.restore());
  readonly selected = signal('');
  readonly selectedSection = signal('');
  readonly mode = signal<'edit' | 'preview'>('edit');
  readonly paletteOpen = signal(false);
  readonly tab = signal('questions');
  readonly importOpen = signal(false);
  readonly error = signal('');
  readonly publishing = signal(false);
  readonly answers = signal<Answers>({});
  readonly collapsed = signal(new Set<string>());
  readonly count = computed(() => this.form().sections.reduce((a, s) => a + s.fields.length, 0));
  readonly problems = computed(() => definitionIssues(this.form()));
  readonly listIds = computed(() => this.form().sections.map((s) => 'fields-' + s.id));
  private key() {
    return (
      'ursunalia:builder:v27:' +
      (this.route.snapshot.queryParamMap.get('id') ?? this.store.forms()[0]?.id ?? 'new')
    );
  }
  private restore(): FormDefinition {
    const id = this.route.snapshot.queryParamMap.get('id');
    try {
      const raw = localStorage.getItem(this.key());
      if (raw) {
        const value = JSON.parse(raw);
        if (isEditorDraft(value)) return value;
      }
    } catch {
      /* Keep inaccessible or damaged backup untouched. */
    }
    if (id === 'new')
      return {
        id: uid('form'),
        eventId: 'ursunalia-2027',
        revision: 1,
        status: 'draft',
        title: 'Nowa ankieta',
        description: '',
        sections: [
          {
            id: uid('section'),
            title: 'Pierwsza sekcja',
            description: '',
            fields: [this.newField('text')],
          },
        ],
      };
    try {
      const old = localStorage.getItem('ursunalia:surveys:builder:v26');
      if (old && !id) return migrateSurvey(JSON.parse(old));
    } catch {
      /* Original v26 draft is retained. */
    }
    return structuredClone(this.store.forms().find((f) => f.id === id) ?? this.store.forms()[0]);
  }
  private save(form: FormDefinition) {
    this.form.set({ ...form, status: 'draft' });
    try {
      localStorage.setItem(this.key(), JSON.stringify(this.form()));
    } catch {
      this.error.set('Zapis lokalny niedostępny. Pobierz JSON, aby zachować pracę.');
    }
  }
  newField(type: FieldType): Field {
    const field: Field = {
      id: uid('field'),
      type,
      label: type === 'info' ? 'Informacja' : 'Nowe pytanie',
      required: false,
    };
    if (['single', 'multi', 'select'].includes(type))
      field.options = [
        { id: uid('option'), label: 'Opcja 1' },
        { id: uid('option'), label: 'Opcja 2' },
      ];
    if (type === 'rating') {
      field.min = 1;
      field.max = 5;
    }
    if (type === 'text' || type === 'textarea') field.maxLength = type === 'text' ? 160 : 2000;
    return field;
  }
  meta(key: 'title' | 'description', value: string) {
    this.save({ ...this.form(), [key]: value });
  }
  section(id: string, key: 'title' | 'description', value: string) {
    this.save({
      ...this.form(),
      sections: this.form().sections.map((s) => (s.id === id ? { ...s, [key]: value } : s)),
    });
  }
  patch(sectionId: string, fieldId: string, patch: Partial<Field>) {
    this.save({
      ...this.form(),
      sections: this.form().sections.map((s) =>
        s.id === sectionId
          ? { ...s, fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) }
          : s,
      ),
    });
  }
  select(sectionId: string, fieldId = '') {
    this.selectedSection.set(sectionId);
    this.selected.set(fieldId);
  }
  add(type: FieldType) {
    let sectionId = this.selectedSection() || this.form().sections.at(-1)?.id;
    if (!sectionId) sectionId = this.addSection();
    const f = this.newField(type);
    this.save({
      ...this.form(),
      sections: this.form().sections.map((s) =>
        s.id === sectionId ? { ...s, fields: [...s.fields, f] } : s,
      ),
    });
    this.select(sectionId, f.id);
    this.paletteOpen.set(false);
  }
  addSection() {
    const s: Section = { id: uid('section'), title: 'Nowa sekcja', description: '', fields: [] };
    this.save({ ...this.form(), sections: [...this.form().sections, s] });
    this.select(s.id);
    this.paletteOpen.set(false);
    return s.id;
  }
  removeSection(id: string) {
    if (!confirm('Usunąć sekcję wraz z pytaniami?')) return;
    this.save({ ...this.form(), sections: this.form().sections.filter((s) => s.id !== id) });
    this.selected.set('');
    this.selectedSection.set('');
  }
  duplicateSection(id: string) {
    const sections = structuredClone(this.form().sections);
    const index = sections.findIndex((s) => s.id === id);
    const copy = structuredClone(sections[index]);
    copy.id = uid('section');
    copy.title += ' — kopia';
    copy.fields = copy.fields.map((f) => ({ ...f, id: uid('field') }));
    sections.splice(index + 1, 0, copy);
    this.save({ ...this.form(), sections });
  }
  removeField(sectionId: string, id: string) {
    if (!confirm('Usunąć to pytanie?')) return;
    this.save({
      ...this.form(),
      sections: this.form().sections.map((s) =>
        s.id === sectionId ? { ...s, fields: s.fields.filter((f) => f.id !== id) } : s,
      ),
    });
  }
  duplicateField(sectionId: string, id: string) {
    this.save({
      ...this.form(),
      sections: this.form().sections.map((s) => {
        if (s.id !== sectionId) return s;
        const fields = structuredClone(s.fields);
        const i = fields.findIndex((f) => f.id === id);
        fields.splice(i + 1, 0, { ...structuredClone(fields[i]), id: uid('field') });
        return { ...s, fields };
      }),
    });
  }
  shiftSection(index: number, delta: number) {
    if (index + delta < 0 || index + delta >= this.form().sections.length) return;
    const sections = [...this.form().sections];
    moveItemInArray(sections, index, index + delta);
    this.save({ ...this.form(), sections });
  }
  shiftField(sectionId: string, index: number, delta: number) {
    this.save({
      ...this.form(),
      sections: this.form().sections.map((s) => {
        if (s.id !== sectionId || index + delta < 0 || index + delta >= s.fields.length) return s;
        const fields = [...s.fields];
        moveItemInArray(fields, index, index + delta);
        return { ...s, fields };
      }),
    });
  }
  changeType(sid: string, field: Field, type: FieldType) {
    const fresh = this.newField(type);
    this.save({
      ...this.form(),
      sections: this.form().sections.map((s) =>
        s.id !== sid
          ? s
          : {
              ...s,
              fields: s.fields.map((f) =>
                f.id !== field.id
                  ? f
                  : {
                      ...fresh,
                      id: field.id,
                      label: field.label,
                      description: field.description,
                      required: field.required,
                      ...(['single', 'multi', 'select'].includes(type) && field.options
                        ? { options: field.options }
                        : {}),
                    },
              ),
            },
      ),
    });
  }
  addOption(sid: string, f: Field) {
    this.patch(sid, f.id, {
      options: [...(f.options ?? []), { id: uid('option'), label: 'Nowa odpowiedź' }],
    });
  }
  editOption(sid: string, f: Field, id: string, label: string) {
    this.patch(sid, f.id, { options: f.options?.map((o) => (o.id === id ? { ...o, label } : o)) });
  }
  removeOption(sid: string, f: Field, id: string) {
    this.patch(sid, f.id, { options: f.options?.filter((o) => o.id !== id) });
  }
  dropSection(event: CdkDragDrop<Section[]>) {
    const sections = [...this.form().sections];
    moveItemInArray(sections, event.previousIndex, event.currentIndex);
    this.save({ ...this.form(), sections });
  }
  dropField(event: CdkDragDrop<Field[]>, sid: string) {
    const sections = structuredClone(this.form().sections);
    const from = sections.find((s) => 'fields-' + s.id === event.previousContainer.id);
    const to = sections.find((s) => s.id === sid);
    if (!from || !to) return;
    if (from === to) moveItemInArray(to.fields, event.previousIndex, event.currentIndex);
    else transferArrayItem(from.fields, to.fields, event.previousIndex, event.currentIndex);
    this.save({ ...this.form(), sections });
  }
  dropOption(event: CdkDragDrop<unknown>, sid: string, f: Field) {
    const options = [...(f.options ?? [])];
    moveItemInArray(options, event.previousIndex, event.currentIndex);
    this.patch(sid, f.id, { options });
  }
  toggle(id: string) {
    this.collapsed.update((all) => {
      const s = new Set(all);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }
  label(type: FieldType) {
    return this.types.find((t) => t.type === type)?.label;
  }
  export() {
    downloadJson('ursunalia-ankieta-' + this.form().id + '.json', this.form());
  }
  async import(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 400000) throw new Error('Maksymalny rozmiar definicji to 400 KB.');
      const form = migrateSurvey(JSON.parse(await file.text()));
      const errors = definitionIssues(form);
      if (errors.length) throw new Error(errors[0]);
      if (!confirm('Zastąpić aktualny szkic importowaną ankietą?')) return;
      this.save({ ...form, eventId: 'ursunalia-2027' });
      this.importOpen.set(false);
      this.error.set('');
    } catch (e) {
      this.error.set(this.store.message(e));
    }
    input.value = '';
  }
  async publish() {
    if (this.publishing()) return;
    this.publishing.set(true);
    try {
      await this.store.publish(this.form());
      this.error.set('');
    } catch (e) {
      this.error.set(this.store.message(e));
    } finally {
      this.publishing.set(false);
    }
  }
  previewAnswer(id: string, value: Answers[string]) {
    this.answers.update((all) => ({ ...all, [id]: value }));
  }
}
