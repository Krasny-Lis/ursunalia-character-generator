import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { PlatformStore } from './platform.store';
import { Icon } from './icon';
import { ArchivedCharacter, Field, statusLabel } from './models';
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, DatePipe],
  styles: [`:host .button { white-space: normal; max-width: 100%; } :host .account-card p { overflow-wrap: anywhere; }`],
  template: ` <a class="back-link" routerLink="/"><u-icon name="back" />Wydarzenie</a>
    <section class="page-heading">
      <div>
        <span class="eyebrow">TWOJE MIEJSCE W OPOWIEŚCI</span>
        <h1>Konto uczestnika</h1>
      </div>
    </section>
    <section class="paper account-card">
      @if (store.mode() === 'demo') {
        <span class="wax-icon"><u-icon name="user" /></span>
        <h2>Oglądasz wersję demonstracyjną</h2>
        <p>
          Możesz wypełniać ankiety, przeglądać kartę Aleny i korzystać z kreatora formularzy. Dane
          są przechowywane w tej przeglądarce.
        </p>
        <p>Logowanie i wysyłanie zgłoszeń działają po uruchomieniu aplikacji z serwerem.</p>
        <a routerLink="/moje-postacie" class="button primary"
          >Moje zgłoszenia<u-icon name="next"
        /></a>
      } @else if (store.user(); as user) {
        <span class="wax-icon"><u-icon name="user" /></span>
        <h2>{{ user.name }}</h2>
        <p>{{ user.email }}</p>
        <p>{{ user.role === 'organizer' ? 'Organizator' : 'Uczestnik' }}</p>
        <div class="actions"><a class="button light" routerLink="/moje-postacie">Moje aktywne postacie</a><a class="button light" routerLink="/powiadomienia">Powiadomienia · {{ store.unreadCount() }}</a></div>
        <button class="button light" [disabled]="busy()" (click)="logout()">Wyloguj</button>
      } @else {
        <div class="tabs">
          <button [class.active]="mode() === 'login'" (click)="mode.set('login')">Logowanie</button
          ><button [class.active]="mode() === 'register'" (click)="mode.set('register')">
            Nowe konto
          </button>
        </div>
        <h2>{{ mode() === 'login' ? 'Witaj ponownie' : 'Dołącz do Ursunaliów' }}</h2>
        <form (ngSubmit)="submit()">
          @if (mode() === 'register') {
            <label
              >Imię / pseudonim<input
                name="name"
                [(ngModel)]="name"
                required
                maxlength="100"
                autocomplete="name"
            /></label>
          }
          <label
            >Adres e-mail<input
              name="email"
              type="email"
              [(ngModel)]="email"
              required
              autocomplete="email" /></label
          ><label
            >Hasło<input
              name="password"
              type="password"
              [(ngModel)]="password"
              required
              minlength="12"
              maxlength="128"
              [autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
          /></label>
          @if (mode() === 'register') {
            <small>Co najmniej 12 znaków.</small>
          }
          @if (error()) {
            <p class="field-error" role="alert">{{ error() }}</p>
          }
          <button class="button primary" type="submit" [disabled]="busy()">
            {{ busy() ? 'Proszę czekać…' : mode() === 'login' ? 'Zaloguj się' : 'Utwórz konto'
            }}<u-icon name="next" />
          </button>
        </form>
      }
    </section>
    @if (store.user()) {
      <section class="section-title"><div><span class="eyebrow">TWOJE DAWNE OPOWIEŚCI</span><h2>Archiwum postaci</h2><p>Historyczne kopie tekstowe bez zdjęć. Archiwalnej postaci nie można przywrócić ani edytować.</p></div><button class="button outline" [disabled]="busy()" (click)="refreshArchives()">Odśwież archiwum</button></section>
      @if (error()) { <p class="error-banner" role="alert">{{ error() }}</p> }
      <div class="application-list">@for (archived of store.archives(); track archived.id) {
        <article class="paper survey-card"><span class="eyebrow">{{ archived.event.name }} · {{ archived.event.date }}</span><h3>{{ archived.answers['name'] || archived.form.title }} {{ archived.answers['surname'] || '' }}</h3><p>{{ status(archived.status) }} · archiwizacja {{ archived.archivedAt | date: 'dd.MM.yyyy, HH:mm' }}</p><button class="button light" (click)="selectedArchive.set(archived.id)">Otwórz archiwalną postać</button></article>
      } @empty { <section class="paper empty-state"><h3>Archiwum jest puste</h3><p>Zarchiwizowane postacie pojawią się tutaj.</p></section> }</div>
      @if (archive(); as archived) {
        <section class="paper review-detail"><div class="summary-heading"><h2>Archiwalna postać · {{ archived.event.name }}</h2><button class="icon-button" aria-label="Zamknij archiwalną postać" (click)="selectedArchive.set('')"><u-icon name="close" /></button></div><p>{{ archived.event.date }} · {{ archived.event.location }} · {{ status(archived.status) }}</p>
          @for (section of archived.form.sections; track section.id) { <h3>{{ section.title }}</h3><dl>@for (field of section.fields; track field.id) { @if (field.type !== 'file' && field.type !== 'info') { <dt>{{ field.label }}</dt><dd>{{ archiveAnswer(archived, field) }}</dd> } }</dl> }
          @for (answer of additional(archived); track answer.id) { <dl><dt>{{ answer.id }} · historyczna odpowiedź</dt><dd>{{ answer.value }}</dd></dl> }
          <h3>Wykorzystaj jako podstawę nowego zgłoszenia</h3><p>Skopiujemy tylko pasujące odpowiedzi na inne wydarzenie. Bez zdjęcia, decyzji MG i wcześniejszej akceptacji. Pozostałe dane pozostaną w archiwum.</p>
          <label>Docelowe wydarzenie<select [(ngModel)]="targetEvent"><option value="">Wybierz wydarzenie</option>@for (event of targets(archived); track event.id) { <option [value]="event.id">{{ event.name }}</option> }</select></label>
          <div class="actions"><button class="button primary" [disabled]="busy() || !targetEvent" (click)="reuse(archived)">Utwórz nowy szkic z archiwum</button><button class="button light" [disabled]="busy()" (click)="removeArchive(archived)">Usuń archiwalną postać</button></div>
        </section>
      }
    }`,
})
export class AccountPage {
  readonly store = inject(PlatformStore);
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly selectedArchive = signal('');
  readonly status = statusLabel;
  targetEvent = '';
  mode = signal<'login' | 'register'>('login');
  busy = signal(false);
  error = signal('');
  name = '';
  email = '';
  password = '';
  constructor() { this.selectedArchive.set(this.route.snapshot.queryParamMap.get('archive') ?? ''); if (this.store.user()) void this.refreshArchives(); }
  archive() { return this.store.archives().find(a => a.id === this.selectedArchive()); }
  targets(a: ArchivedCharacter) { return this.store.events().filter(e => e.id !== a.eventId && this.store.forms().some(f => f.eventId === e.id && this.store.isCharacter(f))); }
  archiveAnswer(a: ArchivedCharacter, f: Field) {
    const v = a.answers[f.id];
    return Array.isArray(v) ? v.map(x => f.options?.find(o => o.id === x)?.label ?? x).join(', ') : f.options?.find(o => o.id === v)?.label ?? v ?? '—';
  }
  additional(a: ArchivedCharacter) {
    const known = new Set(a.form.sections.flatMap(s => s.fields).map(f => f.id));
    return Object.entries(a.answers).filter(([id]) => !known.has(id)).map(([id,value]) => ({ id, value: Array.isArray(value) ? value.join(', ') : String(value) }));
  }
  async refreshArchives() {
    if (this.busy() || !this.store.user()) return;
    this.busy.set(true); this.error.set('');
    const owner = this.store.user()?.id;
    try {
      if (!this.store.dirty()) await this.store.refreshServer();
      else { const archives = await this.store.request<ArchivedCharacter[]>('api/archives'); if (this.store.user()?.id === owner) this.store.archives.set(archives); }
    }
    catch (e) { this.error.set(this.store.message(e)); }
    finally { this.busy.set(false); }
  }
  async reuse(a: ArchivedCharacter) {
    if (this.busy() || !this.targets(a).some(e => e.id === this.targetEvent)) return;
    this.busy.set(true); this.error.set('');
    try { await this.store.reuseArchive(a, this.targetEvent); await this.router.navigate(['/zgloszenie-postaci']); }
    catch (e) { this.error.set(this.store.message(e)); }
    finally { this.busy.set(false); }
  }
  async removeArchive(a: ArchivedCharacter) {
    if (this.busy() || !window.confirm('Nieodwracalnie usunąć archiwalną postać oraz wszystkie jej kopie wewnętrzne? MG nie będzie mógł jej przywrócić.')) return;
    this.busy.set(true); this.error.set('');
    try { await this.store.retireCharacter(a, false); this.selectedArchive.set(''); }
    catch (e) { this.error.set(this.store.message(e)); }
    finally { this.busy.set(false); }
  }
  async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.store.auth(this.mode(), this.name, this.email, this.password);
      this.password = '';
      await this.router.navigate(['/']);
    } catch (e) {
      this.error.set(this.store.message(e));
    } finally {
      this.busy.set(false);
    }
  }
  async logout() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      await this.store.logout();
    } catch (e) {
      this.error.set(this.store.message(e));
    } finally { this.busy.set(false); }
  }
}
