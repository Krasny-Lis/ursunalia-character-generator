# Ursunalia 2027 — system zgłoszeń

Przebudowana aplikacja Angular, oparta na sześciu wizualizacjach Royal Manuscript: granatowe tło Kisleva, pergaminowe karty, złote obramowania i bordowe akcje. Wersja 27 zastępuje poprzednią powłokę, generator i edytor jednym systemem formularzy.

## Szybki start — demonstracja

Wymagany **Node.js 24 lub nowszy**.

```bash
npm ci
npm start
```

Otwórz `http://localhost:4200`. Dane pozostają w tej przeglądarce; w tym trybie nie ma wysyłki do organizatora. Pierwsze uruchomienie dodaje jedną kompletną przykładową postać — Alenę z Białej Doliny.

- `/` — wydarzenie, informacje i opublikowane ankiety.
- `/#/zgloszenie-postaci` — siedem sekcji ankiety postaci, walidacja i zapis szkicu.
- `/#/karta-postaci` — karta i podsumowanie, eksport JSON i druk.
- `/#/moje-postacie` — lista szkiców i zgłoszeń.
- `/#/organizator/ankiety` — ankiety i panel weryfikacji zgłoszeń.
- `/#/organizator/ankiety/edytor` — edytor sekcji i pytań, podgląd, import/eksport i publikacja.
- `/#/konto` — logowanie i rejestracja w trybie serwerowym.

## Pełny system — zapis na serwerze

```bash
npm ci
npm run build
cp .env.example .env
```

Uzupełnij w `.env` `ADMIN_EMAIL` oraz własne `ADMIN_PASSWORD` (12–128 znaków). Konto organizatora jest tworzone tylko przy pierwszym uruchomieniu dla nowego adresu. Następnie:

```bash
npm run server
```

Otwórz **http://localhost:3000**. Serwer podaje aplikację Angular oraz API na tym samym adresie. Zwykli uczestnicy rejestrują konta w aplikacji. Rola organizatora nigdy nie jest przyjmowana z żądania rejestracji.

SQLite przechowuje użytkowników, sesje, wersje ankiet, szkice, zgłoszenia i decyzje organizatora. Domyślna baza: `var/ursunalia.sqlite`. Hasła są haszowane przez scrypt. Sesje używają ciasteczek HttpOnly / SameSite=Strict; w produkcji również Secure. Serwer weryfikuje właściciela zgłoszenia, rolę organizatora, źródło żądań i kompletność odpowiedzi.

Wydarzenia, uczestnictwo i uprawnienia MG/organizatora są teraz trwałe i przypisane do konkretnego wydarzenia. Założenie konta nie zapisuje na wydarzenie; istniejąca akcja „Dołącz i wypełnij” wykonuje osobne dołączenie przed rozpoczęciem szkicu. Zamknięcie zapisów blokuje nowych uczestników, zachowując możliwość tworzenia i poprawiania zgłoszeń przez już zapisanych. API zarządzania wydarzeniami i grantami oraz zasady bezpiecznej migracji: [docs/EVENTS-AND-PERMISSIONS.md](docs/EVENTS-AND-PERMISSIONS.md).

Przepływ: **szkic → wysłane → zaakceptowane / do poprawy → ponownie wysłane**. Jeden uczestnik może mieć jedno zgłoszenie na ankietę. Nowe wersje formularza nie zmieniają ankiet już rozpoczętych. Portret jest opcjonalny, JPG/PNG/WebP do 750 KB; całe żądanie może mieć maksymalnie 2 MB. Szkice na serwerze zapisuje przycisk „Zapisz szkic”. Przed opuszczeniem strony przeglądarka ostrzega o niezapisanych zmianach.

### Produkcja

- Ustaw `NODE_ENV=production` i `APP_ORIGIN=https://twoja-domena.pl`.
- Uruchom Node 24 za reverse proxy z HTTPS; aplikacja i API muszą mieć tę samą domenę. Dla `npm run server` używaj builda z bazowym adresem `/`.
- Przechowuj `.env` poza repozytorium. Po utworzeniu konta organizatora możesz usunąć z konfiguracji `ADMIN_PASSWORD`.
- Zapewnij trwały dysk dla bazy; wykonuj kopie poleceniem SQLite `.backup` lub przy wyłączonym serwerze. Nie kopiuj samego pliku bazy podczas aktywnego trybu WAL.
- Ta wersja nie zawiera płatności, wysyłki e-maili ani odzyskiwania hasła przez e-mail. Nie została wdrożona na zewnętrzny serwer przez tę zmianę.

### GitHub Pages

Istniejący workflow na `main` nadal buduje statyczną **wersję demonstracyjną**. Pages nie uruchamia Node ani SQLite. Pełny system wymaga powyższego serwera. Służy temu odrębna konfiguracja `runtime-config.json`: statyczna strona jawnie deklaruje demo, a serwer zawsze podaje tryb `server`. Awaria API nie przełącza aplikacji po cichu na demo.

