# Ursunalia – Edytor ankiet v26.1 (inline)

Poprawka **NA paczkę v26**. Tylko edytor i jego logika. Nie zmienia generatora postaci, istniejącego renderera v25 ani danych szkiców (`localStorage` pozostaje pod tym samym kluczem).

## Co zmienia
- Jednokolumnowy edytor inspirowany Google Forms; kliknięcie karty otwiera jej ustawienia wewnątrz niej.
- Brak lewego panelu typów oraz prawego panelu właściwości.
- Wąski pasek dodawania pytania/sekcji; wszystkie ustawienia pytania (w tym zmiana typu) są na karcie.
- Wysoki, rozszerzalny `Opis pomocniczy` i pola pomocy `ⓘ` oraz opisów odpowiedzi.
- Przeciąganie kart za uchwyt, z wyraźną linią przed/za celem; przenoszenie między sekcjami.
- Alternatywne przyciski `↑`/`↓`.
- Zachowane import/eksport JSON, zapis lokalny, podgląd i konfiguracja sekcji.
- Zmiana typu pola zachowuje ID pytania i jego pozycję.

## Instalacja (PowerShell)
```powershell
cd G:\Projects\ursunalia-character-generator
git branch --show-current
# oczekiwany: feature/platform-foundation-v24
Expand-Archive -Path "G:\Projects\download-temps\ursunalia_surveys_v26_1_inline_editor.zip" -DestinationPath . -Force
npm run build
npm test -- --watch=false
npm start
```

Adres: `http://localhost:4200/#/organizator/ankiety/edytor`

## Sprawdź
1. Wybierz kartę i wpisz kilka linijek w „Opis pomocniczy”. Da się zwiększyć wysokość pola.
2. Zmień typ pytania wewnątrz jego karty.
3. Dodaj opcje odpowiedzi, edytuj ich opisy, skonfiguruj `ⓘ`, obowiązkowość i walidację.
4. Chwyć uchwyt `⠿` i przesuń pytanie powyżej/poniżej innego; zobacz złotą linię miejsca wstawienia.
5. Przenieś pytanie między sekcjami i całą sekcję między innymi sekcjami.
6. Przyciskami `↑`/`↓` zmień kolejność bez przeciągania.
7. Podgląd, import/eksport JSON i odświeżenie strony – zachowują szkic.
8. Sprawdź, czy stary generator pod `/zgloszenie-postaci` nadal działa.

## Uwagi
- W środowisku narzędziowym wykonano izolowany `tsc` modelu oraz typowanie pliku klasy z deklaracjami testowymi Angulara i próby przenoszenia danych. **Pełny build Angulara i testy UI wymagają uruchomienia w lokalnym repozytorium.**
- Brak zmian w `package.json` i `package-lock.json` – nie trzeba instalować dodatkowych bibliotek.
- Edytor jest nadal deweloperski i zapisuje szkice w `localStorage`, nie publikuje ankiet.
- Bez commita i bez mergowania do `main`, dopóki wersja nie zostanie zaakceptowana.
