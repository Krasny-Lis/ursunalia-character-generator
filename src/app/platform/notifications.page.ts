import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { PlatformStore } from './platform.store';
import { AppNotification, statusLabel } from './models';
@Component({ standalone: true, imports: [DatePipe, RouterLink], styles: [`:host .button { white-space: normal; max-width: 100%; } :host .survey-card p { white-space: pre-line; overflow-wrap: anywhere; }`], template: `
  <a class="back-link" routerLink="/konto">Moje konto</a>
  <section class="page-heading"><div><span class="eyebrow">WIADOMOŚCI OD MG</span><h1>Powiadomienia</h1><p>Nieprzeczytane: {{ store.unreadCount() }}</p></div><button class="button outline" [disabled]="busy()" (click)="refresh()">Odśwież powiadomienia</button></section>
  @if (error()) { <p class="error-banner" role="alert">{{ error() }}</p> }
  @if (!store.user()) { <section class="paper empty-state"><h2>Zaloguj się, by zobaczyć swoje powiadomienia</h2><a class="button primary" routerLink="/konto">Moje konto</a></section> }
  @else { <div class="application-list">@for (notice of store.notifications(); track notice.id) {
    <article class="paper survey-card"><span class="eyebrow">{{ notice.readAt ? 'PRZECZYTANE' : 'NOWE' }} · {{ eventName(notice.eventId) }}</span><h2>{{ notice.kind === 'unlock' ? 'MG odblokował zaakceptowaną postać' : 'Postać: ' + status(notice.kind) }}</h2><small>{{ notice.createdAt | date: 'dd.MM.yyyy, HH:mm' }}</small>
      @if (notice.comment) { <p>{{ notice.comment }}</p> }
      <div class="actions">@if (notice.characterAvailable) { <button class="button primary" [disabled]="busy()" (click)="open(notice)">Otwórz postać</button> } @else if (notice.archiveAvailable) { <a class="button light" routerLink="/konto" [queryParams]="{ archive: notice.characterId }">Zobacz w archiwum</a> } @else { <p>Postać została usunięta.</p> }
        @if (!notice.readAt) { <button class="button light" [disabled]="busy()" (click)="read(notice)">Oznacz jako przeczytane</button> }
      </div>
    </article>
  } @empty { <section class="paper empty-state"><h2>Brak powiadomień</h2><p>Decyzje i komentarze MG pojawią się tutaj i pozostaną po ponownym zalogowaniu.</p></section> }</div> }
` })
export class NotificationsPage {
  readonly store = inject(PlatformStore);
  readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly status = statusLabel;
  constructor() { void this.refresh(); }
  eventName(id: string) { return this.store.events().find(e => e.id === id)?.name ?? id; }
  async refresh() { await this.run(() => this.store.refreshNotifications()); }
  async read(n: AppNotification) { await this.run(() => this.store.markRead(n.id)); }
  async open(n: AppNotification) { await this.run(async () => { await this.store.openNotification(n); await this.router.navigate(['/karta-postaci']); }); }
  private async run(work: () => Promise<unknown>) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try { await work(); } catch (e) { this.error.set(this.store.message(e)); }
    finally { this.busy.set(false); }
  }
}
