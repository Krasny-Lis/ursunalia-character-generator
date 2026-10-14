# SQLite — migracje, preflight i kopie zapasowe

Zakres R-02 / PR 1: wyłącznie fundament migracji obecnej bazy v27.2. Nie zmienia reguł, endpointów, formularzy ani danych zgłoszeń. Nie dodaje wydarzeń ani nowego modelu postaci. Podczas przygotowania tej zmiany operacje wykonano tylko na izolowanych bazach testowych, bez dostępu do bazy produkcyjnej.

Kolejna migracja (R-02 / PR 2), `event_memberships_v1`, dodaje wydarzenia, uczestnictwo i granty, zachowując oryginalne tabele i rekordy. Jej mapowanie, uprawnienia oraz dodatkowe kontrole preflight opisano w [EVENTS-AND-PERMISSIONS.md](EVENTS-AND-PERMISSIONS.md). Migracja 1 pozostaje niezmienna. Przed wdrożeniem wersji 2 sprawdzić na kopii wnioskowane członkostwa i przyznanie istniejącym organizatorom praw wyłącznie do Ursunaliów 2027.

## Co robi serwer przy starcie

Aktualny Etap 4 dodaje migrację 6 (`mvp_character_lifecycle_v1`): blokady, dyspozycje, tekstowe archiwum i powiadomienia. Migracje 1–5/checksum oraz istniejące rekordy pozostają niezmienione. Dawne nieaktywne karty wymagają decyzji mapowania (`LEGACY_INACTIVE_MAPPING_REQUIRED`); brak automatycznego archiwizowania/usuwania. Procedura, usuwanie kopii i ograniczenia WAL/backupów: [MVP-STAGE-4.md](MVP-STAGE-4.md). Runner wykonuje brakujące wersje do 6 w jednej transakcji. Poniżej historyczny opis Etapu 3.

Etap 3 dodaje migrację 5 (`live_character_schema_v1`), jeden schemat wydarzenia i bezstratną kopię źródłową istniejących postaci. Preflight blokuje nierozstrzygniętą utratę odpowiedzi przez `LIVE_SCHEMA_MAPPING_REQUIRED`; nie usuwa lub nie konwertuje odpowiedzi automatycznie. Migracje 1–4 pozostają niezmienne. Procedura i ryzyka: [LIVE-CHARACTER-SCHEMA.md](LIVE-CHARACTER-SCHEMA.md). W Etapie 3 runner wykonywał brakujące wersje do 5; aktualny runner wykonuje je do 6 w jednej transakcji.

Poprawki PR #6 dodają migrację 4 (`character_edits_v1`): pusty trwały rejestr metadanych edycji MG. Nie zmienia migracji 1–3, istniejących rekordów ani decyzji; nie rekonstruuje dawnych edycji. Przy aktualizacji z wersji 3 stosuje się ta sama procedura kopii, preflight i transakcyjnego rollbacku. Starszy kod odmówi startu bazy z wersją 4. Szczegóły: [CHARACTERS-AND-REVIEW.md](CHARACTERS-AND-REVIEW.md).

Aktualna migracja 3 (`characters_review_v1`, Etap 2) dodaje model postaci, mapping formularza i historię decyzji. Zachowuje wszystkie oryginalne tabele/rekordy; nierozpoznane ankiety i potencjalne kolizje blokują migrację zamiast automatycznego wyboru. Raport, mapowanie, testy i procedura przełączenia: [CHARACTERS-AND-REVIEW.md](CHARACTERS-AND-REVIEW.md). Wersje 1/2 pozostają niezmienne. Poniższy opis adopcji dotyczy bazowej migracji 1; aktualny runner następnie wykonuje wszystkie brakujące wersje do 6 w tej samej transakcji. Przed wdrożeniem wersji 3 wymagany jest przegląd preflight na kopii. Nie wykonano migracji na produkcji.

