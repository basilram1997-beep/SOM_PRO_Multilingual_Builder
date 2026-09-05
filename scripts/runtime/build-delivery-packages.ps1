param(
  [string]$OutputRoot = $(Join-Path $PSScriptRoot "..\..\deliverables\package-sets")
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\")
$outputRoot = Resolve-Path -Path (Split-Path $OutputRoot -Parent) -ErrorAction SilentlyContinue
if (-not $outputRoot) {
  $outputRoot = New-Item -ItemType Directory -Path (Split-Path $OutputRoot -Parent) -Force | Select-Object -ExpandProperty FullName
}
$sourceRoot = Join-Path $OutputRoot "source-handoff-package"
$publishRoot = Join-Path $OutputRoot "publishing-package"

function Reset-Directory {
  param([string]$Path)
  if (Test-Path $Path) {
    Remove-Item $Path -Recurse -Force
  }
  New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Copy-PathItem {
  param(
    [string]$SourcePath,
    [string]$DestinationPath
  )

  if (-not (Test-Path $SourcePath)) {
    return
  }

  $parent = Split-Path $DestinationPath -Parent
  if ($parent) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }

  Copy-Item -Path $SourcePath -Destination $DestinationPath -Recurse -Force
}

function Remove-DeliveryNoise {
  param([string]$RootPath)

  $pathsToRemove = @(
    (Join-Path $RootPath "deploy\backup"),
    (Join-Path $RootPath "deploy\backup\postgres"),
    (Join-Path $RootPath "deploy\backup\update-runs")
  )

  foreach ($path in $pathsToRemove) {
    if (Test-Path $path) {
      Remove-Item $path -Recurse -Force
    }
  }

  $filePatterns = @("*.sql", "*.dump", "*.sqlite", "*.sqlite3", "*.bak")
  Get-ChildItem -Path $RootPath -Recurse -Force -File |
    Where-Object {
      $name = $_.Name
      foreach ($pattern in $filePatterns) {
        if ($name -like $pattern) {
          return $true
        }
      }
      return $false
    } |
    Remove-Item -Force
}

function Write-Manifest {
  param(
    [string]$DestinationPath,
    [string]$Title,
    [string[]]$Included,
    [string[]]$Excluded
  )

  $lines = @(
    "# $Title",
    "",
    "## Included",
    ""
  )
  $lines += $Included | ForEach-Object { "- $_" }
  $lines += @("", "## Excluded", "")
  $lines += $Excluded | ForEach-Object { "- $_" }
  $lines += ""
  Set-Content -Path $DestinationPath -Value $lines -Encoding UTF8
}

Reset-Directory -Path $sourceRoot
Reset-Directory -Path $publishRoot

$sourceArchive = Join-Path $env:TEMP "sompro-source-handoff.zip"
if (Test-Path $sourceArchive) {
  Remove-Item $sourceArchive -Force
}

Push-Location $repoRoot
try {
  git archive -o $sourceArchive HEAD
  Expand-Archive -Path $sourceArchive -DestinationPath $sourceRoot -Force

  $untracked = git ls-files --others --exclude-standard
  $sourceExclusions = @(
    "deliverables/",
    "store/",
    "reports/",
    "site-package.tgz"
  )

  foreach ($rel in $untracked) {
    $normalized = $rel.Replace("\", "/")
    $skip = $false
    foreach ($prefix in $sourceExclusions) {
      if ($normalized.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        $skip = $true
        break
      }
    }
    if ($skip) {
      continue
    }
    $src = Join-Path $repoRoot $rel
    $dst = Join-Path $sourceRoot $rel
    Copy-PathItem -SourcePath $src -DestinationPath $dst
  }
}
finally {
  Pop-Location
  if (Test-Path $sourceArchive) {
    Remove-Item $sourceArchive -Force
  }
}

$publishRoots = @(
  "README.md",
  "HANDOFF.md",
  "SALE_READINESS_REPORT.md",
  "KNOWN_ISSUES.md",
  "CHANGELOG.md",
  "VERSION",
  "package.json",
  "package-lock.json",
  "docs",
  "store",
  "reports",
  "release",
  "web-page",
  "assets",
  "deploy",
  ".github"
)

foreach ($item in $publishRoots) {
  Copy-PathItem -SourcePath (Join-Path $repoRoot $item) -DestinationPath (Join-Path $publishRoot $item)
}

Remove-DeliveryNoise -RootPath $sourceRoot
Remove-DeliveryNoise -RootPath $publishRoot

Write-Manifest -DestinationPath (Join-Path $sourceRoot "PACKAGE_MANIFEST.md") -Title "Source Handoff Package" -Included @(
  "Tracked source and docs from the repository",
  "Untracked but non-ignored source files such as Android and iOS project files",
  "Example environment files only"
) -Excluded @(
  "Real .env files",
  "node_modules",
  "dist",
  "release",
  "reports",
  "logs",
  "test-results",
  "tmp",
  "deliverables",
  "site-package.tgz"
)

Write-Manifest -DestinationPath (Join-Path $publishRoot "PACKAGE_MANIFEST.md") -Title "Publishing Package" -Included @(
  "Store metadata and publishing copy",
  "Evidence and review reports",
  "Final release artifacts in release/",
  "Marketing site and brand assets",
  "Deployment and distribution docs",
  "Top-level release references"
) -Excluded @(
  "Source code trees such as apps/, packages/, scripts/, android/, ios/",
  "Real .env files",
  "node_modules",
  "debug logs",
  "temporary artifacts",
  "database dumps"
)

Write-Host "Built source handoff package at $sourceRoot"
Write-Host "Built publishing package at $publishRoot"
