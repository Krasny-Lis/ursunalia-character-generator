import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { PlatformStore } from './platform.store';
import { Icon } from './icon';
import { statusLabel } from './models';
@Component({
  standalone: true,
  imports: [RouterLink, Icon, DatePipe],
  template: ` <a class="back-link" routerLink="/"><u-icon name="back" />Wydarzenie</a>
    <section class="page-heading">
      <div>
        <span class="eyebrow">TWOJE OPOWIEŚCI</span>
        <h1>Moje zgłoszenia</h1>
        <p>Szkice, gotowe postacie i odpowiedzi organizatora.</p>
      </div>
      <a class="button primary" routerLink="/">Wypełnij ankietę<u-icon name="plus" /></a>
    </section>
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
  open(id: string) {
    this.store.open(id);
    void this.router.navigate(['/karta-postaci']);
  }
  readonly status = statusLabel;
}
