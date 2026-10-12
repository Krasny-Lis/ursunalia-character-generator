# Ursunalia v26.5 — kontrola wyglądu i regresji

## Założenie
Ciemny shell: nawigacja, tło strony, hero, pasek dolny.
Jasne powierzchnie robocze: kreator ankiet, formularze gracza, zgłoszenie postaci i podsumowanie.

## Uruchomienie
```bash
npm ci
npm run build
npm test -- --watch=false
npm start
```

## Rozdzielczości
- Telefon 375 × 812 i 390 × 844
- Tablet 768 × 1024
- Desktop 1440 × 900

## Scenariusze ręczne
1. Otwórz ekran startowy: shell pozostaje ciemny.
2. Kreator ankiety: dodaj sekcję, pole tekstowe i opcje wyboru; zmień kolejność metodą drag-and-drop.
3. Sprawdź tekst w polach, zaznaczone karty i menu dodawania; kontrast oraz widoczny fokus klawiatury.
4. Uruchom podgląd formularza: wypełnij odpowiedzi, wywołaj walidację, popraw błędy i wyczyść odpowiedzi.
5. Otwórz zgłoszenie postaci: wszystkie karty i podsumowanie są jasne, a hero i dolny dock ciemne.
6. Rozwiń katalogi cech i okna opisów. Sprawdź układ i czytelność na mobile.
7. Odśwież stronę: szkice nadal obecne zgodnie z aktualną implementacją storage.
8. Sprawdź nawigację klawiaturą, działanie focus, rozwijanie sekcji i brak poziomego przewijania.
9. Uruchom preferencję systemową ograniczenia ruchu i sprawdź, czy animacje nie przeszkadzają.

## Ograniczenia
Automatyczny CI potwierdza budowę i testy jednostkowe po uruchomieniu GitHub Actions.
Ta instrukcja nie oznacza przeprowadzenia testów przeglądarkowych ani ich pozytywnego wyniku.
