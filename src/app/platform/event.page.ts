import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PlatformStore } from './platform.store';
import { FormDefinition } from './models';
import { Icon } from './icon';
@Component({
  standalone: true,
  imports: [RouterLink, Icon],
  template: `
    <div class="eyebrow page-eyebrow">LARP FANTASY · KISLEV · 2027</div>
    <section class="event-hero">
      <div>
        <span class="status-tag"
          ><span class="status-dot"></span>{{ store.seed()!.event.status }}</span
        >
        <h1>Ursunalia <span>2027</span></h1>
        <h2>Nowe początki.<br />Stare długi.</h2>
        <p class="hero-description">{{ store.seed()!.event.description }}</p>
        <div class="event-meta">
          <span><u-icon name="calendar" />22–24 kwietnia 2027</span
          ><span><u-icon name="pin" />Krywulka · Ziemie Braci</span>
        </div>
        <div class="actions">
          <a class="button primary" href="#ankiety" (click)="scroll($event)"
            >Zobacz ankiety <u-icon name="next" /></a
          ><a class="button outline" routerLink="/moje-postacie">Moje zgłoszenia</a>
        </div>
      </div>
      <div class="hero-emblem" aria-hidden="true">
        <span>✦</span><small>ZA NAMI PRZESZŁOŚĆ<br />PRZED NAMI HISTORIA</small>
      </div>
    </section>
    <div class="info-strip">
      <u-icon name="info" /><span>
        @if (store.mode() === 'demo') {
          Wersja demonstracyjna. Szkice zapisują się w tej przeglądarce. Wysyłanie do organizatora
          wymaga serwera.
        } @else {
          Twoje zgłoszenia są widoczne tylko dla Ciebie i organizatorów wydarzenia.
        }
      </span>
    </div>
    <section id="ankiety" class="event-surveys">
      <div class="section-title">
        <div>
          <span class="eyebrow">TWOJA HISTORIA ZACZYNA SIĘ TUTAJ</span>
          <h2>Ankiety organizatora</h2>
        </div>
        <span>{{ store.forms().length }} dostępne ankiety</span>
      </div>
      <div class="survey-cards">
        @for (form of store.forms(); track form.id) {
          <article class="paper survey-card">
            <span class="wax-icon"><u-icon [name]="$first ? 'feather' : 'calendar'" /></span
            ><span class="eyebrow">{{
              $first ? 'POSTAĆ I FABUŁA' : 'ORGANIZACJA WYDARZENIA'
            }}</span>
            <h3>{{ form.title }}</h3>
            <p>{{ form.description }}</p>
            <div class="ornament">✧</div>
            <div class="card-meta">
              <span>{{ form.sections.length }} sekcji</span><span>Wersja {{ form.revision }}</span>
            </div>
            <button class="button primary" (click)="start(form)">
              {{ hasApplication(form.id) ? 'Kontynuuj ankietę' : 'Wypełnij ankietę'
              }}<u-icon name="next" />
            </button>
          </article>
        }
      </div>
    </section>
    <div class="event-bottom">
      <section class="paper">
        <span class="eyebrow">O WYDARZENIU</span>
        <h2>Witaj na Ziemiach Braci</h2>
        <p>
          Budzenie Niedźwiedzi gromadzi mieszkańców i przyjezdnych w Krywulce. Pod cieniem
          północnych fortów spotykają się różne kultury, wyznania i interesy. Twoja postać stanie
          się częścią tej opowieści.
        </p>
        <p>
          Wybierz pochodzenie i zajęcie. Nadaj postaci cel, relacje oraz zobowiązania. Odpowiedzi
          pomogą organizatorom przygotować Twoje wątki.
        </p>
      </section>
      <section class="paper">
        <span class="eyebrow">PRZED ZGŁOSZENIEM</span>
        <h3>Warto wiedzieć</h3>
        <ul class="plain-list">
          <li><u-icon name="check" />Postacie należą do kultur Kisleva.</li>
          <li><u-icon name="check" />Szkic możesz zapisać i dokończyć później.</li>
          <li><u-icon name="check" />Zgłoszenie sprawdza organizator.</li>
          <li><u-icon name="pin" />{{ store.seed()!.event.locationNote }}</li>
        </ul>
        <details>
          <summary>Informacje organizatora</summary>
          <p>
            Termin: 22–24.04.2027. Wypełnienie ankiety zgłasza postać do rozpatrzenia. Nie jest
            potwierdzeniem przyjęcia ani opłacenia udziału. Szczegółowy regulamin, adres i
            informacje o biletach organizator przekaże osobno.
          </p>
        </details>
      </section>
    </div>
  `,
})
export class EventPage {
  readonly store = inject(PlatformStore);
  readonly router = inject(Router);
  hasApplication(id: string) {
    return this.store.applications().some((a) => a.form.id === id && a.id !== 'demo-alena');
  }
  start(form: FormDefinition) {
    const id = this.store.start(form);
    void this.router.navigate(
      [id ? '/zgloszenie-postaci' : '/konto'],
      id ? { queryParams: { id } } : {},
    );
  }
  scroll(e: Event) {
    e.preventDefault();
    document.getElementById('ankiety')?.scrollIntoView({ behavior: 'smooth' });
  }
}
