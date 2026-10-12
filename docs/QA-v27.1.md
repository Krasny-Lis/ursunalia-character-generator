# Ursunalia v27.1 — weryfikacja po korektach Royal Manuscript

Data: 12.10.2026. Bazą jest kompletne archiwum v27 dostarczone przez użytkownika.

## Wykonane poprawki

- Naprawiono rozciąganie numeru sekcji w kreatorze. Przyczyną był selektor `.section-heading > span:nth-child(2)` działający również na identyfikator numeru, kiedy poprzedzała go rączka przeciągania.
- Ujednolicono typografię pól tytułów sekcji i formularza; wcześniejsze ogólne style `input:not(...)` przesłaniały style nagłówka i redukowały jego wielkość.
- Złagodzono kontrast gór i zamku za formularzami przez warstwę przyciemniającą i poprawiono tonację pergaminu.
- W mobilnej ankiecie usunięto powtórne działania nad formularzem (zostaje stały pasek Zapisz szkic / Dalej). Nawigator pokazuje wszystkie **siedem** faktycznych sekcji zamiast ucinania kolejnych kroków.
- Te same poprawki CSS znajdują się w `src/styles.scss` oraz w dołączonym `dist/.../browser/styles-*.css`. JS aplikacji pozostał bez zmian.

## Wyniki lokalnej weryfikacji

- Katalogi świata: **10/10 zgodnych**, polecenie `node scripts/validate-catalog.mjs`.
- Integracja backendu HTTP/SQLite: **6/6 testów PASS**, polecenie `node --test server/server.test.mjs`.
- UI: z dostarczonego buildu Angular uruchomiono moduły i style w izolowanym Chromium/Playwright z podstawionymi odpowiedziami `platform.json` i `runtime-config.json` oraz lokalną pamięcią przeglądarki. Sprawdzono formularz, kartę i kreator dla **320, 360, 390, 768, 820, 1440 i 1672 px**. We wszystkich 21 kombinacjach `document.documentElement.scrollWidth` nie przekraczał `innerWidth`; nie wystąpiły błędy `pageerror`.
- Interakcje w przeglądarce: zmiana imienia, zapis szkicu, sprawdzenie karty; w edytorze dodanie pytania (34 → 35), zmiana tytułu i otwarcie podglądu — **PASS**. W izolowanym środowisku dodano wyłącznie testowy zamiennik `crypto.randomUUID()`; prawdziwa witryna HTTPS używa natywnego API.
- Przejrzano rendery 1672×945 i 390×844 po CSS; stwierdzone różnice poprawiono. Nie wykonywano automatycznego porównania piksel po pikselu.

## Granice i blokery

- Dostępny Node.js: **22.16.0**. Angular 22.2.2 wymaga Node.js **22.22.3+ albo 24.15.0+**. Instalacja `npm ci --offline` nie powiodła się z powodu brakującego artefaktu w cache (`zod@4.6.5`). Próba pobrania zależności online nie ukończyła się; DNS GitHub również jest niedostępny. **Nie uruchomiono ponownie `npm run verify` ani 12 testów Angulara**, które zostały zgłoszone jako zaliczone w poprzednim środowisku.
- Test Chromium działał przez wstrzyknięte skompilowane zasoby bez dostępu do internetu i nie stanowi testu prawdziwego wdrożenia HTTP. Backend został sprawdzony oddzielnie; nie testowano przeglądarkowego połączenia UI → API na żywym serwerze.
- Portret Aleny podczas testu izolowanego dostarczono przez `data:` URL, ponieważ środowisko blokuje pobieranie obrazów po HTTP. W ZIP-ie portret jest prawidłowo zachowany pod `public/art/alena.png`, a ścieżka źródłowa to `art/alena.png`.
- Brak uruchomienia na fizycznym telefonie, testów klawiatury ekranowej, czy testów wizualnych w Safari/Firefox.
- GitHub connector zezwala na zapis, ale terminal nie może się połączyć z `github.com`, a connector nie przyjmuje lokalnego ZIP-a jako kompletu obiektów Git. Dlatego pełnej przebudowy **nie wysłano** i **nie otwarto PR**; przygotowano bezpieczny skrypt importu dla czystego klona (opis w README).

## Przed wdrożeniem

Na Node.js 24.15+ i z dostępem do npm: `npm ci`, `npm run verify`, `node scripts/validate-catalog.mjs`, `npm run build`. Następnie wykonać rzeczywisty test E2E z logowaniem i API, oceną organizatora, mobilną klawiaturą oraz wizualny przegląd w Chrome/Firefox/Safari. Strony GitHub Pages nadal oferują tylko tryb demonstracyjny.
