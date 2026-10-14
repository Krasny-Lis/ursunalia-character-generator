# R-02 / PR 2 — wydarzenia, uczestnictwo i uprawnienia

Zakres: istniejący Node.js/SQLite i Royal Manuscript. Dodano trwałe wydarzenia, osobne uczestnictwo, otwieranie/zamykanie zapisów i uprawnienia MG/organizatora na wydarzenie. Nadal istnieją stare `forms/applications`, cztery statusy zgłoszeń i historyczne rewizje formularzy. Limit aktywnej postaci na wydarzenie, nowy model postaci, pięć statusów i żywy schemat należą do kolejnych zatwierdzanych PR-ów.

## Dane i migracja 2

Powyższy zakres opisuje historyczny PR 2. Aktualny Etap 2 dodaje osobny model postaci, pięć statusów i historię, wykorzystując te same uczestnictwa/granty. Kontrakt nowych endpointów, podział bootstrapu na postacie i zachowane ankiety oraz migrację 3 opisuje [CHARACTERS-AND-REVIEW.md](CHARACTERS-AND-REVIEW.md). Żywy schemat nadal jest odłożony.

`server/migrations/002-events.sql` to niezmienna, wersjonowana migracja `event_memberships_v1`. Sumy i wpis migracji 1 pozostają bez zmian. Runner z PR 1 zapewnia preflight, kontrolę checksum i atomowy zapis/rollback.

| Tabela | Zawartość i zabezpieczenia |
|---|---|
| `events` | Stabilne ID, definicja danych wydarzenia, niezależne flagi publikacji/otwarcia zapisów, rewizja zapisu. Zapisy nie mogą być otwarte dla nieopublikowanego wydarzenia |
| `event_memberships` | PK `(event_id,user_id)`, status `joined`, data, pochodzenie `legacy_application/explicit`; FK do wydarzenia i konta |
| `event_grants` | PK `(event_id,user_id)`, rola `organizer/gm`; FK do wydarzenia i konta. Grant jest niezależny od uczestnictwa |

Migracja jest addytywna, bez DROP/resetu lub przepisania starych rekordów:

1. Dodaje Ursunalia 2027 z zamrożonych, demonstracyjnych danych v27.2. Przy pierwszej migracji wydarzenie jest opublikowane i ma otwarte zapisy, jak dotychczasowy prototyp. Kolejne starty nie nadpisują informacji ani stanu zapisów z `platform.json`.
2. Z istniejących zgłoszeń i ich dokładnych rewizji formularzy wyprowadza po jednym uczestnictwie na parę użytkownik/wydarzenie. Dotyczy to także dawnej ankiety logistycznej. Konta bez zgłoszeń nie zostają automatycznie zapisane.
3. Uczestnictwo z migracji ma `source=legacy_application`. `joined_at` pochodzi z najwcześniejszego dostępnego `submitted_at` lub `updated_at`; to data dowodu wcześniejszego powiązania, nie odtworzona rzeczywista data zapisu. Jawne dołączenie ma `source=explicit` i bieżący czas UTC.
4. Istniejącym globalnym organizatorom przyznaje prawa **wyłącznie do `ursunalia-2027`**, bez automatycznego uczestnictwa i bez dostępu do przyszłych wydarzeń. Hashe haseł, konta i sesje pozostają nietknięte.

Preflight blokuje `EVENT_MAPPING_REQUIRED`, jeśli stara baza wskazuje inne wydarzenie niż znane Ursunalia 2027. Nie tworzy zastępczego wydarzenia z domyślnymi danymi i nie nadaje do niego praw. `INCONSISTENT_FORM_EVENT` blokuje formularz zmieniający event ID między rewizjami. Te przypadki wymagają osobno przejrzanego mapowania na kopii wdrożenia. Po migracji dodatkowo sprawdza definicje wydarzeń, powiązania formularzy i brak uczestnictwa dla istniejących zgłoszeń; nie naprawia ich automatycznie.

