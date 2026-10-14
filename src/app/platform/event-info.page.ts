import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';
import { PlatformStore } from './platform.store';

/** Public facts, with no invented venue, fees, schedule or contact details. */
@Component({
  standalone: true,
  imports: [RouterLink, Icon],
  templateUrl: './event-info.page.html',
  styleUrl: './event-info.page.scss',
})
export class EventInfoPage {
  readonly store = inject(PlatformStore);

  readonly event = computed(() =>
    this.store.mode() === 'server'
      ? this.store.events().find(item => item.id === 'ursunalia-2027') ?? null
      : this.store.seed()?.event ?? null,
  );
  readonly date = computed(() => this.event()?.date || '22–24 kwietnia 2027');
  readonly registrationStatus = computed(() => {
    if (this.store.mode() !== 'server' || this.event()?.registrationsOpen === undefined) return 'Do ogłoszenia';
    return this.event()?.registrationsOpen ? 'Otwarte' : 'Zamknięte';
  });

  readonly faq = [
    {
      question: 'Czy utworzenie konta gwarantuje udział w LARP-ie?',
      answer: 'Nie. Konto pozwala przygotować zgłoszenie postaci. Zgłoszenie musi jeszcze zostać rozpatrzone przez Mistrza Gry.',
    },
    {
      question: 'Jak wygląda zgłoszenie postaci?',
      answer: 'Po założeniu konta przygotowujesz jedną aktywną postać na Ursunalia 2027. Możesz zapisać szkic, wysłać go do MG, otrzymać uwagi i wprowadzić poprawki.',
    },
    {
      question: 'Kiedy otrzymam dane do wpłaty składki?',
      answer: 'Zgodnie z docelowym procesem będą dostępne po akceptacji postaci przez MG. Wpłatę potwierdzi organizator. Kwota, termin i rachunek nie zostały jeszcze ogłoszone.',
    },
    {
      question: 'Kiedy uzyskam dostęp do karty postaci?',
      answer: 'Po potwierdzeniu wpłaty i udostępnieniu przez organizatora dokumentu o statusie „Do sprawdzenia” lub „Gotowa”. Karta będzie udostępniana linkiem do Google Docs.',
    },
    {
      question: 'Gdzie dokładnie odbędzie się wydarzenie?',
      answer: 'Krywulka to miejscowość w świecie gry. Rzeczywisty adres terenu, informacje o dojeździe i mapa Google zostaną opublikowane przez organizatorów.',
    },
  ];
}