`server/migrations.mjs` zawiera uporządkowane, niezmienne migracje. Pierwsza (`version=1`, `baseline_v27_2`) jest identycznym DDL czterech obecnych tabel: `users`, `sessions`, `forms`, `applications`.

- Pusta baza: tworzy obecne cztery tabele i rejestr.
- Rozpoznana baza v27.2 bez rejestru: dodaje wyłącznie `schema_migrations` i wpis `operation=adopt`; nie wykonuje DDL tabel biznesowych ani nie przepisuje ich rekordów.
- Baza z rejestrem: sprawdza wszystkie wpisy i aktualny schemat, następnie wykonuje tylko brakujące wersje. Kolejny start nie zmienia dat istniejących wpisów.
- Nieznana, częściowa, uszkodzona lub niespójna baza: blokuje start przed seedingiem oraz zmianą trybu dziennika. Nie naprawia jej automatycznie.

Rejestr zapisuje `version`, `name`, SHA-256, `applied_at` (UTC) i `operation` (`initialize/adopt/apply`). Checksum obejmuje wersję, nazwę, dokładny SQL migracji oraz SQL oczekiwanego schematu. To kontrola przypadkowej zmiany wdrożonych migracji, nie podpis kryptograficzny przeciwko administratorowi modyfikującemu jednocześnie kod i bazę. Nie edytować zastosowanej migracji i nie nadpisywać checksum, aby ominąć błąd: przyszła zmiana wymaga nowej wersji.

Runner otwiera `BEGIN IMMEDIATE`, ponawia preflight pod blokadą zapisu, wykonuje wszystkie oczekujące operacje i ich wpisy, sprawdza wynik, a następnie `COMMIT`. Błąd SQL lub końcowej kontroli powoduje `ROLLBACK` całego oczekującego zestawu. Wcześniej zatwierdzone migracje zostają zachowane. Nie przejmuje zewnętrznej transakcji. Obsługa blokad jest fail-closed: przy zajętej bazie ponowić start dopiero po ustaleniu, kto pisze; nie uruchamiać dwóch wdrożeń naraz.

Przy przyszłych migracjach dodać kolejny numer, nazwę, `sql` i `schemaSql` (pełny oczekiwany schemat biznesowy po tej wersji, bez rejestru). Nie umieszczać sterowania transakcją, PRAGMA, ATTACH/DETACH, VACUUM ani operacji zewnętrznych w SQL. Konfigurację SQLite i rejestr obsługuje runner. Dodawać testy fixture, ponownego uruchomienia i błędu w połowie. Zmiany DDL, seeding i migracje danych w kolejnych PR-ach wymagają osobnego przeglądu; ten PR zachowuje dotychczasowe zasilanie formularzy i tworzenie administratora po migracji.

## Preflight bez migracji

Z katalogu repozytorium, Node.js 24.19.0 (wersja zweryfikowana):

```bash
node server/preflight.mjs /SCIEZKA/DO/KOPII/ursunalia.sqlite
```

Wymagana jest jawna ścieżka. Baza jest otwierana `readOnly`; brak pliku nie tworzy nowego. Narzędzie nie zasila seed, nie tworzy tabel, nie zmienia trybu dziennika i nie naprawia danych. Kontrole są odczytywane w jednym snapshotcie. SQLite może potrzebować dostępu do istniejących plików WAL/SHM przy bazie używanej przez serwer; do audytu preferować spójną kopię.

JSON zawiera `ok`, rozpoznany `kind` (`empty/legacy/versioned/unknown`), zweryfikowaną wersję, wersje oczekujące, liczby rekordów i kody błędów. Bez haseł, hashy sesji, e-maili, odpowiedzi i komentarzy. Nie oznacza weryfikacji wymagań przyszłego MVP ani kompletności szkiców. Kod wyjścia: `0` — kontrola przeszła; `1` — niespójność lub błąd odczytu; `2` — błędne argumenty.

Preflight sprawdza:

