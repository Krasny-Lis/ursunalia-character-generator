# Etap 4 — komplet MVP do odbioru

Baza: `feature/royal-manuscript-rebuild`, `aab583d3ac363845548ca9623b63121bbdb1242d` (Etap 3 / PR #7). Gałąź: `feat/stage-4-mvp-completion`. Jeden PR, bez merge lub wdrożenia. Ten dokument i decyzje Etapu 4 zastępują wcześniejsze zasady soft delete/przywracania. Audyt R-01 pozostaje historyczną diagnozą i planem 11 PR-ów, nie bieżącym kontraktem usuwania.

## Funkcje i dostęp

- **Administracja wydarzeń** `/#/organizator/wydarzenia`: tworzenie, nazwa/termin/lokalizacja/opis, publikacja, otwarcie/zamknięcie zapisów, lista uczestników i zespołu, wyszukiwanie kont i granty. Tworzenie zachowuje istniejące prawo globalnego organizatora; zarządzanie konkretnym wydarzeniem wymaga jego grantu `organizer`. Sam grant wydarzenia nie promuje konta do globalnej roli. Wyszukiwanie jest wyłącznie dla organizatora tego eventu, wymaga 3–200 znaków, zwraca maksymalnie 20 nazw/e-maili/ID, bez sekretów. Działa także dla polskich znaków. Dane wydarzenia i granty korzystają ze wspólnej rewizji. Zmiana uprawnień wymaga `expectedRevision` także przy DELETE; stale zapis daje 409. Ostatniego organizatora nie można usunąć lub zdegradować.
- **Blokada karty**: osobna flaga, niezależna od pięciu statusów. Organizator blokuje/odblokowuje pojedynczą kartę lub wskazane karty zbiorczo. Stan widoczny jako „Karta zablokowana”. API gracza odmawia zapisu i wysłania. MG może nadal edytować wysłaną kartę; odblokowanie `accepted → changes` nie usuwa osobnej blokady. Blokada zwiększa rewizję tylko przy zmianie, nie zmienia decyzji ani nie tworzy powiadomienia. Nowe postacie nie dziedziczą blokad.
- **Panel MG**: dotychczasowy renderer, wyszukiwanie, statusy, indywidualna edycja i decyzje oraz zaznaczanie do wspólnej decyzji w jednym wydarzeniu. Pełna walidacja każdej nowej akceptacji, rewizje wszystkich kart, decyzje/historia/powiadomienia w jednej transakcji. Niewysłane i cofnięte szkice są ukryte również w GET/PATCH recenzenta przez ID. Własny endpoint nadal udostępnia szkic właścicielowi. Organizator ma jawnie szersze uprawnienie administracyjne do metadanych kart (bez odpowiedzi szkiców) i dotychczasowego pełnego eksportu schematu; grant `gm` nie daje tych praw.
- **Konto i aktywne postacie**: odświeżanie danych, archiwum właściciela, kontekst wydarzenia/statusu, czytelne stany puste i błędy. 409 pozostawia dane lokalnego edytora i zaznaczenia; nie nadpisuje ich automatycznie. Ponowne wczytanie wydarzenia wymaga zgody na odrzucenie zmian. Aktualizacja danych w tle nie usuwa niezapisanej pracy gracza. Spóźniony bootstrap/powiadomienia po wylogowaniu nie odtwarzają prywatnego cache.
- **Powiadomienia** `/#/powiadomienia`: trwałe, przypisane do właściciela i wydarzenia, nowe/przeczytane, opcjonalny komentarz, link do dostępnej postaci lub archiwum. Po usunięciu zostaje neutralna informacja bez linku i komentarza. Każda rzeczywista akceptacja, odrzucenie, poprawki lub odblokowanie tworzy jeden rekord powiązany z decyzją. Nowy komentarz przy decyzji tego samego statusu także powiadamia. Powtórzenie identycznej decyzji i komentarza jest no-op (nowa akceptacja nadal wymaga aktualnej walidacji). Zapis bez zmian, edycja odpowiedzi MG oraz blokady nie powiadamiają. Odczyt jest idempotentny i dostępny wyłącznie odbiorcy. Brak e-mail/SMS/push; odświeżenie następuje przy wejściu lub przyciskiem.

Wygląd, zasoby, typografia i układy Royal Manuscript pozostają. Nowe komponenty korzystają z istniejących kart/przycisków/kontrolek; lokalne reguły CSS tylko zawijają długie etykiety i treści na wąskich ekranach. Nie dodano frameworka ani zależności aplikacji.

## Usunięcie i archiwizacja — odrębne, nieodwracalne operacje

**Usunięcie przez właściciela**, także `accepted` lub zablokowanej karty, wymaga jednoznacznego potwierdzenia i aktualnej rewizji. Nie usuwa uczestnictwa ani konta/sesji, zwalnia aktywny slot. W jednej transakcji:

1. `characters.answers` staje się `{}`, `feedback` jest pusty, ustawiane są data wycofania, nowa rewizja i dyspozycja `deleted`.
2. Powiązane `applications.answers/feedback` są czyszczone, cały `character_schema_origins` jest usuwany.
3. Komentarze decyzji są czyszczone; wpisy decyzji/edycji i powiadomienia zostają wyłącznie metadanymi technicznymi wymaganymi przez FK. Powiadomienie czyta komentarz z decyzji, więc nie ma drugiej kopii treści.
4. Ewentualna kopia w `character_archives` również jest usuwana. Właściciel może usunąć także już archiwalną postać.

Nie ma API przywracania i MG nie może odzyskać treści. Aktualny eksport pokazuje tylko minimalny ślad wycofania, bez treści/portretu/komentarzy. Pozostawione FK nie pozwalają tworzyć ponownie postaci pod starym ID. Oryginały innych postaci i ankiety logistycznej pozostają nietknięte.

**Archiwizacja** wymaga osobnego potwierdzenia usunięcia zdjęcia i braku przywracania. Gracz może archiwizować własną kartę niezależnie od statusu. Organizator archiwizuje jawnie zaznaczone karty po zamknięciu zapisów i potwierdzeniu zakończenia wydarzenia. Data wydarzenia w dotychczasowym modelu jest opisowym tekstem; aplikacja nie zgaduje terminu zakończenia, wymaga świadomego potwierdzenia organizatora. Operacja zbiorcza ma limit 500 kart, sprawdza rewizję wydarzenia i każdej wskazanej postaci; nowe karty powstałe później nie są objęte.

Archiwum zapisuje niezmienny snapshot wydarzenia, schematu, tekstowych odpowiedzi (także nieznanych historycznych kluczy), statusu i czasu. Nie zachowuje zdjęć. Aktualne odpowiedzi/feedback karty są czyszczone, a fotografie usuwane również z powiązanych legacy odpowiedzi, źródła migracji i komentarzy. Usuwane są wartości pól obrazowych oraz rozpoznane image data URI, także w nieznanych kluczach; otaczający tekst pozostaje. Wspólny demonstracyjny zasób `art/alena.png` nie jest plikiem zdjęcia użytkownika; referencje w archiwum są usuwane, sam zasób UI pozostaje. Późniejsze zmiany formularza lub wydarzenia nie aktualizują kopii archiwalnej. Usunięte rekordy nie mają odpowiedzi, archiwa nie uczestniczą w analizie skutków żywego schematu. Limit jednej aktywnej postaci nadal korzysta z dotychczasowego indeksu `deleted_at IS NULL`.

**Ponowne użycie archiwum**: wyłącznie właściciel, inne wydarzenie, członkostwo i aktualna rewizja docelowego formularza. Powstaje nowe ID i `draft`, bez zdjęcia, poprzedniej akceptacji, komentarzy, decyzji, edycji i blokady. Kopiowane są tylko zgodne ID/typy, dostępne opcje i wartości spełniające walidację szkicu (np. nowy limit maksymalny). Nowe wymagania mogą pozostawić szkic niekompletny. Niepasujący tekst pozostaje w archiwum. Tworzenie odbywa się w jednej transakcji z kontrolą unikalności; istniejąca aktywna postać na docelowy event → 409. Zamknięte zapisy zachowują dotychczasowe zasady dla już zapisanych uczestników.

## Baza i migracja 6

`mvp_character_lifecycle_v1` jest addytywna. Migracje 1–5, SQL, checksum oraz istniejące dane pozostają niezmienione; migracja nie archiwizuje ani nie usuwa odpowiedzi.

| Tabela/indeks | Dane |
|---|---|
| `character_controls` | PK/FK postaci, niezależna flaga `locked`, dyspozycja `active/archived/deleted`; istniejące aktywne karty dostają `locked=0,active` |
| `character_archives` | PK/FK postaci, właściciel/event z FK, JSON snapshotu wydarzenia/formularza/tekstowych odpowiedzi, status/czas/rewizja |
| `notifications` | Odbiorca/event/postać/decyzja z FK, rodzaj/czas/odczyt; UNIQUE decyzji, bez kopii odpowiedzi i komentarza |
| `notifications_owner` | Indeks właściciela/czasu powiadomienia |

Nie dopisuje fikcyjnej historii lub powiadomień dla dawnych decyzji. Kolejny start nie powtarza backfillu. Runner cofa cały oczekujący zestaw przy błędzie DDL/backfillu/postflight. Preflight dodatkowo kontroluje dyspozycje, czyste wycofane odpowiedzi, właściciela/event/status/rewizję i brak zdjęć w archiwum oraz relacje powiadomień. Naruszenia blokują start.

**Konflikt istniejącego `deleted_at` sprzed migracji 6:** `LEGACY_INACTIVE_MAPPING_REQUIRED`, lista ID w `inactiveCharacters`, bez odpowiedzi/kont/sekretów. Nie da się bez decyzji właściciela ustalić, czy dane mają zostać zachowane w archiwum czy nieodwracalnie usunięte. Migracja blokuje start i zachowuje oryginały; nie interpretuje ich automatycznie. Potrzebny jest osobno przejrzany adapter na kopii po rozstrzygnięciu. Wcześniejsze konflikty mapowania etapów 2/3 nadal blokują adopcję.

### Procedura i ryzyka

1. Zatrzymać zapisy; wykonać spójny backup i próbę odtworzenia według [SQLITE-MIGRATIONS.md](SQLITE-MIGRATIONS.md). Zachować prywatnie wersję kodu, checksum i raport.
2. Uruchomić preflight nowego kodu na **kopii**: `node server/preflight.mjs /PRYWATNA/KOPIA.sqlite`. Przejrzeć konflikty i liczniki. Nie usuwać rejestru ani nie nadpisywać checksum.
3. Na izolowanej kopii wykonać migrację/restart, porównać konta/sesje/oryginały oraz pełny test odbiorczy. Sprawdzić miejsce i czas transakcji; duże portrety i snapshoty zwiększają rozmiar bazy. Dopiero osobny przegląd uprawnia wdrożenie w oknie serwisowym.
4. Stary kod nie rozpoznaje wersji 6. Po nowych zapisach preferować poprawkę naprzód. Powrót do wcześniejszego backupu traci późniejsze zapisy i może **ponownie wprowadzić dane już usunięte przez właściciela**. Procedura odtwarzania musi uwzględniać te operacje przed dopuszczeniem ruchu; nie dostarczono automatycznego importu ani odtwarzania.

Ryzyko utraty danych przez samą migrację jest niskie: brak aktualizacji wcześniejszych tabel, checksum, preflight i rollback. Ryzyko zamierzonych operacji usunięcia/archiwizacji jest istotne i jawne: wymagają potwierdzenia oraz CAS. Są transakcyjne, lecz zakończonego usunięcia nie można cofnąć w aplikacji. Oryginały chronione przy migracji są później celowo czyszczone przy żądaniu właściciela albo usuwaniu zdjęć podczas archiwizacji.

Zdjęcia są zapisane inline w JSON SQLite, nie w dodatkowym katalogu uploadów. Serwer włącza `PRAGMA secure_delete=ON`; logiczne rekordy, kopie wewnętrzne i wszystkie aktualne API/eksporty tracą wybraną treść/zdjęcie. **Nie jest to gwarancja wymazania wcześniejszych bajtów z WAL, kopii zewnętrznych, eksportów pobranych wcześniej, cache przeglądarki, snapshotów dysku lub pamięci urządzenia.** Dawne ramki WAL i backupy podlegają prywatnej polityce retencji. Operacyjnie po zatrzymaniu wszystkich klientów/pisarzy można wykonać zweryfikowany checkpoint `PRAGMA wal_checkpoint(TRUNCATE)` oraz w oknie serwisowym `VACUUM` z odpowiednim wolnym miejscem; wynik i samodzielną kopię trzeba sprawdzić. Nie uruchamiać tych operacji w migracji ani przy każdym HTTP DELETE, nie kopiować samego pliku aktywnego WAL i nie usuwać ręcznie WAL. Nawet te czynności nie gwarantują fizycznego wymazania snapshotów/nośnika. Nie wykonano ich na produkcji.

## API Etapu 4

Mutacje zachowują sesję, Origin i JSON; poniższe endpointy nie przyjmują dowolnego właściciela z klienta.

| Endpoint | Uprawnienie/kontrakt |
|---|---|
| `GET /api/events/:id/administration` | Organizer; event, uczestnicy, zespół z nazwą/e-mailem/ID |
| `GET /api/events/:id/accounts?q=...` | Organizer; ograniczone wyszukiwanie kont |
| `PUT/DELETE /api/events/:id/grants/:userId` | Organizer; obowiązkowa rewizja wydarzenia, opcjonalne `role` tylko przy PUT |
| `GET /api/events/:id/characters` | Organizer; metadane aktywnych kart, bez odpowiedzi |
| `POST /api/events/:id/character-locks` | Organizer; `{characters:[{id,expectedRevision}],locked}` |
| `POST /api/events/:id/character-archives` | Organizer; lista jak wyżej, `expectedEventRevision`, `confirmArchive:true,confirmCompleted:true`, zamknięte zapisy |
| `DELETE /api/characters/:id` | Właściciel aktywnej/archiwalnej; `{expectedRevision,confirmDelete:true}` |
| `POST /api/characters/:id/archive` | Właściciel aktywnej; `{expectedRevision,confirmArchive:true}` |
| `GET /api/archives` | Wyłącznie własne archiwum tekstowe |
| `POST /api/characters/:archiveId/reuse` | Właściciel; `{eventId,expectedSchemaRevision}` → nowy szkic |
| `POST /api/organizer/characters/decisions` | MG/organizer jednego eventu; `{eventId,status,feedback?,characters:[{id,expectedRevision}]}` |
| `GET /api/notifications` | Własne powiadomienia |
| `POST /api/notifications/:id/read` | Odbiorca; `{}`, idempotentny czas pierwszego odczytu |

Pełny eksport schematu zachowuje aktywne postacie (w tym szkice) z obiema historiami, tekstowe archiwa z ich oryginalnym formularzem/kontekstem i historiami, minimalne ślady wycofania oraz pozostałe źródła i legacy rekordy po wymaganym czyszczeniu. Nie zawiera sekretów kont/sesji ani treści usuniętych postaci/zdjęć archiwalnych. Prywatne notatki MG nadal nie istnieją; `gmNotes:[],gmNotesAvailable:false` opisuje ten fakt.

## Test odbiorczy

Na izolowanym serwerze testowym z fikcyjnymi kontami, osobne sesje/przeglądarki organizatora, MG i gracza:

1. Organizator otwiera panel → Administracja wydarzeń, tworzy nieopublikowane wydarzenie, ustawia nazwę/termin/lokalizację/opis. Otwiera formularz postaci, konfiguruje sekcje/pola i ręcznie zapisuje. Następnie publikuje wydarzenie i otwiera zapisy.
2. MG rejestruje konto. Organizator wyszukuje je i nadaje `gm` tylko temu wydarzeniu. Sprawdzić, że MG nie ma administracji, wyszukiwarki kont ani eksportu i nie może nadać sobie praw. Spróbować odebrać ostatniego organizatora — odmowa.
3. Gracz rejestruje się, wybiera wydarzenie, dołącza i zapisuje niekompletny szkic. Odświeża/loguje ponownie — zapis i uczestnictwo pozostają. MG nie widzi szkicu także przez bezpośredni GET/PATCH jego ID.
4. Gracz uzupełnia dane, dołącza zdjęcie i wysyła. MG kieruje do poprawy z komentarzem; gracz widzi trwałe powiadomienie, oznacza je jako przeczytane, poprawia i wysyła ponownie. MG akceptuje. Historia ma prawidłowych aktorów/czasy/statusy, edycja MG jest odrębna od decyzji.
5. Zmienić wysłaną postać: zapis faktycznych zmian cofa do szkicu i ukrywa ją w MG. Zapis bez zmian nie cofa. Ponowne wysłanie wraca do kolejki. Walidacja nowej akceptacji używa bieżącego formularza.
6. Organizator blokuje jedną lub zaznaczone karty. Gracz widzi „Karta zablokowana”; API zapisu/wysłania daje 409. Blokada nie zmienia statusu ani nie powiadamia. Nowa postać innego gracza nie jest zablokowana. Odblokowanie zaakceptowanej przez MG i niezależna blokada pozostają osobnymi warunkami.
7. Po wydarzeniu organizator zamyka zapisy, zaznacza istniejące karty, potwierdza zakończenie i archiwizację. Gracz widzi tekst/status/kontekst w Koncie, bez zdjęć. Sprawdzić także pełny eksport oraz kopie wewnętrzne na fixture — bez zdjęcia. Zmiana formularza/eventu nie zmienia archiwum.
8. Organizator tworzy kolejne wydarzenie/formularz. Gracz używa archiwum jako podstawy: nowy szkic na inne wydarzenie, zgodne odpowiedzi, brak fotografii/akceptacji/historii, ponowna zwykła weryfikacja. Niepasujący tekst zostaje w archiwum. Druga aktywna postać na ten event jest odrzucona 409.
9. Osobno usunąć zaakceptowaną lub zablokowaną postać: anulowanie potwierdzenia nic nie robi; potwierdzenie czyści treść i kopie, pozostawia uczestnictwo, pozwala stworzyć nową kartę. MG nie przywraca. Usunąć też archiwalną kopię. W nowych API/eksporcie nie może być usuniętej treści.
10. Sprawdzić drugie wydarzenie i konto: MG A nie czyta/recenzuje B, cudze archiwum/powiadomienia niedostępne. Odebranie grantu działa w otwartej sesji i po restarcie. Dwie równoczesne edycje oraz zbiorcza operacja ze starą rewizją dają 409 bez częściowego zapisu; lokalna praca pozostaje.
11. Sprawdzić nowe ekrany, kreator i kartę klawiaturą oraz przy 1440, 980, 390 i 320 px. Puste listy, niedostępna postać, brak praw i błędy mają komunikaty, bez poziomego przewijania lub niewidocznych etykiet.

Powtarzalne sprawdzenie:

```bash
npm ci
npm run verify
node scripts/validate-catalog.mjs
# Playwright jest opcjonalnym narzędziem testowym poza zależnościami aplikacji.
PLAYWRIGHT_MODULE=/tmp/ursunalia-browser/node_modules/playwright-core/index.mjs node scripts/smoke-mvp.mjs
PLAYWRIGHT_MODULE=/tmp/ursunalia-browser/node_modules/playwright-core/index.mjs node scripts/smoke-characters.mjs
PLAYWRIGHT_MODULE=/tmp/ursunalia-browser/node_modules/playwright-core/index.mjs node scripts/smoke-live-schema.mjs
```

Wymagane Chromium i `playwright-core` poza repozytorium, według dokumentacji Etapu 2. Skrypty tworzą/usuwają własne fixture SQLite, nie przyjmują ścieżki do rzeczywistej bazy. `smoke-mvp` używa portu 31849 (`SMOKE_PORT`), `CHROMIUM_PATH`, opcjonalnie `SMOKE_SCREENSHOTS=/tmp`. Scenariusz E2E przechodzi przez rzeczywiste ekrany i Origin/cookie HTTP; dodatkowe odmowy oraz integralność sprawdza przez autoryzowane HTTP i fikcyjną SQLite.

## Granice odbioru

Brak wdrożenia lub migracji produkcji. Liczby rekordów/konfliktów realnego wdrożenia są nieznane. Historyczne źródła nie są pełną historią wszystkich późniejszych odpowiedzi. Powiadomienia odświeżają się przy wejściu/przyciskiem, bez push. Zakończenie wydarzenia potwierdza organizator, nie parser opisowej daty. Operacje zbiorcze mają limit 500; większy zbiór wymaga świadomych partii. Nie dodano importu pełnych kopii, płatności, biletów, rezerwacji, zewnętrznych integracji, uniwersalnych ankiet, rozbudowanych statystyk ani modułu prywatnych notatek. Kontrola Chromium nie zastępuje odbioru przez organizatorów/graczy i prób na rzeczywistych urządzeniach.

## Wyniki końcowe w środowisku chmurowym

Node.js 24.19.0, npm 11.6.2 do instalacji zgodnej z lockfile:

- `npm ci` — powodzenie, bez zmian manifestów/lockfile.
- `npm run verify` — build produkcyjny, **40/40 testów Angular/Vitest**, **115/115 testów Node/HTTP/SQLite**, bez skipped/cancelled.
- `node scripts/validate-catalog.mjs` — wszystkie **10 katalogów** poprawne.
- Trzy skrypty Chromium/HTTP/SQLite — pełny MVP, regresja recenzji i żywego schematu; główne szerokości **1440/980/390/320 px**, bez błędów JS i poziomego overflow. Przejrzano desktop/mobile administracji i konta/archiwum. Zrzuty zawierają tylko fikcyjne dane i nie trafiają do repozytorium.
- `git diff --check` — poprawne. SQL migracji 2–5, manifesty/lockfile i wspólny `src/styles.scss` są identyczne bajtowo z bazą; test przypina dokładne checksum 1–5.

Testy nowych scenariuszy: niezależne blokady i ich no-op, przyszłe karty bez dziedziczenia; rollback partii i konkurencyjne rewizje; właścicielskie usuwanie accepted/locked i archiwum; redakcja `applications/origins/decisions` i brak treści w nowych eksportach; zachowanie innych postaci/ankiet/kont/sesji; trwałość tekstu/statusu/kontekstu i usunięcie obrazów także z nieznanych kluczy; bezpieczne dopasowanie archiwum; izolacja eventów i cofnięcie grantów; prywatne/idempotentne powiadomienia oraz rollback ich awarii; ograniczona wyszukiwarka z polską wielkością liter; inicjalizacja/adopcja/restart/checksum/rollback migracji 6 i blokada niejednoznacznych nieaktywnych rekordów. Kontrolowane HTTP 500 po testowych triggerach potwierdzają rollback, nie oznaczają niewyjaśnionych błędów.

Raport syntetycznego konfliktu: fixture wersji 5 z nieaktywną kartą `historical` zwraca `LEGACY_INACTIVE_MAPPING_REQUIRED`, zachowując identyczne oryginały/rejestr 1–5 i bez tworzenia archiwum lub usuwania danych. Zgodna fixture zachowuje wszystkie poprzednie rekordy i aktywne sesje, dodaje wyłącznie nowe struktury/kontrolki. Żadna z tych liczb nie dotyczy produkcji.

## Korekta PR #8 — kontekst wielu wydarzeń

Teksty Budzenia Niedźwiedzi, Krywulki, Ziemi Braci i kultur Kisleva są teraz przypisane wyłącznie do wydarzenia `ursunalia-2027`; jego typografia, ornamenty i dotychczasowe teksty pozostają. Pozostałe wydarzenia pokazują opis, termin, lokalizację i wskazówki organizatora oraz neutralne informacje o zgłoszeniu. Puste dane/formularze mają komunikaty, nie zastępczą fabułę Ursunaliów.

Wybór wydarzenia w istniejącej liście i wejście bezpośrednim adresem `/#/wydarzenie/:id` ustawia kontekst nawigacji. Link „Ankiety” prowadzi do sekcji formularzy tego wydarzenia; otwarcie postaci, kreatora lub administracji również aktualizuje kontekst. Strona główna zachowuje bieżący wybór w ramach otwartej aplikacji. Wybór jest wyłącznie w pamięci, nie dopisuje danych do SQLite lub localStorage; po wylogowaniu jest czyszczony, a niedostępne wydarzenie nie jest celem linku. Nieznany bezpośredni adres pokazuje niedostępność, bez podstawiania Ursunaliów. Routing z `#` pozostaje kompatybilny z F5 i statyczną demonstracją.

Aktualna weryfikacja poprawki: `npm run verify` — build, **44/44 testy Angulara i 115/115 Node/HTTP/SQLite**, bez pominiętych; walidacja **10/10 katalogów**. Cztery scenariusze Chromium: dodatkowy `smoke-events` oraz wcześniejsze MVP, recenzja i kreator — powodzenie. Nowy scenariusz sprawdza dwa odmienne wydarzenia organizatora, Ursunalia, bezpośrednie linki/F5, przełączanie tej samej trasy, menu „Ankiety”, właściwy formularz i niedostępne ID przy **1440/980/390/320 px**, bez błędów JS lub poziomego overflow. Przejrzano desktopowy i mobilny wygląd. Backend, model, migracje/checksum, wspólne style, zasoby i zależności nie zmieniają się w tej korekcie.

```bash
PLAYWRIGHT_MODULE=/tmp/ursunalia-browser/node_modules/playwright-core/index.mjs node scripts/smoke-events.mjs
```

Skrypt korzysta wyłącznie z własnej tymczasowej fikcyjnej SQLite, domyślnie port 31850. Test ręczny: otworzyć dwa wydarzenia o różnych opisach/terminach/lokalizacjach, przełączać je listą, kliknąć „Ankiety” i wejść w ich formularze; powtórzyć przez adres/F5 i menu mobilne. Ursunalia mają zachować swoje teksty, a pozostałe nie mają ich dziedziczyć.
