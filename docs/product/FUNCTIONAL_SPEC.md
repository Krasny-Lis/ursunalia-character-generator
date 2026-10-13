# Ursunalia — specyfikacja i audyt stanu obecnego

Stan kodu: **13.10.2026**, gałąź `feature/royal-manuscript-rebuild`, commit [`68737a8794e426d612fe54c03c88f6d431ba394e`](https://github.com/Krasny-Lis/ursunalia-character-generator/commit/68737a8794e426d612fe54c03c88f6d431ba394e). Dokument opisuje kod tego commita, nie potwierdza konfiguracji publicznego wdrożenia.

## 1. Produkt i granice audytu

System dla jednej grupy organizatorskiej, docelowo obsługujący wiele wydarzeń. Pierwsze wdrożenie: **Ursunalia 2027, 22–24.04.2027**. MVP obejmuje konto, ankiety, trwały szkic, wysłanie, weryfikację, poprawki i decyzję. **Nowe zatwierdzone wymagania biznesowe:** zaakceptowana ankieta postaci przyjmuje uczestnika na Ursunalia 2027; organizator ręcznie oznacza wpływ składki wpłaconej przelewem. Tych dwóch funkcji nie należy mylić z aktualną implementacją. Data uruchomienia zapisów pozostaje do ustalenia. **Integracja płatności**, SaaS, mikroserwisy oraz rozbudowany kreator wydarzeń nie są warunkiem pierwszego wdrożenia. Ręczna ewidencja składki jest wymaganiem MVP.

Role obecne: gość, `participant`, globalny `organizer`. Tryb demonstracyjny daje dostęp do kreatora bez uwierzytelnienia, ale nie wysyła prawdziwych zgłoszeń. Rola organizatora w API wymaga sesji; ukrywanie interfejsu nie jest jedyną ochroną.

Statusy funkcji:

- **Gotowe**: zaimplementowane i zweryfikowane w opisanym zakresie testów.
- **Częściowe**: zaimplementowane, ale z podanym ograniczeniem.
- **Demonstracyjne**: efekt ograniczony do przeglądarki.
- **Brak**: nie znaleziono realizacji w aktualnym kodzie.
- **Wymaga weryfikacji**: dostępne dowody nie rozstrzygają działania.

Oznaczenie „Gotowe” nie oznacza gotowości całego systemu do produkcji. Testy jsdom nie potwierdzają geometrii, kontrastu ani zachowania fizycznego telefonu.

## 2. Dowody i weryfikacja

### Wykonane w tym audycie

| Kontrola | Wynik i zakres |
|---|---|
| HEAD i historia | Sklonowano wskazaną gałąź; HEAD zgodny z ostatnim znanym commitem. Odczytano ostatnie 8 commitów. |
| Issues | GitHub REST `issues?state=all&per_page=100` zwrócił `[]`, 13.10.2026 przed utworzeniem dokumentacyjnego PR. Brak istniejących Issues do deduplikacji. |
| CI | [Run 38321049210](https://github.com/Krasny-Lis/ursunalia-character-generator/actions/runs/38321049210), push HEAD, wszystkie kroki success. Także 4 wcześniejsze zwrócone przebiegi success. Nie jest to przegląd całej historii Actions. |
| Instalacja | `npm ci --ignore-scripts`, Node 24.19.0, npm 11.9.0. Brak zmian lockfile. CI instaluje przez zwykłe `npm ci`. |
| Build i testy | `npm run verify`: produkcyjny build PASS, **13/13** testów Angular/Vitest PASS, **6/6** testów HTTP/SQLite PASS. Początkowy bundle 352,36 kB. |
| Katalogi | `node scripts/validate-catalog.mjs`: **10/10** plików poprawnych. Dodatkowo porównano ID, etykiety i opisy opcji role/culture/region/traits/hooks w aktywnym `platform.json` z katalogami: zgodne. |
| Próby uzupełniające | Tymczasowy serwer z bazą `:memory:`: odtworzono akceptację niekompletnych poprawek, nadpisanie nowszego szkicu starym, pełne odpowiedzi poufne w liście organizatora. Walidator przyjmuje opis jako obiekt oraz ciąg udający PNG. Szczegóły niżej. |
| Przeglądarka | Próba uruchomienia Playwright: brak pliku wykonywalnego Chromium. **Nie wykonano testów przeglądarkowych, zrzutów ekranów, pomiaru kontrastu ani E2E UI→API w tym audycie.** |

`docs/QA-v27.1.md` opisuje wcześniejszy izolowany test Chromium ze stubami i innym środowiskiem. Nie przenosimy jego wyniku na bieżący HEAD ani rzeczywisty serwer. `README.md` i stare QA pozostają dokumentami historycznymi; aktualne ustalenia znajdują się tutaj. W README instrukcja importu przebudowy jest już historyczna, ponieważ przebudowa znajduje się na badanej gałęzi.

### Mapa źródeł

Poniższe odnośniki są przypięte do audytowanego commita. Numery oznaczają linie tego stanu.

| Kod dowodu | Plik i zakres |
|---|---|
| S1 | [server/server.mjs](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/server/server.mjs): 17–25 hasła; 35–60 schema i seed; 62–110 sesje/limity; 146–183 parser i nagłówki; 184–399 endpointy; 458–480 start. |
| S2 | [platform.store.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/platform/platform.store.ts): 37–79 bootstrap/request; 80–182 demo; 183–294 szkice/auth; 295–312 publikacja. |
| S3 | [models.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/platform/models.ts), [app.routes.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/app.routes.ts), [app.config.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/app.config.ts). |
| S4 | [form.page.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/platform/form.page.ts) i [form.page.html](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/platform/form.page.html). |
| S5 | [summary.page.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/platform/summary.page.ts) i [summary.page.html](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/platform/summary.page.html): `mobile-character-cards`, `fields()`, `consents`, eksport. |
| S6 | [builder.page.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/platform/builder.page.ts) i [builder.page.html](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/platform/builder.page.html). |
| S7 | [organizer.page.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/platform/organizer.page.ts): 88–151 lista/szczegóły; 174–235 filtry, API i eksport. |
| S8 | [field.control.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/platform/field.control.ts): 62–105 select; 106–156 wybory; 226–279 interakcje i portret. |
| S9 | [shared/validation.mjs](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/shared/validation.mjs): `definitionIssues`, `answerIssues`, `isPortrait`, `cleanAnswers`. |
| S10 | [platform.json](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/public/data/platform.json) — aktywna definicja wydarzenia, 2 formularzy i przykładu. |
| S11 | [styles.scss](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/styles.scss): 2780–2948 reduced motion, druk i mobilne podsumowanie; 3077–3105 opisy/overlay. |
| S12 | [platform.spec.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/platform/platform.spec.ts), [app.spec.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/app.spec.ts), [server.test.mjs](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/server/server.test.mjs). |
| S13 | [package.json](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/package.json), `package-lock.json`, `angular.json`, `.github/workflows/verify.yml`, `.github/workflows/deploy.yml`, `.env.example`. |
| S14 | [event.page.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/platform/event.page.ts), [applications.page.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/platform/applications.page.ts), [account.page.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/platform/account.page.ts), [app.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/app.ts), [app.html](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/app.html). |
| S15 | [migration.ts](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/src/app/platform/migration.ts), [validate-catalog.mjs](https://github.com/Krasny-Lis/ursunalia-character-generator/blob/68737a8794e426d612fe54c03c88f6d431ba394e/scripts/validate-catalog.mjs). |

## 3. Inwentaryzacja techniczna

- Angular **22.2.2**, CDK **22.2.2**, TypeScript **6.0.3**, Vitest **5.0.3** według lockfile. `package.json` nadal ma wersję produktu `27.0.0`; nie rozstrzyga numeracji v27.1/v27.2 w historii.
- `src/app/platform/`: samodzielne, leniwie ładowane strony. Signals/computed i jeden `PlatformStore`; formularze używają `ngModel`, nie NgRx ani Reactive Forms. `fetch` obsługuje API mimo zarejestrowanego `HttpClient`.
- `src/app/app.*`: powłoka, menu, bootstrap i komunikaty. Hash routing wspiera statyczny hosting. Brak route guards; API egzekwuje uprawnienia niezależnie, szablony stron odmawiają dostępu.
- `server/server.mjs`: jeden proces Node, `node:http`, `node:sqlite`, scrypt. Brak Express, kontenerów, kolejki oraz osobnego frameworka backendu. Obecny rozmiar pozwala na stopniowy podział modułów bez wymiany stosu.
- `shared/validation.mjs` + deklaracja `.d.mts`: wspólna walidacja; brak pełnego schematu runtime dla odpowiedzi API.
- `public/data/platform.json`: aktywne opcje są osadzone w definicjach. Pozostałe 10 katalogów jest materiałem źródłowym/historycznym; brak runtime synchronizacji z formularzem. Test katalogów sam nie porównuje ich z `platform.json`.
- `src/styles.scss`: globalny plik ponad 3100 linii z kolejnymi korektami kaskady. Nie jest to dowód błędu sam w sobie, ale zwiększa koszt regresji. Zachować Royal Manuscript.
- `scripts/`: kontrola katalogów i starsze narzędzia importu/porządkowania; nie są bieżącymi migracjami SQLite.

## 4. Funkcje uczestnika

| Funkcja | Status | Zachowanie i ograniczenie | Dowód / backlog |
|---|---|---|---|
| Rejestracja, logowanie, wylogowanie | Gotowe w API; częściowe produktowo | Hasło 12–128 znaków, normalizacja email, sesja 7 dni; testy HTTP. Brak potwierdzenia adresu i odzyskania konta. | S1 197–264, S12, U15/U29 |
| Zarządzanie kontem | Częściowe | Wyświetlenie nazwy/email/roli, wylogowanie. Brak edycji profilu, zmiany hasła, usunięcia konta i sesji innych urządzeń. Brak globalnego profilu imienia/nazwiska, telefonu, FB i Discord – wymaganie C11, U32. Błąd logout zapisuje się w `error`, ale szablon zalogowanego konta go nie pokazuje. | S14 account, U15/U19/U32 |
| Przegląd wydarzeń | Częściowe | Jeden stały ekran. Parametr `wydarzenie/:id` nie wybiera wydarzenia; nie ma listy wielu wydarzeń. | S3/S14, U09 |
| Lista ankiet | Częściowe | Dwa seedy, później opublikowane rewizje; brak zamknięcia zapisów. Kategoria pierwszej karty zależy od `$first`, nie rodzaju formularza. | S1 111–118, S14, U06/U10 |
| Rozpoczęcie | Gotowe w ograniczonym modelu | W serwerze wymaga sesji; jedno zgłoszenie na użytkownika/formularz, istniejące jest ponownie otwierane. Nowy szkic przed zapisem istnieje tylko w pamięci. | S2 187–210, S1 329–348, S12 |
| Tworzenie postaci | Częściowe | Odpowiedzi formularza postaci, bez odrębnej encji Character. | S3/S10, U10/U26 |
| Edycja odpowiedzi | Gotowe dla draft/changes | `submitted` i `accepted` nieedytowalne w UI i API; wyjątki cyklu decyzji niżej. | S2 211–226, S1 301–307, S12 |
| Zapis i ponowne otwarcie | Częściowe | Demo autosave localStorage; serwer ręczny zapis. Test trwałości po restarcie PASS. Brak kontroli równoczesnych edycji. | S2 165–247, S12, U02/U07 |
| Walidacja | Częściowe | Typy, opcje, liczba wyborów, daty, tekst i wymagane pola; backend bierze definicję z DB. Nie waliduje całej struktury opisów; brak reguł między polami i polaryzacji cech. | S9, U04/U21 |
| Podgląd | Częściowe | Desktop generuje większość pól, mobile postaci ma odrębny ręczny zestaw. Pomija część odpowiedzi. Ogólne pola `file` znikają z podsumowania poza specjalnym `portrait`. | S5/S11, U03 |
| Wysłanie | Częściowe | Save i submit to 2 żądania; walidacja API 422; brak idempotencji/reconciliation po utracie odpowiedzi. Demo jawnie nie wysyła. | S2 249–279, S1 351–364, U07 |
| Własne zgłoszenia/statusy | Częściowe | Lista z bootstrap, brak odświeżania po decyzji podczas otwartej sesji. Etykiety: szkic/wysłane/zaakceptowane/do poprawy. | S2 68–79, S14 applications, U08 |
| Odbiór decyzji i poprawek | Częściowe | Aktualny feedback widoczny po ponownym bootstrapie; brak e-maili, historii, oznaczenia nieprzeczytanej decyzji. | S1 119–138, S14, U08/U11 |
| Poprawki i ponowna wysyłka | Częściowe | Obsługiwane i testowane API; organizator może zaakceptować edytowany, niekompletny szkic w statusie changes bez ponownej wysyłki. | S1 375–398, U01 |
| Eksport | Częściowe | Pełny JSON zgłoszenia; brak importu szkicu uczestnika. Sugestia pobrania kopii nie oznacza możliwości automatycznego przywrócenia. | S4/S5, U22 |
| Druk | Częściowe | Metoda `print()` nie jest podpięta do przycisku; druk przez przeglądarkę. CSS ukrywa `boundaries/exclusions`, ale nie dowolne poufne pole, np. `needs`. | S5/S11, U05/U03 |
| Desktop/tablet/mobile | Wymaga weryfikacji | Są media queries, nie ma bieżącego testu rzeczywistego layoutu. Statycznie potwierdzono rozbieżność mobile/desktop. | S11, U03/U16 |

### Przerwanie pracy i błędy

1. **Zamknięcie karty:** serwerowy niezapisany tekst znika; `beforeunload` ostrzega tylko gdy globalne `dirty=true`. Demo zachowuje dane po udanym localStorage, wyjątek quota jest komunikowany. Brak importera pobranego szkicu.
2. **Zmiana aktywnego zgłoszenia:** `dirty` nie jest przypisane do ID. Scenariusz wynikający z S2: edytuj A, otwórz B, zapisz B → `dirty=false`, mimo niezapisanego A. Zamknięcie może stracić A bez ostrzeżenia. U02.
3. **Nieudany zapis:** odpowiedzi zostają w pamięci i komunikat pojawia się na 5 sekund. Brak trwałego błędu przy konkretnym szkicu. `request()` usuwa szczegóły `issues` z odpowiedzi 422. U07.
4. **Utrata odpowiedzi po udanym submit:** serwer może mieć `submitted`, klient nadal `draft`; ponowny save otrzyma 409. Należy pobrać stan i rozstrzygnąć operację, nie wysyłać w ciemno ponownie. U07.
5. **Dwie karty:** POST zapisuje całe answers bez wersji blokady, ostatni zapis wygrywa. Odtworzone lokalnie. U02.
6. **Wygaśnięcie sesji:** API odmawia 401; frontend nie prowadzi przez bezpieczne ponowne logowanie z zachowaniem pracy. `auth()` wywołuje refresh zastępujący lokalny stan. U07.
7. **Start aplikacji offline:** błąd bootstrapu; brak cichego przełączenia na demo — właściwe zachowanie. Ponowienie wymaga odświeżenia strony. Nie ma offline-first.

## 5. Generator i treść formularzy

Aktywny formularz `character-2027` ma **7 sekcji, 34 pola**:

| Sekcja | Zakres aktualny | Ograniczenie |
|---|---|---|
| Tożsamość | Imię, nazwisko/przydomek, 7 ról, profesja, wiek, motto, portret | Wiek jako tekst; rola i profesja niezależne, brak hierarchii podkategorii. |
| Pochodzenie | 4 kultury, 5 regionów, 2 statusy pobytu, miejsce, zwierzchnik, tło | Zwierzchnik jest tekstem; brak reguł zależnych od kultury/regionu. |
| Cechy i haki | 38 cech, **2–5 wyborów**; 19 haków, **0–4 wyborów** | Kategorie cech nie są przeniesione jako metadane opcji; brak reguły pozytywna/negatywna. |
| Historia | Biografia **500–6000** znaków, cel, przeszkoda, przybycie, stawka | Limity sprawdzane, bez powiązanych warunków. |
| Relacje | Tekst, otwartość, wykluczenia | Brak grafu relacji lub powiązania z innym zgłoszeniem. |
| Preferencje | 6 skal 1–5, styl gry, granice/potrzeby | Poufność wynika z etykiety/ID, nie z uprawnień danych. |
| Zgody | 3 wymagane pola multi z jedną opcją | Oświadczenia są częścią answers, bez osobnej wersji dokumentu czy historii wycofania. |

`logistics-2027`: 1 sekcja, 3 pola: data przyjazdu, dojazd, potrzeby organizacyjne. Potrzeby także mogą zawierać informacje wymagające ograniczenia dostępu.

Uniwersalne: silnik sekcji/pól, wybory, limity, szkic, publikacja i decyzje. Specyficzne: zawartość katalogów, ID formularza `character-2027`, ID pól/sekcji w karcie, teksty wydarzenia i mapowanie starego generatora. Nie zmieniono treści katalogów.

Rekomendacja: pozostawić `traits` i `hooks` odrębnymi polami/kategoriami domenowymi. Dodać jawne znaczenie pola (`semanticKey`) i metadane kategorii opcji przy potrzebie reguł, bez tworzenia umiejętności z cech charakteru. Strukturę i limity uzgodnić przed dopracowaniem opisów tagów. Obecne 2–5 cech to fakt kodowy, nie zatwierdzenie docelowej reguły produktu — D07 w [DECISIONS](../planning/DECISIONS.md).

## 6. Kreator ankiet

| Funkcja | Status | Dowód i ograniczenia |
|---|---|---|
| Nowa ankieta, sekcje i pytania | Gotowe w podstawowym zakresie | S6 `restore`, `add`, `addSection`, test komponentu. Nowa ankieta zawsze ma `ursunalia-2027`. |
| Usuwanie | Częściowe | Potwierdzenie `confirm`; dopuszcza przejściowo pusty/niepoprawny szkic; publikacja blokuje błędy. Brak undo. |
| Typy pól | Gotowe jako renderer | `text`, `textarea`, `single`, `multi`, `select`, `rating`, `date`, `file`, `info`; file jest obrazem, nie dowolnym załącznikiem. Nie wszystkie typy mają osobny test interakcji. |
| Etykiety i wskazówki | Częściowe | Edycja tytułu/opisu formularza, sekcji, pola i opcji; placeholder w modelu/renderze, brak edytora placeholdera. |
| Opisy odpowiedzi | Częściowe | Edycja textarea, jawne rozwinięcie wyborów i opisy w overlay select. Nie tylko hover. Brak pełnej walidacji typu/długości opisów. |
| Kolejność | Częściowe | DnD sekcji/pól/opcji, pola między sekcjami; przyciski góra/dół dla sekcji i pól. Opcje oraz przenoszenie między sekcjami nie mają równoważnej akcji klawiaturą. |
| Duplikowanie | Częściowe | Sekcja/pole dostają nowe ID. Eksport/import całej ankiety **zachowuje form.id**, więc publikacja może utworzyć rewizję oryginału zamiast nowej ankiety. README sugeruje za dużo. U12. |
| Podgląd | Częściowe | Działające kontrolki na lokalnych testowych answers; brak pełnego przejścia przez walidację, podsumowanie i wysyłkę. |
| Wersje i publikacja | Gotowe dla zachowania starej definicji | Serwer wylicza następną rewizję; zgłoszenie zachowuje wskazaną definicję, test PASS. Brak listy historii, diff, archiwizacji i wykrywania publikacji z nieaktualnego szkicu. |
| Szkic organizatora | Częściowe | localStorage także w trybie server; klucz nie obejmuje użytkownika ani trybu. `id=new` jest jednym slotem; po publikacji szkic nie jest przełączany na nową wersję. U12/U13. |
| Import/eksport | Częściowe | JSON do 400000 bajtów w UI; migracja schematu v1. Serwer mierzy długość stringa (jednostki JS), nie bajty — granice nie są identyczne. |
| Integralność | Częściowe | Bezpieczne/unikalne ID, 30 sekcji, 300 pól, 200 opcji/pole, poprawne limity. Szkic dopuszcza braki; publikacja nie sprawdza wszystkich opcjonalnych właściwości. |
| Stare zgłoszenia | Gotowe dla rewizji | Zapis istniejącego szkicu nie może zmienić form_revision; opublikowanie v2 nie przepisuje v1. Brak polityki wycofania starej wersji — nowe zgłoszenie API może wskazać dowolną istniejącą rewizję. U06. |

Silnik obsługuje prostą ankietę, co pokazuje logistyka. Powłoka podsumowania i nazwy tras nadal traktują odpowiedź jako postać. Przed wydarzeniem potrzebne są bezpieczna publikacja, kontrola zakresu zmian, opisy, wszystkie odpowiedzi w podglądzie i minimum obsługi klawiaturą. Rozbudowane warunki, biblioteka szablonów i zaawansowany DnD mogą poczekać.

## 7. Panel organizatora

| Funkcja | Status | Ograniczenie / dowód |
|---|---|---|
| Lista formularzy | Gotowe w modelu jednej imprezy | Aktualne opublikowane rewizje, S7. Nie pokazuje listy lokalnych szkiców. |
| Lista zgłoszeń | Częściowe | Z serwera wszystkie nie-draft, razem z całością answers i portretami; bez paginacji. S1 366–373. |
| Szukanie osoby, filtry | Częściowe | Frontend filtruje imię, email, nazwę postaci i tytuł; formularz i status. „Rodzaj ankiety” oznacza konkretny form.id, brak form.kind. S7 174–181. |
| Czytelność list | Wymaga weryfikacji UI | Oddzielne etykiety osoby/formularza i statusu w kodzie; brak testu długich wartości/layoutu. |
| Pełne odpowiedzi | Częściowe | Teksty/opcje/skale, ale `file` jest pominięte w widoku; dane obrazu nadal są pobierane i eksportowane. S7 123–131. |
| Akceptacja/poprawki | Częściowe | Obowiązkowy komentarz dla changes. API akceptuje decyzję dla każdego nie-draft bez sprawdzenia kompletności. U01. |
| Komentarze | Częściowe | Jeden aktualny feedback, nadpisywany; brak dyskusji, przypisania autora i powiadomienia. |
| Historia zmian/decyzji | Brak | Brak tabeli Review/AuditLog i wersji odpowiedzi; `updated_at` nie rozróżnia edycji od oceny. U11. |
| Eksport | Częściowe | Pojedynczy pełny JSON, zawiera poufne informacje i email; brak audytu i ograniczonego eksportu. U05/U14. |
| Poufność i członkowie zespołu | Brak rozdziału uprawnień | Każdy organizer może przeglądać wszystkie nie-draft, publikować i oceniać. U05/U14. |
| Zarządzanie uczestnikami | Brak osobnego modułu | Jest wyszukiwanie zgłoszeń, nie ma widoku przyjętych na podstawie zaakceptowanego zgłoszenia postaci, ewidencji składek, pojemności, przydziałów czy zaproszeń zespołu. |
| Składki przelewem | Brak | Nie ma ręcznego potwierdzenia przez organizatora per użytkownik i wydarzenie ani audytu zmian. Brak planowanej integracji bankowej; instrukcje przelewu będą wysyłane poza systemem. U31. |
| Rozszerzone statusy zgłoszeń | Brak w implementacji | Właściciel zatwierdził siedem statusów (C09/D18), dowolne zmiany przez uprawnionego organizatora i wznawianie `withdrawn` (C10/D08); API obecnie obsługuje jedynie `draft/submitted/changes/accepted`. Nowe trzy statusy to część U30. |
| Katalog zgłoszonych postaci dla graczy | Brak | Nowy wymóg C20/C21: nazwa postaci, publiczny opis, portret i tylko jawnie udostępnione dane gracza (nazwisko/ksywa/social). Katalog nie jest listą przyjętych; dostęp zależy od logowania, a postacie `rejected` i `withdrawn` są ukrywane (C22/D23a); `changes` pozostaje widoczne wyłącznie z ostatniego faktycznie wysłanego snapshotu (C23/D23b); zakres odbiorców C24/D24: każdy zalogowany użytkownik platformy, niezależnie od zgłoszenia na wydarzenie; bez logowania brak dostępu. U34. |

## 7a. Zatwierdzone wymagania po audycie (13.10.2026) – jeszcze niezaimplementowane

1. **Przyjęcie uczestnika:** dla Ursunaliów 2027 przyjęcie wynika z zaakceptowania zgłoszenia postaci. Akceptacja innych ankiet nie przyznaje udziału. Nie tworzyć dodatkowego procesu zatwierdzania uczestnictwa. Przed planowaną v28.0 dodać do formularza serwerową cechę `grants_admission` i wyliczać listę przyjętych per wydarzenie (U30).
2. **Statusy – zatwierdzone (C09/D18, C10/D08):** siedem statusów: `draft`, `submitted`, `changes`, `accepted`, `waitlisted`, `rejected`, `withdrawn`. Status `cancelled` wykreślono; organizator używa `rejected`. Uprawniony organizator może zmienić status na **dowolny** z każdego stanu, także `withdrawn` czy `draft`; rekomendowane ścieżki to podpowiedzi, a nie blokady. Uczestnik może wznowić wycofane zgłoszenie i ponownie wysłać tę samą postać, bez utraty odpowiedzi i ID. Zmiany organizatora mają historię autora/czasu/statusów; bez wcześniejszego wysłania nie wolno udawać, że oceniono wysłany formularz. Funkcjonalność nie jest jeszcze wdrożona (U01/U11/U30).
3. **Składki:** wpłata zwykłym przelewem, dane do przelewu przekazywane mailowo poza aplikacją. Uprawniony organizator zaznacza „składka wpłynęła / potwierdzona”; brak potwierdzenia nie zmienia statusu zaakceptowania. Flaga zapisywana przy parze użytkownik–wydarzenie, z autorem/czasem i audytem; nie zbierać danych bankowych ponad konieczne minimum (U31).
4. **Brak automatycznych płatności:** nie implementować operatorów płatniczych, połączeń z bankami ani automatycznych maili transakcyjnych w MVP. Dodatkowe możliwości: kwoty, częściowe wpłaty, zwolnienia i zwroty – D19.
5. **Kontakt przy rejestracji konta (C11/U32):** imię, nazwisko, e-mail oraz opcjonalne telefon, Facebook i Discord należą do globalnego profilu konta, współdzielonego między wydarzeniami. Brak numeru telefonu nie blokuje rejestracji konta (C13). Istniejące konta migrować bez zgadywania imienia i nazwiska z dawnego pola nazwy.
6. **Trzy bazowe typy kont (C15/U33):** `administrator`, `organizer`, `participant`. Każde nowe konto domyślnie ma typ `participant`. Organizator może nadać użytkownikowi typ `organizer` i niestandardowe role, ale nigdy `administrator`; Administrator jest nadawany wyłącznie przez innego Administratora. Administrator ma pełną możliwość odczytu i edycji danych biznesowych całej platformy, także należących do innych organizatorów i uczestników, z audytem zmian.
7. **Konfigurowalne role (C12/C16/U14):** organizator tworzy dowolnie nazwane role i przypisuje im uprawnienia do grup danych oraz funkcji. Fabularzysta z C14 jest wyłącznie **przykładową konfiguracją** (odczyt fabuły, tajemnic, haków, FB/Discord, bez prywatnego kontaktu i zdrowia), a nie obowiązkową rolą systemową. Nadanie roli dodatkowej nie zmienia bazowego typu uczestnika. Zgodnie z C18/D21 niestandardowa rola i jej przypisanie obowiązują wyłącznie w konkretnym wydarzeniu; nie przenoszą się na kolejne LARPy. Bazowy typ konta pozostaje globalny.
8. **Odczyt i edycja grup danych (C16/U05/U14):** osobne prawa `read` i `write` dla tożsamości (imię, nazwisko, pełnoletniość), prywatnego kontaktu (e-mail/telefon), kontaktu społecznościowego (FB/Discord), fabuły postaci, preferencji rozgrywki, triggerów, wykluczeń interpersonalnych, zdrowia, zgłoszeń/statusów i składek. Operacje na formularzach, wydarzeniach, rolach i eksportach mają osobne prawa `manage/assign/export`. Własne dane uczestnika mogą być edytowane zgodnie z regułami procesu, a cudze tylko na podstawie prawa. Serwer musi egzekwować te prawa także w listach, eksporcie i API; edycja nie nadpisuje po cichu historycznych wysłań. Role nie mogą nadać Administratora.
9. **Ograniczenia techniczne Administratora:** globalny Administrator jest superużytkownikiem w warstwie biznesowej, lecz system nie przechowuje i nie wyświetla jawnych haseł. Do zmiany cudzych danych służy kontrolowana edycja lub poprawka z historią; nie usuwa się śladów historii i audytu tylko dlatego, że aktor ma status Administratora.
10. **Katalog zgłoszonych postaci (C20/C24/U34):** osobna, responsywna lista dla **każdego zalogowanego użytkownika platformy**, niezależnie od zgłoszenia na dane wydarzenie, zawierająca pełną nazwę postaci, osobny publiczny opis i przesłany portret (jeśli jest). Katalog ma prezentować postacie **zgłoszone**, nie tylko `accepted`, i nie jest listą osób przyjętych. Publiczny opis nie powstaje z pełnej biografii, tajemnic ani prywatnego opisu postaci. Nie pokazywać szkiców, których nigdy faktycznie nie wysłano; przy `changes` **zachować widoczność postaci i pokazywać jedynie ostatnie prawdziwe wysłanie (C23/D23b)**, bez publikowania zmian roboczych aż do ponownego wysłania; bez wcześniejszego wysłania nie tworzyć wpisu. **Zatwierdzone C22/D23a:** postacie z aktualnym statusem `rejected` (Odrzucono) lub `withdrawn` (Wycofano) znikają z katalogu i szczegółów katalogowych, bez usunięcia zgłoszenia, danych i historii. Mogą pojawić się ponownie po zmianie na kwalifikujący status i przy istnieniu faktycznie wysłanej postaci. **D23 zamknięte** – `changes` pozostaje w katalogu na poprzedniej przesłanej wersji, a `rejected`/`withdrawn` są ukryte; **D24 zamknięte (C24)** – wystarcza zalogowane konto, nie trzeba być zgłoszonym lub przyjętym na wydarzenie; użytkownik anonimowy nie widzi katalogu.
11. **Dobrowolna publikacja danych gracza (C21/U34):** w katalogu pokazywać imię i nazwisko, ksywę oraz social media (np. FB/Discord) **tylko dla pól, które użytkownik sam zdecyduje się udostępnić**. Samo podanie kontaktu przy rejestracji konta nie oznacza publikacji. Rekomendowane ustawienia widoczności osobno dla wydarzeń, domyślnie wyłączone i możliwe do cofnięcia. E-mail, telefon, alergie, zdrowie, granice i wykluczenia nie trafiają do katalogu. Ksywa to opcjonalne pole globalnego profilu. Użytkownik musi wiedzieć, że wysłane zdjęcie postaci będzie prezentowane w katalogu.

Stan implementacji w dniu audytu nadal odpowiada tabelom poniżej; powyższe punkty są nowymi wymaganiami, nie potwierdzeniem funkcjonalności.

## 8. Rejestr najważniejszych ustaleń

Priorytet oznacza znaczenie przed uruchomieniem zapisów. P0 nie jest deklaracją, że zaobserwowano atak na publicznym wdrożeniu.

| ID | Priorytet | Fakt i skutek | Zadanie |
|---|---|---|---|
| F01 | P0 | S1 386–395 wybiera każde status!='draft'. Lokalnie: submit → changes → zapis pustej biografii → PATCH accepted = **200**, accepted z pustą historią. Organizator może nadać accepted bez ponownego wysłania poprawek, ale obecne API nie oznacza tego jako świadomej decyzji administracyjnej, nie ostrzega i nie ma historii. Docelowo taka zmiana jest dozwolona, tylko jej pochodzenie musi być jawne. | U01 |
| F02 | P0 przy zbieraniu poufnych danych | S1 119–138/366–373 i S7: pełne answers w masowej liście i eksporcie; etykieta „poufne” niczego nie ogranicza. Lokalna lista zawiera `boundaries`. | U05 |
| F03 | P1 | Brak blokady wersji zapisu; próba lokalna „first → newer → stary first” daje **200** i „first”. | U02 |
| F04 | P1 | Globalne dirty i aktywne ID, brak dirty per draft; opisany scenariusz A/B może wyłączyć ostrzeżenie. To wniosek ze ścieżki kodu, nie test browser. | U02 |
| F05 | P1 | CSS <=700 px ukrywa generic summary postaci. Ręczne karty pomijają wiek, status pobytu, przeszkodę, stawkę, 6 skal, wykluczenia i nowe pola kreatora; tło/patron pokazane częściowo w innym kontekście. | U03 |
| F06 | P1 | `definitionIssues()` przyjmuje `description={...}` i liczbowy placeholder. Brak limitów długości większości opisów/etykiet. | U04 |
| F07 | P1 | `isPortrait('data:image/png;base64,YWJj')` daje true: sprawdzana deklaracja, nie dekodowalny obraz, rozdzielczość czy metadane. Nie wykazano wykonania kodu ani obejścia CSP. | U04 |
| F08 | P1 | Hasła: scrypt bez jawnych parametrów i wersji w zapisie. W lokalnym Node domyślny koszt N=16384; wymaga dobrania i zapisania parametrów oraz rehash przy logowaniu. | U15 |
| F09 | P1 | Limiter 25 prób/15 min bazuje na `remoteAddress`; za wspólnym proxy może blokować wszystkich użytkowników. Nie ufa dowolnemu X-Forwarded-For — tego nie należy zmieniać bez listy zaufanych proxy. | U18 |
| F10 | P1 | „Zapisy otwarte” jest stałym tekstem seed, brak bramki zapisów. API pozwala zakładać nowe zgłoszenia na starszej rewizji. | U06 |
| F11 | P1 | Import całej ankiety nie tworzy nowego ID; stary lokalny szkic może publikować nowe rewizje bez sprawdzenia rewizji bazowej. | U12/U13 |
| F12 | P1 | Brak E2E UI→API, próby odtworzenia backupu i potwierdzonego środowiska produkcyjnego. Weryfikacja CI nie obejmuje tych ryzyk. | U16/U17/U18/U24 |

### Bezpieczeństwo: co już jest i czego dowody nie obejmują

S1 stosuje parametryzowane SQL, scrypt z losową solą, timingSafeEqual, 256-bitowy losowy token z hashem w DB, HttpOnly, SameSite=Strict i Secure w produkcji. Mutacje wymagają zgodnego Origin i JSON; API nie ufa przesłanej definicji ankiety. Jest limit 2 MiB żądania, limit auth, CSP i podstawowe nagłówki. Nie znaleziono endpointu wykonującego przesłany kod ani niepotrzebnego CORS.

Nie potwierdzono TLS/proxy, szyfrowania dysku i backupów, konfiguracji dostępu operatora, monitoringu, czasu reakcji na awarię ani skuteczności odzyskania danych. HSTS w kodzie nie tworzy HTTPS. Brak ponownej autoryzacji dla wrażliwych operacji konta, odzyskiwania hasła i funkcji usuwania danych. Sesje wygasają po 7 dniach, nie ma idle timeout ani panelu unieważniania. To zakres do decyzji, nie powód do wymiany całego auth.

Duże portrety base64 w każdym zgłoszeniu oraz zwracanie wszystkich danych na liście mogą powodować duże odpowiedzi HTTP i zużycie pamięci. SQLite/WAL w jednym procesie wystarczy jako punkt wyjścia; potrzebny pomiar na uzgodnionej liczbie uczestników, nie migracja do mikroserwisów.

Techniczna analiza nie stanowi opinii prawnej. Przed zbieraniem realnych danych właściciel musi zatwierdzić informację dla uczestników, zakres danych, podstawy przetwarzania, odbiorców, retencję, obsługę usunięcia i treść oświadczeń. Nie zakładamy, że wymagany checkbox rozwiązuje te kwestie. Bez zatwierdzonej polityki nie zbierać opisów zdrowia ani innych zbędnych szczegółów.

## 9. UX/UI i kryteria weryfikacji

Zachować Royal Manuscript, poprawiać konkretne komponenty.

| Obszar | Ocena na podstawie kodu | Kryterium naprawy / test |
|---|---|---|
| Opisy cech/haków | Są przyciski rozwijające pełne opisy; tooltip CSS reaguje hover/focus-within. | Wszystkie opisy dostępne przez dotyk i klawiaturę, bez obowiązku hover; brak ucięcia przy 320 px i 200% zoom. |
| Select CDK | Overlay ma pozycje góra/dół, backdrop i Escape; brak jawnego zarządzania fokusem, strzałek i przywrócenia fokusu po wyborze. | Otwórz z klawiatury, wybierz opcję, Escape/Tab; focus pozostaje przewidywalny. Sprawdzić etykietę, rolę i ogłoszenie wartości czytnikiem. |
| Błędy pól | Text/textarea wiążą help/error; date/select/wybory nie mają pełnego powiązania błędów. Przejście do błędu przewija, nie przenosi fokusu. | Po wysłaniu lista błędów i fokus pierwszego pola; błąd odczytywany wraz z nazwą pola. |
| Kreator | Przyciski zmiany kolejności sekcji/pól; odpowiedzi tylko DnD. | Wszystkie operacje wymagane do publikacji możliwe bez myszy. |
| Komunikaty | `role=status`, zamykanie, auto-hide 5 s; błędy zapisu znikają. | Błąd zapisu trwa do rozwiązania, sukces nie zasłania aktywnej kontrolki, długie komunikaty mieszczą się na telefonie. |
| Podsumowanie | Dwa sposoby renderowania desktop/mobile; ogólna ankieta nadal pokazuje nagłówek „POSTAĆ”. | To samo znaczenie i komplet odpowiedzi na każdym rozmiarze; poprawna etykieta form.kind. |
| Zgody | Podsumowanie pokazuje wynik walidacji, nie faktyczną wartość dowolnego pola sekcji consents. | Wyświetla faktyczny wybór i wersję treści; brak zaznaczonej zgody tylko dlatego, że pole jest opcjonalne. |
| Nawigacja/status zapisu | beforeunload, bez CanDeactivate; aktualna sekcja startuje od identity także dla logistyki. | Jawne aktywne zgłoszenie, stan zapisu per ID; nawigacja działa z dowolną pierwszą sekcją. |
| Kontrast/focus | Są tokeny kolorów, focus-visible, skip-link, reduced motion i focus trap w modalach. | Pomiar kontrastów tekstu i kontrolek; widoczny focus; tab order; 320/390/768/1440 px, landscape, duże fonty. Wymaga testu, brak deklaracji zgodności WCAG. |
| Długie formularze | Render wszystkich pól; multi pokazuje początkowo 9 plus wybrane. | 300 pól/200 opcji i długie opisy bez zamrożenia, poziomego przewijania ani ukrytych błędów. |

## 10. Macierz testów i bramka MVP

| Obszar | Obecny dowód | Luka do domknięcia |
|---|---|---|
| Shell, komponenty, store | 13 testów jsdom; edycja imienia, multi, overlay, builder, demo quota, wersje | Realny DOM/layout, server-mode store, konto/organizator, błędy sieci, wiele szkiców |
| Walidacja | Seed/przykład, ID, daty, opcje, krótka historia | Wszystkie typy, granice, złe opisy, obrazy, opcjonalne limity, rozmiar UTF-8 |
| API/uprawnienia | Owner isolation, rola organizatora, CSRF, blokada edycji po submit | Macierz ról wydarzenia i prywatnych danych, paginacja/eksport, stany decyzji |
| SQLite | Trwałość restartu, wersja definicji, unique user/form | Migracje, backup/restore, FK i constraints docelowe, konflikt aktualizacji |
| Proces zgłoszenia | Pełny cykl HTTP w jednym teście | Rzeczywista przeglądarka i dwa niezależne konta/konteksty |
| CI/CD | Build/test/catalog na push badanej gałęzi oraz PR | E2E, staging, smoke po wdrożeniu, rollback; deploy Pages nie zależy od joba verify |

Przed publicznym MVP muszą przejść:

1. Rejestracja → formularz → niekompletny szkic → zapis → zamknięcie i ponowne otwarcie → komplet → wysłanie → organizator → poprawki → ponowne wysłanie → akceptacja. Rzeczywisty browser i HTTP/SQLite, bez stubów API.
2. Nieautoryzowany użytkownik, inny uczestnik i organizator bez uprawnienia nie otrzymują zastrzeżonych odpowiedzi w JSON, eksporcie ani logach.
3. Nie można zaakceptować trwających poprawek; każda decyzja wskazuje niezmienny zestaw wysłanych odpowiedzi. Konflikty nie nadpisują danych po cichu.
4. Każda odpowiedź uczestnika widoczna w podsumowaniu na 390, 768 i 1440 px; podstawowy cykl także na 320 px i klawiaturze.
5. Awaria sieci, 401, 409, 413, 422 i 500 prowadzą do czytelnej informacji i zachowania pracy; ponowienie submit nie tworzy duplikatu.
6. Zmiana formularza nie zmienia historycznych zgłoszeń; migracja i odtworzenie kopii sprawdzone na reprezentatywnej bazie testowej.
7. Staging HTTPS, trwały dysk, monitoring, odtwarzanie i procedura wsparcia mają właścicieli; pilotaż zatwierdzony. Brak otwartych P0, P1 zamknięte lub formalnie zawężony zakres funkcji.

Brak liczbowego coverage — nie uruchamiano pomiaru pokrycia. Liczba testów nie jest wskaźnikiem kompletności produktu.

## 11. Dalsze dokumenty i źródła zaleceń

- [Model i migracja](../architecture/DATA_MODEL.md)
- [Backlog](../planning/BACKLOG.md)
- [Decyzje](../planning/DECISIONS.md)
- [Roadmap](../planning/ROADMAP.md)

Sprawdzone 13.10.2026: [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) — autoryzacja każdego żądania, domyślna odmowa; [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) — parametry kosztu scrypt; [Node crypto](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback) — API parametrów; [SQLite Online Backup](https://www.sqlite.org/backup.html) — spójna kopia pracującej bazy. Zalecenia zastosowano do małego, pojedynczego wdrożenia; nie są wynikiem testu penetracyjnego ani opinią prawną.