- `PRAGMA integrity_check` i `foreign_key_check` (także dla rekordów zapisanych kiedyś z wyłączonym FK).
- Pełny znany DDL: kolumny, CHECK, UNIQUE, PK, FK, defaulty, dodatkowe tabele/indeksy/triggery/widoki. Rozpoznawanie jest zachowawcze: toleruje formatowanie, komentarze i wielkość liter niecytowanych identyfikatorów. Inny równoważny zapis SQL może wymagać ręcznego rozpoznania w osobnym PR, nie jest automatycznie przepisywany.
- Nieznane nagłówki `user_version/application_id`, schemat rejestru, brak/gap/nieznaną wersję, zmienione nazwy/checksum i nieprawidłowe metadane.
- Definicje formularzy i zgodność ID/rewizji JSON z kluczem tabeli; odpowiedzi muszą być poprawnym obiektem JSON. Nie waliduje kompletności postaci, nie stosuje `cleanAnswers`, nie usuwa nieznanych odpowiedzi ani nie przepina starych rewizji.

Przykładowe kody: `SCHEMA_MISMATCH`, `SQLITE_INTEGRITY`, `FOREIGN_KEY_VIOLATIONS`, `MIGRATION_CHECKSUM_MISMATCH`, `UNKNOWN_MIGRATION_VERSION`, `INVALID_FORM_DEFINITIONS`, `INVALID_ANSWERS_JSON`. Zatrzymanie startu jest celowe. Zachować plik i backup, zdiagnozować kopię; nie usuwać rejestru, tabel ani nie resetować bazy. Jeśli naruszony jest schemat CHECK/UNIQUE/FK, migrator nie uzna go za poprawny tylko dlatego, że nazwy kolumn pasują.

## Bezpieczna kopia SQLite

Przed pierwszym startem nowego kodu na istniejącym wdrożeniu: zatrzymać przyjmowanie zapisów, ustalić rzeczywistą ścieżkę `DATABASE_PATH`, utworzyć kopię, zweryfikować ją i wykonać próbne odtworzenie. `.env`, hasła i tokeny nie trafiają do logów ani repozytorium. Baza/backup zawiera dane osobowe, hashe haseł i sesji oraz odpowiedzi — przechowywać poza katalogiem publicznym, z ograniczonym dostępem i szyfrowaniem nośnika/backupów. Nie wysyłać kopii do PR.

Poniższy szablon używa API backup wbudowanego w Node/SQLite, bez dodatkowych pakietów. Obejmuje zatwierdzone dane z WAL i tworzy samodzielną bazę. Nigdy nie kopiować samego głównego pliku aktywnej bazy przez `cp`; może pominąć zatwierdzone transakcje w WAL. Dla stabilnego porównania liczby rekordów utrzymać zatrzymanie zapisów do końca backupu.

Uruchomić ze zweryfikowanymi ścieżkami; katalog docelowy musi istnieć i być prywatny. Szablon odmawia nadpisania pliku backupu:

```bash
set -euo pipefail
umask 077
node --input-type=module - /SCIEZKA/DO/BAZY.sqlite /PRYWATNY/KATALOG/backup.sqlite <<'NODE'
import { DatabaseSync, backup } from 'node:sqlite';
import { openSync, closeSync } from 'node:fs';
const [sourcePath, destinationPath] = process.argv.slice(2);
const source = new DatabaseSync(sourcePath, { readOnly: true });
try {
  closeSync(openSync(destinationPath, 'wx', 0o600));
  await backup(source, destinationPath);
  const check = new DatabaseSync(destinationPath, { readOnly: true });
  try {
    if (check.prepare('PRAGMA integrity_check').all().some(r => r.integrity_check !== 'ok') ||
        check.prepare('PRAGMA foreign_key_check').all().length)
      throw new Error('Backup verification failed');
  } finally { check.close(); }
} finally { source.close(); }
NODE
node server/preflight.mjs /PRYWATNY/KATALOG/backup.sqlite
sha256sum /PRYWATNY/KATALOG/backup.sqlite > /PRYWATNY/KATALOG/backup.sqlite.sha256
```

