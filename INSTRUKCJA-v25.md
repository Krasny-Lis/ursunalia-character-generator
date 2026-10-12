# Ursunalia v25 - uniwersalny model ankiet i renderer

## Wymagania
- Lokalna wersja v24.1 po zatwierdzonych poprawkach.
- Galaz `feature/platform-foundation-v24` (nie instalowac na `main`).
- Brak niezatwierdzonych zmian kolidujacych z plikami w tej paczce.

## Instalacja (PowerShell)
```powershell
cd G:\Projects\ursunalia-character-generator
git branch --show-current
git status --short
Expand-Archive -Path "G:\Projects\download-temps\ursunalia_surveys_v25.zip" -DestinationPath . -Force
npm run build
npm test -- --watch=false
npm start
```

## Co sprawdzic
1. `/` i `/#/zgloszenie-postaci` dzialaja jak w v24.1 (aplikacja stosuje hash routing).
2. Menu `Ankiety (dev)` otwiera liste testowa (tylko lokalny serwer dev).
3. Kliknij `Otworz podglad ankiety v25` (trasa `/#/organizator/ankiety/podglad`).
4. Wypelnij nazwe postaci i kulture, kliknij `Sprawdz odpowiedzi`.
5. Sprawdz rozne kontrolki: tekst, textarea, wybory, skale, teksty pod `ⓘ`, zwijane sekcje.
6. Kliknij `Wyczysc odpowiedzi`, potem `Sprawdz odpowiedzi`; powinny pojawic sie dwa bledy pol wymaganych.

## Co jest w paczce
- `src/app/modules/surveys/models/`: typowany schemat definicji i odpowiedzi.
- `src/app/modules/surveys/validation/`: czysta walidacja oraz testy.
- `src/app/modules/surveys/data/`: demonstracyjna definicja ankiety.
- `src/app/modules/surveys/renderer/`: wielokrotnego uzytku renderer i testy Angular.
- `src/app/modules/surveys/pages/survey-preview-page/`: deweloperski podglad.
- Aktualizacja `app.routes.ts` oraz widoku `surveys-dev-page.html`.

## Granice v25
- Brak kreatora drag and drop, backendu, uzytkownikow i zapisu odpowiedzi.
- Podglad jest demonstracyjny, nie nalezy wpisywac rzeczywistych danych osobowych.
- Istniejacy generator v24.1 jest nietkniety.
- Nowa trasa dostepna tylko w trybie dev za istniejacym `moduleEnabledGuard('surveys')`.
- Nie wykonuj commita, dopoki nie zatwierdzisz zmian lokalnie.
