# Etap UI-3 – O wydarzeniu i Świat gry

Gałąź: `feature/ursunalia-event-and-world` bazuje na `feature/ursunalia-homepage-hub` (PR #10).
Ciąg zależności do przeglądu: PR #9 → #10 → #11. Żaden nie powinien być scalony bez akceptacji.

## Widok O wydarzeniu (`/o-wydarzeniu`)

- Fakt potwierdzony: **Ursunalia 2027, 22–24 kwietnia 2027**, w świecie gry: Krywulka/Ziemie Braci.
- Fizyczny adres, kwota składki, rachunek bankowy, godziny i kontakty nie są znane: **Do ogłoszenia**, bez wymyślonych danych.
- Sekcje: opis i kontekst, informacja w pigułce, dojazd i puste miejsce na Google Maps, program w przygotowaniu, FAQ, kontakt.
- Status przyjmowania postaci w server mode pochodzi z `registrationsOpen`. Brak pola lub demo = „Do ogłoszenia”.
- FAQ opisuje **docelowy** 4-etapowy proces: konto → postać → składka → dokument Google Docs. Nie udaje wdrożonego przepływu płatności.
- Brak nowych endpointów, formularzy ubezpieczeniowych, map fantasy lub niezatwierdzonych godzin.

## Widok Świat gry (`/swiat-gry`, `/swiat-gry/:slug`)

- Wyszukiwarka, pięć kategorii, czytelna lista bez miniaturek.
- Czytnik artykułów ze spisem treści opartym o fragmenty Angular Router (działa także w hash routing).
- Przykładowe treści z istniejących założeń świata znajdują się w `world-demo.data.ts` i **nie są publikowane**; na produkcji biblioteka ma pusty stan.
- W development mode można czytać cztery przykładowe artykuły o Kislevie, Krywulce, społeczeństwie i wierze.
- Piąty artykuł pokazuje symulację materiału dla „Organizatora”. Tylko do przeglądu UI. **Przełącznik deweloperski nie jest autoryzacją.**
- Docelowy CMS, publikacja, redakcja i bezpieczeństwo dostępu do dokumentów **wymagają backendu w późniejszym etapie**. Na tym etapie nie wyświetlamy niepublicznych prawdziwych materiałów.

## Odbiór

- Desktop 1440 px, tablet 980 px, mobile 390 i 320 px.
- Układ „O wydarzeniu” jest czytelny, FAQ rozwijane klawiaturą, mapa nie wskazuje niepotwierdzonego adresu.
- Biblioteka ma 5 filtrów kategorii, przyciski z `aria-pressed`, wyszukiwarkę i stan pusty.
- Czytnik działa przez `/#/swiat-gry/<slug>`; spis treści nawigacją fragmentów.
- „Organizator” pokazuje wyłącznie fikcyjny redakcyjny materiał demonstracyjny; zwykły gość go nie widzi.
- CI: `npm run build`, `npm test -- --watch=false`, `npm run test:server`, walidacja katalogu.

## Uruchomienie
```bash
git fetch origin
git switch feature/ursunalia-event-and-world
npm ci
npm start
```
Otwórz `http://localhost:4200`. Nie wdrażamy obecnie CMS ani serwerowych uprawnień do artykułów.
