# Etap 2 — postacie i weryfikacja MG

Baza: `feature/royal-manuscript-rebuild`. Istniejący Angular 22, Node.js 24, SQLite, renderer, walidacja, sesje i granty wydarzeń. Jeden PR obejmuje migrację, API, istniejące ekrany i testy. Nie wdraża żywego schematu, eksportu zbiorczego, powiadomień, usuwania/przywracania ani archiwum. Nie uruchamia migracji na produkcji.

Ten dokument zachowuje kontrakt Etapu 2. Aktualny Etap 3 zastępuje przypięte schematy jednym bieżącym formularzem i dodaje ręczny kreator oraz pełny eksport; zasady migracji i aktualne API: [LIVE-CHARACTER-SCHEMA.md](LIVE-CHARACTER-SCHEMA.md). Model statusów, historia decyzji i odrębny rejestr edycji pozostają.

**Etap 4:** niewysłane szkice są ukryte także w GET/PATCH recenzenta przez ID. Działają niezależne blokady, powiadomienia, decyzje zbiorcze, nieodwracalne usuwanie i oddzielne archiwum bez zdjęć. Historyczny zakres Etapu 2 poniżej nie wyklucza aktualnych funkcji. Usunięcie nie pozwala na przywrócenie; ochrona źródeł migracji nie jest wyjątkiem od późniejszego żądania usunięcia treści/zdjęć. Aktualne zasady: [MVP-STAGE-4.md](MVP-STAGE-4.md).

## Model i zapis

Migracja **3 — `characters_review_v1`** dodaje:

| Struktura | Znaczenie |
|---|---|
| `event_character_forms` | Jeden jawnie wskazany formularz postaci na wydarzenie; FK do istniejącej rewizji formularza |
| `characters` | Właściciel, wydarzenie, przypięty formularz, JSON odpowiedzi, pięć statusów, rewizja, daty, ostatni komentarz i pochodzenie `legacy_application_id` |
| `one_active_character` | Częściowy UNIQUE `(user_id,event_id) WHERE deleted_at IS NULL`; egzekwuje limit także przy konkurencyjnym tworzeniu |
| `character_decisions` | Aktor i nazwa z chwili decyzji, czas UTC, poprzedni/docelowy status, opcjonalny komentarz, akcja decyzji/odblokowania i rewizja postaci |

Migracja **4 — `character_edits_v1`** dodaje osobną tabelę `character_edits`: ID wpisu, ID autora (FK do konta), ID postaci, czas UTC i rewizja po zmianie. Bez kopii imienia/e-maila, odpowiedzi, portretu, komentarza lub statusu decyzji. Wyświetlana nazwa autora pochodzi z bieżącego konta; trwałą tożsamością pozostaje jego ID. Rzeczywista edycja MG i wpis rejestru są atomowe. Brak zmian, zapis gracza, błąd walidacji, autoryzacji albo rewizji nie tworzą wpisu. API właściciela/uprawnionego MG udostępnia osobne `editHistory`, a istniejąca karta historii pokazuje edycje oddzielnie od decyzji. Nie odtwarzamy fikcyjnych dawnych edycji.

`deleted_at` to podstawa indeksu limitu aktywnych postaci. W Etapie 2 wszystkie utworzone/migrowane rekordy miały NULL. Od Etapu 4 usuwanie/archiwizacja ustawiają datę wycofania, czyszczą aktywne odpowiedzi i zwalniają limit; przywracania nie ma. FK `(event_id,user_id)` wymaga uczestnictwa; grant MG nie jest uczestnictwem.

Zapis istniejącej postaci, wysyłka, decyzja, edycja MG i odblokowanie wymagają całkowitego `expectedRevision >= 1`; nowa postać — `expectedRevision: 0`. Brak rewizji → 400, nieaktualna → 409 bez zapisu. Faktyczna zmiana zwiększa rewizję. Identyczny zapis nie zmienia rewizji, statusu ani daty. Kolejność kluczy JSON i opcji multiselectu jest nieistotna; zmiany tekstu są rzeczywistymi zmianami. Konflikt pozostawia lokalną pracę w pamięci, dostępną również przez dotychczasowy eksport szkicu/rekordu. Nie ma automatycznego scalania konfliktów.