Przed wdrożeniem wykonać backup i próbę odtworzenia według [SQLITE-MIGRATIONS.md](SQLITE-MIGRATIONS.md), następnie preflight na kopii z nowym kodem. Przejrzeć liczby członkostw i uprawnień oraz zaakceptować wynik dla rzeczywistego wdrożenia. W tym PR migracje uruchamiano wyłącznie na fikcyjnych, izolowanych bazach testowych. Dane produkcyjne nie były odczytywane ani migrowane.

## Uprawnienia

| Operacja | Wymaganie |
|---|---|
| Odczyt publicznego wydarzenia/formularzy | Wydarzenie opublikowane; bez logowania |
| Odczyt nieopublikowanego wydarzenia | Uczestnictwo lub grant do tego wydarzenia |
| Dołączenie | Własna sesja; nowe uczestnictwo wymaga publikacji i otwartych zapisów |
| Ponowne dołączenie już zapisanego | Zwraca istniejący rekord także po zamknięciu zapisów; nie zmienia daty/pochodzenia |
| Zapis/wysłanie własnej ankiety | Własność i uczestnictwo we właściwym wydarzeniu; stan zapisów nie blokuje dotychczasowego uczestnika |
| Lista i decyzje dotyczące zgłoszeń | `gm` lub `organizer` **w wydarzeniu zgłoszenia** |
| Zmiana wydarzenia, otwarcie/zamknięcie zapisów, publikacja formularzy, granty | `organizer` **w tym wydarzeniu** |
| Utworzenie nowego wydarzenia | Dotychczasowa globalna rola `organizer` jako prawo tworzenia; twórca dostaje grant tylko do nowego wydarzenia |

Globalna rola nie daje dostępu do cudzej kolejki, publikacji formularza, zmiany wydarzenia ani grantów. Gracz nie nadaje sobie roli przez rejestrację lub dołączenie. MG może otrzymać grant bez zapisania się jako gracz. Organizatorem danego wydarzenia może zostać także konto z globalną rolą `participant`: jego prawo dotyczy tego wydarzenia i nie zmienia globalnego konta ani uprawnień tworzenia kolejnych wydarzeń.

Nie można usunąć ani zdegradować ostatniego organizatora wydarzenia. Odebranie grantu nie wylogowuje użytkownika, nie usuwa uczestnictwa i działa przy kolejnym żądaniu API. Nowe konto zaufanego administratora utworzone przez `ADMIN_EMAIL/ADMIN_PASSWORD` dostaje prawa do Ursunaliów 2027; konfiguracja istniejącego konta nie przywraca odebranych praw po restarcie.

Źródłem uprawnienia do recenzji jest przypięty formularz odczytany z SQLite, a nie event ID przesłany przez klienta. Formularza nie można przenieść między wydarzeniami przez opublikowanie nowej rewizji tego samego ID. Właściciel nadal ma dostęp wyłącznie do swoich zgłoszeń. Cookies HttpOnly/SameSite, hashowanie i kontrola Origin pozostają aktywne. Zmiany grantów, dołączenia, danych wydarzeń i chronione zapisy organizatora są transakcyjne; odpowiedź sukcesu następuje po COMMIT.

## API

Nowe endpointy pozostają na tej samej domenie co aplikacja. Zapisy wymagają sesji, `Content-Type: application/json` oraz właściwego `Origin`, także dla DELETE.

| Endpoint | Kontrakt |
|---|---|
| `GET /api/events` | Widoczne publiczne oraz własne wydarzenia; nie zwraca prywatnych eventów innych użytkowników |
| `GET /api/events/:id` | Dane wydarzenia, `published`, `registrationsOpen`, `revision` i opisowy `status`; 404 dla niewidocznego wydarzenia |
| `POST /api/events` | `id`, `name`, opcjonalne `subtitle/date/location/locationNote/description` oraz flagi (domyślnie false). Tworzy event i grant twórcy; bez uczestnictwa |
| `PATCH /api/events/:id` | `expectedRevision` i zmieniane dane/flagi; 409 przy nieaktualnej rewizji. Nie zmienia ID |
| `POST /api/events/:id/join` | Puste `{}`; zwraca własny rekord uczestnictwa. Nie przyjmuje cudzego user ID ani roli |
| `PUT /api/events/:id/grants/:userId` | `{ "role": "gm" }` lub `organizer`; tylko organizer tego eventu, tylko istniejące konto |
| `DELETE /api/events/:id/grants/:userId` | Puste `{}`; odebranie praw z ochroną ostatniego organizatora |

