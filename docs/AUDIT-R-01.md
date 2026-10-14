# R-01 — audyt MVP i plan migracji Royal Manuscript v27.2

Data: 14.10.2026. Baza: `feature/royal-manuscript-rebuild`, commit `95f8042b7500bcfb9e1ac12014d3a3abcb9e5a16`. Gałąź analizy: `docs/r-01-mvp-audit`.

Podstawa wymagań: `docs/MCP-SPEC.md` z tej gałęzi. Przeczytano README, kod `src/app/platform`, `server`, `shared`, routing, testy i workflow. Dokument opisuje propozycję; żadnej migracji ani zmiany implementacji nie wykonano. Nie scalano starszych gałęzi. Nie otwierano rzeczywistej bazy i nie ustalano liczby istniejących kont lub zgłoszeń na wdrożeniu.

## Wniosek i zakres

Obecna aplikacja jest działającym fundamentem: ma Angular, wspólny renderer i walidację, API Node, SQLite, konta, sesje, trwałe szkice oraz recenzję. Nie potrzeba nowego backendu ani przebudowy UI. Zielone testy potwierdzają obecny kontrakt prototypu, w tym zachowania sprzeczne z MVP: przypięte wersje ankiet i blokadę edycji wysłanego zgłoszenia.

Najpierw trzeba zabezpieczyć migracje i zapis, następnie wprowadzić wydarzenia/uprawnienia, jeden formularz i postać na wydarzenie, poprawny cykl decyzji oraz żywy schemat. Usuwanie, odzyskiwanie, eksport i powiadomienia dopełniają wymagania §3. Zachowujemy wygląd Royal Manuscript, istniejące kontrolki, sekcje, opisy opcji, podgląd i katalogi świata. Zmiany interakcji wymagane przez MVP powinny wykorzystywać obecne komponenty bez przeprojektowania layoutu lub stylów.

## 1. Obecny model i źródła prawdy

DDL: `server/server.mjs:36–41`. Brak jawnego rejestru migracji.

| Tabela | Dane i integralność | Znaczenie dla migracji |
|---|---|---|
| `users` | `id`, nazwa, unikalny e-mail, hash scrypt, globalna rola `participant/organizer` | Zachować identyfikatory i hashe; nie ponawiać rejestracji |
| `sessions` | hash tokena, FK do użytkownika, termin wygaśnięcia | Zachować aktywne sesje i obecne zabezpieczenia cookies |
| `forms` | PK `(id, revision)`, definicja JSON | Każda rewizja to osobny rekord; `eventId` istnieje w JSON, bez FK do wydarzenia |
| `applications` | PK `id`, właściciel, FK `(form_id, form_revision)`, JSON odpowiedzi, cztery statusy, daty, ostatni `feedback`; UNIQUE `(user_id, form_id)` | Brak event ID, soft delete, rewizji zapisu, historii i aktora decyzji |

Wydarzenie jest w `public/data/platform.json`, nie w SQLite. Frontend wczytuje ten plik także w trybie serwerowym (`platform.store.ts:41`). Trasa `/wydarzenie/:id` nie wybiera wydarzenia z API: `EventPage` nadal używa seed i częściowo stałych tekstów. API publikacji akceptuje tylko `seed.event.id` (`server.mjs:272`).

Seed zawiera `character-2027` (7 sekcji, 34 pola) oraz `logistics-2027` (1 sekcja, 3 pola), oba dla `ursunalia-2027`. Serwer wykonuje `INSERT OR IGNORE` dla seed przy każdym uruchomieniu. To ważne podczas wycofywania starych formularzy: samo usunięcie danych mogłoby je ponownie zasilić. Nie należy kasować drugiej ankiety.

`forms()` zwraca najnowszą rewizję każdego formularza, natomiast `application()` zwraca historyczny schemat wskazany przez zgłoszenie (`server.mjs:111,119`). Demo przechowuje lokalne snapshoty w `ursunalia:manuscript:v1`; kreator zapisuje szkic w `ursunalia:builder:v27:<id>`. Import starych formatów w `migration.ts` i `restoreDemo()` dotyczy przeglądarki, nie migracji SQLite. Konta serwerowe nie otrzymują fikcyjnej Aleny ani automatycznego importu demo — to zachowanie należy zachować.

## 2. Istniejące endpointy

