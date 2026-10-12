# Ursunalia 2027 – słowniki JSON i serwis Angular 22

Ta paczka to **krok 18: fundament danych**, a nie gotowy interfejs. Zawiera:
- `public/data/*.json`: dane wyborów do formularza, bez postaci ani informacji poufnych,
- `src/app/core/models/catalog-data.model.ts`: typ zagregowanego słownika,
- `src/app/core/services/catalog.service.ts`: serwis do jednorazowego wczytania katalogów z cache,
- `scripts/validate-catalog.mjs`: automatyczna kontrola liczby pozycji i wymaganych opisów.

## Instalacja w lokalnym repozytorium

W PowerShell (terminal projektu):

```powershell
cd G:\Projects\ursunalia-character-generator
Expand-Archive -Path "<ścieżka do pobranej paczki>" -DestinationPath . -Force
node .\scripts\validate-catalog.mjs
```

Istniejących modeli `character.model.ts` i `catalog.model.ts` **nie nadpisujemy**.

## HttpClient – włączenie odczytu JSON

Otwórz `src/app/app.config.ts` i dodaj import:

```ts
import { provideHttpClient } from '@angular/common/http';
```

Następnie dopisz `provideHttpClient()` do tablicy `providers` w istniejącym `appConfig`, zachowując dotychczasowe wpisy (np. `provideRouter(routes)`).

Przykład (jeśli plik zawiera standardowy setup):

```ts
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideHttpClient()],
};
```

Nie zastępuj całego pliku bez sprawdzenia jego aktualnej zawartości.

## Weryfikacja

```powershell
npm run build
npm start
```

Po uruchomieniu sprawdź w przeglądarce:
- `http://localhost:4200/data/traits.json`
- `http://localhost:4200/data/hooks.json`

Powinieneś zobaczyć tablice JSON z pełnymi opisami.

## Zgodność modelu

Identyfikatory w `game-styles.json`, `residencies.json` oraz `pillars.json` są dopasowane do wcześniejszych typów `GameplayStyle`, `ResidencyStatus`, `PillarId`. Wybrane cechy i haki zapisuj w postaci `id`, nie w postaci polskiej nazwy.

## Źródła

Dane słowników przeniesiono z zaakceptowanej wersji prototypu `ursunalia_2027_prototyp_v2.html`, której pełne opisy pochodziły z uzgodnionych wcześniej materiałów formularza. Nie dopisujemy nowych definicji zachowań; wyjątki to techniczne ID, tablice przykładów i pomocniczy tekst ról.

Nie robimy jeszcze commita, dopóki nie zweryfikujesz działania danych w lokalnym projekcie.
