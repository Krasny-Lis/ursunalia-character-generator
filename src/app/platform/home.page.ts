import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PlatformStore } from './platform.store';
import { Icon } from './icon';

/**
 * Ursunalia-only public information hub. News and fees are intentionally
 * unpopulated until an organizer publishes real content in a later stage.
 */
@Component({
  standalone: true,
  imports: [RouterLink, Icon],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  readonly store = inject(PlatformStore);
  private readonly router = inject(Router);
  private readonly eventId = 'ursunalia-2027';

  readonly event = computed(() =>
    this.store.mode() === 'server'
      ? this.store.events().find(event => event.id === this.eventId) ?? null
      : this.store.seed()?.event ?? null,
  );
  readonly eventDate = computed(() => this.event()?.date || '22–24 kwietnia 2027');
  readonly registrations = computed(() => {
    if (this.store.mode() !== 'server' || this.event()?.registrationsOpen === undefined) return 'Do ogłoszenia';
    return this.event()?.registrationsOpen ? 'Otwarte' : 'Zamknięte';
  });
  readonly characterForm = computed(() =>
    this.store.forms().find(form => form.eventId === this.eventId && this.store.isCharacter(form) && form.status === 'published') ?? null,
  );
  readonly hasCharacter = computed(() =>
    this.store.applications().some(app =>
      app.id !== 'demo-alena' &&
      app.form.eventId === this.eventId &&
      (app.kind === 'character' || this.store.mode() === 'demo' && app.form.id === 'character-2027'),
    ),
  );
  readonly canStart = computed(() =>
    !!this.characterForm() &&
    (this.store.mode() === 'demo' || this.event()?.registrationsOpen === true),
  );

  async startCharacter() {
    const form = this.characterForm();
    if (!form || !this.canStart() || this.store.busy()) return;
    if (this.store.mode() === 'server' && !this.store.user()) {
      await this.router.navigate(['/konto']);
      return;
    }
    this.store.busy.set(true);
    try {
      if (this.store.user()) await this.store.joinEvent(form.eventId);
      const id = this.store.start(form);
      await this.router.navigate(
        [id ? '/zgloszenie-postaci' : '/konto'],
        id ? { queryParams: { id } } : {},
      );
    } catch (error) {
      this.store.notice.set(this.store.message(error));
    } finally {
      this.store.busy.set(false);
    }
  }
}
