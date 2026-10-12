# Ursunalia v26.3 – zmiany w edytorze ankiet

**Przeznaczenie:** nakładka na v26.2 (po jej instalacji), na gałęzi `feature/platform-foundation-v24`. Bez commita i bez zmiany modelu JSON.

## Zmiany

- Sekcji nie przeciągamy: do ustawiania kolejności służą strzałki `↑` / `↓`.
- Dotychczasowy uchwyt sekcji zastąpiono przyciskiem rozwijania/zwijania pól.
- Zwijanie w edytorze nie zmienia ustawienia `Uczestnik może zwijać sekcję` w ankiecie.
- Przeciąganie pytań przez Angular CDK pozostaje, ale pod kursorem widać już tylko prosty graficzny obrys zamiast kopiowanych tekstów karty.
- Nie zmieniono innych plików ani zachowania generatora postaci.

## Instalacja w PowerShell

```powershell
cd G:\Projects\ursunalia-character-generator
git branch --show-current
Expand-Archive -Path "G:\Projects\download-temps\ursunalia_surveys_v26_3_collapse_sections.zip" -DestinationPath . -Force
npm run build
npm test -- --watch=false
npm start
```

## Odbiór

1. Strzałki zmieniają kolejność sekcji; nie da się ich przeciągać myszą.
2. Przycisk `▴/▾` zwija i rozwija pytania w sekcji.
3. Nadal można przeciągać pytania w obrębie sekcji oraz między rozwiniętymi sekcjami.
4. W podglądzie ankiety ustawienie `Uczestnik może zwijać sekcję` jest niezależne od zwinięcia sekcji w edytorze.
5. Szary napis nie pojawia się już podczas przeciągania.

Nie wykonywać commita, dopóki nie zostanie zweryfikowana kompilacja i zachowanie w przeglądarce.
