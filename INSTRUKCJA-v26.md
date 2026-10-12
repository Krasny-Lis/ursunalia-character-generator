# Ursunalia 2027 – v26: wizualny edytor ankiet

## Punkt wyjścia
Gałąź: `feature/platform-foundation-v24`. Wymagana działająca i zatwierdzona v25 (razem z poprawką importu `SurveyIssue` i zabezpieczeniem `scrollIntoView`).

Nie przełączaj na `main`. Nie wykonuj commita przed testami.

## Instalacja (Windows PowerShell)

```powershell
cd G:\Projects\ursunalia-character-generator
git branch --show-current
git status --short
Expand-Archive -Path "G:\Projects\download-temps\ursunalia_surveys_v26.zip" -DestinationPath . -Force
npm run build
npm test -- --watch=false
npm start
```

Paczka modyfikuje istniejący `src/app/app.routes.ts`, `src/styles.scss` oraz ekran `/organizator/ankiety`, i dodaje nowe pliki edytora. W ZIP **nie ma** zmodyfikowanych plików starego generatora postaci ani v25 renderera.

## Test w przeglądarce

Adres: `http://localhost:4200/#/organizator/ankiety/edytor`

1. W edytorze wybierz sekcję oraz pytanie. Zmień etykietę, opis, wymaganie i informację ⓘ.
2. Dodaj krótkie i długie pole, wybór pojedynczy/wielokrotny, ocenę i blok informacyjny.
3. Dodaj sekcję, zmień kolejność przez uchwyt ⠿; wypróbuj także strzałki.
4. Przenieś pytanie między sekcjami oraz zduplikuj pytanie wyboru (ID opcji muszą być unikalne).
5. Dodaj opcję odpowiedzi, usuń opcję, zmień wygląd wyboru na kafelki lub select.
6. Przełącz na Podgląd, wypełnij obowiązkowe pola i naciśnij Sprawdź odpowiedzi.
7. Wróć do Edycji, odśwież F5: szkic ma pozostać (localStorage).
8. Wyeksportuj JSON, zresetuj do przykładu, ponownie zaimportuj ten JSON. Upewnij się, że poprzednie zmiany wróciły.
9. Wprowadź niepoprawny JSON i upewnij się, że edytor nie zastępuje bieżącego szkicu.
10. Sprawdź, czy dotychczasowe Zgłoszenie postaci nadal działa.

## Granice v26

- Edytor i podgląd tylko w development (istniejąca blokada trasy `surveys`).
- Zapis wyłącznie do **localStorage tej przeglądarki**. Brak backendu, kont zespołu i synchronizacji.
- Eksport/import JSON dotyczy **definicji ankiety**, nie odpowiedzi uczestników.
- Przeciąganie używa natywnego HTML Drag & Drop; na urządzeniach dotykowych używaj przycisków strzałek.
- Brak powtarzalnych rekordów, zestawów ocen, zasad warunkowych oraz współdzielonych katalogów; te elementy są planowane na v27+.
- Nie wpisuj rzeczywistych danych uczestników do demonstracyjnego podglądu.

## Walidacja

Model i operacje przenoszenia pól przeszły lokalne sprawdzenie TypeScript `--strict` oraz podstawowe testy Node. Nie było dostępnych lokalnie zależności Angular 22, więc pełny `ng build` i testy komponentów muszą zostać potwierdzone u Ciebie.
