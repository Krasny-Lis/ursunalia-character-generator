# Ursunalia — decyzje i założenia

Stan: 13.10.2026, audyt `68737a8`. Rekomendacja autora audytu **nie jest zatwierdzeniem właściciela**. Odwołania Uxx prowadzą do [BACKLOG](BACKLOG.md).

## Potwierdzone przez instrukcję właściciela

| ID | Decyzja | Konsekwencja |
|---|---|---|
| C01 | Jedna grupa organizatorska, wiele możliwych wydarzeń | Brak architektury SaaS i izolacji wielu organizacji. |
| C02 | Wdrażamy teraz wyłącznie Ursunalia 2027, 22–24.04.2027 | Funkcje przyszłych wydarzeń nie blokują zapisów. |
| C03 | Royal Manuscript pozostaje podstawą | Poprawki dostępności i kompletności zamiast nowego motywu. |
| C04 | Konfiguracja formularzy, zachowanie działających funkcji i danych | Nie przepisywać generatora bez potrzeby; rewizje historyczne muszą przetrwać. |
| C05 | Niniejsze zadanie obejmuje audyt i dokumentację | Bez zmian produkcyjnego kodu, API, migracji, wdrożenia i merge. Issues tylko w propozycji. Dokumentacyjna gałąź/PR są dozwolone. |
| C06 | Zespół ma utrzymywać rozwiązanie o rozsądnej złożoności | Preferować obecny stos i małe kroki z kryteriami akceptacji. |
| C07 / D16 | **Akceptacja zgłoszenia postaci na Ursunalia 2027 oznacza przyjęcie gracza na wydarzenie** | Nie dodawać drugiej decyzji o przyjęciu. Wymagana reguła, która wskazuje formularz nadający uczestnictwo; ankieta logistyczna nie przyznaje udziału. |
| C08 / D17 | **Składki zbierane przelewem, poza aplikacją; organizator ręcznie potwierdza wpływ** | MVP potrzebuje ewidencji potwierdzenia składki przy użytkowniku i wydarzeniu, bez operatora płatności czy integracji bankowej. Instrukcje przelewu będą przekazywane mailowo poza systemem. |
| C09 / D18 | **Siedem statusów:** `draft`, `submitted`, `changes`, `accepted`, `waitlisted`, `rejected`, `withdrawn`. Dawny `cancelled` (anulowano) wykreślony; organizator korzysta z `rejected`. | Statusy są zatwierdzone, lecz wciąż niezaimplementowane. |
| C11 / D03a | **Dane kontaktowe są zbierane przy tworzeniu konta i przypięte do profilu użytkownika niezależnie od wydarzenia:** imię, nazwisko, e-mail, telefon, opcjonalnie Facebook i Discord. | Konto i profil kontaktowy współdzielone między wydarzeniami; uprawnienia do odczytu są kontekstowe, nie publiczne dla całej platformy. Obowiązkowość telefonu oraz widoczność kontaktów dla innych uczestników pozostają do ustalenia. |
| C12 / D03b | **Role organizatorów z nadawanymi uprawnieniami do poszczególnych rodzajów danych.** Główny organizator ma pełny dostęp do danych uczestników w powierzonym wydarzeniu, fabularzysta domyślnie widzi z kontaktów tylko podane przez gracza Facebook/Discord. | Oddzielić dostęp do danych fabularnych, profilu identyfikacyjnego, prywatnych kontaktów, społecznościowych kontaktów i szczególnie chronionych danych; kontrola na serwerze, kontekst konkretnego wydarzenia, brak dostępu do haseł/sesji. |

## Fakty potwierdzone kodem, które nie są decyzją o przyszłości

Obecnie: jedno zgłoszenie na formularz, globalny organizer, 2–5 cech i maksymalnie 4 haki, 7 sekcji postaci, serwerowe szkice uczestnika zapisywane ręcznie, szkice kreatora lokalne. Wydarzenie ma stały napis „Zapisy otwarte”. Żaden z tych faktów nie oznacza zaakceptowania docelowej polityki. Pełne dowody i ryzyka: [FUNCTIONAL_SPEC](../product/FUNCTIONAL_SPEC.md).

## Rekomendacje wymagające zatwierdzenia

