import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { PlatformStore, downloadJson } from './platform.store';
import { Application, Field } from './models';
import { Icon } from './icon';
@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, Icon, DatePipe],
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
          [queryParams]="{ id: 'new' }"
          ><u-icon name="plus" />Nowa ankieta</a
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
            @if (store.canManageForm(form.eventId)) {
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
          <h2>Zgłoszenia</h2>
        </div>
        <div class="actions review-filters">
          <label class="filter-label">Użytkownik
            <input type="search" [(ngModel)]="userQuery" placeholder="Imię, nazwisko, e-mail…" />
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
              <option value="submitted">Do sprawdzenia</option>
              <option value="accepted">Zaakceptowane</option>
              <option value="changes">Do poprawy</option>
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
              <p>Wysłane ankiety uczestników pojawią się tutaj.</p>
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
                (click)="selected.set(null)"
              >
                <u-icon name="close" />
              </button>
            </div>
            <p>{{ app.userEmail }}</p>
            @for (section of app.form.sections; track section.id) {
              <h3>{{ section.title }}</h3>
              <dl>
                @for (field of section.fields; track field.id) {
                  @if (field.type !== 'info' && field.type !== 'file') {
                    <dt>{{ field.label }}</dt>
                    <dd>{{ answer(app, field) }}</dd>
                  }
                }
              </dl>
            }
            <label
              >Uwagi dla uczestnika<textarea
                [(ngModel)]="feedback"
                maxlength="2000"
                rows="4"
              ></textarea>
            </label>
            <div class="actions">
              <button
                class="button light"
                [disabled]="busy() || !feedback.trim()"
                (click)="review('changes')"
              >
                Poproś o poprawki</button
              ><button class="button primary" [disabled]="busy()" (click)="review('accepted')">
                <u-icon name="check" />Zaakceptuj</button
              ><button class="button light" (click)="export(app)">Pobierz JSON</button>
            </div>
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
  status(s: string) {
    return (
      (
        { submitted: 'Do sprawdzenia', accepted: 'Zaakceptowane', changes: 'Do poprawy' } as Record<
          string,
          string
        >
      )[s] ?? s
    );
  }
  select(app: Application) {
    this.selected.set(app);
    this.feedback = app.feedback ?? '';
  }
  answer(app: Application, f: Field) {
    const v = app.answers[f.id];
    if (Array.isArray(v))
      return v.map((x) => f.options?.find((o) => o.id === x)?.label ?? x).join(', ');
    return f.options?.find((o) => o.id === v)?.label ?? v ?? '—';
  }
  async refresh() {
    if (this.store.mode() !== 'server' || !this.store.canOrganize()) return;
    this.busy.set(true);
    try {
      this.applications.set(await this.store.request<Application[]>('api/organizer/applications'));
    } catch (e) {
      this.error.set(this.store.message(e));
    } finally {
      this.busy.set(false);
    }
  }
  async review(status: 'changes' | 'accepted') {
    const app = this.selected();
    if (!app) return;
    this.busy.set(true);
    try {
      const updated = await this.store.request<Application>(
        'api/organizer/applications/' + app.id,
        'PATCH',
        { status, feedback: this.feedback },
      );
      this.applications.update((all) => all.map((a) => (a.id === updated.id ? updated : a)));
      this.selected.set(updated);
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
