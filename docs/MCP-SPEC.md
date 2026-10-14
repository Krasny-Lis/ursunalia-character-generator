# Ursunalia 2027 — specyfikacja MVP dla Codex (Royal Manuscript)

**Obowiązująca baza kodu:** `feature/royal-manuscript-rebuild` w repozytorium `Krasny-Lis/ursunalia-character-generator`.  
**Wersja zastana:** Royal Manuscript **v27.2**, Angular 22 + Node.js 24 + SQLite.  
**Data aktualizacji:** 2026-10-14.

> **WAŻNE:** to jest właściwa specyfikacja wykonawcza dla najnowszej wersji projektu. Dokument `docs/MCP-SPEC.md` umieszczony wcześniej na `feature/platform-foundation-v24` opierał się na starszym kodzie i **nie jest instrukcją do implementowania od nowa backendu ani interfejsu**. NIE merguj `feature/platform-foundation-v24` do `feature/royal-manuscript-rebuild` i NIE cherry-pickuj poprawek U-01 w ciemno. Wszelkie kolejne gałęzie robocze i PR-y mają wychodzić z `feature/royal-manuscript-rebuild` oraz do niego wracać, chyba że właściciel projektu postanowi inaczej.

## 1. Cel i zasada ograniczenia złożoności

To platforma do publikowania i organizowania LARP-ów, początkowo **Ursunalia — Nowe Początki, Stare długi, 22–24.04.2027**. Organizator publikuje wydarzenie i definiuje **jedno zgłoszenie postaci**. Gracz uczestniczy w wydarzeniu, tworzy postać i przekazuje do MG. MG akceptuje, odrzuca lub odsyła do poprawy. Gracz widzi status i komentarz.

**Nie projektujemy od zera uniwersalnej platformy ankiet.** Obecny edytor pól i renderer są fundamentem zgłoszenia postaci. Nie implementujemy wszystkich uzgodnionych przypadków brzegowych w pierwszym wydaniu; priorytetem jest działający przepływ od konta do zaakceptowanej postaci.

## 2. Stan faktyczny repozytorium — NIE tworzyć tego ponownie

Sprawdzone na gałęzi `feature/royal-manuscript-rebuild`:
- `src/app/platform/` — nowy frontend Royal Manuscript v27.x, formularz postaci, karta, lista zgłoszeń, kreator, panel organizatora, konto i stan aplikacji.
- `server/server.mjs` — **istniejące API HTTP** z rejestracją, logowaniem, sesjami, publikacją formularzy, zapisem i weryfikacją zgłoszeń.
- **SQLite** (`users`, `sessions`, `forms`, `applications`) i zabezpieczenia sesji; baza może już zawierać rzeczywiste dane, więc nie wolno jej niszczyć przy refaktoryzacji.
- `shared/validation.mjs` — wspólna walidacja po stronie klienta i serwera.
- `public/data/platform.json` — demonstracyjne dane wydarzenia i formularzy (nie jedyne źródło prawdy dla przyszłych wydarzeń).
- `server/server.test.mjs` — integracyjne testy API/SQLite.
- `.github/workflows/verify.yml` — build Angulara, testy frontendu, backendu i walidacja katalogów.
- `docs/DESIGN-v27.md`, `docs/QA-v27.1.md`, `README.md` — istniejące materiały wdrożeniowe i wizualne.

Ostatni sprawdzony CI gałęzi `royal-manuscript-rebuild` dla commita `68737a8` zakończył się **success**: https://github.com/Krasny-Lis/ursunalia-character-generator/actions/runs/38321049210 .

**U-01 na starszej gałęzi nie jest wymaganym cherry-pickiem.** Starszy błąd SCSS `character-review.scss` dotyczył usuniętego w przebudowie komponentu. Wersja Royal Manuscript ma inny zestaw stylów i zielony CI.

## 3. Reguły biznesowe docelowego produktu

### Wydarzenie i postać
- Jedno wydarzenie może mieć **jeden aktywny formularz zgłoszenia postaci**, konfigurowany przez organizatora.
- Status uczestnictwa w wydarzeniu jest odrębny od statusu postaci i ewentualnych płatności.
- Gracz może posiadać **jedną aktywną postać na wydarzenie**. Usunięta logicznie postać nie liczy się do limitu.
- Zamknięcie zapisów dotyczy nowych uczestników, a nie możliwości utworzenia, poprawienia czy zastąpienia postaci przez już zapisanego uczestnika.