| ID | Pytanie | Wariant rekomendowany | Alternatywa i konsekwencje | Blokuje |
|---|---|---|---|---|
| D01 | Kiedy pilot i otwarcie zapisów, kto odpowiada za uruchomienie? | Wybrać termin zapisów T po oszacowaniu i teście pilota; zostawić bufor na poprawki. Terminy eventu pozostają 22–24.04.2027. | Publiczne otwarcie bez pilota zwiększa ryzyko utraty zgłoszeń. Nie wyznaczamy T samodzielnie. | U24 i kalendarz roadmapy |
| D02 | Gdzie hostować serwer i kto utrzymuje kopie? | Jeden Node 24 + SQLite, trwały dysk, HTTPS proxy, oddzielne staging. | Hosting statyczny pozwala tylko na demo; baza zarządzana wymaga dodatkowej obsługi i nie rozwiązuje błędów aplikacji. | U17/U18 |
| D03 (pozostała część) | Kto poza głównym organizatorem może widzieć granice, wykluczenia, alergie i informacje zdrowotne, a także czy kontakty społecznościowe mogą widzieć inni gracze? | C11/C12 ustalają profil konta i zakres główny organizator / fabularzysta. Dostępy innych ról i danych zdrowotnych nadać jawnie według zadania; rozdzielić zakresy, dane zdrowotne chronić szczególnie. | Sama nazwa „publiczne dane kontaktowe” oznacza tu jedynie mniejszą wrażliwość FB/Discord, a nie automatyczną publikację ich poza zespołem. Obowiązkowość telefonu pozostaje otwarta. | U05/U14/U19/U32 |
| D04 | Ile zgłoszeń/postaci może mieć osoba? | MVP jedno zgłoszenie na formularz; jedno zgłoszenie postaci i osobna logistyka. Parametr max_per_user w modelu. | Wiele postaci wymaga rozróżnienia postaci od osoby i limitów/event capacity. Nie wprowadzać do MVP bez potrzeby. | U09/U21; U26 później |
| D05 | Jaką rolę pełni konto i odzyskiwanie dostępu? | Konta lokalne; samodzielny reset jednorazowym tokenem przez email, unieważnienie sesji. Weryfikacja adresu przed wysłaniem, jeśli email ma służyć identyfikacji. | Udokumentowana procedura ręczna możliwa w małym pilocie, po weryfikacji tożsamości; większy koszt wsparcia i ryzyko podszycia. | U29 |
| D06 | Retencja, obowiązki informacyjne, oświadczenia? | Osobne okresy dla szkiców, udziału, potrzeb, historii i backupów; minimalizacja, pełne treści dokumentów; przegląd prawny przed otwarciem. | Jednolita retencja wszystkich danych jest prostsza, lecz może być nieadekwatna. Audyt nie ustala podstaw prawnych. | U19/U24 |
| D07 | Docelowa struktura generatora i reguła cech? | Najpierw zatwierdzić strukturę/limity i rozdzielenie cech oraz haków, potem opisy tagów. Obecne 2–5 cech potraktować jako zastany wariant do oceny. | Utrzymać obecne limity jawnie albo przyjąć wariant cecha pozytywna + negatywna; drugi wymaga kategorii/reguły walidacji. | U21; nie zmieniamy lore w audycie |
| C10 / D08 | **Zatwierdzona swoboda zmiany statusu:** uprawniony organizator może ustawić dowolny z siedmiu statusów z każdego stanu, a uczestnik może wznowić `withdrawn` i ponownie wysłać tę samą postać. | Rekomendowane ścieżki to wyłącznie podpowiedzi UI, bez blokady API dla uprawnionego organizatora. Każda zmiana zachowuje autora/czas/poprz. i nowy status; nietypowe operacje otrzymują ostrzeżenie z potwierdzeniem. Nie wyłącza to autoryzacji ani kontroli równoczesnego zapisu. | U01/U11/U30 |
| D09 | Jak zapisywać treść i historię decyzji? | Każde faktyczne wysłanie uczestnika tworzy niezmienny snapshot; zmiany statusu zawsze tworzą historię. Gdy organizator zmieni status bez wcześniejszego wysłania, historia wskazuje `organizer_override` bez fikcyjnego `submissionId`. | Obowiązkowe powiązanie każdej zmiany statusu z istniejącym wysłaniem blokowałoby uprawnionemu organizatorowi zmianę `draft` lub `withdrawn`; nie wprowadzać takiego ograniczenia. | U01/U11 |
| D10 | Czy serwerowy szkic kreatora jest konieczny przed wydarzeniem? | P2, ale podnieść do P1 jeśli ankiety edytuje kilka osób/urządzeń. Jeden wspólny draft z lock_version. | Jeden wydawca + kontrolowane eksporty JSON może wystarczyć dla MVP; bez obietnicy współedycji. | U13 |
| D11 | Co z formularzami już rozpoczętymi po publikacji nowej wersji? | Zachować przypiętą wersję; nowe zgłoszenia tylko na aktualnej; poprawki na pierwotnej. Osobne zamknięcie nowych zapisów i zgoda na poprawki. | Wymuszona aktualizacja wymaga mapowania odpowiedzi i zgody uczestnika; większe ryzyko utraty danych. | U06/U12 |
| D12 | Kiedy utworzyć osobną Character? | Po stabilnym rdzeniu, poza krytyczną ścieżką zapisów; tworzenie z zaakceptowanego formularza character, dane fabularne bez poufnych. | Tworzenie przy pierwszym szkicu zwiększa liczbę osieroconych/nieprzyjętych postaci. | U26 |
| D13 | Jakie powiadomienia są konieczne? | MVP widoczna aktualna decyzja po odświeżeniu i bezpiecznym wejściu na listę; email ogólny bez odpowiedzi poufnych po dodaniu dostawcy. | Powiadomienia wyłącznie ręczne wymagają stałej pracy organizatora. U08 nie wymaga emaila. | Zakres U08/U29 |
| D14 | Docelowa skala i czasy odtworzenia? | Ustalić liczbę uczestników i równoczesnych zapisów; roboczo testować 200 użytkowników, 2 formularze i portrety. Uzgodnić RPO/RTO, np. RPO 24 h/RTO 4 h jako propozycję do odrzucenia lub zaostrzenia. | Krótsze RPO wymaga częstszych kopii i sprawdzania ich kosztu; bez uzgodnienia nie deklarujemy SLA. | U17/U23/U24 |
| D15 | Czy istnieją już realne dane? | Ustalić właściciela DB, liczby rekordów, istniejące kopie i lokalne szkice. Nie pobierać pełnych danych bez potrzeby. | Gdy wszystkie dane są testowe, migracja nadal powinna być sprawdzona, ale wdrożenie może być prostsze. | U09/U17 |
| D19 | **Jak rozliczać wyjątki składkowe?** | MVP: `niepotwierdzona` / `potwierdzona` kontrolka organizatora; brak automatycznej zależności od akceptacji. Potwierdzenie: kto i kiedy. | Kwota, częściowe przelewy, zwolnienie ze składki, zwroty i warunkowość udziału pozostają otwarte; nie rozszerzać modelu bez decyzji. | U31/U14/U24 |
| D20 | **Jak przekazywać informacje o przelewie i potwierdzeniu?** | Dane przelewu i instrukcja wysłane mailowo przez organizatorów poza systemem. W UI organizatora widoczny status składki. | Automatyzacja e-maili i integracje bankowe nie są częścią MVP. Czy uczestnik widzi informację „składka potwierdzona” – do decyzji. | U31/U08 |