Szkice mogą być niekompletne i mieć krótkie odpowiedzi. Podane wartości nadal podlegają walidacji typu, limitów maksymalnych, opcji, dat i portretu. Wysyłka i **każda nowa akceptacja**, także powtórna, sprawdzają pełną wymagalność; niepowodzenie → 422 z `issues`, bez zmiany statusu, rewizji lub historii.

**Granica żywego schematu:** postać zachowuje konkretną rewizję formularza. Wysyłka/akceptacja w tym etapie waliduje **jej przypięty, zaufany schemat z SQLite**. Publikacja nowszej rewizji zmienia formularz nowych postaci bez przepisywania wcześniejszych odpowiedzi/statusów. Przepięcie istniejących postaci na żywy schemat wymaga następnego etapu i przeglądu różnic. Podmiana `form.revision` w żądaniu gracza zwraca 409.

## Przejścia i historia

| Operacja | Stan wejściowy | Wynik |
|---|---|---|
| Gracz zapisuje szkic/poprawki | `draft`, `changes`, `rejected` | Ten sam status; zmienione odpowiedzi i rewizja |
| Gracz otwiera lub zapisuje bez zmian | `submitted` | Nadal `submitted`; bez nowej rewizji |
| Gracz zapisuje rzeczywiste zmiany | `submitted` | `draft`; poprzednia data wysłania zachowana jako dane historyczne |
| Gracz wysyła poprawną postać | `draft`, `changes`, `rejected` | `submitted`, nowa data wysłania i rewizja |
| Gracz edytuje/wysyła | `accepted` | 409; potrzebne odblokowanie MG |
| MG podejmuje decyzję | Każdy stan poza `draft` | `accepted`, `changes` albo `rejected`; komentarz opcjonalny |
| MG zapisuje odpowiedzi | Każdy stan poza prywatnym `draft` (aktualizacja Etapu 4) | Status bez zmian; niekompletność dopuszczalna jak w szkicu |
| MG odblokowuje | Wyłącznie `accepted` | `changes`, jawna historia `action=unlock` |

Decyzja/odblokowanie zapisuje status, komentarz, datę, rewizję i historię w jednej transakcji `BEGIN IMMEDIATE`. Błąd historii cofa całość. Historia jest widoczna właścicielowi i MG/organizatorowi tego wydarzenia. Edycja odpowiedzi MG nie udaje nowej decyzji. Nie ma prywatnych notatek ani fikcyjnie odtworzonych dawnych aktorów.

## Migracja i raport

Migracje 1/2 i ich checksum pozostają niezmienne. Migracja 3 nie aktualizuje ani nie usuwa rekordów `users`, `sessions`, `forms`, `applications`. Wykorzystuje transakcję, preflight i kontrolę końcową istniejącego runnera. Awaria cofa nowe tabele, backfill i wpis wersji 3; wcześniejsze wersje pozostają zachowane.

Jawne mapowanie dostarczonego v27.2:

- `character-2027` na `ursunalia-2027`: kopia 1:1 do `characters`, z ID, właścicielem, **dokładnym JSON**, przypiętą rewizją, statusem, datami i feedbackiem. Bez `cleanAnswers`, usuwania nieznanych pól lub starych opcji. Zastana nieprawidłowa zaakceptowana postać zachowuje status; jej nowa akceptacja już wymaga poprawności.
- `logistics-2027` na `ursunalia-2027`: pozostaje w `applications`, dostępna właścicielowi w istniejących ekranach i uprawnionemu recenzentowi przez dawne API ankiet. Nie liczy się do limitu postaci.
- Inne formularze z odpowiedziami: `CHARACTER_MAPPING_REQUIRED` blokuje migrację. Potencjalne wielokrotne postacie użytkownika na wydarzenie dodatkowo otrzymują `CHARACTER_MAPPING_CONFLICT`. Nie wybieramy zwycięzcy, nie łączymy JSON i nie usuwamy rekordów.

