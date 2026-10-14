import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Icon } from './icon';
import { ParticipantViewStore } from './participant-view.store';
import { PlatformStore } from './platform.store';

@Component({
  standalone: true,
  imports: [RouterLink, Icon],
  templateUrl: './participant-dashboard.page.html',
  styleUrl: './participant-dashboard.page.scss',
})
export class ParticipantDashboardPage {
  readonly state = inject(ParticipantViewStore);
  readonly store = inject(PlatformStore);
  private readonly router = inject(Router);

  async start() {
    const form = this.state.form();
    if (!form || !this.state.canStart() || this.store.busy()) return;
    if (this.store.mode() === 'server' && !this.store.user()) {
      await this.router.navigate(['/konto']);
      return;
    }
    this.store.busy.set(true);
    try {
      if (this.store.mode() === 'server') await this.store.joinEvent(form.eventId);
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
