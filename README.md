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
- `/#/konto` — konto, logowanie/rejestracja i własne archiwum tekstowe bez zdjęć.
- `/#/organizator/wydarzenia` — administracja wydarzeń, uczestników, grantów, blokad i zbiorczej archiwizacji.
- `/#/powiadomienia` — trwałe decyzje/komentarze MG i oznaczanie odczytu.

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

Przepływ postaci: **W edycji → Do weryfikacji → Zaakceptowana / Do poprawy / Odrzucona**. Jeden uczestnik ma jedną aktywną postać na wydarzenie. Gracz poprawia także odrzuconą postać; faktycznie zmieniony zapis podczas weryfikacji cofa ją do szkicu, zapis bez zmian zachowuje status. Zaakceptowaną postać może odblokować MG. Panel MG umożliwia edycję bez zmiany statusu, opcjonalne komentarze i historię decyzji. Zapis chronią rewizje; konflikty nie nadpisują lokalnej pracy. Bezstratna migracja, API, granice przypiętych schematów oraz test przepływu: [docs/CHARACTERS-AND-REVIEW.md](docs/CHARACTERS-AND-REVIEW.md).

Dodatkowe ankiety i oryginalne zgłoszenia pozostają zachowane przy migracji. Jawne późniejsze usunięcie postaci czyści także jej kopie wewnętrzne; archiwizacja usuwa zdjęcia, zachowując historyczny tekst. Formularz postaci jest teraz jednym żywym schematem na wydarzenie: ręczny zapis obejmuje wszystkie aktywne istniejące i nowe postacie, bez zmiany ich statusów. Destrukcja odpowiedzi wymaga aktualnej analizy i jawnego potwierdzenia; dostępny jest pełny eksport JSON. Kreator nie utrzymuje trwałego lokalnego szkicu i ostrzega przed opuszczeniem. Raport migracji, API i test przepływu: [docs/LIVE-CHARACTER-SCHEMA.md](docs/LIVE-CHARACTER-SCHEMA.md).

Etap 4 dopełnia MVP: pełna administracja wydarzeń, niezależne blokady kart, decyzje zbiorcze MG, trwałe powiadomienia i odrębne nieodwracalne usuwanie/tekstowe archiwum. Właściciel może wykorzystać archiwum na inne wydarzenie jako nowy szkic bez zdjęcia/akceptacji/historii MG. Nie istnieje przywracanie usuniętej lub archiwalnej karty. Raport, migracja 6, ryzyka WAL/backupów i instrukcja odbioru: [docs/MVP-STAGE-4.md](docs/MVP-STAGE-4.md).

Portret jest opcjonalny, JPG/PNG/WebP do 750 KB; całe żądanie ma limit 2 MB. Szkice postaci zapisuje przycisk „Zapisz szkic”. Przeglądarka ostrzega o niezapisanych zmianach; panel MG ostrzega również przy opuszczaniu widoku.

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

Robocze zmiany edytora pozostają w pamięci; „Zapisz formularz” zapisuje całą definicję z kontrolą rewizji. Na serwerze zarządzać schematem i eksportować pełną kopię może wyłącznie organizator danego wydarzenia. W demonstracji zatwierdzony zapis dotyczy tej przeglądarki.

## Weryfikacja

```bash
npm run verify
node scripts/validate-catalog.mjs
```

`verify` wykonuje build produkcyjny, testy komponentów Angular/Vitest i integracyjne testy rzeczywistego HTTP/SQLite. Testy obejmują wypełnianie formularza, podsumowanie, trwały zapis, migrację szkiców, edycję i wersjonowanie ankiet, izolację danych uczestników, decyzje organizatora, walidację i odrzucanie obcych źródeł żądań.

Etap postaci sprawdzono w Chromium z rzeczywistym API/SQLite oraz na szerokościach 1440, 390 i 320 px. Powtarzalny smoke: [docs/CHARACTERS-AND-REVIEW.md](docs/CHARACTERS-AND-REVIEW.md). Responsywne układy mają progi 700, 980, 1250 i 1650 px; przed wdrożeniem przejrzeć je również na rzeczywistych urządzeniach. Szczegóły wcześniejszego projektu: `docs/QA-v27.md`.

## Dane i migracja

Mechanizm migracji SQLite, preflight tylko do odczytu oraz procedura bezpiecznego backupu i odtwarzania: [docs/SQLITE-MIGRATIONS.md](docs/SQLITE-MIGRATIONS.md). Przed startem na istniejącej bazie wykonaj zweryfikowaną kopię i próbę odtworzenia. Serwer rozpoznaje v27.2 i stosuje migracje 1–6. Migracja 5 zachowuje oryginały postaci w osobnej tabeli źródeł oraz konta, sesje i dawne formularze/zgłoszenia; nie rozstrzyga utraty odpowiedzi lub konfliktów mapowania. Postacie otrzymują jeden aktualny schemat; edycje MG — odrębny rejestr metadanych. Kolejka i bezpośrednie odczyty/edycje MG pomijają szkice, także cofnięte po zmianach gracza. Migracja 6 nie zmienia istniejących danych; dodaje kontrolki, archiwum i powiadomienia. Dawne nieaktywne rekordy wymagają jawnej decyzji mapowania. Nierozpoznana baza lub nierozstrzygnięte mapowanie blokuje start. Nie uruchamiano migracji na rzeczywistym wdrożeniu.

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

### Baza dalszych prac

Royal Manuscript jest już bazą projektu: `feature/royal-manuscript-rebuild`. Kolejne zmiany wychodzą z niej i wracają do niej w PR, bez automatycznego merge. Historyczny skrypt `reconcile-rebuild.mjs` służył jednorazowemu przeniesieniu v27; nie jest procedurą aktualizacji istniejącej aplikacji lub SQLite.
