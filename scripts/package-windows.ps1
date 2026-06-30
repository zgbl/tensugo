param(
  [string]$OutputDir = "E:\Codes\Output",
  [switch]$SkipInstall
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
  }
}

Run-Step "Build Windows app bundles" {
  npm run tauri -- build
}

$packageJson = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$version = $packageJson.version
$bundleRoot = Join-Path $repoRoot "src-tauri\target\release\bundle"
$msiPath = Join-Path $bundleRoot "msi\TensuGo_${version}_x64_en-US.msi"
$nsisPath = Join-Path $bundleRoot "nsis\TensuGo_${version}_x64-setup.exe"

if (-not (Test-Path $msiPath)) {
  throw "MSI bundle was not found: $msiPath"
}

if (-not (Test-Path $nsisPath)) {
  throw "NSIS installer was not found: $nsisPath"
}

Run-Step "Copy bundles to $OutputDir" {
  New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
  Copy-Item -Force -Path $msiPath, $nsisPath -Destination $OutputDir
}

Write-Host ""
Write-Host "Windows packages created:"
Get-ChildItem -Path $OutputDir -Filter "TensuGo_${version}_x64*" |
  Select-Object Name, Length, LastWriteTime |
  Format-Table -AutoSize
