import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';
import { ParticipantViewStore } from './participant-view.store';

@Component({
  standalone: true,
  imports: [RouterLink, Icon],
  template: `
    <a class="back-link" routerLink="/moj-panel"><u-icon name="back"/> Mój panel</a>
    <header class="page-heading"><div><span class="eyebrow">URSUNALIA 2027 · ETAP 4</span>
      <h1>Karta postaci</h1>
      <p>Dokument Google Docs przypisany do zaakceptowanej i opłaconej postaci.</p></div></header>
    @if (!state.hasAccount()) {
      <section class="paper empty-state"><h2>Zaloguj się</h2>
        <p>Dokument jest dostępny wyłącznie dla uprawnionego uczestnika.</p>
        <a routerLink="/konto" class="button primary">Moje konto</a></section>
    } @else {
      @if (state.simulated()) {
        <div class="info-strip" role="note"><u-icon name="info"/>
          Wersja demonstracyjna. Status dokumentu i link są symulowane — nie udostępniają prawdziwego pliku.</div>
      }
      <section class="paper" style="max-width:880px; padding:clamp(24px,4vw,42px)">
        <span class="eyebrow">STATUS DOKUMENTU</span>
        <h2 style="color:var(--ink);margin:12px 0">{{ state.card().title }}</h2>
        <p>{{ state.card().detail }}</p>
        @if (state.simulated() && state.preview.canViewCard()) {
          <div class="info-strip"><u-icon name="check"/>
            Wszystkie warunki są spełnione w podglądzie. Prawdziwy link Google Docs będzie widoczny tutaj po integracji.</div>
        } @else {
          <div class="info-strip"><u-icon name="shield"/>
            Link do dokumentu nie jest teraz dostępny. Wymagana jest akceptacja postaci, potwierdzenie składki i status „Do sprawdzenia” lub „Gotowa”.</div>
        }
        <p>Ukrycie przycisku w serwisie nie zabezpiecza udostępnionego pliku. Organizator musi nadać odpowiednie uprawnienia w Google Docs.</p>
        <div class="actions"><a routerLink="/moj-panel" class="button light">Mój panel</a>
          <a routerLink="/skladka" class="button outline">Składka <u-icon name="next"/></a></div>
      </section>
    }
  `,
})
export class CharacterDocumentPage {
  readonly state = inject(ParticipantViewStore);
}
