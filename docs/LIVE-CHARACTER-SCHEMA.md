# Etap 3 — kreator i żywy schemat postaci

Baza: `feature/royal-manuscript-rebuild`. Jeden PR rozwija istniejący Angular/Node.js 24/SQLite. Style i zasoby Royal Manuscript, sekcje, pola, opisy, opcje, porządek, DnD, podgląd i import definicji pozostają. Nie powstaje nowy backend, system niezależnych ankiet ani moduł notatek/płatności. Testy korzystają wyłącznie z fikcyjnych, izolowanych baz.

**Aktualizacja Etapu 4:** aktywne postacie nadal korzystają z jednego schematu. Archiwa zachowują własny tekstowy snapshot bez zdjęć; usunięte rekordy nie mają odpowiedzi ani przywracania. Usunięcie i archiwizacja celowo czyszczą odpowiednie kopie wewnętrzne, również źródła migracji. Bieżący cykl i eksport: [MVP-STAGE-4.md](MVP-STAGE-4.md).

## Aktualne źródło prawdy

`character_schemas` ma jeden rekord na wydarzenie: stabilne ID formularza, bieżący JSON i techniczną rewizję. Wszystkie odczyty postaci i walidacja wysyłki/każdej nowej akceptacji używają tego rekordu. Zmiana obejmuje szkice, wysłane, skierowane do poprawy, zaakceptowane, odrzucone; archiwa są wyłączone z późniejszych zmian, a usunięte rekordy nie przechowują treści. Nowe wymagane pola są bez odpowiedzi; stare statusy pozostają bez zmian, nawet gdy postać wymaga uzupełnienia według nowego schematu.

Historyczne `forms`, `applications`, `event_character_forms` i kolumny `characters.form_id/form_revision` są zachowanymi kotwicami pochodzenia/FK. Nie są wersjami biznesowymi wybieranymi przez gracza ani źródłem walidacji. Zapis schematu nie dopisuje kolejnej historycznej definicji do `forms`. Dodatkowa ankieta logistyczna i jej odpowiedzi pozostają nietknięte, bez nowych funkcji kreatora dla niezależnych ankiet.

## Ręczny kreator

„Zapisz formularz” zapisuje całą definicję. Lokalne edycje są wyłącznie w pamięci, bez publikacji/autosave i bez zapisu lub odczytu trwałego szkicu kreatora w localStorage. Stare klucze pozostają nietknięte jako dotychczasowe kopie; nie są automatycznie przywracane. Tryb demo zapisuje dopiero zatwierdzony schemat w swoim istniejącym stanie demonstracyjnym, nie szkic kreatora.

Router i `beforeunload` ostrzegają przed utratą niezapisanej pracy. Podgląd jest lokalny. Import definicji zachowuje tożsamość aktualnego formularza i wydarzenia; podlega tej samej walidacji i analizie co edycja ręczna. Nie importuje całej kopii bazy/postaci. „Nowy” w wydarzeniu z formularzem otwiera istniejący formularz; API nie pozwala utworzyć drugiego.

409 zachowuje pola, kolejność, opisy i bazową rewizję użytkownika. Nie ma automatycznego nadpisania/scalania. Można pobrać niezapisany formularz JSON, a następnie jawnie wczytać aktualną definicję po potwierdzeniu odrzucenia lokalnych zmian. Błąd odświeżenia po udanym zapisie nie jest interpretowany jako nieudany commit. Nie dodano interfejsu ręcznego scalania dużych konfliktów.

## Analiza i potwierdzenie

Istniejące zapisane demo również odczytuje jeden zatwierdzony schemat dla postaci. Zgodne snapshoty przechodzą do bieżącej definicji bez zmiany odpowiedzi i bez przepisania oryginalnego localStorage przy odczycie. Destrukcyjne mapowanie blokuje odczyt z komunikatem i zachowuje pełną kopię zamiast automatycznego rozstrzygnięcia.

