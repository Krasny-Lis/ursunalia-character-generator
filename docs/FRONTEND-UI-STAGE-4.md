# Etap UI-4 – „Dla gracza” i „Aktualności”

**Gałąź:** `feature/ursunalia-guides-and-news` od `feature/ursunalia-event-and-world` (PR #11). Etapy są zależne i pozostają szkicami do odbioru. Nie scalać bez wyraźnej akceptacji.

## Dla gracza (`/dla-gracza`)

- Jeden hub poradników z sześcioma sekcjami: Jak wziąć udział, Tworzenie postaci, Stroje i wyposażenie, Zasady i mechaniki, Materiały, FAQ.
- Na górze karty nawigujące do fragmentów strony (obsługiwane przez Angular Router z hash routingiem).
- Docelowa ścieżka: **konto → postać i decyzja MG → składka przelewem → dokument Google Docs**.
- Jeden użytkownik ma jedną aktywną postać na wydarzenie; podczas weryfikacji widzi status/uwagi, zablokowanej postaci nie edytuje.
- Brak fotografii profilowych, formularza ubezpieczenia, archiwum, powiadomień oraz samodzielnego potwierdzenia przelewu.
- Kwoty, miejsca, zasady bezpieczeństwa, program i terminy nie są wymyślane. Oficjalny regulamin i mechaniki pozostają opisane jako materiały w przygotowaniu.
- Linki tylko do istniejących miejsc w serwisie; dalsza implementacja profilu i składek jest osobnym etapem.

## Aktualności (`/aktualnosci` i `/aktualnosci/:slug`)

- Lista tekstowa bez miniaturek, z wyróżnionym przypiętym komunikatem, kategoriami, wyszukiwaniem i widokiem pełnego wpisu.
- **Production**: stan pusty, ponieważ nie powstał jeszcze CMS ani API wpisów. Żadnych fikcyjnych dat i wiadomości.
- **Development**: trzy przykłady wyłącznie do sprawdzenia wyglądu i przepływu, jawnie oznaczone „podgląd deweloperski”. Dwa przykłady „Wszyscy”, jeden „Organizator”. MG widzi tylko przykłady „Wszyscy”.
- Dostęp do wpisu redakcyjnego w podglądzie wynika tylko z lokalnego `UiPreviewStore`. To NIE jest zabezpieczenie. Produkcyjny CMS ma egzekwować widoczność i status publikacji na serwerze.
- Brak sztucznie wygenerowanych linków Google Forms; przyszły edytor wpisów może obsługiwać prawdziwe linki do dodatkowych ankiet.
- Nie dodajemy danych do backendu, migracji, powiadomień ani prawdziwych publikacji.

## Odbiór i testy

1. Otwórz `npm start` i sprawdź sekcje „Dla gracza” (w tym nawigację fragmentami) i demonstracyjne aktualności.
2. Zmień rolę Gość / Gracz / MG / Organizator w pasku podglądu; sprawdź trzeci wpis tylko w trybie Organizator.
3. Kliknij przykład wpisu i sprawdź link „Wróć do aktualności”. Przejście do materiału organizatora przez URL nie powinno pokazywać treści Gościowi.
4. Filtry, wyszukiwanie, brak miniaturek, stan braku wyników i pusta tablica w produkcji.
5. Widoki 1440, 980, 390, 320 px, obsługa klawiaturą, bez poziomego scrolla.
6. `npm run verify` i `node scripts/validate-catalog.mjs`.

### Podgląd
```powershell
git fetch origin
git switch feature/ursunalia-guides-and-news
npm ci
npm start
```

Adres: `http://localhost:4200`. Backend i rzeczywiste uprawnienia bez zmian.
