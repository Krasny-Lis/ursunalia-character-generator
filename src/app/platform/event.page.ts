import { Component, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlatformStore } from './platform.store';
import { FormDefinition } from './models';
import { Icon } from './icon';
@Component({
  standalone: true,
  imports: [RouterLink, Icon],
  template: `
    @if (event(); as currentEvent) {
    <div class="eyebrow page-eyebrow">LARP FANTASY · KISLEV · 2027</div>
    <section class="event-hero">
      <div>
        <span class="status-tag"
          ><span class="status-dot"></span>{{ currentEvent.status }}</span
        >
        <h1>
          @if (currentEvent.name === 'Ursunalia 2027') {Ursunalia <span>2027</span>}
          @else { {{ currentEvent.name }} }
        </h1>
        <h2>
          @if (currentEvent.subtitle === 'Nowe początki. Stare długi.') {Nowe początki.<br />Stare długi.}
          @else { {{ currentEvent.subtitle }} }
        </h2>
        <p class="hero-description">{{ currentEvent.description }}</p>
        <div class="event-meta">
          <span><u-icon name="calendar" />{{ currentEvent.date }}</span
          ><span><u-icon name="pin" />{{ currentEvent.location }}</span>
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
        <span>{{ forms().length }} dostępne ankiety</span>
      </div>
      <div class="survey-cards">
        @for (form of forms(); track form.id) {
          <article class="paper survey-card">
            <span class="wax-icon"><u-icon [name]="store.isCharacter(form) ? 'feather' : 'calendar'" /></span
            ><span class="eyebrow">{{
              store.isCharacter(form) ? 'POSTAĆ I FABUŁA' : 'ANKIETA DODATKOWA'
            }}</span>
            <h3>{{ form.title }}</h3>
            <p>{{ form.description }}</p>
            <div class="ornament">✧</div>
            <div class="card-meta">
              <span>{{ form.sections.length }} sekcji</span><span>Wersja {{ form.revision }}</span>
            </div>
            <button class="button primary" (click)="start(form)" [disabled]="store.busy()">
              {{ hasApplication(form.id) ? 'Kontynuuj ankietę' : !store.isMember(form.eventId) ? 'Dołącz i wypełnij' : 'Wypełnij ankietę'
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
          <li><u-icon name="pin" />{{ currentEvent.locationNote }}</li>
        </ul>
        <details>
          <summary>Informacje organizatora</summary>
          <p>
            Termin: {{ currentEvent.date }}. Wypełnienie ankiety zgłasza postać do rozpatrzenia. Nie jest
            potwierdzeniem przyjęcia ani opłacenia udziału. Szczegółowy regulamin, adres i
            informacje o biletach organizator przekaże osobno.
          </p>
        </details>
      </section>
    </div>
    } @else {
      <section class="paper empty-state"><h1>Wydarzenie niedostępne</h1><p>Sprawdź adres wydarzenia lub zaloguj się.</p></section>
    }
  `,
})
export class EventPage {
  readonly store = inject(PlatformStore);
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly event = computed(() => {
    const id = this.params().get('id') ?? this.store.seed()?.event.id;
    if (this.store.mode() === 'demo') return this.store.seed()?.event.id === id ? this.store.seed()!.event : null;
    return this.store.events().find(event => event.id === id) ?? null;
  });
  readonly forms = computed(() => this.store.forms().filter(form => form.eventId === this.event()?.id));
  hasApplication(id: string) {
    return this.store.applications().some((a) => a.form.id === id && a.id !== 'demo-alena');
  }
  async start(form: FormDefinition) {
    if (this.store.busy()) return;
    this.store.busy.set(true);
    try {
      if (this.store.user()) await this.store.joinEvent(form.eventId);
      const id = this.store.start(form);
      await this.router.navigate([id ? '/zgloszenie-postaci' : '/konto'], id ? { queryParams: { id } } : {});
    } catch (error) {
      this.store.notice.set(this.store.message(error));
    } finally { this.store.busy.set(false); }
  }
  scroll(e: Event) {
    e.preventDefault();
    document.getElementById('ankiety')?.scrollIntoView({ behavior: 'smooth' });
  }
}
