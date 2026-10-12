# Kontrola v27

## Automatyczna

- Produkcyjna kompilacja Angular: kontrola szablonów, typów, importów i budżetu pakietów.
- Komponenty i stan: interakcje z rzeczywistymi kontrolkami formularza, aktualizacja karty, walidacja pustego szkicu, edytor, podgląd, wersje, brak fikcyjnej wysyłki, zachowanie danych w localStorage i migracja poprzedniej sesji.
- HTTP/SQLite: rejestracja/logowanie, ciasteczka sesyjne, własność zgłoszeń, uprawnienia organizatora, kompletność przed wysłaniem, niezmienność wysłanych zgłoszeń, komentarz i poprawki, ponowne wysłanie, niezależne wersje ankiet, trwałość po restarcie, odrzucenie CSRF, obcych portretów i sfałszowanych definicji formularza.
- Walidacja istniejących katalogów świata.

## Granica weryfikacji

Nie wykonano testu pikselowego ani ręcznej kontroli w przeglądarce. Dostępna instrukcja Sites dla zarządzanego środowiska wymaga narzędzia `control-browser`, którego ta sesja nie udostępniała, i zabrania zastępowania go inną ścieżką kontroli przeglądarki. Testy Angular uruchomiono w jsdom; nie zastępują kontroli layoutu.

## Lista do przeglądu po uruchomieniu

1. Szerokości 360/390, 768/820, 1440/1672 px: menu, karty, brak poziomego przepełnienia.
2. Wydarzenie → ankieta → szkic → podsumowanie. W pierwszej sesji przejrzyj Alenę.
3. W kreatorze wybierz pytanie, zmień typ, dodaj odpowiedź/sekcję, przesuń element, otwórz podgląd. Na telefonie sprawdź dolny panel i klawiaturę ekranową.
4. Po odświeżeniu sprawdź odtworzenie lokalnych danych. W trybie serwera zapisz szkic ręcznie, wyloguj i zaloguj ponownie.
5. Jako uczestnik wyślij pełne zgłoszenie; jako organizator odeślij do poprawy i zaakceptuj po ponownym wysłaniu.
6. Wydruk podsumowania pomija poufne granice i wykluczenia relacji.