Serwer porównuje stabilne ID sekcji, pól i opcji. Usunięcie sekcji/pola/opcji i zmiana typu są destrukcyjne. Liczy **różne aktywne postacie** faktycznie tracące odpowiedzi oraz liczbę pól z utratą. Pole kompatybilności `affectedDeletedCharacters` od Etapu 4 wynosi 0: usunięte karty nie mają odpowiedzi, a archiwa są niezmienne. Jedna postać z kilkoma zmienianymi polami liczy się raz. Przesunięcie pola między sekcjami nie usuwa odpowiedzi, gdy jego ID i typ pozostają.

- Usunięcie pola/sekcji usuwa wartości tych pól po potwierdzeniu.
- Zmiana typu usuwa starą wartość, bez zgadywania konwersji.
- Usunięcie opcji usuwa wybraną wartość single/select lub tylko te elementy multi, zachowując pozostałe.
- Nieznane historyczne klucze pozostają zachowane. Kolizja takiego klucza z nowym polem lub nieznanej dawnej opcji z nową opcją wymaga jawnego potwierdzenia zamiast cichej reinterpretacji wartości.
- Etykiety, opisy, kolejność, wymagalność i limity nie czyszczą automatycznie odpowiedzi. Pełna walidacja stosuje nowe wymagania przy wysyłce/akceptacji.

Dialog pokazuje liczby, oferuje pełną kopię JSON i wymaga zaznaczenia potwierdzenia. Usunięcie elementu w lokalnym kreatorze nie jest zgodą na zmianę zapisanych odpowiedzi. Potwierdzenie jest wymagane także przy zmianie destrukcyjnej z zerem odpowiedzi do utraty.

Token analizy jest podpisany HMAC i związany z aktorem, wydarzeniem, dokładną definicją, rewizją schematu oraz ID/rewizjami/odpowiedziami wszystkich aktywnych postaci. Wycofanie/archiwizacja w międzyczasie również unieważnia analizę. Ważność 5 minut. Zapis odpowiedzi, decyzja, nowa postać, inne zmiany schematu lub restart unieważniają odpowiednio analizę. Nie przechowujemy historii analiz/eksportów. Serwer ponownie liczy skutki pod `BEGIN IMMEDIATE`; schemat, odpowiedzi i rewizje zapisuje atomowo. Błąd w środku cofa wszystko.

Każda rzeczywista zmiana schematu zwiększa rewizję wszystkich aktywnych postaci wydarzenia, chroniąc przed starymi klientami. Statusy, daty wysłania, uczestnictwa i historie decyzji/edycji MG pozostają. Sam zapis schematu nie udaje decyzji ani edycji odpowiedzi przez MG. Nieaktualna rewizja formularza lub postaci → 409. Edycja MG wymaga także `expectedSchemaRevision`; gracz przekazuje rewizję w `form.revision`.

## API i eksport

| Endpoint | Prawo i dane |
|---|---|
| `GET /api/events/:id/character-schema` | Formularz widocznego wydarzenia; jeden aktualny JSON |
| `POST /api/events/:id/character-schema/preview` | Organizer wydarzenia; `{definition,expectedRevision}`; zmiany, liczby i token |
| `PUT /api/events/:id/character-schema` | Organizer; pełna definicja i oczekiwana rewizja; przy destrukcji także `confirmLoss:true,confirmationToken` |
| `GET /api/events/:id/character-schema/export` | Wyłącznie organizer wydarzenia; pełna spójna kopia JSON |

Nowy formularz ma `expectedRevision:0`, a istniejący — bieżący licznik. Tożsamości eventu/istniejącego formularza nie można podmienić. Dawne `/api/forms` nie może publikować kolejnej historycznej wersji aktualnego formularza postaci ani ominąć analizy. Pozostaje adapterem zastanych ankiet i pierwszego jawnego przypisania istniejącej definicji. Grant MG uprawnia do recenzji, nie zarządzania schematem lub pełnego eksportu. Sesje, Origin, limity JSON, FK i izolacja eventów pozostają aktywne.

