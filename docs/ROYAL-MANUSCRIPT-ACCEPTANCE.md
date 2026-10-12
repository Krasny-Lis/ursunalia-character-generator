# Ursunalia — odbiór przebudowy „Królewski Manuskrypt”

## Zakres wdrożony do Angulara
- Ciemna nawigacja i oprawa Kisleva; autorska dekoracja gór i fortu w SVG.
- Strona wydarzenia z przejściami do generatora postaci oraz ankiet.
- Mobilne menu nawigacji: otwórz / zamknij, zamknięcie po przejściu.
- Kreator ankiet: funkcjonalny panel dodawania typów pytań i sekcji, zmiany kolejności, edycja, podgląd, eksport/import JSON.
- Formularz ankiety: istniejący renderer z walidacją i jasnym motywem.
- Generator postaci: jasne pola i karty, podsumowanie, zapis szkicu w sessionStorage.
- Jedna pełna fikcyjna postać przykładowa „Alena z Białej Doliny”: przycisk „Pokaż przykład” zawsze przywraca ją i otwiera podsumowanie.
- Projektowane rozdzielczości: 390 / 768 / 1440 px. Dopasowanie jest w CSS, lecz NIE było sprawdzone w przeglądarce.

## Testy
Uruchom:
```bash
git switch feature/platform-foundation-v24
git pull
npm ci
npm run build
npm test -- --watch=false
npm start
```
Sprawdź:
1. / — wydarzenie, linki do stron, wygląd desktop/mobile;
2. /zgloszenie-postaci — „Pokaż przykład”, wszystkie sekcje, podsumowanie, edycja, dodanie nowej postaci;
3. /organizator/ankiety/edytor — dodaj nowe pytanie i sekcję z prawego panelu, przenieś, edytuj, usuń, podgląd, import/eksport;
4. na telefonie — menu górne, rozwijany panel dodawania pytań, brak poziomego scrolla;
5. klawiatura — tabulator, fokus, enter/space w przyciskach.

## Ważne ograniczenia
- To prototyp frontendowy: bez serwera nie ma prawdziwego wysyłania zgłoszenia, kont użytkowników i synchronizacji.
- Grafika w repo to uproszczona, autorska dekoracja SVG, a nie ilustracja fortu z wizualizacji 1:1.
- Makiety pokazywały również typy pól (np. data, plik), których istniejący model ankiety jeszcze nie implementuje; nie udajemy, że są gotowe.
- Pełne testy E2E i zrzuty ekranów NIE zostały wykonane przez asystenta; nie ma dostępu do lokalnego środowiska npm tego repozytorium.
- Dane istniejących szkiców w sessionStorage są zachowane. Aby obejrzeć przykład w istniejącej sesji, użyj „Pokaż przykład”.
