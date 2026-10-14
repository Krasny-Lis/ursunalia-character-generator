import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { PlatformStore, downloadJson } from './platform.store';
import { Application, Answers, Field, statusLabel } from './models';
import { Icon } from './icon';
import { FieldControl } from './field.control';
import { CharacterHistory } from './character-history';
@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, Icon, DatePipe, FieldControl, CharacterHistory],
  template: `
    <a class="back-link" routerLink="/"><u-icon name="back" />Wydarzenie</a>
    <section class="page-heading">
      <div>
        <span class="eyebrow">PANEL ORGANIZATORA</span>
        <h1>Ankiety organizatora</h1>
        <p>Twórz formularze i przeglądaj zgłoszenia uczestników.</p>
      </div>
      @if (store.canManageForm(store.seed()!.event.id)) {
        <a
          class="button primary"
          routerLink="/organizator/ankiety/edytor"
          [queryParams]="{ id: 'new', eventId: store.seed()!.event.id }"
          ><u-icon name="edit" />Formularz postaci</a
        >
      }
    </section>
    @if (!store.canOrganize()) {
      <section class="paper empty-state">
        <h2>Dostęp dla organizatorów</h2>
        <p>Zaloguj się na konto organizatora.</p>
        <a class="button primary" routerLink="/konto">Logowanie</a>
      </section>
    } @else {
      <div class="survey-cards">
        @for (form of store.forms(); track form.id) {
          <article class="paper survey-card">
            <span class="eyebrow">OPUBLIKOWANA · WERSJA {{ form.revision }}</span>
            <h2>{{ form.title }}</h2>
            <p>{{ form.sections.length }} sekcji · {{ count(form) }} pytań</p>
            @if (store.canManageForm(form.eventId) && store.isCharacter(form)) {
            <div class="actions">
              <a
                class="button light"
                routerLink="/organizator/ankiety/edytor"
                [queryParams]="{ id: form.id }"
                ><u-icon name="edit" />Edytuj formularz</a
              >
            </div>
            }
          </article>
        }
      </div>
      <section class="section-title">
        <div>
          <span class="eyebrow">ODPOWIEDZI UCZESTNIKÓW</span>
          <h2>Postacie</h2>
        </div>
        <div class="actions review-filters">
          <label class="filter-label">Szukaj
            <input type="search" [(ngModel)]="userQuery" placeholder="Gracz lub postać…" />
          </label>
          <label class="filter-label">Rodzaj ankiety
            <select [(ngModel)]="formFilter">
              <option value="all">Wszystkie ankiety</option>
              @for (form of store.forms(); track form.id) {
                <option [value]="form.id">{{ form.title }}</option>
              }
            </select>
          </label>
          <label class="filter-label">Status
            <select [(ngModel)]="filter">
              <option value="all">Wszystkie</option>
              <option value="submitted">Do weryfikacji</option>
              <option value="accepted">Zaakceptowane</option>
              <option value="changes">Do poprawy</option>
              <option value="rejected">Odrzucone</option>
            </select>
          </label>
          <button class="button outline" (click)="refresh()" [disabled]="busy()">Odśwież</button>
        </div>
      </section>
      @if (store.mode() === 'demo') {
        <div class="info-strip">
          <u-icon name="info" />W wersji demonstracyjnej nie ma rzeczywistych zgłoszeń uczestników.
        </div>
      }
      @if (error()) {
        <p class="error-banner" role="alert">{{ error() }}</p>
      }
      <div class="review-layout">
        <div class="application-list">
          @for (app of filtered(); track app.id) {
            <button
              class="paper review-item"
              [class.selected]="selected()?.id === app.id"
              (click)="select(app)"
            >
              <span class="review-user">Użytkownik: <strong>{{ app.userName || app.userEmail }}</strong></span>
              <span class="review-form">Ankieta: <strong>{{ app.form.title }}</strong></span>
              <h3>{{ app.answers['name'] || 'Zgłoszenie' }} {{ app.answers['surname'] }}</h3>
              <span class="review-meta"><small>{{ app.submittedAt | date: 'dd.MM.yyyy, HH:mm' }}</small>
                <strong class="review-status" [attr.data-status]="app.status">{{ status(app.status) }}</strong></span>
            </button>
          } @empty {
            <section class="paper empty-state">
              <u-icon name="file" />
              <h3>Brak zgłoszeń w tym widoku</h3>
              <p>Postacie uczestników pojawią się tutaj.</p>
            </section>
          }
        </div>
        @if (selected(); as app) {
          <section class="paper review-detail">
            <div class="summary-heading">
              <h2>{{ app.userName }}</h2>
              <button
                class="icon-button"
                aria-label="Zamknij zgłoszenie"
                [disabled]="busy()"
                (click)="closeDetail()"
              >
                <u-icon name="close" />
              </button>
            </div>
            <p>{{ app.userEmail }}</p>
            @for (section of app.form.sections; track section.id) {
              <h3>{{ section.title }}</h3>
              @if (editing()) {
                <div class="field-grid">
                  @for (field of section.fields; track field.id) {
                    <u-field [field]="field" [value]="editAnswers()[field.id]" [disabled]="busy()"
                      [class.full]="['textarea','multi','single','file','info'].includes(field.type)"
                      (changed)="changeAnswer(field.id, $event)" />
                  }
                </div>
              } @else { <dl>
                @for (field of section.fields; track field.id) {
                  @if (field.type !== 'info' && field.type !== 'file') {
                    <dt>{{ field.label }}</dt>
                    <dd>{{ answer(app, field) }}</dd>
                  }
                }
              </dl> }
            }
            <div class="actions">
              @if (editing()) {
                <button class="button primary" [disabled]="busy()" (click)="saveEdit()">Zapisz odpowiedzi bez zmiany statusu</button>
                <button class="button light" [disabled]="busy()" (click)="cancelEdit()">Anuluj edycję</button>
              } @else {
                <button class="button light" [disabled]="busy()" (click)="beginEdit()">Edytuj postać jako MG</button>
              }
            </div>
            <label
              >Uwagi dla uczestnika (opcjonalne)<textarea
                [(ngModel)]="feedback"
                (ngModelChange)="store.reviewDirty.set(true)"
                [disabled]="busy() || editing()"
                maxlength="2000"
                rows="4"
              ></textarea>
            </label>
            <div class="actions">
              <button
                class="button light"
                [disabled]="busy() || editing() || app.status === 'draft'"
                (click)="review('changes')"
              >
                Poproś o poprawki</button
              ><button class="button primary" [disabled]="busy() || editing() || app.status === 'draft'" (click)="review('accepted')">
                <u-icon name="check" />Zaakceptuj</button
              ><button class="button light" [disabled]="busy() || editing() || app.status === 'draft'" (click)="review('rejected')">Odrzuć</button>
              @if (app.status === 'accepted') {
                <button class="button light" [disabled]="busy() || editing()" (click)="review('changes', true)">Odblokuj dla gracza</button>
              }
              <button class="button light" (click)="export(app)">Pobierz JSON</button>
            </div>
            <u-character-history [app]="app" />
          </section>
        }
      </div>
    }
  `,
})
export class OrganizerPage {
  readonly store = inject(PlatformStore);
  readonly applications = signal<Application[]>([]);
  readonly selected = signal<Application | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly editing = signal(false);
  readonly editAnswers = signal<Answers>({});
  filter = 'all';
  formFilter = 'all';
  userQuery = '';
  feedback = '';
  constructor() {
    void this.refresh();
  }
  count(form: any) {
    return form.sections.reduce((n: number, s: any) => n + s.fields.length, 0);
  }
  filtered() {
    const query = this.userQuery.trim().toLocaleLowerCase('pl');
    return this.applications().filter((a) =>
      (this.filter === 'all' || a.status === this.filter) &&
      (this.formFilter === 'all' || a.form.id === this.formFilter) &&
      (!query || [a.userName, a.userEmail, a.answers['name'], a.answers['surname'], a.form.title]
        .some(v => String(v ?? '').toLocaleLowerCase('pl').includes(query)))
    );
  }
  readonly status = statusLabel;
  canLeave() { return !this.store.reviewDirty() || window.confirm('Masz niezapisane zmiany MG. Opuścić widok?'); }
  ngOnDestroy() { this.store.reviewDirty.set(false); }
  closeDetail() { if (this.canLeave()) { this.selected.set(null); this.cancelEdit(); } }
  select(app: Application) {
    if (this.busy() || !this.canLeave()) return;
    this.selected.set(app);
    this.editing.set(false);
    this.store.reviewDirty.set(false);
    this.feedback = app.feedback ?? '';
  }
  beginEdit() {
    if (!this.selected() || this.busy() || !this.canLeave()) return;
    this.feedback = this.selected()!.feedback ?? '';
    this.store.reviewDirty.set(false);
    this.editAnswers.set(structuredClone(this.selected()!.answers));
    this.editing.set(true);
  }
  changeAnswer(id: string, value: Answers[string]) {
    this.editAnswers.update(answers => ({ ...answers, [id]: value }));
    this.store.reviewDirty.set(true);
  }
  cancelEdit() { this.editing.set(false); this.store.reviewDirty.set(false); this.feedback = this.selected()?.feedback ?? ''; }
  private updated(app: Application) {
    this.applications.update(all => all.map(a => a.id === app.id ? app : a));
    this.selected.set(app);
    this.feedback = app.feedback ?? '';
    this.error.set('');
    this.store.reviewDirty.set(false);
  }
  async saveEdit() {
    const app = this.selected();
    if (!app || this.busy()) return;
    this.busy.set(true);
    try {
      this.updated(await this.store.request<Application>('api/organizer/characters/' + app.id, 'PATCH',
        { expectedRevision: app.revision, expectedSchemaRevision: app.form.revision, answers: this.editAnswers() }));
      this.editing.set(false);
      this.store.notice.set('Zapisano odpowiedzi. Status postaci pozostał bez zmian.');
    } catch (e) { this.error.set(this.store.message(e)); }
    finally { this.busy.set(false); }
  }
  answer(app: Application, f: Field) {
    const v = app.answers[f.id];
    if (Array.isArray(v))
      return v.map((x) => f.options?.find((o) => o.id === x)?.label ?? x).join(', ');
    return f.options?.find((o) => o.id === v)?.label ?? v ?? '—';
  }
  async refresh() {
    if (this.store.mode() !== 'server' || !this.store.canOrganize() || this.busy() || !this.canLeave()) return;
    this.busy.set(true);
    try {
      const all = await this.store.request<Application[]>('api/organizer/characters');
      const id = this.selected()?.id;
      this.applications.set(all);
      this.selected.set(null);
      this.cancelEdit();
      if (id) { const current = all.find(a => a.id === id); if (current) { this.selected.set(current); this.feedback = current.feedback ?? ''; } }
      this.error.set('');
    } catch (e) {
      this.error.set(this.store.message(e));
    } finally {
      this.busy.set(false);
    }
  }
  async review(status: 'changes' | 'accepted' | 'rejected', unlock = false) {
    const app = this.selected();
    if (!app || this.busy() || this.editing()) return;
    this.busy.set(true);
    try {
      const updated = await this.store.request<Application>(
        'api/organizer/characters/' + app.id + (unlock ? '/unlock' : '/decision'),
        'POST',
        { status, feedback: this.feedback, expectedRevision: app.revision },
      );
      this.updated(updated);
      this.store.notice.set('Zapisano decyzję organizatora.');
    } catch (e) {
      this.error.set(this.store.message(e));
    } finally {
      this.busy.set(false);
    }
  }
  export(app: Application) {
    downloadJson('ursunalia-' + app.id + '.json', app);
  }
}
