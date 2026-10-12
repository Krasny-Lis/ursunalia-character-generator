#Requires -Version 5.1
<#
Ursunalia v14 - bezpieczne usuwanie nieuzywanych widokow 9-krokowego kreatora.
Uruchom po rozpakowaniu ZIP: powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\cleanup-legacy-v14.ps1
Domyslnie robi pelna kopie usuwanych plikow w katalogu ursunalia-character-generator-backups poza repozytorium.
##>
[CmdletBinding()]
param([switch]$Preview)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
function Read-ProjectFile([string]$relative) {
  $full = Join-Path $root $relative
  if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { throw "Brak pliku: $relative. Sprawdz, czy paczka v14 zostala rozpakowana w katalogu projektu." }
  return [System.IO.File]::ReadAllText($full)
}
$app = Read-ProjectFile 'src/app/app.ts'
$config = Read-ProjectFile 'src/app/app.config.ts'
$styles = Read-ProjectFile 'src/styles.scss'
$layout = Read-ProjectFile 'src/styles/_layout-structure.scss'
if ($app -notmatch 'import\s*\{\s*CharacterReview\s*\}\s*from' -or $app -match 'RouterOutlet|RouterLink|CharacterIdentity|TraitsLab|CharacterHooks|CharacterHistory|CharacterPillars|CharacterGameplay|CharacterRelations') {
  throw 'Nie rozpoznano aktualnego, jednoekranowego App. Przerwano bez usuwania.'
}
if ($config -match 'provideRouter|app\.routes|withHashLocation') {
  throw 'app.config.ts nadal konfiguruje Router. Najpierw trzeba poprawnie zainstalowac widok jednoekranowy.'
}
if ($styles -notmatch 'styles/layout-structure' -or $layout -match 'wizard-slide-leave|data-direction') {
  throw 'Nie odnaleziono poprawnych stylow v14. Przerwano.'
}

$legacy = @(
  'src/app/features/character-identity',
  'src/app/features/traits-lab',
  'src/app/features/character-hooks',
  'src/app/features/character-history',
  'src/app/features/character-pillars',
  'src/app/features/character-gameplay',
  'src/app/features/character-relations',
  'src/app/app.routes.ts',
  'scripts/check-unified-generator.mjs',
  'src/styles/_wizard-legacy.scss'
)
# Upewniamy sie, ze zaden aktualny plik nie importuje starego komponentu.
# Szukamy tylko rzeczywistych odwolaniowych skladni (import, selector, app.routes), nie slow z opisow.
$oldNames = 'character-identity|traits-lab|character-hooks|character-history|character-pillars|character-gameplay|character-relations'
$referencePattern = 'features/(?:' + $oldNames + ')|<app-(?:' + $oldNames + ')\b|app\.routes'
$references = @()
$sourcePath = Join-Path $root 'src'
foreach ($file in (Get-ChildItem -LiteralPath $sourcePath -Recurse -File | Where-Object { $_.Extension -in '.ts', '.html', '.js', '.mjs' })) {
  $rel = $file.FullName.Substring($root.Length).TrimStart([char]'\',[char]'/').Replace('\','/')
  $belongsToLegacy = $false
  foreach ($item in $legacy) {
    if ($rel -eq $item -or $rel.StartsWith($item + '/')) { $belongsToLegacy = $true; break }
  }
  if ($belongsToLegacy) { continue }
  $body = [System.IO.File]::ReadAllText($file.FullName)
  if ($body -match $referencePattern) { $references += $rel }
}
if ($references.Count -gt 0) {
  throw ('Znaleziono referencje do dawnych widokow w aktywnych plikach: ' + ($references -join ', ') + '. Przerwano.')
}
$packageFile = Join-Path $root 'package.json'
if ((Test-Path -LiteralPath $packageFile) -and ([System.IO.File]::ReadAllText($packageFile) -match 'check-unified-generator')) {
  throw 'package.json nadal odwola sie do starego skryptu kontrolnego. Przerwano.'
}
$actual = @($legacy | Where-Object { Test-Path -LiteralPath (Join-Path $root $_) })
if ($actual.Count -eq 0) { Write-Host 'Nie ma nic do usuniecia; projekt jest juz posprzatany.' -ForegroundColor Green; exit 0 }
Write-Host 'Zweryfikowano brak zaleznosci. Pliki/katalogi do przeniesienia do kopii:' -ForegroundColor Cyan
$actual | ForEach-Object { Write-Host ('  ' + $_) }
if ($Preview) { Write-Host 'Podglad zakonczony. Nic nie zostalo usuniete.'; exit 0 }
$backupParent = Join-Path (Split-Path -Parent $root) 'ursunalia-character-generator-backups'
$backup = Join-Path $backupParent ('v14-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
foreach ($rel in $actual) {
  $original = Join-Path $root $rel
  $dest = Join-Path $backup $rel
  $parent = Split-Path -Parent $dest
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Copy-Item -LiteralPath $original -Destination $dest -Recurse -Force
  if (-not (Test-Path -LiteralPath $dest)) { throw "Nie udalo sie wykonac kopii $rel. Przerwano." }
}
foreach ($rel in $actual) {
  Remove-Item -LiteralPath (Join-Path $root $rel) -Recurse -Force
  Write-Host ('Usunieto: ' + $rel)
}
Write-Host ''
Write-Host ('Gotowe. Kopia zapasowa: ' + $backup) -ForegroundColor Green
Write-Host 'Teraz uruchom npm run build i npm test -- --watch=false.'