### Cykl zgłoszenia — pięć stanów
- `W edycji` (`draft`): szkic; nie musi być kompletny.
- `Do weryfikacji` (`submitted`): wysłane do wspólnej kolejki MG.
- `Do poprawy` (`changes`): MG odesłał do poprawy.
- `Zaakceptowana` (`accepted`): gracz nie edytuje bez odblokowania przez MG.
- `Odrzucona` (`rejected`): gracz może poprawić i wysłać ponownie.

Wysyłka oraz **nowa akceptacja** wymagają poprawnych danych. Zapis niekompletnego szkicu jest dozwolony. Edycja `submitted` jest dozwolona, ale dopiero **zapis rzeczywistych zmian** przenosi zgłoszenie do `draft`; otwarcie ekranu nie zmienia statusu. MG może edytować postać bez automatycznej zmiany statusu. Komentarz przy decyzji MG jest **opcjonalny**, także przy odrzuceniu lub prośbie o poprawki.

Historia decyzji MG (aktor, czas, status, komentarz) jest widoczna dla MG i właściciela postaci. Prywatne notatki MG nie mogą trafiać do API gracza.

### Formularz
- Jeden **aktualnie obowiązujący schemat** na wydarzenie; nie utrzymujemy osobnych historycznych wersji biznesowych formularza. Techniczny licznik rewizji do bezpiecznego zapisu jest dozwolony.
- Organizator konfiguruje sekcje, kolejność i rodzaje pól, etykiety, opisy, wymagalność i walidację. Zachowujemy istniejące możliwości UI, o ile nie kolidują z produktem.
- W edytorze zapis formularza jest **ręczny i zbiorczy**; niezapisane zmiany nie wpływają na postacie. W razie opuszczenia ekranu ostrzegamy, a konflikt rewizji nie może nadpisać cudzej pracy.
- Zmiany schematu działają na istniejące postacie, także logicznie usunięte. Usuwanie pól/opcji lub zmiana typu mogą niszczyć odpowiedzi; przed zapisem ostrzegamy i wymagamy potwierdzenia, a status weryfikacji pozostaje bez automatycznej zmiany.
- Kontekstowy eksport JSON przed zmianami destrukcyjnymi oraz pełny eksport w dowolnym momencie są dostępne dla organizatora/osób zarządzających formularzem; JSON ma obejmować także logicznie usunięte postacie i notatki MG. Nie przechowujemy historii eksportów i nie implementujemy automatycznego importu z kopii.
- Zaawansowane warunki widoczności, rozbudowane analizy skutków zmian i ręczne scalanie dużych konfliktów mogą powstać później. Jeśli wdrażamy pola warunkowe, niewidoczne pola nie są walidowane, zachowują wartości i mogą zależeć tylko od wcześniejszych pól.

### Usuwanie
- Usunięcie postaci jest logiczne i nie usuwa automatycznie uczestnictwa. Gracz może usunąć także zaakceptowaną postać po potwierdzeniu.
- MG może przywrócić rekord wyłącznie, gdy jego właściciel nie ma innej aktywnej postaci na tym wydarzeniu; przywrócony status pozostaje bez zmian.
- Archiwum po wydarzeniu, odtwarzanie postaci na inne wydarzenie, zaawansowane operacje masowe i rozbudowane filtry są późniejszym etapem.

## 4. Najważniejsze rozbieżności obecnego v27.2 z celem

Te rozbieżności wynikają z istniejącego kodu, **nie są krytyką funkcjonującego prototypu**; należy je eliminować stopniowo.

