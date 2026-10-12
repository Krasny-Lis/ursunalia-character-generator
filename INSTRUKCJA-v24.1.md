# Ursunalia 2027 – poprawki v24.1

Paczka do nalozenia na v24 na galezi `feature/platform-foundation-v24`. Nie zawiera zmian w bazie, danych postaci ani w konfiguracji ankiet.

## Naprawiono

1. Stopka: usunieto globalny dolny margines body po dawnym generatorze; App Shell wypelnia wysokosc okna. Odstep pod dolna belka formularza jest tylko na stronie generatora.
2. Cechy / Haki: przyciski Rozwin / Zwin wszystkie odzwierciedlaja stan realnie otwartych elementow details, rowniez po recznym klikaniu. Dotyczy formularza i Podsumowania.
3. F5: przy przeladowaniu tej samej strony odtwarzamy przewiniecie zapisane podczas pagehide; czekamy na zaladowanie lazy routingu / odpowiednia wysokosc strony. Nawigacje Wstecz/Dalej nadal obsluguje Angular Router.

## Instalacja

```powershell
cd G:\Projects\ursunalia-character-generator
git branch --show-current
git status --short
Expand-Archive -Path 'G:\Projects\download-temps\ursunalia_platform_fixes_v24_1.zip' -DestinationPath . -Force
npm run build
npm test -- --watch=false
npm start
```

## Weryfikacja manualna

- `/`: na dole ekranu stopka, bez pustego pasa pod nia.
- `/zgloszenie-postaci`: rozwin recznie kazdy opis w Cechach i Hakach; przycisk sam zmienia tekst na 'Zwin wszystkie'. Pierwszy klik zamyka wszystkie. Sprawdz rowniez Podsumowanie.
- Przewin do polowy formularza, odswiez F5; po zaladowaniu przewiniecie powinno powrocic blisko poprzedniej pozycji (ograniczone aktualna wysokoscia dokumentu). Sprawdz Wstecz / Dalej.

Nie wykonuj commita przed lokalnym zatwierdzeniem poprawki. `main` pozostaje bez zmian.
