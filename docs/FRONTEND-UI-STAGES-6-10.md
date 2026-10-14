# Ursunalia 2027 – zamknięcie projektowych etapów UI 6–10

Gałąź: `feature/ursunalia-ui-final-stages` od `feature/ursunalia-player-dashboard`.
PR #14 jest **draft / stacked** (zależności #9 → #10 → #11 → #12 → #13 → #14).
Nie scalać, nie wdrażać bez ręcznej akceptacji.

## Faktyczny zakres wykonany (frontend)

| Etap | Ekran | Zrealizowane teraz | Oczekuje na nowy backend |
| --- | --- | --- | --- |
| 6 – Konto | `/konto` | Royal Manuscript, formularz login/register przez dotychczasowe API, prywatny podgląd profilu, tryb demonstracji edycji, wylogowanie | Osobne imię/nazwisko, pseudonim, **telefon wymagany** już przy tworzeniu konta, opcjonalny FB, trwała edycja danych, zmiana hasła, usunięcie konta |
| 7 – MG | `/mg` | Filtry, tylko przesłane postacie, szczegóły w nowej karcie `?postac=<id>`, zbiorcze decyzje i poprawki na istniejącym API; brak kontaktu gracza w UI MG | Audyt endpointu pod kątem prywatności i izolacji eventów/roli |
| 8 – Organizator | `/organizator` | Pulpit, uczestnicy z istniejącego API, boczny szczegół, nawigacja do postaci, kreatora i ustawień | Statusy składek i kart przy uczestnikach |
| 9 – Składki/karty | `/skladka`, `/dokument-postaci`, taby organizatora | Stany dostępności, bramki warunków, **lokalne symulacje** w dev; bez żadnych fikcyjnych przelewów i linków | Globalny rachunek/odbiorca/kwota/tytuł/termin, indywidualne nadpisania, ręczne potwierdzanie/cofanie wpłat, link GDocs i status przygotowania, kontrola uprawnień w Google |
| 10 – CMS i ustawienia | „Treści strony”, „Kreator postaci”, „Ustawienia” w `/organizator` | Dev-only podgląd wpisów świata i aktualności, podgląd edytora tytułu/opisu/treści z domyślną widocznością Organizator; obecny builder i event-admin zachowane; archiwizacja usunięta z UI | Bezpieczny CMS, zapisy szkiców, publikacja, widoczność serwerowa, załączniki graficzne, ustalenie polityki retencji |

## Zasady nienaruszalne

1. **Frontend nie jest kontrolą uprawnień**. Developer role bar służy jedynie prezentacji UI. Wszystkie realne odczyty i zmiany muszą mieć weryfikację na serwerze.
2. Składki: widoczne graczowi **dopiero po akceptacji MG**; opłacenie potwierdza organizator. Nie implementujemy „Zgłoś wpłatę”, bramek płatniczych i automatycznego potwierdzenia.
3. Karta postaci: link Google Docs dopiero po opłaceniu i przy statusie **Do sprawdzenia** lub **Gotowa**. Sam link **nie wystarcza** do kontroli dostępu; trzeba ustawić udostępnianie dokumentu w Google.
4. Jeden gracz – jedna aktywna postać na Ursunalia 2027. Portret **postaci** może być opcjonalny, zdjęcie **profilowe konta** nie istnieje.
5. Bez modułu ankiet, archiwizacji, powiadomień, ubezpieczeń i publicznego wyboru eventu. Starsze endpointy zachowane dla zgodności, ale nieeksponowane.
6. Nie publikujemy demonstracyjnych aktualności i artykułów. Domyślna widoczność nowego szkicu redakcyjnego: **Organizator**. Nie wolno opierać prywatności publikacji o wybór po stronie przeglądarki.
7. Fizyczne miejsce wydarzenia, kwota i termin składki, numer rachunku i dane kontaktowe organizatora są nieznane; prezentujemy **Do ogłoszenia**.

## Otwarte blokery przed uruchomieniem produkcji

**B1 – profil i rejestracja**: obecne API `auth/register` przyjmuje `name,email,password` i nie może zapisać telefonu, pseudonimu, imienia/nazwiska ani FB. Przebudowa formularza rejestracji na komplet wymaganych danych, walidacja po obu stronach i bezpieczna migracja istniejących użytkowników wymagają backendu.

**B2 – składki**: schemat przelewów, potwierdzania przez organizatora, cofania, globalnych ustawień i indywidualnych nadpisań jeszcze nie istnieje. Nie można oznaczać prawdziwych wpłat przez UI.

**B3 – Google Docs**: brak przypisania realnego dokumentu do postaci i brak backendowej kontroli dostępności; należy zaprojektować mechanizm udostępniania z faktycznymi prawami Google.

**B4 – CMS**: brak endpointów tworzenia, szkiców, publikacji i filtrowania treści po stronie serwera. Roboczy edytor pokazuje wyłącznie wygląd (w pamięci podczas dev), nie zapisuje niczego na serwerze.

**B5 – uprawnienia MG**: obecny endpoint przeglądania postaci może przekazywać dane kontaktowe w odpowiedziach API mimo ukrycia w nowym interfejsie. Wymaga przeglądu serwerowej minimalizacji danych i autoryzacji.

**B6 – finalny odbiór UI**: automatyczne testy nie zastępują ręcznego sprawdzenia 1440, 980, 390 i 320 px, klawiatury, kontrastów oraz czytelności dłuższych polskich tekstów.

## Test i podgląd

```powershell
git fetch origin
git switch feature/ursunalia-ui-final-stages
npm ci
npm run verify
node scripts/validate-catalog.mjs
npm start
```

Otwórz `http://localhost:4200`; przy wybieraniu roli Organizator pasek dev pokazuje `/organizator`. Gracz może obejrzeć `/moj-panel`, `/moja-postac`, `/skladka`, `/dokument-postaci`. Konto serwerowe pokazuje dane tylko z realnego API.

## Kolejność integracji po akceptacji UI

1. Profil / wymagany telefon i polityka prywatności + zmiana hasła i usunięcie konta.
2. Składki (ustawienia, status per uczestnik, ręczne potwierdzenia, audit).
3. Linki Google Docs (statusy, gating oraz prawdziwe uprawnienia).
4. CMS (są tylko dwa rodzaje: Świat gry i Aktualności; publikowanie z uprawnieniami).
5. Audyt API MG, testy E2E i końcowy przegląd mobilny.

**Ten PR kończy projektowe ekrany frontendowe, ale nie kończy implementacji wymienionych funkcji serwerowych.**