Eksport w jednym snapshotcie obejmuje: wydarzenie, aktualny formularz, aktywne postacie (także szkice), odpowiedzi/statusy/rewizje/właścicieli i obie historie, tekstowe archiwa z historycznym schematem/kontekstem, minimalne ślady usuniętych kart oraz pozostałe źródła migracji, oryginalne definicje i powiązane legacy zgłoszenia po wymaganym czyszczeniu. Nigdy nie eksportuje usuniętej treści lub archiwalnych zdjęć. Bez haseł, hashy, tokenów i sesji. Plik zawiera dane uczestników — przechowywać prywatnie. To kopia danych formularza, nie automatyczny import lub backup całej SQLite.

Aktualny backend nie posiada notatek MG. Eksport jawnie podaje `gmNotes:[]` i `gmNotesAvailable:false`; nie deklaruje eksportu nieistniejących notatek. Jeżeli notatki zostaną dodane, kontrakt wymaga dołączenia ich wyłącznie do autoryzowanego eksportu, nigdy do API gracza.

## Migracja 5 i ochrona oryginałów podczas adopcji

Migracje 1–4 i ich checksum pozostają niezmienne. Migracja `live_character_schema_v1` dodaje `character_schemas` oraz `character_schema_origins`. Bieżący schemat bierze z **jawnego, dotychczasowego mappingu** wydarzenia, nie z rankingu dat/tytułów postaci. Dla legacy adopcji stosowane są te same wcześniejsze zasady rozpoznania formularza postaci i ankiety logistycznej.

Przed zmianą rewizji postaci zapisuje dokładny oryginalny rekord w `character_schema_origins`, włącznie z oryginalnym ciągiem JSON odpowiedzi. Konta, sesje, `forms/applications`, decyzje i rejestry edycji nie są przepisywane ani usuwane. Postacie zachowują odpowiedzi i statusy; techniczna rewizja wzrasta o 1, aby stare klienty nie nadpisały danych. Restart nie kopiuje źródeł ponownie.

Preflight tylko do odczytu pokazuje `liveSchemaMapping`: liczbę postaci, konflikty `{characterId,fieldIds}` i ostrzeżenia walidacyjne bez wartości odpowiedzi. Usunięte odpowiedzi/opcje, zmienione typy z odpowiedziami i kolizje kluczy blokują migrację przez `LIVE_SCHEMA_MAPPING_REQUIRED`. Nie wybieramy rekordu, nie konwertujemy ani nie kasujemy wartości, nie potwierdzamy za właściciela. Niekompletność lub zastana nieprawidłowość bez utraty danych jest ostrzeżeniem; status nie zmienia się, a nowa akceptacja podlega pełnej walidacji.

Przed wdrożeniem:

1. Zatrzymać zapisy; wykonać spójny backup i próbę odtworzenia według [SQLITE-MIGRATIONS.md](SQLITE-MIGRATIONS.md).
2. Uruchomić `node server/preflight.mjs /SCIEZKA/DO/KOPII.sqlite` nowym kodem, na prywatnej kopii. Przejrzeć mapping, ostrzeżenia i konflikty.
3. Przy konflikcie potrzebna jest decyzja właściciela oraz osobno przejrzany adapter migracji na kopii. Nie zmieniać oryginałów, nie usuwać rejestru, nie omijać checksum i nie rozstrzygać przez wybór najnowszej postaci. Ten PR nie dostarcza uniwersalnego ręcznego importu/scalania.
4. Na izolowanej kopii uruchomić zgodny klient/backend, porównać oryginały, źródła, konta/sesje i historie; powtórzyć start i przepływ kreator → gracz → MG. Dopiero po przeglądzie wdrożyć w oknie serwisowym.
5. Stary kod nie rozpoznaje wersji 5. Po nowych zapisach preferować poprawkę naprzód; odtworzenie wcześniejszego backupu utraci późniejsze zapisy. Zachować pliki i backup, bez DROP/resetu.

