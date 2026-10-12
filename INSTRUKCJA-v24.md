# Ursunalia 2027 – Fundament platformy v24

Zmiany przygotowane wyłącznie dla gałęzi `feature/platform-foundation-v24` utworzonej z tagu `frontend-v23.1-stable`.

## 1. Przed instalacją – przełącz gałąź

W PowerShellu:

```powershell
cd G:\Projects\ursunalia-character-generator
git status --short
```

Jeśli są niezapisane lub przygotowane zmiany, zatrzymaj się – nie nadpisuj ich.

```powershell
git fetch origin feature/platform-foundation-v24
git switch --track origin/feature/platform-foundation-v24
```

Jeżeli gałąź lokalna już istnieje, zamiast `git switch --track` wykonaj:

```powershell
git switch feature/platform-foundation-v24
```

Potwierdź:

```powershell
git branch --show-current
git rev-parse --short HEAD
```

Powinno być `feature/platform-foundation-v24` i początkowo `057951a`.

## 2. Instalacja

Pobierz paczkę ZIP do `G:\Projects\download-temps\ursunalia_platform_foundation_v24.zip`, następnie:

```powershell
Expand-Archive -Path "G:\Projects\download-temps\ursunalia_platform_foundation_v24.zip" -DestinationPath . -Force
```

## 3. Test

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-platform-v24.ps1
npm start
```

Otwórz: lokalny URL pokazany przez Angular CLI.

Sprawdź:
- `/` – strona Ursunaliów,
- `/#/zgloszenie-postaci` – generator (dokładny prefiks zależy od base href),
- `/#/organizator/ankiety` – szkielet **tylko na npm start**,
- przełączanie formularz/podsumowanie, zapis sesji po F5,
- odpowiednie zachowanie Wstecz/Dalej.

## 4. Bezpieczeństwo i zakres

- ŻADNE logowanie, baza danych ani API jeszcze nie powstały.
- `Ankiety (dev)` są lokalnym szkieletem; znikają z menu w produkcji i mają zablokowaną trasę. Nie należy wprowadzać tam danych uczestników.
- `sessionStorage` nadal jest jedynym mechanizmem zapisu generatora; przycisk Zapisz nie wysyła danych.
- Role/uprawnienia są wyłącznie modelem typów. Kontrolę dostępu egzekwuje dopiero przyszły backend.
- Moduły niedostępne nie tracą danych: włączenie/wyłączenie to konfiguracja aplikacji.
- Nie wykonuj jeszcze commita. Przetestuj v24 i potwierdź działanie.

## 5. Uwaga wdrożeniowa

Routing ma strategię hash `/#/` z myślą o GitHub Pages bez serwerowego fallbacku tras.

Stabilny punkt odniesienia: `frontend-v23.1-stable`.
