import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PlatformStore } from './platform.store';
import { Icon } from './icon';

/**
 * Account UI shell. Legacy auth is preserved.
 * Contact editing and password changes remain explicitly inactive until
 * server endpoints and validation exist: never accept unsaved PII.
 */
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, Icon],
  templateUrl: './account.page.html',
  styleUrl: './account.page.scss',
})
export class AccountPage {
  readonly store = inject(PlatformStore);
  readonly router = inject(Router);
  readonly mode = signal<'login' | 'register'>('login');
  readonly editing = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  name = '';
  email = '';
  password = '';

  async submit() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.store.auth(this.mode(), this.name, this.email, this.password);
      this.password = '';
      await this.router.navigate(['/moj-panel']);
    } catch (e) {
      this.error.set(this.store.message(e));
    } finally {
      this.busy.set(false);
    }
  }

  async logout() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.store.logout();
      this.editing.set(false);
    } catch (e) {
      this.error.set(this.store.message(e));
    } finally {
      this.busy.set(false);
    }
  }
}