| Endpoint | Obecny kontrakt |
|---|---|
| `GET /runtime-config.json` | Jawne `server`; awaria API nie włącza demo |
| `GET /api/bootstrap` | Najnowsze formularze, bieżący użytkownik i jego zgłoszenia; brak trwałego wydarzenia i uczestnictwa |
| `POST /api/auth/register` | Tworzy wyłącznie `participant` i sesję; rejestracja nie jest zapisem na wydarzenie |
| `POST /api/auth/login`, `/logout` | Logowanie i unieważnienie sesji |
| `POST /api/forms` | Globalny organizator publikuje nową rewizję; brak sprawdzania oczekiwanej rewizji |
| `POST /api/applications` | Tworzenie/zapis własnego szkicu dla podanego ID i rewizji formularza; edycja tylko `draft/changes` |
| `POST /api/applications/:id/submit` | Waliduje przypięty schemat; `draft/changes → submitted` |
| `GET /api/organizer/applications` | Globalny organizator widzi wszystkie rekordy poza `draft`, najnowsze wysłania pierwsze |
| `PATCH /api/organizer/applications/:id` | Decyzja `accepted/changes`; komentarz do `changes` obowiązkowy; bez walidacji akceptacji i historii |

Nie ma endpointów wydarzeń/uczestnictwa, edycji danych przez MG, powiadomień, usuwania/przywracania ani pełnego eksportu. Odczyt i zapis cudzej postaci przez gracza jest blokowany. Autoryzacja recenzji jest rzeczywiście serwerowa, lecz globalna, a nie przypisana do wydarzenia.

## 3. Rozbieżności i priorytety

P0 oznacza fundament poprawności danych lub blokadę docelowego przepływu. P1 oznacza wymagane dopełnienie MVP po tym fundamencie; nie oznacza odrzucenia wymagania. Później: funkcje wyraźnie odłożone w specyfikacji.

| Priorytet | Rozbieżność i dowód w kodzie | Minimalny kierunek zmiany |
|---|---|---|
| P0 | Brak trwałych wydarzeń, uczestnictwa, publikacji wydarzenia i zamykania zapisów; `models.ts:58`, `event.page.ts`, `server.mjs:272` | Dodać model wydarzenia i członkostwa do istniejącego API; oddzielić rejestrację, dołączenie i status postaci |
| P0 | Globalna rola organizatora daje dostęp do wszystkich formularzy i zgłoszeń; `server.mjs:88,266,367,377` | Uprawnienia MG i zarządzania formularzem per wydarzenie, sprawdzane na każdym endpointzie; właściciel zachowuje dostęp do własnej postaci |
| P0 | Dowolna liczba formularzy; jedna odpowiedź na formularz zamiast jednej aktywnej postaci na wydarzenie; `server.mjs:40–41,330`, `store.start():187` | Wyznaczyć formularz postaci, nie zgadywać po kolejności; unikalność aktywnej postaci w SQLite i API |
| P0 | Gracz nie edytuje `submitted`, brak `rejected`; `server.mjs:301,355,380`, `platform.store.ts:213`, `form.page.html:22,81` | Pięć statusów w DB/API/modelach i UI; faktycznie zmieniony zapis `submitted → draft`; zapis bez zmian zachowuje status |
| P0 | Akceptacja nie wywołuje `answerIssues`; publikacja nie wpływa na istniejące postacie; `server.mjs:119,377–395` | Walidacja wysłania i każdej nowej akceptacji względem aktualnego schematu, przy zachowaniu statusów po samej zmianie schematu |
| P0 | Brak kontroli równoczesnego zapisu; `server.mjs:276,340,390` | Techniczna rewizja postaci i schematu, atomowe compare-and-swap, HTTP 409 z zachowaniem lokalnych zmian |
| P0 | Publikowane rewizje są snapshotami; brak transakcyjnej aktualizacji odpowiedzi; `forms`, FK zgłoszeń, `store.publish():295` | Jeden bieżący schemat na wydarzenie; nie przenosić wszystkich rekordów przez proste ustawienie najnowszej rewizji |
| P0 | Edytor autosave do localStorage, osobna publikacja; brak własnego dirty/guard; `builder.page.ts:124,339` | Ręczny zbiorczy zapis; lokalna kopia nie jest obowiązującym schematem; ostrzeżenie przed utratą pracy i obsługa 409 |
| P0 | Usuwanie pól/sekcji ma tylko lokalne confirm; typ/opcja bez analizy skutków; `builder.page.ts:194,210,248,286` | Przed zapisem policzyć rzeczywistą utratę odpowiedzi, ostrzec o rekordach aktywnych i usuniętych, wymagać potwierdzenia skutków |
| P0 | Brak historii; `feedback` i status są nadpisywane; MG nie ma endpointu edycji odpowiedzi | Oddzielić edycję od decyzji; decyzja, aktor, czas i komentarz zapisywane atomowo; odblokowanie zaakceptowanej przez MG |
| P1 | Brak soft delete/przywracania | `deleted_at` i indeks częściowy; usunięcie także zaakceptowanej postaci; przywrócenie tylko przez MG bez konfliktu z inną aktywną |
| P1 | Brak trwałych powiadomień; toast znika po 5 s (`app.ts`) | Trwałe powiadomienie decyzji i znacznik odczytu; bez e-maili |
| P1 | Eksport kreatora to sama definicja, eksport recenzji to jedna postać; `builder.page.ts:318`, `organizer.page.ts:233` | Serwerowy eksport całego formularza i danych powiązanych, także usuniętych oraz notatek MG, wyłącznie z prawem zarządzania formularzem |
| P0/P1 | Testy świadomie wymagają starego kontraktu; `platform.spec.ts` test snapshotu, `server.test.mjs` blokada submitted i stara rewizja | Zmieniać konkretne testy wraz z kontraktem; dodać regresje migracji i odmów dostępu, nie usuwać istniejących kontroli bezpieczeństwa |

