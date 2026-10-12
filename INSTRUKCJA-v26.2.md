# Ursunalia v26.2 – podgląd 1:1 renderera i drag-sort na żywo

Gałąź: `feature/platform-foundation-v24`. Poprawka obejmuje tylko edytor ankiet.

## Instalacja

1. W katalogu repozytorium uruchom `npm install @angular/cdk@^22.2.0` – ta wersja odpowiada Angular 22. `package-lock.json` zostanie zaktualizowany lokalnie.
2. Rozpakuj ZIP do głównego katalogu projektu (`Expand-Archive -Force`).
3. `npm run build` oraz `npm test -- --watch=false`.
4. `npm start`.

## Zmiany
- Drag and drop wykonuje Angular CDK. Karty przestawiają się *w trakcie* przeciągania (placeholder i animacje), sekcje również; przenoszenie między sekcjami.
- Przyciski strzałek pozostają alternatywą.
- Uchwyt pola na pełną szerokość i wysokość min. 46px.
- Kliknięcie poza kartą usuwa zaznaczenie. Kliknięcie karty ustawia przewinięcie na jej górze po zmianie rozmiarów kart.
- Tryb podglądu przestał dziedziczyć style edytora. Używa tego samego `SurveyRenderer`, który wyświetla dynamiczną ankietę dla gracza. Uwaga: nie jest to jeszcze ten sam komponent co starszy generator postaci v23.1 (migracja szablonu planowana później).
- Bez zmian w przechowywanym JSON ani kluczu localStorage.

**Nie commituj** przed testami w przeglądarce, zwłaszcza przeciągania pól między sekcjami i przywracania szkicu.
