import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { PlatformStore } from './platform.store';
import { Icon } from './icon';
import { statusLabel } from './models';
import { CharacterActions } from './character-actions';
@Component({
  standalone: true,
  imports: [RouterLink, Icon, DatePipe, CharacterActions],
  template: ` <a class="back-link" routerLink="/"><u-icon name="back" />Wydarzenie</a>
    <section class="page-heading">
      <div>
        <span class="eyebrow">TWOJE OPOWIEŚCI</span>
        <h1>Moje zgłoszenia</h1>
        <p>Szkice, gotowe postacie i odpowiedzi organizatora.</p>
      </div>
      <a class="button primary" routerLink="/">Wypełnij ankietę<u-icon name="plus" /></a>
      @if (store.mode() === 'server' && store.user()) { <button class="button outline" [disabled]="busy()" (click)="refresh()">Odśwież postacie</button> }
    </section>
    @if (error()) { <p class="error-banner" role="alert">{{ error() }}</p> }
    <div class="application-list">
      @for (app of store.applications(); track app.id) {
        <article class="paper application-item">
          <div class="wax-icon"><u-icon name="feather" /></div>
          <div>
            <span class="eyebrow">{{ app.form.title }}{{ app.kind === 'survey' ? ' · ankieta dodatkowa' : '' }}</span>
            <h2>
              {{ app.answers['name'] || 'Nowe zgłoszenie' }} {{ app.answers['surname'] || '' }}
            </h2>
            <p>
              Ostatnia zmiana: {{ app.updatedAt | date: 'dd.MM.yyyy, HH:mm' }}
              @if (app.id === 'demo-alena') {
                · postać przykładowa
              }
            </p>
            @if (app.feedback) {
              <p>Uwagi: {{ app.feedback }}</p>
            }
            @if (app.locked) { <p>Karta zablokowana</p> }
            <u-character-actions [app]="app" />
          </div>
          <span class="application-status">{{ status(app.status) }}</span
          ><button class="button light" (click)="open(app.id)">
            Otwórz kartę<u-icon name="next" />
          </button>
        </article>
      } @empty {
        <section class="paper empty-state">
          <u-icon name="book" />
          <h2>Twoja księga czeka na pierwszą historię</h2>
          <p>Otwórz wydarzenie i wybierz ankietę organizatora.</p>
          <a routerLink="/" class="button primary">Zobacz ankiety</a>
        </section>
      }
    </div>`,
})
export class ApplicationsPage {
  readonly store = inject(PlatformStore);
  readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal('');
  constructor() { if (this.store.mode() === 'server' && this.store.user() && !this.store.dirty()) void this.refresh(); }
  async refresh() {
    if (this.busy() || this.store.busy()) return;
    if (this.store.dirty()) { this.error.set('Zapisz bieżący szkic przed odświeżeniem listy.'); return; }
    this.busy.set(true); this.error.set('');
    try { await this.store.refreshServer(); }
    catch (e) { this.error.set(this.store.message(e)); }
    finally { this.busy.set(false); }
  }
  open(id: string) {
    if (this.busy()) return;
    this.store.open(id);
    void this.router.navigate(['/karta-postaci']);
  }
  readonly status = statusLabel;
}
