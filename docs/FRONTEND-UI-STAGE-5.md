# Etap UI-5 – Mój panel i Moja postać

Gałąź: `feature/ursunalia-player-dashboard`, od `feature/ursunalia-guides-and-news` (PR #12).
To kolejny **stacked draft PR**. Nie scalać bez jawnej akceptacji. Backend i SQLite pozostają nietknięte.

## Widoki

- `/moj-panel`: cztery etapy **Konto / Postać / Składka / Karta**, status MG, skróty do realnych stron.
- `/moja-postac`: dwie zakładki na **jednej stronie** – podgląd odpowiedzi i edycja tych samych pól `FieldControl` przez istniejący `PlatformStore.update/save/submit`; historia decyzji i komentarze MG.
- Globalne menu gracza: `Mój panel` i `Moja postać`; dotychczasowe `/moje-postacie` przekierowuje do panelu.
- Usunięto archiwum z aktualnego interfejsu konta, przycisk archiwizacji postaci oraz odnośnik do powiadomień. Backendowe mechanizmy pozostają zachowane.
- Konto wykorzystuje na razie **stare API login/register**. Pełne dane (imię, nazwisko, pseudonim, telefon, opcjonalny Facebook) oraz zmiana hasła są osobnym etapem i wymagają późniejszej integracji. Ten PR tego nie udaje.
- Brak zdjęć profilowych. Portret postaci pozostaje opcjonalną funkcją formularza.
- Brak dodatkowych formularzy wydarzenia i formularza ubezpieczenia.

## Źródła statusu

- Statusy prawdziwych postaci i komentarze MG pobierane są z dotychczasowego `PlatformStore`.
- W `npm start` można wybrać rolę Gracz, status postaci i blokadę z górnego paska. Te wartości są oznaczone jako symulowane; prawdziwa blokada `store.canEdit` nadal działa i nie może być obejścia przełącznikiem.
- Nie ma jeszcze backendu składek ani kart Google Docs. Produkcyjny widok nie pokazuje fikcyjnych płatności, rachunków i linków. W `npm start` widoczne są wyłącznie **symulacje** warunków.
- Nie można uzyskać w przeglądarce „dostępu” do nieistniejącego Google Docs. Prawdziwa kontrola dokumentu będzie musiała uwzględnić uprawnienia po stronie Google.

## Sprawdzenie

1. `npm start`: wybierz Gracz → brak postaci / szkic / do poprawy / zaakceptowana / zablokowana.
2. Mój panel ma dokładnie cztery etapy. Brak modułu powiadomień i archiwum.
3. Moja postać w trybie Podgląd pokazuje historyczne odpowiedzi i decyzje MG. Edytuj korzysta z istniejącego zapisu i jest niedostępny przy rzeczywistej lub symulowanej blokadzie.
4. Składka i karta nie dają fałszywych danych ani linków. W produkcji informują o trwającej integracji.
5. Sprawdź 1440, 980, 390, 320 px i obsługę klawiaturą.
6. `npm run verify` oraz `node scripts/validate-catalog.mjs`.

```powershell
git fetch origin
git switch feature/ursunalia-player-dashboard
npm ci
npm start
```
Adres podglądu: `http://localhost:4200` (tryb development).