Odblokowanie zaakceptowanej postaci jest częściowo możliwe już teraz: organizator może nadać jej `changes`. Nie trzeba tworzyć tego mechanizmu od zera; trzeba doprecyzować uprawnienie, historię i opcjonalność komentarza. Szkice mogą być niekompletne, ale API sprawdza typy i limity podanych odpowiedzi — zachować tę ochronę. Wyszukiwanie po graczu/postaci i filtr statusu już istnieją w `OrganizerPage`; rozszerzyć istniejące kontrolki o nowe statusy, bez budowy nowego panelu.

Prywatne notatki MG obecnie nie istnieją. Nie stwierdzono wycieku takich notatek; przy ich dodawaniu potrzebne są odrębne DTO i testy braku ich obecności w odpowiedzi gracza. Nie wolno utożsamiać publicznego komentarza decyzji z prywatną notatką.

`beforeunload` w `app.ts:25` kontroluje tylko globalny `store.dirty()`, nie kreator ani nawigację routera. Zmiany postaci pozostają czasem w pamięci przy przejściu między widokami, ale odświeżenie/autoryzacja może je zastąpić. Przyszłe ostrzeżenie powinno chronić faktyczne odrzucenie pracy, a nie każde przejście formularz → karta. Potrzebny stan dirty per edytowany obiekt. Szkice kreatora są przypisane do formularza, nie konta; warto rozdzielić lokalne kopie kont/trybów i nie publikować automatycznie starej kopii po logowaniu innego użytkownika.

## 4. Weryfikacja w tym audycie

Node.js 24.19.0, instalacja z lockfile przez npm 11.6.2:

- `npm ci` — OK; brak zmian package.json/lockfile.
- `npm run verify` — OK: build produkcyjny, 13/13 testów Angular/Vitest w 2 plikach, 6/6 testów HTTP/SQLite; brak skipped/cancelled.
- `node scripts/validate-catalog.mjs` — OK, 10 katalogów.
- Siedem ad hoc prób HTTP na bazie `:memory:` — potwierdziło opisane poniżej zachowania. To diagnoza istniejącego kodu, nie test zgodności MVP ani nowy zestaw testów w repozytorium.

| Próba | Zaobserwowany wynik |
|---|---|
| Dwa zgłoszenia jednego gracza na formularzach tego samego wydarzenia | 200/200 |
| Zapis wysłanego zgłoszenia, również bez zmian | 409 |
| Decyzja `changes` bez komentarza i decyzja `rejected` | 400/400 |
| Dwie publikacje oparte na rewizji 1 | 201/201, powstały rewizje 2 i 3 zamiast konfliktu |
| Dodanie nowego wymaganego pola i akceptacja istniejącej postaci bez niego | Postać nadal na rewizji 1; akceptacja 200 |
| Niekompletny rekord submitted w kontrolowanej bazie testowej | Akceptacja 200; do tej próby zmieniono wyłącznie fixture w pamięci |
| Dwa zapisy szkicu z tej samej bazowej kopii | 200/200, drugi nadpisał pierwszy |

