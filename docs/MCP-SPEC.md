# Ursunalia 2027 – specyfikacja MVP dla Codex

**Status:** obowiązujący zakres pierwszej wersji (MVP); rozszerzenia opisane niżej są odłożone.
**Aktualizacja:** 2026-10-14.
**Repozytorium:** `Krasny-Lis/ursunalia-character-generator`.
**Gałąź bazowa:** `feature/platform-foundation-v24`.

> Ten dokument jest skróconą specyfikacją wykonawczą. Zastępuje potrzebę odtwarzania ponad 100 szczegółowych decyzji w codziennej pracy programistycznej, ale **nie anuluje** wcześniejszych ustaleń produktu. Jeżeli istnieje konflikt między bieżącym kodem demonstracyjnym a niniejszym MVP, dla nowych zmian kierujemy się tym dokumentem. Wątpliwości dotyczące istotnego zachowania produktu zgłaszamy do decyzji zamiast zgadywać.

## 1. Cel produktu

Platforma internetowa do publikowania i organizowania LARP-ów. Pierwszy docelowy event to **Ursunalia – Nowe Początki, Stare długi (22–24.04.2027)**, ale architektura ma umożliwiać kolejne wydarzenia.

**Główny scenariusz:**
1. Organizator tworzy/publikuje wydarzenie i otwiera zapisy.
2. Organizator konfiguruje **jeden formularz zgłoszenia postaci** dla wydarzenia.
3. Gracz zakłada konto, dołącza do wydarzenia, tworzy postać, zapisuje szkic i przekazuje ją do MG.
4. MG przegląda zgłoszenie, akceptuje, odrzuca lub kieruje do poprawy; gracz może poprawić i wysłać ponownie.
5. Gracz widzi wynik w panelu; zatwierdzona postać jest gotowa do gry.

**To nie jest ogólny kreator ankiet:** nie budujemy wielu ankiet na wydarzenie. Istniejący moduł `surveys` jest prototypem technologii edycji i wyświetlania pól; docelowo powinien zasilać formularz **postaci**.

## 2. Granica MVP

### P0 – wymagane do uruchomienia użytecznej wersji

- Konta, logowanie, przypisanie do wydarzenia i **egzekwowane po stronie serwera** uprawnienia gracza, MG oraz organizatora/uprawnionego zarządzającego.
- Wydarzenia: podstawowe dane, publikacja, możliwość zapisania się i zamknięcia przyjmowania nowych uczestników.
- Jeden konfigurowalny formularz postaci na wydarzenie; sekcje, kolejność, etykiety/opisy, wymagane pola, podstawowe typy pól i ich walidacja.
- Gracz: panel własnej postaci, utworzenie, ręczny zapis niekompletnego szkicu, edycja zgodna ze statusem, przekazanie do weryfikacji, podgląd decyzji.
- MG: wspólna lista zgłoszeń, wyszukiwanie po postaci/graczu, filtr statusu, karta postaci, decyzja, opcjonalny komentarz i historia decyzji.
- Jedna aktywna postać na gracza i wydarzenie, bez zmiany statusu uczestnictwa przy działaniach na postaci.
- Trwała baza danych i API, ochrona przed nieuprawnionym dostępem, podstawowa kontrola konfliktów zapisu.
- Podstawowe trwałe powiadomienia **w aplikacji** o decyzjach MG (bez e-maili).
- Ręczny zapis zmian formularza jako jednej operacji; ostrzeżenia i potwierdzenia przed operacjami niszczącymi odpowiedzi.
- Responsywny interfejs dla telefonu, tabletu i desktopu, poprawne działanie klawiaturą.
- Automatyczne testy najważniejszych reguł i działający CI.

### P1 – po podstawowym przepływie, najlepiej przed wydarzeniem

- Wewnętrzna notatka MG do całej postaci i do poszczególnych pól; zawsze niewidoczna dla gracza, także przez API.
- Podstawowe warunki widoczności pól, oparte na wcześniejszych odpowiedziach; ukrytych pól nie walidujemy, a ich zapisane wartości pozostają zachowane.
- Logiczne usuwanie postaci przez gracza lub MG; przywracanie wyłącznie przez MG, jeśli właściciel nie ma innej aktywnej postaci.
- Eksport pełnej kopii konfiguracji i danych formularza do JSON przez organizatora/osoby zarządzające formularzem.
- Historia podstawowych operacji i odblokowywanie zaakceptowanej postaci przez MG.

**P1 to nadal uzgodnione funkcje, a nie zbędne pomysły.** Nie blokują jednak pierwszego działającego przepływu P0. Priorytet może wzrosnąć, jeśli realna organizacja Ursunaliów będzie ich wymagać.

### Poza MVP / późniejsze iteracje