`node server/preflight.mjs /SCIEZKA/DO/KOPII.sqlite` otwiera bazę tylko do odczytu. Dla wersji sprzed 3 raport `characterMapping` zawiera ID/rewizje wszystkich formularzy, event ID, liczby postaci/ankiet, nierozpoznane ID zgłoszeń i zestawy potencjalnie konfliktowych ID. `preservedAnswerWarnings` wskazuje ID nieznanych i nieprawidłowych/brakujących pól, bez odpowiedzi. Niekompletność szkicu nie blokuje bezstratnego kopiowania. Raport nie zawiera haseł, tokenów, e-maili ani treści odpowiedzi; metadane rzeczywistego wdrożenia przechowywać prywatnie, poza publicznym PR.

Po migracji preflight sprawdza mapping formularz/event, proweniencję skopiowanych postaci i brak pominiętych legacy postaci. Restart nie kopiuje danych ponownie. Oryginały skopiowanych postaci pozostają historyczne: dawne endpointy nie mogą ich edytować, wysyłać ani recenzować. Nowych postaci również nie można zapisać przez `/api/applications`. Zwykła edycja nowej postaci zachowuje nieznane zastane odpowiedzi, bez możliwości ich nadpisania poza przypiętym formularzem.

### Bezpieczne wdrożenie

1. Zatrzymać zapisy, wykonać spójną kopię i próbę odtworzenia według [SQLITE-MIGRATIONS.md](SQLITE-MIGRATIONS.md). Nie kopiować samego pliku aktywnej bazy w WAL.
2. Uruchomić preflight nowego kodu na **kopii**. Sprawdzić mapping, liczby i ostrzeżenia. Znany mapping seed wymaga potwierdzenia zgodności z rzeczywistym wdrożeniem przed uruchomieniem migracji na nim.
3. Przy nierozpoznanych ankietach/kolizjach zachować oryginały i przedstawić raport właścicielowi. Właściciel wskazuje znaczenie ankiet, aktywny rekord i sposób zachowania pozostałych. Następnie potrzebny jest osobno przejrzany adapter/mapping i test na kopii. Nie poprawiać produkcji ręcznie, nie wybierać najnowszego rekordu, nie usuwać rejestru ani nie nadpisywać checksum. Ten PR nie dostarcza uniwersalnego importu ani rozstrzygania konfliktów.
4. Na izolowanej kopii uruchomić zgodny frontend/backend, porównać oryginalne cztery tabele, postacie, ankiety i sesje; powtórzyć start oraz przepływ recenzji. Dopiero po przeglądzie wdrożyć w oknie serwisowym.
5. Zachować backup. Stary kod nie obsługuje wersji 4. Po nowych zapisach preferować poprawkę naprzód; odtworzenie wcześniejszego backupu straciłoby późniejsze odpowiedzi/decyzje i rejestr edycji. Migracja 4 dodaje wyłącznie nową pustą tabelę, zachowuje wszystkie wcześniejsze dane i wpisy migracji 1–3; restart nie dopisuje historii. Preflight kontroluje również rewizje rejestru edycji.

Nie odczytano rzeczywistej bazy produkcyjnej — liczba rzeczywistych konfliktów jest nieznana. Fixture z dwoma kandydatami blokuje start i zachowuje oba oryginały. Ryzyko bezpośredniej utraty danych przez migrację jest małe dzięki kopiowaniu bez transformacji i rollbackowi; ryzyka operacyjne to blokada startu, czas blokady zapisów i błędne odtwarzanie backupu.