Przykład zmiany zapisów po odczycie rewizji wydarzenia:

```json
{ "expectedRevision": 1, "registrationsOpen": false }
```

`GET /api/bootstrap` rozszerzono o `events`, własne `memberships` i `eventGrants`. Formularze są filtrowane widocznością wydarzenia. Zgłoszenia nadal mają dotychczasowy kontrakt i wskazują własną historyczną rewizję, bez migracji odpowiedzi.

`GET /api/organizer/applications` zwraca wyłącznie zgłoszenia z wydarzeń aktora. Opcjonalne `?eventId=...` wymaga grantu do wskazanego eventu. Bez grantów API zwraca 403. `PATCH /api/organizer/applications/:id` sprawdza właściwe wydarzenie w bazie. Dane właściciela, w tym `userId` potrzebne do nadania grantu, są dostępne tylko w autoryzowanej odpowiedzi recenzenta.

## Istniejący frontend

Style i układ Royal Manuscript nie zostały zmienione. W trybie serwerowym istniejący ekran `/wydarzenie/:id` korzysta z danych SQLite i pokazuje tylko ankiety tego wydarzenia. Nowy uczestnik używa obecnego przycisku z etykietą „Dołącz i wypełnij”: osobne dołączenie poprzedza utworzenie lokalnego szkicu, a samo członkostwo jest trwałe nawet bez wysłania odpowiedzi. Zamknięte zapisy pozostawiają użytkownika na ekranie z komunikatem; nie tworzą szkicu. Dotychczasowy uczestnik kontynuuje normalnie.

Menu/panel recenzji i kreator używają grantów wydarzeń, zamiast ufać globalnej roli konta. MG nie dostaje akcji zarządzania formularzem. Wylogowanie czyści cache prywatnych danych i praw także przy awarii odświeżenia. Tryb demonstracyjny zachowuje dotychczasowe lokalne działanie.

Nie dodano nowego ekranu administracyjnego do tworzenia wydarzeń, przełączania zapisów i grantów — te operacje są dostępne przez API opisane powyżej. Istniejący kreator nadal tworzy nową ankietę dla Ursunaliów 2027; edytowanie formularzy innych wydarzeń jest możliwe przez wskazanie istniejącego formularza, a nowe formularze innych wydarzeń można publikować przez API. Rozbudowa panelu administracyjnego wymaga osobnego uzgodnienia; nie jest ukrytą przebudową UI w tym PR.

## Weryfikacja i ryzyka

Polecenia: `npm run verify`, `node scripts/validate-catalog.mjs`. Testy obejmują rejestrację bez członkostwa, jawne dołączenie, trwałe dane/stan zapisów, pierwsze zgłoszenie po zamknięciu dla dotychczasowego uczestnika, izolację MG i organizatorów między wydarzeniami, odmowę eskalacji uprawnień, odebranie grantu po restarcie, ochronę ostatniego organizatora, odmowy CSRF oraz migrację zarówno starej, jak i wersjonowanej bazy. W frontendzie testowane są istniejący kreator, rozpoczęcie ankiety, błąd zamkniętych zapisów, czyszczenie cache i właściwe wydarzenie wybrane przez routing.

Ryzyko utraty istniejących danych jest ograniczone: migracja nie aktualizuje ani nie usuwa rekordów czterech oryginalnych tabel. Ryzyko operacyjne to blokada startu dla nieznanego mapowania i konieczność sprawdzenia wnioskowanych uczestnictw/grantów na kopii. Zmiana SQL po zastosowaniu migracji 2 spowoduje błąd checksum. Po nowych zapisach nie wolno wracać do backupu bez uwzględnienia tych zapisów. Stary serwer z PR 1 nie rozpoznaje wersji 2 i odmówi startu — preferować poprawkę naprzód. Pełna procedura rollbacku/kopii znajduje się w dokumentacji migracji. Nie wykonano wdrożenia ani wizualnego porównania w przeglądarce; testy DOM nie zastępują tego ostatniego.