- Uniwersalny system wielu ankiet na wydarzenie, zaawansowana edycja formularzy, rozbudowane warunki AND/OR i zależności.
- Własne zestawy i zapamiętywanie kolumn/filtrów MG, filtrowanie po dynamicznych polach, szczegółowe fallbacki sortowania.
- Masowe zmiany statusów, zaawansowane widoki i historie.
- Złożone interfejsy scalania konfliktów (dane i formularze).
- Symulacje wpływu zmian formularza na każdą postać, grupowane listy niezgodności i rozbudowane zbiorcze powiadomienia.
- Import/przywracanie całej bazy z pliku JSON.
- Archiwum po wydarzeniu, przenoszenie postaci między wydarzeniami oraz dodatkowe moduły: ogłoszenia, kompendium, mailing, wątki, galerie.
- System płatności i szczegółowa obsługa finansów wydarzenia.

Odkładanie tych funkcji nie oznacza zanegowania wcześniejszych decyzji. Nie implementować ich „przy okazji”.

## 3. Nienaruszalne reguły domenowe

### Uczestnictwo i postać

- Status **udziału w wydarzeniu**, status **postaci** i ewentualny status płatności są niezależnymi pojęciami.
- Użytkownik może mieć maksymalnie **jedną aktywną (nieusuniętą) postać** na jedno wydarzenie. Nie ogranicza to liczby logicznie usuniętych rekordów.
- Zamknięcie zapisów blokuje **nowych uczestników**, ale nie blokuje utworzenia pierwszej postaci, poprawiania lub zastąpienia postaci przez uczestnika już zapisanego.
- Nową postać tworzymy ze statusem `W edycji`. Kopiowanie postaci między wydarzeniami jest późniejszym rozszerzeniem.
- Usunięcie/zastąpienie postaci nie oznacza rezygnacji z uczestnictwa.

### Statusy zgłoszenia

Pięć statusów biznesowych:
- `W edycji` – roboczy szkic gracza.
- `Do weryfikacji` – zgłoszenie przekazane MG.
- `Do poprawy` – MG oczekuje poprawek.
- `Zaakceptowana` – pozytywna decyzja MG.
- `Odrzucona` – odmowa MG; gracz może zmienić i zgłosić ponownie.

Reguły:
- Zapis niekompletnego szkicu jest dozwolony; wysłanie do MG i nowa akceptacja wymagają poprawnych odpowiedzi według **aktualnie obowiązujących, widocznych pól**.
- Gracz może edytować postać `W edycji`, `Do poprawy`, `Odrzucona` i ponownie ją przekazać.
- W statusie `Do weryfikacji` gracz może edytować zgłoszenie, ale dopiero **zapis rzeczywiście zmienionych danych** zmienia status na `W edycji`. Samo otwarcie lub zapis bez zmian nie wycofuje zgłoszenia.
- `Zaakceptowana` jest zablokowana do edycji przez gracza; wyłącznie MG może ją odblokować do poprawek. Blokada edycji nie zabrania graczowi usunięcia własnej postaci.
- MG może edytować dane postaci; jego edycja **nie zmienia automatycznie statusu**.
- Komentarz MG przy decyzji jest opcjonalny. Historia decyzji (kto, kiedy, status, komentarz) jest dostępna dla właściciela i MG.
- Niezależność weryfikacji: wspólna kolejka dla MG, brak przypisywania jednego MG do postaci.
- Dla kolejki używamy **daty ostatniego przekazania do weryfikacji**; najstarsze oczekujące są pierwsze. Brak oznaczenia „ponowna weryfikacja”.

### Formularz postaci

- **Jeden bieżący schemat** na wydarzenie; nie przechowujemy historii wersji biznesowych schematu. Techniczny `revision` służy kontroli konfliktów.
- Pola mają stabilne identyfikatory, sekcje, typ i walidację. Początkowo obsługujemy: krótką/długą odpowiedź, pojedynczy/wielokrotny wybór, blok informacyjny oraz ocenę, jeśli potrzebna dla preferencji gracza (renderer już ją obsługuje).
- Wszystkie postacie wydarzenia, także logicznie usunięte, odnoszą się do **aktualnego schematu**.
- Dodane pole nie ma odpowiedzi w istniejących postaciach. Usunięcie pola/sekcji/opcji usuwa właściwe odpowiedzi; zmiana typu pola usuwa wcześniejsze odpowiedzi tego pola. Statusy weryfikacji nie zmieniają się automatycznie.
- Przed destrukcyjną zmianą: jasne ostrzeżenie, liczba **aktywnych** postaci tracących dane, informacja o wpływie także na logicznie usunięte postacie, świadome potwierdzenie i opcjonalny eksport JSON.
- W MVP zapis kreatora jest **ręczny**, zbiorczy i atomowy: wiele lokalnych zmian, jeden przycisk `Zapisz zmiany`. Niezapisany schemat nie wpływa na graczy; przy opuszczaniu widoku ostrzegamy o niezapisanej pracy.
- Konflikt rewizji schematu blokuje zapis bez nadpisania cudzych zmian i bez utraty lokalnej pracy. Pełny interfejs ręcznego porównania może powstać później.
- Po wdrożeniu pól warunkowych: zależność wyłącznie od pól **wcześniejszych w kolejności**, ukryte pole nie aktywuje dalszych zależności; zapisane odpowiedzi w ukrytych polach pozostają, lecz nie są wyświetlane ani walidowane.