| W v27.2 jest | Docelowo potrzebujemy |
|---|---|
| W `platform.json` i UI są różne formularze/ankiety, a API udostępnia wiele formularzy | Jeden formularz **postaci** na wydarzenie; pozostałe rodzaje ankiet poza MVP |
| `applications` ma unikalność `user_id, form_id` | Limit jednej **aktywnej postaci na wydarzenie**, uwzględniający soft delete |
| `forms` przechowuje rewizje; zgłoszenia wskazują konkretną `form_revision` | Jeden żywy schemat; konieczna ostrożna migracja starych danych i odpowiedzi |
| API obsługuje `draft/submitted/accepted/changes` | Dodać `rejected`, właściwe przejścia i historię decyzji |
| Wysłane zgłoszenie ma blokadę edycji; prośba o poprawki wymaga wpisania komentarza | Edycja `submitted` przez gracza z cofnięciem do szkicu dopiero przy faktycznym zapisie zmian; komentarze opcjonalne |
| Kreator zapisuje lokalny szkic automatycznie, a publikacja działa osobno | Ręczne zapisanie obowiązującego schematu i właściwe ostrzeżenia przed opuszczeniem oraz utratą danych |
| Istnieją konta i role `participant/organizer`, ale nie pełne uczestnictwo i uprawnienia MG per wydarzenie | Uczestnictwo w wydarzeniu i właściwe uprawnienia organizatora/MG po stronie API |
| Działają rzeczywiste zgłoszenia i podstawowa recenzja, brak pełnego zestawu historii, powiadomień i usuwania | Rozwijać aktualne API zamiast tworzyć je od nowa |

Nie kasować drugiego formularza demonstracyjnego ani nie przepisywać istniejących danych automatycznie przed ustaleniem migracji.

## 5. Zaktualizowany backlog

1. **R-01 / U-02: audyt luk i plan bezpiecznej migracji** — przygotuj krótki raport: model obecnej bazy, endpointy, różnice z §3–4, plan migracji bez utraty istniejących rekordów, zakres pierwszego PR. Bez wielkiej refaktoryzacji.
2. **R-02: wydarzenia i uczestnictwo** — trwale przypisz graczy i uprawnienia do wydarzeń; zachowaj aktualne konta i sesje.
3. **R-03: jedna postać na wydarzenie** — ograniczenie po stronie bazy i API; zachowaj obecny renderer i formularz.
4. **R-04: statusy i weryfikacja MG** — pięć stanów, poprawne przejścia, opcjonalne komentarze i podstawowa historia decyzji.
5. **R-05: integracja żywego schematu** — dostosuj edytor i dane postaci bez nadpisywania odpowiedzi; zapisywanie ręczne i zabezpieczenia.
6. **R-06: powiadomienia i odzyskiwanie** — proste powiadomienia w aplikacji, soft delete, dostęp MG.
7. **R-07: test przepływu, responsywność i wdrożenie** — konto → uczestnictwo → szkic → weryfikacja → poprawa → akceptacja; build, testy, API, klawiatura i mobile.

**Najbliższe zlecenie Codex: wyłącznie R-01 (audyt i plan migracji).** U-01 na Royal Manuscript jest już pokryte działającym CI. Nie rozpoczynać budowy nowego backendu ani zamiany frameworka.

## 6. Zasady techniczne dla Codex

- Gałąź robocza **od `feature/royal-manuscript-rebuild`**, PR **do `feature/royal-manuscript-rebuild`**. Nie mergować bez zgody.
- Nie scalać starych gałęzi, nie odtwarzać usuniętych ekranów, nie podmieniać stylu Royal Manuscript innym UI.
- Preferować rozwinięcie `server/server.mjs`, SQLite, `shared/validation.mjs` i istniejących komponentów `src/app/platform`; inny backend tylko po osobnym uzasadnieniu i akceptacji.
- Każda zmiana schematu SQLite musi mieć **jawny plan migracji** i test na danych istniejących. Nie używać `DROP TABLE` albo resetu bazy jako „migracji”.
- Nie obniżać poziomu zabezpieczeń (autoryzacja po stronie serwera, izolacja uczestników, poprawność danych, sesje). Testy odmowy dostępu są obowiązkowe.
- Testy: `npm ci`, `npm run verify`, `node scripts/validate-catalog.mjs`; ręczny przegląd istotnych zmian UI.
- Zmiany realizować małymi PR-ami, z kryteriami akceptacji; nie implementować na zapas szczegółów z dalszych etapów.
- Po każdym zadaniu raportować: zmienione pliki, wyniki testów, ryzyka migracji, instrukcję testu użytkownika, link do PR.

**Definicja sukcesu MVP:** organizator publikuje wydarzenie i jego formularz postaci; uczestnik rejestruje się, zapisuje postać trwale i wysyła ją MG; MG kieruje do poprawy albo akceptuje; uczestnik widzi decyzję po ponownym zalogowaniu. Wszystko na istniejącym interfejsie Royal Manuscript.
