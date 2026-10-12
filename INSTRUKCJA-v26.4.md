# Ursunalia – edytor v26.4: uchwyt przeciągania sekcji

Nakładka na **v26.3**, gałąź `feature/platform-foundation-v24`.

Zmiany:
- na samej górze każdej sekcji pełnoszerokościowy uchwyt „PRZECIĄGNIJ SEKCJĘ”, taki jak w pytaniu;
- sekcje zamieniają kolejność już podczas przeciągania dzięki Angular CDK;
- przycisk zwijania/rozwijania sekcji oraz strzałki ↑/↓ pozostają dostępne;
- przeciąganie pytań i lokalny szkic JSON bez zmian;
- podczas przenoszenia sekcji nie jest duplikowany jej tekst w podglądzie.

Instalacja (PowerShell w katalogu repozytorium):

```powershell
cd G:\Projects\ursunalia-character-generator
git branch --show-current
Expand-Archive -Path 'G:\Projects\download-temps\ursunalia_surveys_v26_4_section_drag_handle.zip' -DestinationPath . -Force
npm run build
npm test -- --watch=false
npm start
```

Sprawdź przeciąganie wyłącznie za górny uchwyt, strzałki, zwijanie, przenoszenie pytań między sekcjami oraz trwałość kolejności po F5. Nie commituj przed testami.
