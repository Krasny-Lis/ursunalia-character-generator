param(
  [string]$Repo = 'G:\Projects\ursunalia-character-generator'
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $Repo

$branch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) {
  throw 'Cannot determine current Git branch.'
}
if ($branch -ne 'feature/platform-foundation-v24') {
  throw "Wrong Git branch: $branch. Expected feature/platform-foundation-v24."
}

Write-Host '[1/2] Angular build...' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
  throw 'Angular build failed.'
}

Write-Host '[2/2] Angular tests...' -ForegroundColor Cyan
npm test -- --watch=false
if ($LASTEXITCODE -ne 0) {
  throw 'Angular tests failed.'
}

Write-Host 'v24: build and tests passed.' -ForegroundColor Green