## Edytor ankiet

Obsługuje krótki i długi tekst, jeden i wiele wyborów, listę rozwijaną, skalę, datę, portret oraz blok informacyjny. Sekcje, pytania i odpowiedzi można przeciągać. Dla sekcji i pytań są również przyciski zmiany kolejności. Ankietę można zduplikować przez eksport/import, a pojedyncze pytania i sekcje przez ich przyciski. Panel dodawania na telefonie wysuwa się od dołu.

Szkic edytora zapisuje się lokalnie, publikacja jest osobną czynnością. Na serwerze publikować może wyłącznie organizator. W demonstracji publikacja dotyczy tej przeglądarki.

## Weryfikacja

```bash
npm run verify
node scripts/validate-catalog.mjs
```

`verify` wykonuje build produkcyjny, testy komponentów Angular/Vitest i integracyjne testy rzeczywistego HTTP/SQLite. Testy obejmują wypełnianie formularza, podsumowanie, trwały zapis, migrację szkiców, edycję i wersjonowanie ankiet, izolację danych uczestników, decyzje organizatora, walidację i odrzucanie obcych źródeł żądań.

Nie wykonano wizualnej kontroli w przeglądarce. Responsywne układy przygotowano dla szerokości od 320 px, z progami 700, 980, 1250 i 1650 px; przed wdrożeniem należy przejrzeć je na rzeczywistych urządzeniach. Szczegóły: `docs/QA-v27.md`.

## Dane i migracja

Mechanizm migracji SQLite, preflight tylko do odczytu oraz procedura bezpiecznego backupu i odtwarzania: [docs/SQLITE-MIGRATIONS.md](docs/SQLITE-MIGRATIONS.md). Przed startem nowej wersji na istniejącej bazie wykonaj zweryfikowaną kopię i próbę odtworzenia. Serwer rozpoznaje schemat v27.2 i dodaje rejestr migracji bez przepisywania kont, sesji ani zgłoszeń; nieznana lub niespójna baza blokuje start.

- `public/data/platform.json` — wydarzenie, startowe ankiety i fikcyjny przykład. Katalogi z poprzedniej wersji pozostają w `public/data/`.
- `shared/validation.mjs` — wspólna walidacja przeglądarki i serwera.
- `src/app/platform/` — nowy interfejs i logika stanu.
- `server/` — samodzielne API bez dodatkowych zależności wykonawczych.
- Pierwszy start demo importuje wcześniejsze postacie z klucza sesji v1, pozostawiając oryginał.
- Edytor potrafi importować wcześniejszy eksport ankiety ze schematem v1 (v25/v26), nie usuwa starych danych.
- Konta rzeczywistych uczestników nie otrzymują automatycznie fikcyjnej Aleny ani lokalnych szkiców demonstracyjnych.

Szczegóły projektu i zasobów: `docs/DESIGN-v27.md`. Stare ekrany i nakładające się style usunięto z aktywnego kodu; ich poprzednie wersje pozostają w historii Git.

## Korekta wyglądu v27.1 (12.10.2026)

Po zestawieniu w Chrome/Playwright gotowego buildu z sześcioma makietami poprawiono nagłówek kreatora, numer sekcji, papier, kontrast tła oraz mobilną nawigację. Zestaw testów, ograniczenia środowiska i dokładny status GitHub opisuje `docs/QA-v27.1.md`. Oryginalna struktura siedmiu sekcji pozostała bez zmian.

### Przeniesienie całej przebudowy do GitHub

**Uwaga:** ta paczka ma być traktowana jako pełny snapshot, nie nakładka plików. Przykładowe polecenia w nowym, czystym katalogu (Node.js 24.15+):

```bash
git clone --branch feature/platform-foundation-v24 https://github.com/Krasny-Lis/ursunalia-character-generator.git
cd ursunalia-character-generator
git switch -c feature/royal-manuscript-rebuild
node /SCIEZKA/DO/ROZPAKOWANEGO/ursunalia-v27/scripts/reconcile-rebuild.mjs .
node /SCIEZKA/DO/ROZPAKOWANEGO/ursunalia-v27/scripts/reconcile-rebuild.mjs . --apply
npm ci
npm run verify
node scripts/validate-catalog.mjs
git add -A
git commit -m "feat: rebuild Ursunalia application with Royal Manuscript UI"
git push -u origin feature/royal-manuscript-rebuild
```

Pierwsze wywołanie skryptu jest bezpiecznym podglądem. Drugie kopiuje nowe pliki i usuwa **wyłącznie śledzone przez Git** starsze pliki, których brakuje w ZIP-ie. Skrypt wymaga czystego repozytorium oraz właściwej gałęzi, nie dotyka katalogu `.git`. Po wypchnięciu gałęzi utwórz PR do `feature/platform-foundation-v24` i pozostaw go bez mergowania. `dist/` jest ignorowane przez Git; paczka ZIP nadal je zawiera i można uruchomić z niej serwer przed przebudową.