Jeśli którykolwiek etap się nie powiódł, plik docelowy może być niekompletny; nie traktować go jako zweryfikowanej kopii. Oryginał nie jest modyfikowany. Nie usuwać ani nie nadpisywać poprzedniej dobrej kopii. Zachować wynik preflight bez treści rekordów i identyfikator commita serwera. Checksum pliku pozwala wykryć uszkodzenie podczas przechowywania/przenoszenia; oddzielić ją od sum migracji w rejestrze.

## Odtwarzanie i wycofanie wdrożenia

1. Sprawdzić checksum backupu (`sha256sum -c ...`) i preflight na kopii. Wybrać wersję kodu zgodną z rejestrem: stary kod migratora odmówi startu bazy z nowszą nieznaną wersją.
2. Zatrzymać wszystkie procesy piszące do docelowej bazy i zachować aktualny stan jako dodatkowy backup. Nie nadpisywać jedynego egzemplarza ani bazy uruchomionego serwera.
3. Odtwarzać do **nowego, pustego, prywatnego katalogu**, kopiując zweryfikowaną samodzielną bazę backupu. Nie dokładać do niej starych `-wal`/`-shm` z innej bazy. Ustawić właściwego właściciela i uprawnienia pliku. Użycie innego katalogu pozwala zachować stary zestaw plików do diagnozy.
4. Wykonać preflight odtworzonego pliku. Na izolowanej kopii uruchomić kompatybilny serwer z `DATABASE_PATH` tej kopii, innym portem/origin, bez bootstrapu nowego administratora. Nie dopuszczać ruchu produkcyjnego do próby. Sprawdzić znane konta, sesje (jeśli nie wygasły), liczby rekordów, wszystkie rewizje formularzy i zgłoszenia; nie wypisywać sekretów ani odpowiedzi do raportu.
5. Dopiero po przeglądzie i pozytywnej próbie odtworzenia przełączyć wdrożenie na nową ścieżkę. Zachować poprzedni plik oraz sprawdzony backup; nie wykonywać DROP/resetu jako rollbacku.

Rollback transakcji migratora dotyczy wyłącznie jego oczekujących migracji. Nie cofa późniejszego seedingu/admin bootstrapu ani żądań HTTP. Przywrócenie wcześniejszego backupu po nowych zapisach użytkowników utraciłoby te zapisy i mogłoby ponownie wprowadzić treści/zdjęcia już usunięte w Etapie 4. Potrzebna jest poprawka naprzód albo osobno uzgodnione odtworzenie uwzględniające także żądania usunięcia i archiwizacji przed ponownym dopuszczeniem ruchu. Nie ma automatycznego importu ani przywracania postaci przez MG.

## Testy i granice

```bash
node --test server/migrations.test.mjs
npm run verify
node scripts/validate-catalog.mjs
```

Testy używają `:memory:` i losowych katalogów w systemowym tmp, z fikcyjnymi kontami. Obejmują nową bazę, niezależną fixture starego DDL, adopcję i restart, identyczne JSON/hashe/statusy/daty, użycie starej sesji przez HTTP, checksum/nieznane wersje, odmowy przy zmianie constraints lub uszkodzonym JSON/FK, rollback zmian danych i DDL, końcową kontrolę, preflight read-only oraz backup/odtworzenie ze zmianami w WAL. Istniejące testy API i odmowy dostępu nadal wykonują się bez zmian.

Kontrole nie gwarantują odporności na awarię sprzętu, pełny dysk, błąd administratora lub utratę kopii. Preflight skanuje całą bazę, a migrator na czas kontroli blokuje innych piszących: dla dużego wdrożenia wymagane jest okno serwisowe i pomiar na kopii. Ten PR nie uruchamia migracji na rzeczywistym wdrożeniu i nie realizuje dalszych etapów R-02.