Nie odczytywano ani nie migrowano produkcji. Nie wiadomo, ile konfliktów zawiera rzeczywiste wdrożenie. Ryzyko utraty oryginałów przez migrację jest ograniczone kopią źródeł i rollbackiem; ryzykiem operacyjnym jest odmowa startu przy niezgodności, czas blokady zapisu i przywrócenie zbyt starego backupu. Kopia źródeł zwiększa rozmiar bazy, zwłaszcza przy portretach — na kopii trzeba sprawdzić wymagane miejsce i czas migracji. Po świadomie potwierdzonym czyszczeniu w działającej aplikacji późniejsze odpowiedzi są dostępne w pobranym eksporcie, jeśli organizator go wykonał; źródła migracji nie są historią wszystkich późniejszych zmian.

## Weryfikacja i odtworzenie

```bash
npm ci
npm run verify
node scripts/validate-catalog.mjs
PLAYWRIGHT_MODULE=/tmp/ursunalia-browser/node_modules/playwright-core/index.mjs node scripts/smoke-characters.mjs
PLAYWRIGHT_MODULE=/tmp/ursunalia-browser/node_modules/playwright-core/index.mjs node scripts/smoke-live-schema.mjs
```

Smoke wymaga builda, Chromium i opcjonalnego `playwright-core` zainstalowanego poza repozytorium zgodnie z instrukcją Etapu 2. Sam tworzy i usuwa fikcyjną SQLite, nie przyjmuje ścieżki do produkcji. Nowy skrypt domyślnie używa portu 31848 (`SMOKE_PORT`), `CHROMIUM_PATH` i opcjonalnego `SMOKE_SCREENSHOTS=/tmp`.

Backend testuje adopcję/restart/rollback, konflikt mapowania typu/opcji/usuniętego pola, dokładne zachowanie źródeł, wszystkie statusy/usunięte, dodanie wymaganego pola, walidację nowej akceptacji/wysyłki, CAS równoczesnych edytorów, nieaktualne potwierdzenie po zmianie postaci, atomowość i uprawnienia eksportu. Frontend testuje brak trwałego szkicu, lokalny podgląd i DnD, ręczny zapis, ostrzeżenia, zachowanie pracy na 409 i obowiązkowe potwierdzenie.

Przeglądarka sprawdza ręczny zapis, dwóch edytorów, anulowanie nawigacji, brak localStorage kreatora, dodanie pola, aktualny formularz istniejącej postaci, 422 przy akceptacji niekompletnej, pełny eksport przed stratą, potwierdzenie usunięcia pola, zachowanie statusu, poprawienie/wysłanie i akceptację. Kontrola szerokości: 1440, 980, 390 i 320 px, bez poziomego overflow; dodatkowo pełny przepływ recenzji z Etapu 2. Testy nie zastępują kontroli na rzeczywistych urządzeniach i nie stanowią wdrożenia.

Wynik końcowy w chmurze (Node.js 24.19.0): `npm ci`, produkcyjny build i `npm run verify` — powodzenie; **32 testy Angulara oraz 94 Node/SQLite**, bez pominiętych. Wszystkie **10 katalogów** poprawne. Oba skrypty Chromium/API/SQLite zakończyły się powodzeniem; brak błędów JS i poziomego overflow, przejrzano desktopowy/mobilny wygląd kreatora. Kontrolowane HTTP 500 w testach są wymuszeniami rollbacku, nie nierozwiązanymi błędami.

Raport testowych konfliktów adopcji: osobne fixture usuniętego pola, wybranej opcji, zmienionego typu, kolizji starego klucza i kolizji opcji otrzymują `LIVE_SCHEMA_MAPPING_REQUIRED`, z ID postaci i pól. Wszystkie oryginały oraz wpisy migracji 1–4 pozostają identyczne; nie tworzono schematu docelowego ani nie wybierano rozstrzygnięcia. Na zgodnej fixture adopcja zachowuje dokładny JSON źródłowy, konta/sesje, statusy i historyczne definicje; zwiększa tylko techniczną rewizję postaci i zapisuje nowy schemat. Nie jest to raport danych produkcyjnych.