### Usuwanie i kopie

- Usuwanie postaci jest **logiczne (soft delete)**; zachowujemy dane i historię. Usunięta postać znika z aktywnych list.
- MG może przywrócić postać tylko wtedy, gdy właściciel nie ma już innej aktywnej postaci w tym wydarzeniu; przywrócenie zachowuje wcześniejszy status.
- Kopia JSON obejmuje definicję formularza, odpowiedzi, powiązania z postaciami oraz notatki MG – zarówno dla aktywnych, jak i logicznie usuniętych postaci. Zwykły MG bez prawa zarządzania formularzem nie może jej pobrać.
- Eksport dostępny w dowolnym momencie dla organizatora/osób zarządzających formularzem; nie prowadzimy osobnej historii eksportów. Import z kopii nie należy do MVP.

## 4. Model danych – minimum pojęciowe

Docelowy model domeny powinien rozdzielać co najmniej:
- `User` – konto i tożsamość.
- `Event` – wydarzenie oraz stan zapisów.
- `EventMembership` – udział użytkownika w konkretnym wydarzeniu i jego uprawnienia.
- `CharacterForm` – bieżąca definicja formularza dla wydarzenia oraz rewizja.
- `Character` – właściciel, wydarzenie, status, odpowiedzi indeksowane stabilnymi identyfikatorami pól, znaczniki czasu oraz informacja o logicznym usunięciu.
- `ReviewHistory` – decyzje MG, komentarze i znaczniki czasu.
- `Notification` – trwałe powiadomienia wewnętrzne i informacja o przeczytaniu.
- W P1: `GmNote` / wewnętrzne notatki przy postaci i polach; operacje usunięcia/przywrócenia.

Nazwy tabel i struktura bazy są decyzją implementacyjną. Nie narzucać nieuzgodnionego dostawcy uwierzytelniania lub backendu bez krótkiego uzasadnienia. Integralność i uprawnienia muszą być zabezpieczone **w API i bazie**, a nie wyłącznie w Angularze.

## 5. Aktualny kod – punkt wyjścia do refaktoryzacji

Stan z gałęzi `feature/platform-foundation-v24` (kontrola 2026-10-14):
- Angular 22 + SCSS + Angular CDK, wspólna powłoka UI i routing.
- `src/app/modules/surveys/`: prototyp kreatora formularza, walidacji i renderera.
- `src/app/modules/character/` oraz `src/app/features/character-*/`: starszy generator postaci i formularz o odrębnym modelu.
- `src/app/core/storage/character-store.service.ts`: postacie w `sessionStorage` przeglądarki, **bez zapisu do API**.
- Kreator `SurveyBuilderPage` zapisuje szkic automatycznie do `localStorage`; to zachowanie **trzeba zmienić** na ręczny zapis docelowego formularza.
- `src/app/core/permissions/permission.model.ts`: tylko deklaracja ról/uprawnień; docelowe reguły musi egzekwować backend.
- `src/app/core/config/features.config.ts`: panele gracza i organizatora są obecnie wyłączone; część tras ma oznaczenie `development`.
- `public/data/*.json`: przydatne katalogi cech, kultur, pochodzenia i preferencji; zachować ich użyteczną zawartość.
- `src/app/core/models/character.model.ts`: dotychczasowy sztywny model i statusy `draft/submitted/in-review/ready` nie odpowiadają w pełni ustalonej domenie. Potrzebne jest ujednolicenie.
- README i instrukcje wersji `v24–v26` opisują historię prototypu; **nie traktować ich jako nadrzędnych wymagań**.

**Znany problem CI:** uruchomienie GitHub Actions z 2026-10-12 (run `38262847888`) kończy się na `npm run build`, ponieważ `src/app/features/character-review/character-review.scss` ma około **9,88 kB**, a budżet `anyComponentStyle.maximumError` ustawiono na **8 kB**. Testy jednostkowe zostały pominięte po błędzie kompilacji.

## 6. Kolejność prac / backlog

