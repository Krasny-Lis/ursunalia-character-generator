import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';

/**
 * Public participant guide. Confirmed product process only; unpublished
 * rules, dates, venue, safety paperwork and payments are not invented.
 */
@Component({
  standalone: true,
  imports: [RouterLink, Icon],
  templateUrl: './player-guide.page.html',
  styleUrl: './player-guide.page.scss',
})
export class PlayerGuidePage {
  readonly topics = [
    { id: 'udzial', title: 'Jak wziąć udział?', description: 'Cztery etapy od konta do karty postaci.', icon: 'check' },
    { id: 'postac', title: 'Tworzenie postaci', description: 'Zgłoszenie, poprawki i decyzja MG.', icon: 'feather' },
    { id: 'stroje', title: 'Stroje i wyposażenie', description: 'Jak przygotować strój do świata Kisleva.', icon: 'shield' },
    { id: 'zasady', title: 'Zasady i mechaniki', description: 'Miejsce na oficjalne zasady gry.', icon: 'book' },
    { id: 'materialy', title: 'Materiały', description: 'Przydatne odnośniki i lektury.', icon: 'file' },
    { id: 'faq', title: 'FAQ', description: 'Krótkie odpowiedzi na pytania graczy.', icon: 'info' },
  ] as const;

  readonly steps = [
    { number: '01', title: 'Załóż konto', description: 'Podaj dane kontaktowe i ustal hasło. Facebook jest opcjonalny.' },
    { number: '02', title: 'Zgłoś postać', description: 'Przygotuj szkic i wyślij go do Mistrza Gry. Możesz otrzymać uwagi do poprawy.' },
    { number: '03', title: 'Opłać składkę', description: 'Dane przelewu otrzymasz po zaakceptowaniu postaci. Wpłatę oznacza organizator.' },
    { number: '04', title: 'Odbierz kartę', description: 'Po potwierdzeniu wpłaty i przygotowaniu dokumentu uzyskasz dostęp do Google Docs.' },
  ] as const;
}