Próby nie ujawniają danych produkcyjnych i nie wprowadzają ich do plików. Nie wykonano wizualnego przeglądu, przeglądarkowego E2E ani zdalnego CI bieżącego commita. Zielony historyczny CI podany w specyfikacji nie zastępuje tych kontroli.

## 5. Minimalny model docelowy — propozycja, nie implementacja

Pozostawić `users`, `sessions`, Node/SQLite, endpointy auth i `shared/validation.mjs`. Dodać:

| Element | Minimalny kontrakt |
|---|---|
| `schema_migrations` | Wersja, checksum migracji, data zastosowania; rozpoznanie aktualnego schematu przed adopcją |
| `events` | Stabilne ID, dane wydarzenia, stan publikacji i otwarcia zapisów, techniczna rewizja |
| `event_memberships` | `(event_id,user_id)`, stan uczestnictwa niezależny od postaci |
| Uprawnienia wydarzenia | Jawne prawa przeglądu/edycji/decydowania MG oraz zarządzania wydarzeniem/formularzem; grant nie jest automatycznym zgłoszeniem gracza do udziału |
| `character_forms` | Jeden rekord na event (UNIQUE `event_id`), stabilne ID formularza, bieżąca definicja i techniczna rewizja; bez wyboru historycznej wersji przez postać |
| `characters` | Właściciel, event, odpowiedzi według ID pól, pięć statusów, daty, `deleted_at`, rewizja zapisu; częściowy UNIQUE `(user_id,event_id) WHERE deleted_at IS NULL` |
| `review_history` | ID postaci, aktor, czas, status przed/po, opcjonalny komentarz; append-only |
| `notifications` | Odbiorca, postać/decyzja, czas, `read_at`; unikalny klucz decyzji zapobiega duplikacji |
| Mapowanie migracji | Jednoznaczne powiązanie starego zgłoszenia/formularza z nowym rekordem; nierozwiązane przypadki blokują przełączenie wydarzenia |

Nowa tabela `characters` pozwala wprowadzić pięć statusów i nowe ograniczenia bez DROP starego `applications` (jego CHECK i UNIQUE nie zmienią się od samego dodania kolumn). To ewolucja tego samego backendu, nie drugi backend. Dotychczasowe `forms/applications` pozostają zachowanymi rekordami migracyjnymi; po przełączeniu nie są równoległym źródłem prawdy ani katalogiem historycznych schematów do użycia przez gracza. Nazwy tabel można doprecyzować w pierwszym PR modelu, bez zmiany tego kontraktu.

API pozostaje na tej samej domenie. Dodać operacje wydarzeń, dołączenia i odczytu uprawnień; istniejące operacje zgłoszeń adaptować do postaci wydarzenia. Każdy zapis przyjmuje `expectedRevision` (postać/schemat); zapis odpowiedzi także rewizję schematu, według którego klient edytował. Nie ufać przesłanej definicji, właścicielowi, roli ani statusowi. Konflikt → 409 i zachowanie lokalnej pracy; błędy odpowiedzi → 422. Tworzenie/wskrzeszanie postaci musi egzekwować indeks także przy równoczesnych żądaniach.

Decyzja, historia, rewizja i później powiadomienie muszą być jedną transakcją. MG może zapisać zmienione odpowiedzi bez zmiany statusu. Przy zapisie gracza w `submitted` porównać znormalizowane odpowiedzi z zapisem bazowym: rzeczywista zmiana → `draft`, brak zmian → zachować status. Porównanie powinno uwzględniać kolejność nieistotną dla wielokrotnego wyboru, lecz nie ignorować faktycznych zmian tekstu. Gracz nie edytuje `accepted`; niekompletny szkic nadal jest dozwolony.

## 6. Migracja bez utraty istniejących danych

