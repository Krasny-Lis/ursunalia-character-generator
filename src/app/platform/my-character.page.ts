import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';
import { FieldControl } from './field.control';
import { PlatformStore } from './platform.store';
import { ParticipantViewStore } from './participant-view.store';
import { statusLabel, type Application, type Field } from './models';
import { answerIssues } from '../../../shared/validation.mjs';

@Component({
  standalone: true,
  imports: [RouterLink, Icon, FieldControl, DatePipe],
  templateUrl: './my-character.page.html',
  styleUrl: './my-character.page.scss',
})
export class MyCharacterPage {
  readonly store = inject(PlatformStore);
  readonly state = inject(ParticipantViewStore);
  readonly mode = signal<'view' | 'edit'>('view');
  readonly confirmOpen = signal(false);
  readonly character = this.state.character;
  readonly issues = computed(() => this.character()
    ? answerIssues(this.character()!.form, this.character()!.answers)
    : {},
  );
  readonly canEdit = computed(() => this.state.canEditRecord(this.character()));

  readonly canSubmit = computed(() => {
    const app = this.character();
    if (!app || !this.canEdit() || this.store.busy() || Object.keys(this.issues()).length > 0) return false;
    return ['draft', 'changes', 'rejected'].includes(app.status) ||
      (app.status === 'submitted' && this.store.dirty());
  });

  display(field: Field, app: Application): string {
    const value = app.answers[field.id];
    if (Array.isArray(value))
      return value.map(key => field.options?.find(option => option.id === key)?.label ?? key).join(', ') || 'Nie uzupełniono';
    if (value === undefined || value === null || value === '') return 'Nie uzupełniono';
    return field.options?.find(option => option.id === value)?.label ?? String(value);
  }

  startEdit() {
    const app = this.character();
    if (!app || !this.canEdit()) return;
    if (this.store.activeId() !== app.id) {
      if (this.store.dirty()) {
        this.store.notice.set('Zapisz bieżące zmiany przed otwarciem edycji tej postaci.');
        return;
      }
      this.store.open(app.id);
    }
    this.mode.set('edit');
  }

  backToView() {
    if (this.store.dirty() && this.store.activeId() === this.character()?.id) {
      this.store.notice.set('Zapisz zmiany przed powrotem do podglądu.');
      return;
    }
    this.mode.set('view');
  }

  update(field: Field, value: string | number | string[]) {
    if (!this.canEdit() || this.store.activeId() !== this.character()?.id) return;
    this.store.update(field.id, value);
  }

  async save() {
    if (!this.canEdit() || this.store.activeId() !== this.character()?.id) return;
    await this.store.save();
    if (!this.store.dirty() && !this.store.storageError()) this.mode.set('view');
  }

  async submit() {
    this.confirmOpen.set(false);
    if (!this.canSubmit() || this.store.activeId() !== this.character()?.id) return;
    if (await this.store.submit()) this.mode.set('view');
  }

  readonly statusText = statusLabel;
}
