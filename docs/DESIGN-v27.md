# Projekt v27 — Royal Manuscript

Bazą są sześć wizualizacji użytkownika z 12.10.2026: kreator desktop/mobile, ankieta desktop/mobile oraz karta postaci desktop/mobile. Elementy przeniesiono do działających komponentów Angular, nie do obrazu udającego interfejs.

## Zasady wizualne

- Ciemne tło `#06121c`, papier `#f8f1e4`, atrament `#101a2a`, złoto `#d3a65e`, bordo `#770d19`.
- Szeryfowe nagłówki i treść, niewielkie etykiety bezszeryfowe z rozstrzeleniem.
- Papier ma warstwę subtelnego szumu, podwójne obramowanie i wektorowe narożniki. Ornament oddziela nagłówek od pól.
- Formularz: dwie kolumny pól i panel postępu na desktopie; jedna kolumna i dolny pasek działań na telefonie.
- Kreator: edycja w kartach, paleta po prawej; paleta w dolnym panelu na małych ekranach.
- Karta: portret, nazwa, tagi, siatka podsumowań na desktopie; rozwijane wiersze z bordowymi ikonami na telefonie.
- Kontrolki używają etykiet, stanów błędów, nawigacji klawiaturą, widocznego focusu oraz ograniczenia animacji na życzenie systemu.

## Grafika

`public/art/kislev-night.png` — granatowy krajobraz z zamkiem, złotymi górami i ornamentami.
`public/art/alena.png` — portret Aleny.

Grafiki powstały w narzędziu ImageGen na podstawie dostarczonych projektów. Zachowano je jako pliki projektu. Szum pergaminu, narożniki oraz ikony są wektorowe.

Prompty:

1. Na podstawie wizualizacji ankiety wyodrębnij i odtwórz samo granatowe tło, usuń cały tekst, formularze i nawigację. Zachowaj złote górskie kontury, północny zamek w prawym górnym rogu, różę kompasową oraz skrajne ornamenty. Lewa i dolna część ciemna, spokojna, bez napisów.
2. Na podstawie mobilnej karty postaci wyodrębnij i odtwórz sam malarski portret rudej zwiadowczyni, zachowując twarz, warkocze, futrzany kołnierz i stonowane leśne tło. Kwadrat, bez obramowań, tekstu i elementów interfejsu.

Wizualizacje zawierały przykładowe dane różnych postaci. Do działającego przykładu wykorzystano Alenę i katalogi repozytorium (Hospodar, Ungoł, Ropsmen, Dolganin; Drużini i regiony Kisleva).