| ID | Cel | Główny rezultat |
|---|---|---|
| **U-01** | Naprawa builda i CI | `npm ci`, `npm run build`, `npm test -- --watch=false` przechodzą |
| **U-02** | Trwałość danych | Backend, baza i pierwsze API wraz z migracjami |
| **U-03** | Konta/uprawnienia | Logowanie i autoryzacja operacji wydarzenia po stronie serwera |
| **U-04** | Wydarzenie i zapisy | Publikacja wydarzenia, dołączenie uczestnika, zamknięcie zapisów |
| **U-05** | Integracja formularza | Jeden formularz wydarzenia generuje widok tworzenia postaci |
| **U-06** | Edycja schematu | Ręczny zapis, walidacja i podstawowe zabezpieczenia zmian |
| **U-07** | Zapis postaci | Postać jest trwała i należy do właściwego użytkownika/wydarzenia |
| **U-08** | Weryfikacja danych | Szkic, walidacja i „Przekaż do weryfikacji” |
| **U-09** | Panel MG | Lista, wyszukiwanie, statusy i decyzje |
| **U-10** | Historia i komentarze | Historia decyzji i komentarze zgodnie z uprawnieniami |
| **U-11** | Powiadomienia | Decyzje MG widoczne dla właściciela w aplikacji |
| **U-12** | Usuwanie/przywracanie (P1) | Soft delete i odzyskanie przez MG |
| **U-13** | Testy E2E i wdrożenie | Cały scenariusz działa na głównych rozdzielczościach |

**Pierwsze zlecenie dla Codex: wyłącznie U-01.** Nie zaczynać jednocześnie U-02–U-13. Dla kolejnych zadań przygotowywać małe, osobno testowalne PR-y.

## 7. Kryteria akceptacji produktu

### Pierwszy działający pionowy przepływ
- Organizator zapisuje formularz w bazie, gracz otwiera dokładnie ten sam zestaw pól.
- Gracz zapisuje szkic, wylogowuje się i po zalogowaniu nadal ma dane.
- Inny użytkownik nie ma dostępu do tej postaci.
- Wysłanie niepoprawnego formularza jest blokowane; poprawny trafia do wspólnej kolejki MG.
- MG kieruje zgłoszenie do poprawy, gracz poprawia i ponownie przekazuje.
- MG akceptuje poprawną postać; gracz widzi decyzję i nie może bez zgody MG zmienić zaakceptowanych danych.
- Zamknięcie zapisów nie blokuje działań na postaci istniejącego uczestnika.
- Nie dochodzi do cichego nadpisania danych przy konflikcie rewizji.

### Jakość
- Przechodzą build, testy jednostkowe i przynajmniej krytyczne scenariusze integracyjne/E2E.
- Autoryzacja jest testowana także dla prób dostępu do API bez uprawnień.
- Interfejs ma czytelny stan ładowania, błędu i sukcesu; obsługuje klawiaturę, telefon i desktop.
- Dane poufne MG i graczy nie są ujawniane w publicznych odpowiedziach API.
- Nie przechowujemy rzeczywistych danych uczestników w prototypowych danych demonstracyjnych ani w publicznym repozytorium.

## 8. Zasady współpracy z Codex

1. Pracuj na **oddzielnej gałęzi roboczej** utworzonej z `feature/platform-foundation-v24`; nie commituj bezpośrednio do `main` i nie merguj bez akceptacji.
2. Najpierw przeanalizuj istniejące moduły; **nie przepisuj całej aplikacji od zera**. Wykorzystaj obecny UI, katalogi, renderer i edytor tam, gdzie to możliwe.
3. Realizuj **jedno zadanie backlogu na raz**. Nie dodawaj niezamówionych modułów, komplikacji architektury ani „przy okazji” funkcji z sekcji poza MVP.
4. Gdy istniejący kod jest sprzeczny z regułami domeny, wskaż różnicę i zaproponuj migrację z zachowaniem danych.
5. Zanim zmienisz strukturę modelu, zaproponuj minimalny kontrakt API i migrację danych. Szczegóły techniczne wybieraj pragmatycznie, nie pytając o każdą drobnostkę.
6. Testuj zmianę i nie oznaczaj jej jako ukończonej, gdy kompilacja lub testy zawodzą.
7. Po zadaniu przedstaw: zmienione pliki, krótkie uzasadnienie, wynik build/testów, ryzyka i instrukcję weryfikacji.
8. Zachowaj kierunek UX: nowoczesny, responsywny, czytelny interfejs inspirowany Kislevem, bez pogarszania dostępności i bez zbędnych ekranów.
9. Nie wprowadzaj automatycznie zmian w regułach produktu na podstawie tego, co przypadkowo realizuje stary prototyp.

**Definicja sukcesu MVP:** organizator publikuje wydarzenie i formularz, gracz zapisuje się i zgłasza postać, MG ją weryfikuje, a obie strony widzą trwały, poprawny stan po ponownym zalogowaniu.
