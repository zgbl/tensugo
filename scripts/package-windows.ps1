param(
  [string]$OutputDir = "E:\Codes\Output",
  [switch]$SkipInstall,
  [ValidateSet("Both", "Full", "UiOnly")]
  [string]$Mode = "Both"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
Set-Location $repoRoot

function Run-Step {
  param(
    [string]$Name,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Name"
  & $Command
}

function Write-Utf8NoBom {
  param(
    [string]$Path,
    [string]$Content
  )

  $encoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Assert-NativeSuccess {
  param(
    [string]$Name
  )

  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE."
  }
}

function Set-TauriResources {
  param(
    [bool]$IncludeEngine
  )

  $config = Get-Content $script:tauriConfigPath -Raw | ConvertFrom-Json
  if ($IncludeEngine) {
    $config.bundle.resources = @("resources/katago")
  } else {
    $config.bundle.resources = @()
  }
  Write-Utf8NoBom -Path $script:tauriConfigPath -Content ($config | ConvertTo-Json -Depth 20)
}

function Build-MsiVariant {
  param(
    [string]$Name,
    [bool]$IncludeEngine,
    [string]$OutputSuffix
  )

  Run-Step "Prepare $Name Tauri config" {
    Set-TauriResources -IncludeEngine $IncludeEngine
  }

  Run-Step "Build $Name Windows MSI" {
    npm run tauri -- build --bundles msi
    Assert-NativeSuccess "Tauri $Name MSI build"
  }

  $msiPath = Join-Path $script:bundleRoot "msi\TensuGo_$($script:version)_x64_en-US.msi"
  if (-not (Test-Path $msiPath)) {
    throw "$Name MSI bundle was not found: $msiPath"
  }

  $outputName = "TensuGo_$($script:version)_x64$($OutputSuffix)_en-US.msi"
  Run-Step "Copy $Name MSI to $OutputDir" {
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    Copy-Item -Force -Path $msiPath -Destination (Join-Path $OutputDir $outputName)
  }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js was not found in PATH."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm was not found in PATH."
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  throw "Rust cargo was not found in PATH."
}

if (-not $SkipInstall) {
  Run-Step "Install npm dependencies" {
    npm ci
    Assert-NativeSuccess "npm ci"
  }
}

$script:tauriConfigPath = Join-Path $repoRoot "src-tauri\tauri.conf.json"
$script:tauriConfigBackup = Get-Content $script:tauriConfigPath -Raw
$packageJson = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$script:version = $packageJson.version
$script:bundleRoot = Join-Path $repoRoot "src-tauri\target\release\bundle"

try {
  if ($Mode -eq "Both" -or $Mode -eq "Full") {
    Build-MsiVariant -Name "full engine" -IncludeEngine $true -OutputSuffix ""
  }
  if ($Mode -eq "Both" -or $Mode -eq "UiOnly") {
    Build-MsiVariant -Name "UI-only" -IncludeEngine $false -OutputSuffix "-ui-only"
  }
}
finally {
  Write-Utf8NoBom -Path $script:tauriConfigPath -Content $script:tauriConfigBackup
}

Write-Host ""
Write-Host "Windows MSI packages created:"
Get-ChildItem -Path $OutputDir -Filter "TensuGo_$($script:version)_x64*_en-US.msi" |
  Select-Object Name, Length, LastWriteTime |
  Format-Table -AutoSize
