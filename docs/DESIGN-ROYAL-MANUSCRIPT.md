# Ursunalia — Royal Manuscript (v26.6)

Zatwierdzony kierunek: ciemny Kislevski shell + ciepły pergamin + bordo i stare złoto.

## Zakres wdrożenia
- `src/styles/_manuscript.scss` — tokeny i wygląd kreatora, paneli zgłoszenia oraz okien informacji.
- `src/app/modules/surveys/renderer/survey-renderer.scss` — formularz ankiety gracza.
- `src/app/features/character-review/character-review.scss` — formularz i podsumowanie postaci (oba komponenty używają tego pliku).
- `src/styles.scss` — import motywu na końcu kaskady.

## Przyjęte reguły
- Dark shell: globalna nawigacja, nagłówek, tło, hero, stała dolna belka.
- Light: formularz, karty, edytor, wybory, opisy i rozwijane sekcje.
- Szeryfowe nagłówki, bezszeryfowe etykiety i kontrolki.
- Tekst na jednolitych powierzchniach. Faktura pergaminu i zdobienia wyłącznie dekoracyjne, nie za tekstem.
- Małe ekrany: jednokolumnowy układ, mniej ozdobników, wyraźne cele dotykowe.

## Weryfikacja
```bash
npm ci
npm run build
npm test -- --watch=false
npm start
```

Testy ręczne: desktop 1440 px, tablet 768 px, telefon 390 px; sprawdź kreator, edytowanie pytania, drag-and-drop, wybór, walidację, podgląd, formularz i kartę postaci. Automatyczna walidacja wizualna nie została wykonana w ramach tego commitu.

## Ograniczenia
Wizualizacje są kierunkiem artystycznym, nie makietą pixel-perfect. Nie dodano obrazów góry/fortu ani portretów postaci do kodu — wymagają przygotowania i licencji. Wcześniejsze style pozostają w repozytorium, ale nowy partial jest ostatnim nadpisaniem. Docelowy refactor legacy SCSS należy wykonać po testach wizualnych.