## API i uprawnienia

Mutacje wymagają sesji, właściwego Origin i JSON. Event, formularz, właściciel i role pochodzą z SQLite. Cookie, hashowanie, rozmiar żądania i granty pozostają aktywne. Publiczny bootstrap nie zawiera postaci. Kolejka MG pomija wszystkie `draft`, także zgłoszenia cofnięte wskutek zapisu zmian przez gracza. Filtr `status=draft` zwraca pustą listę; wyszukiwanie nie ujawnia szkiców. Po ponownym poprawnym wysłaniu postać wraca do kolejki. Właściciel nadal widzi swój szkic; dostęp MG przez ID do `draft` od Etapu 4 zwraca 404 także przy grancie, a decyzja dotycząca szkicu jest zabroniona. Przekazanie obcego event ID nie obchodzi grantu. Odebranie praw działa przy kolejnym żądaniu i restarcie.

| Endpoint | Kontrakt |
|---|---|
| `GET /api/bootstrap` | Nowe własne `characters` i `characterForms` widocznych wydarzeń; `applications` zawiera pozostałe ankiety, bez duplikatów postaci |
| `PUT /api/events/:id/character-form` | Organizer eventu; `{formId,formRevision}` najnowszej opublikowanej definicji tego eventu. Zmiana ID przy istniejących postaciach lub legacy odpowiedziach wymaga osobnej migracji → 409 |
| `POST /api/characters` | Własny szkic: `{id,form:{id,revision},answers,expectedRevision}`. Nowe ID `application-UUID`, rewizja 0; stare ID zachowane przez migrację |
| `GET /api/characters/:id` | Tylko właściciel, z historią; cudzy rekord → 404 |
| `POST /api/characters/:id/submit` | Właściciel i uczestnictwo; `{expectedRevision}`; pełna walidacja |
| `GET /api/organizer/characters` | Tylko eventy z grantem MG/organizatora, bez szkiców. Opcjonalne `eventId`, `status`, `q` (gracz/e-mail/imię/nazwisko postaci); brak grantów → 403 |
| `GET /api/organizer/characters/:id` | MG/organizer eventu; wysłana postać (bez draft), właściciel i historia |
| `PATCH /api/organizer/characters/:id` | MG/organizer; `{answers,expectedRevision}`; status bez zmian, rzeczywista edycja atomowo zapisuje `editHistory` |
| `POST /api/organizer/characters/:id/decision` | MG/organizer; `{status,feedback?,expectedRevision}` |
| `POST /api/organizer/characters/:id/unlock` | MG/organizer; `{feedback?,expectedRevision}`; tylko accepted |

## Istniejące ekrany

Style, zasoby i responsywny layout Royal Manuscript nie zmieniają się. Ekran wydarzenia rozpoznaje postać przez mapping zamiast pozycji na liście. Ankiety dodatkowe są oznaczone osobno. Organizer wskazuje formularz przyciskiem na istniejącej karcie; API blokuje zmianę wymagającą migracji.

Formularz gracza, podsumowanie i lista korzystają z nowego źródła, pięciu nazw statusów i historii. Zaakceptowane pola i oba przyciski zapisu są zablokowane. Panel MG wykorzystuje obecną listę, wyszukiwanie/filtry i `FieldControl`. Podczas edycji odpowiedzi decyzje są wyłączone do zapisu/anulowania. 409 zachowuje lokalną pracę. Panel MG ostrzega przy opuszczeniu, przełączeniu rekordu i `beforeunload`; nie dodano interfejsu scalania konfliktów.

## Weryfikacja

```bash
npm ci
npm run verify
node scripts/validate-catalog.mjs
```

