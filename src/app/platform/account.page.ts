import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PlatformStore } from './platform.store';
import { Icon } from './icon';
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, Icon],
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
        <button class="button light" (click)="logout()">Wyloguj</button>
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
    </section>`,
})
export class AccountPage {
  readonly store = inject(PlatformStore);
  readonly router = inject(Router);
  mode = signal<'login' | 'register'>('login');
  busy = signal(false);
  error = signal('');
  name = '';
  email = '';
  password = '';
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
    try {
      await this.store.logout();
    } catch (e) {
      this.error.set(this.store.message(e));
    }
  }
}