## Założenia robocze do projektu

- Jeden aktywny serwer aplikacji i jedna baza; bez równoległych instancji zapisujących na współdzielonym dysku sieciowym.
- Formularze nie wymagają obecnie wielojęzyczności, **zintegrowanych płatności**, logowania społecznościowego ani czasu rzeczywistego. **Ręczne potwierdzenie składki za przelew jest wymagane w MVP** (C08).
- Uczestnik samodzielnie edytuje odpowiedzi; organizator ocenia je i prosi o poprawki.
- Nie wprowadzamy nowych kategorii lore ani zmiany istniejących opisów w tym zadaniu.
- Obecne prywatne pola obejmują przynajmniej `boundaries`, `exclusions`, `needs`; zakres wymaga zatwierdzenia, nowe pola wymagają klasyfikacji.
- Utrata oryginalnych historycznych decyzji jest nieodwracalna. Migracja zachowuje stan zastany i jawnie oznacza nieznane informacje.

## Reguła biznesowa przyjęcia na Ursunalia 2027 (zatwierdzona)

- Tylko zaakceptowanie zgłoszenia **formularza postaci wyznaczonego jako przyznający udział** oznacza przyjęcie użytkownika na wydarzenie. Akceptacja formularza logistycznego nie jest drugą decyzją o udziale.
- „Przyjęty” oznacza uprawnienie do udziału, nie potwierdzenie fizycznej obecności na LARP-ie. Lista przyjętych może być pochodną aktywnych zaakceptowanych zgłoszeń danego wydarzenia, bez osobnej tabeli uczestnictwa w MVP.
- Składka to osobna oś: brak potwierdzenia nie zmienia automatycznie zaakceptowanego zgłoszenia; jego ewentualne odrzucenie jest jawną, osobną zmianą statusu przez organizatora.
- **Zestaw siedmiu statusów (C09/D18) oraz swobodne zmiany organizatora i możliwość wznowienia `withdrawn` (C10/D08) są zatwierdzone.** `Odrzucono` nie zamyka organizatorowi drogi do zmiany statusu. Szczegóły składek/zwrotów pozostają otwarte (D19).

## Decyzje możliwe bez dodatkowego blokowania prac

Można od razu rozpocząć reprodukcje i naprawę utraty zmian, kompletności podsumowania, obsługi błędów oraz walidacji importu. Nie trzeba wybierać przyszłej bazy, chmury ani generatora kolejnych wydarzeń, aby poprawić te błędy. U01 ma rozróżnić zwykłą ocenę wysłanych odpowiedzi od świadomej administracyjnej zmiany statusu; ostrzegać o niewysłanych zmianach, rejestrować pochodzenie decyzji, ale nie blokować uprawnionego organizatora.

Akceptacja planu nie zastępuje późniejszego dopuszczenia produkcji ani nie jest zgodą na publikację wszystkich Issues. W tym audycie przygotowano treści, bez publikowania zadań.