Backend używa baz `:memory:` lub losowych katalogów tmp. Testy obejmują nową/legacy/v2 bazę, dokładny JSON i stare sesje, raport bez sekretów, konflikty mappingu, restart, rollback DDL/backfillu/historii, unikalność, konkurencyjne żądania, pięć statusów, no-op z odwróceniem multiselectu, edycję MG, walidację nowej akceptacji, izolację eventów i blokadę starego API. Testy Angulara sprawdzają kontrolki, rewizje, zachowanie pracy przy 409, historię i odblokowanie.

Opcjonalny smoke rzeczywistej przeglądarki wymaga builda, Chromium i `playwright-core`; instalacja może być poza repozytorium, bez zmiany zależności aplikacji:

```bash
npm run build
npm install --prefix /tmp/ursunalia-browser --no-save --no-audit --no-fund playwright-core
PLAYWRIGHT_MODULE=/tmp/ursunalia-browser/node_modules/playwright-core/index.mjs \
CHROMIUM_PATH=/usr/bin/chromium node scripts/smoke-characters.mjs
```

Skrypt sam tworzy/usuwa testową bazę, uruchamia serwer `127.0.0.1:31847` (zmiana przez `SMOKE_PORT`) i dwie osobne sesje Chromium. Nie przyjmuje ścieżki do rzeczywistej bazy. Konta/hasła są wyłącznie fikcyjną fixture. Sprawdza trwały szkic → submit → no-op → zmiana/cofnięcie → submit → odrzucenie bez komentarza → poprawa → submit → edycja MG → akceptacja → blokada gracza → odblokowanie → poprawa → submit → akceptacja i historię. Długie początkowe odpowiedzi przygotowuje przez autoryzowane API; późniejsze operacje wykonuje przez Angular. Kontroluje overflow przy 1440/390/320 px i błędy JS. `SMOKE_SCREENSHOTS=/tmp` opcjonalnie zapisuje zrzuty fikcyjnych danych.

Do ręcznego przeglądu: powtórzyć ten przepływ na testowej bazie, spróbować obcego eventu i równoczesnych zmian z dwóch kart; porównać historię gracza/MG. Nie wykonano wdrożenia ani kontroli na rzeczywistych urządzeniach mobilnych.

Pierwotna weryfikacja Etapu 2 w środowisku chmurowym (Node.js 24.19.0): `npm ci`, build produkcyjny i `npm run verify` — powodzenie; **25 testów Angulara i 72 testy Node/SQLite**, bez pominiętych testów. Walidacja wszystkich **10 katalogów** — powodzenie. Rzeczywisty smoke Chromium/API/SQLite — powodzenie, brak błędów JS i poziomego overflow przy 1440/390/320 px; przejrzano zrzuty ekranów gracza i MG. Kontrolowany błąd zapisu historii (HTTP 500) jest testem rollbacku, nie nierozwiązanym błędem. Regresje poprawek PR #6 dodatkowo sprawdzają znikanie/powrót do kolejki, trwałość i minimalny zakres rejestru edycji, odrębność od decyzji oraz rollback przy błędzie audytu i migracji 4.

Raport fixture konfliktowej: 1 rozpoznana postać, 1 zachowana ankieta logistyczna, 1 nierozpoznane zgłoszenie `potential-second-character` w `second-character-form`; para z istniejącą postacią tego gracza otrzymuje `CHARACTER_MAPPING_CONFLICT`. Migracja blokowana, wszystkie oryginały i rejestr wersji 1/2 pozostają identyczne. To wynik syntetycznych danych, nie raport rzeczywistego wdrożenia.

Weryfikacja poprawek PR #6: `npm run verify` — build, **27 testów Angulara i 78 Node/SQLite** zakończonych powodzeniem; walidacja **10 katalogów** — powodzenie. Rozszerzony smoke Chromium/API/SQLite potwierdza usunięcie cofniętego szkicu z listy i otwartego panelu MG, powrót po wysyłce, trwałe metadane edycji oraz oddzielną prezentację obu historii. Szerokości 1440/390/320 px nadal bez poziomego overflow i błędów JS. Nie migrowano rzeczywistej bazy.
