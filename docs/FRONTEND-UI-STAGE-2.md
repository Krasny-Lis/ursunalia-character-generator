# Etap UI-2 – Strona główna Ursunaliów 2027

Gałąź `feature/ursunalia-homepage-hub` bazuje na `feature/ursunalia-ui-redesign` (PR #9).
PR jest zależny od poprzedniego etapu i ma być scalony dopiero po akceptacji, w ustalonej kolejności.

## Zakres

- Główny URL `/` pokazuje jeden LARP — **Ursunalia 2027** — zamiast uniwersalnego katalogu wydarzeń i ankiet.
- Kompaktowy hero z istniejącą grafiką `art/kislev-night.png`, datą i dwoma czytelnymi działaniami.
- Tekstowa, wysoko umieszczona sekcja aktualności. Póki nie ma CMS, wyraźny pusty stan — żadnych wymyślonych wpisów.
- Informacje praktyczne: data jest znana; fizyczny adres, kwota i termin składki pozostają `do ogłoszenia`.
- Status otwarcia zgłoszeń w trybie server odczytywany jest z `registrationsOpen`; w demo jest `Do ogłoszenia`, aby nie udawać oficjalnego terminu.
- Cztery etapy uczestnictwa: konto → postać i decyzja MG → składka → karta.
- Skróty do zatwierdzonych działów `Świat gry` i `Dla gracza`.
- Przy istniejącym formularzu przycisk uruchamia dotychczasowy `PlatformStore.start`; w trybie server wymaga prawdziwego konta i otwartych zgłoszeń. Nie dodajemy nowych uprawnień frontendem.
- Zachowana ścieżka `/wydarzenie/:id` dla kompatybilności ze starym kodem. Nie jest eksponowana na stronie głównej.
- Bez zmian w API, SQLite, tabelach, migracjach, schematach i uprawnieniach.
- Pozostałe podstrony publiczne nadal będą widokami przejściowymi; CMS i aktualności są osobnym etapem.

## Kryteria odbioru

- [ ] Desktop 1440 px: hero bez pełnoekranowego obrazu, aktualności wysoko, praktyczne informacje z boku.
- [ ] Tablet 980 px: czytelny nagłówek, 2 kolumny tam, gdzie jest miejsce.
- [ ] Mobile 390 i 320 px: jedna kolumna, poprawne CTA, bez przewijania poziomego.
- [ ] Sekcja aktualności nie pokazuje fikcyjnych publikacji.
- [ ] Gdy server zamyka zgłoszenia, brak aktywnego przycisku tworzenia postaci.
- [ ] W trybie demo przejście do edytora przez istniejący workflow nadal działa.
- [ ] Build Angular, testy Vitest i testy backendu przechodzą.

### Lokalne sprawdzenie

```bash
git fetch origin
git switch feature/ursunalia-homepage-hub
npm ci
npm start
```

Otwórz http://localhost:4200. Na etapie UI-2 nie usuwamy jeszcze starego panelu konta i mechanizmów archiwum z backendu. Ich ukrycie w docelowych widokach będzie osobnym etapem.
