# Refaktor v18–v23: kontrole kontraktow strukturalnych oraz kompilacja/testy aplikacji.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $project
Write-Host '=== Ursunalia: kontrola refaktoru v18-v23 ==='
$parent = Get-Content 'src/app/features/character-review/character-review.html' -Raw -Encoding utf8
$requiredSelectors = @('app-character-identity-editor', 'app-character-catalog-editor', 'app-character-story-editor', 'app-character-relations-editor', 'app-character-preferences-editor')
foreach ($selector in $requiredSelectors) {
  if (-not $parent.Contains('<' + $selector)) { throw "Brak komponentu: $selector" }
}
$sectionIds = @('identity','traits','hooks','story','relations','preferences')
foreach ($id in $sectionIds) {
  if (-not $parent.Contains('id="' + $id + '"')) { throw "Brak identyfikatora sekcji: $id" }
  if (-not $parent.Contains('section-content-' + $id)) { throw "Brak dostepnego sterowania sekcja: $id" }
}
$components = @('character-catalog-editor','character-story-editor','character-relations-editor','character-preferences-editor')
foreach ($name in $components) {
  foreach ($ext in @('ts','html')) {
    if (-not (Test-Path ('src/app/features/'+$name+'/'+$name+'.'+$ext))) { throw "Brak: $name.$ext" }
  }
}
Write-Host 'Kontrakty komponentow: OK'
& npm run build
if ($LASTEXITCODE -ne 0) { throw 'npm run build zakonczyl sie bledem' }
& npm test -- --watch=false
if ($LASTEXITCODE -ne 0) { throw 'npm test zakonczyl sie bledem' }
Write-Host 'Kompilacja i testy: OK'
