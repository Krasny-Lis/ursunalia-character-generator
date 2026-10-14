import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';
import { ParticipantViewStore } from './participant-view.store';

@Component({
  standalone: true,
  imports: [RouterLink, Icon],
  template: `
    <a class="back-link" routerLink="/moj-panel"><u-icon name="back"/> Mój panel</a>
    <header class="page-heading"><div><span class="eyebrow">URSUNALIA 2027 · ETAP 3</span>
      <h1>Składka</h1><p>Informacje o wpłacie pojawią się po akceptacji postaci przez MG.</p></div></header>
    @if (!state.hasAccount()) {
      <section class="paper empty-state"><h2>Zaloguj się</h2>
        <p>Składka jest przypisana do uczestnika i jego postaci.</p>
        <a routerLink="/konto" class="button primary">Moje konto</a></section>
    } @else {
      @if (state.simulated()) {
        <div class="info-strip" role="note"><u-icon name="info"/>
          Symulacja statusu składki — nie ma prawdziwej wpłaty ani rachunku bankowego.</div>
      }
      <section class="paper" style="max-width:880px; padding:clamp(24px,4vw,42px)">
        <span class="eyebrow">STATUS SKŁADKI</span>
        <h2 style="color:var(--ink);margin:12px 0">{{ state.payment().title }}</h2>
        <p>{{ state.payment().detail }}</p>
        @if (state.accepted()) {
          <div class="info-strip"><u-icon name="info"/>
            Dane przelewu: numer rachunku, odbiorca, kwota, tytuł i termin — do udostępnienia przez organizatora po wdrożeniu obsługi składek.</div>
          <p>Wpłatę potwierdza organizator. Nie trzeba zgłaszać przelewu w serwisie.</p>
        } @else {
          <p>Dane do wpłaty są niedostępne, dopóki MG nie zaakceptuje postaci.</p>
        }
        <div class="actions"><a routerLink="/moja-postac" class="button light">Moja postać</a>
          <a routerLink="/dokument-postaci" class="button outline">Karta postaci <u-icon name="next"/></a></div>
      </section>
    }
  `,
})
export class PaymentPage {
  readonly state = inject(ParticipantViewStore);
}