1. **Kopia i inwentaryzacja.** Na wdrożeniu wykonać spójną kopię SQLite przez backup lub przy zatrzymanym serwerze, z ochroną jak dane uczestników. Nie kopiować samego pliku podczas aktywnego WAL. Przetestować odtworzenie i integralność na kopii. Raport zawiera liczby, zgodność FK, rozpoznane statusy, formularze/event ID, kolizje i mapowanie — bez haseł, tokenów i treści odpowiedzi w publicznych logach.
2. **Adopcja schematu.** Migrator rozpoznaje obecne cztery tabele, ich constraints i FK; nie nadaje wersji nierozpoznanej bazie. Nowe migracje tylko raz, transakcyjnie, z checksum i bez DROP/resetu. Dodać nowe struktury bez zmiany starych zapisów. Seeding docelowych danych tylko przy inicjalizacji/migracji, nie odtwarzanie wycofanych formularzy przy każdym starcie.
3. **Jawne mapowanie.** Dla obecnego seed kandydatem na formularz postaci jest `character-2027`; `logistics-2027` zachować jako dane legacy. Na kopii rzeczywistej bazy trzeba sprawdzić wszystkie formularze, nie tylko seed. Nie wybierać kanonicznego formularza po pozycji na liście, nazwie ani najnowszej dacie. Mapowanie i obsługę dodatkowych ankiet zatwierdza właściciel projektu przed przełączeniem.
4. **Wydarzenia, członkostwo i granty.** Event ID wyprowadzić z zweryfikowanej definicji formularza, zachowując stare ID. Użytkownik ze zgłoszeniem do eventu ma dowód wcześniejszego powiązania — propozycja backfill członkostwa dla niego, do jawnego zatwierdzenia. Samo konto bez zgłoszenia nie dowodzi udziału. Globalnym organizatorom przyznać zatwierdzone prawa do dotychczasowego wydarzenia, nie do wszystkich przyszłych wydarzeń. Nie zmieniać haseł, identyfikatorów ani sesji. Oddzielić grant od uczestnictwa gracza.
5. **Kolizje postaci.** Dwa formularze na wydarzenie nie oznaczają dwóch postaci: zgłoszenie logistyczne nie jest postacią. Jeśli istnieją dwa rzeczywiste zgłoszenia postaci jednego gracza na wydarzenie, raportować konflikt i zachować oba. Nie wybierać zwycięzcy, nie scalać JSON i nie soft-delete'ować automatycznie. Zatwierdzona decyzja wskazuje aktywny rekord i sposób zachowania drugiego; nierozwiązany konflikt blokuje przełączenie eventu.
6. **Odpowiedzi i historyczne schematy.** Dla każdego zgłoszenia porównać jego oryginalną definicję z docelowym schematem. Przenieść odpowiedzi tylko przy zgodnych stabilnych ID, typach i ID opcji. Nowe pola pozostają bez odpowiedzi. Brakujące pola/opcje, zmiana typu i stare nieprawidłowe wartości tworzą raport do decyzji. Nie uruchamiać `cleanAnswers` jako bezwarunkowej migracji: usunąłby odpowiedzi bez zgody. Oryginał pozostaje zachowany w legacy i backup; zastosowanie utraty z widoku bieżącego schematu wymaga jawnego potwierdzenia. Nie zmieniać statusu przy migracji schematu, nawet jeśli wcześniej zaakceptowana postać stała się niekompletna; ponowna akceptacja wymaga już aktualnej walidacji.
7. **Historia i pochodzenie.** Zachować ID postaci gdzie mapowanie jest 1:1, daty wysłania, status i ostatni feedback. Nie odtwarzać fikcyjnej historii decyzji: obecna baza nie przechowuje aktora, wszystkich komentarzy ani czasu decyzji (updated_at może oznaczać edycję). Importowany stan oznaczyć jako stan zastany, z nieznanym aktorem/czasem decyzji, a nie nową decyzję MG. Pełna historia zaczyna się dla rzeczywistych nowych operacji.
8. **Przełączenie.** Przetestować migrację i jej ponowne uruchomienie na kopii, porównać liczby/ID/mapowania, kontrolować JSON i FK, sesje oraz autoryzację. Na czas finalnego backfill i przełączenia zatrzymać zapisy; w jednej kontrolowanej operacji przełączyć istniejący frontend/API na nowe źródło. Nie uruchamiać starego endpointu zapisującego legacy równolegle z nowym modelem. Dodatkowe ankiety zachować i zapewnić uzgodniony dostęp do ich danych bez wystawiania ich jako kolejnych aktywnych formularzy postaci.
9. **Wycofanie.** Przed dopuszczeniem nowych zapisów można wrócić do backupu i poprzedniej wersji. Po nowych zapisach proste przywrócenie backupu utraciłoby dane — preferować poprawkę naprzód; rollback wymaga odrębnego, sprawdzonego eksportu/mapowania nowych zapisów. Nie kasować starych tabel jako część tych PR-ów. Kopii SQL nie udostępniać przez eksport aplikacji.

