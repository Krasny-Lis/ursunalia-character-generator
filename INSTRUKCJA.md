# Ursunalia v24.1 – poprawka kompilacji TypeScript

Zmodyfikowano tylko dwa pliki:
- `src/app/features/character-catalog-editor/character-catalog-editor.ts`
- `src/app/features/character-summary/character-summary.ts`

Błąd `TS2347: Untyped function calls may not accept type arguments` wynikał z użycia generycznego `querySelectorAll<HTMLDetailsElement>` na nietypowanym `nativeElement`. Teraz element root ma jawny typ `HTMLElement`, a algorytm rozwijania pozostaje bez zmian.

Uruchom na branchu `feature/platform-foundation-v24`:

```powershell
Expand-Archive -Path "G:\Projects\download-temps\ursunalia_platform_v24_1_types_fix.zip" -DestinationPath . -Force
npm run build
npm test -- --watch=false
npm start
```

Zatrzymaj dotychczasowe `npm start` (Ctrl+C), zanim uruchomisz je ponownie. Nie twórz jeszcze commita.
