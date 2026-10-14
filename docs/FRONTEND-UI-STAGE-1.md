# Etap UI-1 – wspólna nawigacja i tryb projektowy

Baza: `feature/royal-manuscript-rebuild`, PR do tej samej gałęzi.
Prace na `feature/ursunalia-ui-redesign`. Bez merge i bez zmian backendu.

## Zakres

- Nagłówek kieruje do pięciu zaakceptowanych działów publicznych: Start, O wydarzeniu, Świat gry, Dla gracza, Aktualności.
- Publiczne linki do ankiet, wyszukiwanie ankiet, link do powiadomień i ikona awatara zostały usunięte z globalnego shell.
- Skróty do konta i narzędzi MG/organizatora odpowiadają roli w **roboczym podglądzie**. Docelowe ekrany i prawdziwe uprawnienia pozostają przedmiotem kolejnych etapów.
- Podstrony publiczne oprócz Startu są na razie jawnymi stronami przejściowymi. Nie udają ukończonej treści.
- W `ng serve` widać pasek `Podgląd UI`: Gość, Gracz, MG, Organizator; status postaci i niezależna blokada, składka, status dokumentu i obecność linku. Przełącznik działa wyłącznie w pamięci.
- Przełącznik jest ukryty w produkcyjnym buildzie Angulara (`isDevMode() === false`). **Nie stanowi mechanizmu autoryzacji.**
- Istniejące trasy starego interfejsu i funkcje serwera zachowane dla zgodności. Nowych serwerowych uprawnień, płatności i modelu kont jeszcze nie implementowano.

## Podgląd lokalny

```bash
npm ci
npm start
```

Otwórz http://localhost:4200. Tryb projektowy jest dostępny w developerskim buildzie Angulara.
W `npm run build && npm run server` pasek nie będzie widoczny — to zamierzone.

## Testy i odbiór

```bash
npm run verify
node scripts/validate-catalog.mjs
```

Sprawdź przy 1440, 980, 390 i 320 px: menu publiczne, otwieranie i zamykanie mobile,
rozwijanie paska, wybór ról i stanów, brak poziomego scrolla. Żaden przełącznik nie powinien
wywołać rzeczywistej zmiany sesji, uprawnień ani danych SQLite.

## Następny etap

Wymiana przejściowych stron na zaakceptowane widoki hubu informacyjnego i artykułów,
z jedną grafiką tytułową, tekstowymi aktualnościami i bez miniatur w panelu redakcyjnym.