Późniejsze destrukcyjne zmiany schematu: serwer tworzy preview różnic i liczbę różnych aktywnych postaci rzeczywiście tracących odpowiedzi; oddzielnie wskazuje wpływ na usunięte. Opcjonalny pełny JSON można pobrać przed zapisem. Potwierdzenie wiązać z konkretną zmianą, rewizją i stanem danych; przy zmianie któregokolwiek z nich trzeba ponownie policzyć skutki i potwierdzić. Schemat, usunięcie odpowiednich odpowiedzi (w tym z soft-deleted), rewizje i zapis potwierdzenia są atomowe. Statusy pozostają bez zmian. Nie potrzeba symulacji każdej postaci ani interfejsu scalania konfliktów.

## 7. Proponowane małe PR-y

Każdy wychodzi z `feature/royal-manuscript-rebuild` i wraca do tej gałęzi. Poniżej plan, nie zgoda na jego implementację. Nie uruchamiać kolejnego zadania bez zatwierdzenia zakresu.

| PR / zadanie | Priorytet i zakres | Warunek ukończenia |
|---|---|---|
| 1 — fundament migracji | P0; R-02 przygotowanie: rejestr migracji, adopcja obecnej SQLite, bezpieczny raport preflight, instrukcja kopii/odtworzenia | Świeża i istniejąca fixture, ponowne uruchomienie bez zmian, błąd w połowie → rollback; zachowane users/sessions/forms/applications |
| 2 — wydarzenie i uczestnictwo | P0; R-02: trwały event, join, otwarcie/zamknięcie zapisów, jawne granty MG/organizatora | Uczestnik nie nadaje sobie roli; MG event A nie ma dostępu do B; zamknięcie blokuje nowych, a nie dotychczasowych; auth bez regresji |
| 3 — mapowanie danych postaci | P0; R-03 przygotowanie: raport wszystkich formularzy/wersji i kolizji, zatwierdzony wybór formularza, dry-run transformacji odpowiedzi | Fixture ze zgłoszeniem logistycznym, dwiema postaciami i zmianą typu/opcji; zero automatycznych rozstrzygnięć lub utraty oryginałów |
| 4 — jedna aktywna postać | P0; R-03: `characters`, testowany backfill i adapter API przygotowany do późniejszego przełączenia; partial UNIQUE, rewizja zapisu i 409 | Jedna aktywna per event także przy równoczesnej kreacji; brak zmiany uczestnictwa; zgodne ID/daty; konflikty migracji blokują switch |
| 5 — statusy i decyzje | P0; R-04: pięć statusów, edycja submitted/no-op, opcjonalny komentarz, walidacja akceptacji, historia i uprawnienia edycji MG | Tabela przejść testowana dla gracza/MG; niekompletna akceptacja 422; decyzja/historia atomowe; accepted blokuje gracza; edycja MG zachowuje status |
| 6 — pełny eksport | P1, przed destrukcyjnym R-05: serwerowy JSON definicji, postaci i powiązań, historii; uwzględnienie deleted i notatek, gdy istnieją | Organizator z prawem formularza może eksportować; zwykły MG/gracz nie; brak hashes/sessions; spójny snapshot, bez historii eksportów i importu bazy |
| 7 — żywy schemat API | P0; R-05: current form i migracja snapshotów po zatwierdzonym raporcie; expectedRevision, preview i potwierdzenie destrukcji | Existing/deleted widzą bieżący schemat; dodane pole bez odpowiedzi; usunięte pole/opcja i typ poprawnie czyszczone w transakcji; status nie zmienia się; stale preview → 409 |
| 8 — ręczny edytor | P0; R-05: jeden przycisk zapisu, stan roboczy, ochrona przed opuszczeniem, obsługa 409 i preview/eksport z PR 6–7 | Niezapisane zmiany nie docierają do graczy; konflikt zachowuje lokalne dane; istniejące DnD/podgląd/kontrolki działają; style bez zmian |
| 9 — usuwanie i przywracanie | P1; R-06: endpointy i istniejące widoki, potwierdzenie usunięcia, przywrócenie przez MG | Można usunąć accepted; aktywne listy nie pokazują deleted; udział/status bez zmiany; przywracanie z kolizją 409; próby obcego użytkownika odrzucone |
| 10 — trwałe powiadomienia | P1; R-06: odczyt/lista dla właściciela, atomowe powiązanie z nową decyzją | Po ponownym logowaniu decyzja jest widoczna; brak duplikacji i cudzych powiadomień; awaria zapisu nie pozostawia częściowej decyzji |
| 11 — przepływ i wdrożenie | P0 jako bramka wydania; R-07: istniejący UI z API, E2E, regresje migracji, mobile/klawiatura | Konto → join → szkic → submit → changes/rejected → ponowne submit → accepted; równoczesne zapisy; odmowy API; build/verify/katalogi i kontrola wyglądu |

PR 4 wymaga zakończonego PR 3 i zatwierdzonego mapowania. PR-y 4–7 przygotowują i testują nowy kontrakt, ale nie przełączają automatycznie istniejącego wdrożenia. Finalny backfill i przełączenie następują dopiero po zgodnym wdrożeniu backendu i klienta (PR 7–8) oraz rozstrzygnięciu raportu migracji. Nie należy obchodzić niezgodności historycznych wersji przez utratę danych lub przejściowe złamanie reguł. PR 7 wymaga PR 6, aby eksport był dostępny przed zmianami destrukcyjnymi. Deployment aktywujący nowe źródło danych powinien zawierać wszystkie zależne elementy, nawet gdy są przeglądane w oddzielnych małych PR-ach. Prywatne notatki można dodać osobno, jeśli ich implementacja zostanie zlecona; bez nich eksport nie może deklarować eksportowania nieistniejących danych.

### Zakres pierwszego PR do zatwierdzenia

Tylko migrator i jego testy, podłączenie do inicjalizacji obecnego `createAppServer`, raport read-only i dokumentacja kopii/odtworzenia. Bez zmiany bieżących endpointów, statusów, formularzy, UI, kont i sesji. Nie migrować jeszcze zgłoszeń do nowego modelu i nie uruchamiać migracji na produkcji. Testy muszą używać fixture/kopii z fikcyjnymi danymi, sprawdzać również przydatność zachowanej sesji oraz oryginalny JSON wszystkich rewizji. To daje zabezpieczenie przed pierwszą zmianą domenowego modelu SQLite.

## 8. Decyzje wymagane przed migracją wdrożenia

- Potwierdzenie formularza postaci i postępowania z istniejącymi zgłoszeniami do dodatkowych ankiet; kandydat seed nie zastępuje audytu wdrożenia.
- Zatwierdzenie backfill uczestnictwa i przypisania istniejących organizatorów do wydarzenia; bez automatycznego przyznania prawa do przyszłych wydarzeń.
- Rozstrzygnięcie realnych kolizji jednej aktywnej postaci i odpowiedzi niezgodnych z wybranym schematem — jeśli raport je ujawni.
- Dostęp operacyjny do bezpiecznej kopii, miejsce jej przechowania, okno zatrzymania zapisów i próba odtworzenia.

Nie blokują one zakończenia R-01 ani przygotowania pierwszego PR migratora. Brak rozpoznania danych wdrożenia oznacza, że nie można jeszcze zatwierdzić konkretnego backfill ani obiecać migracji bez ręcznych decyzji. Nie proponuje się teraz importu całej bazy, uniwersalnych ankiet, płatności, e-maili, zaawansowanych warunków lub nowego frameworka.

## 9. Wynik i sposób przeglądu

Jedyny nowy plik repozytorium: `docs/AUDIT-R-01.md`. Kod aplikacji/backendu, testy, style, manifest i lockfile pozostają bez zmian. Publikacja gałęzi dokumentacyjnej służy przeglądowi audytu; jej PR może wskazywać wyłącznie `feature/royal-manuscript-rebuild`. Nie wykonano merge. R-02 nie rozpoczęto.

Do przeglądu: potwierdzić kolejność i zakres PR 1; porównać tabelę rozbieżności z §3–4 specyfikacji; ustalić zasady mapowania przed przyszłym backfill. Obecny przepływ można sprawdzić na testowej bazie przez `npm run verify`; testów nie uruchamiać na bazie uczestników. Zielony wynik oznacza sprawny prototyp, nie pełną zgodność z MVP.
