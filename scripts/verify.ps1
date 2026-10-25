# Alpicim — Windows doğrulama betiği
# Ortamı denetler, bağımlılıkları kurar ve tüm kontrolleri çalıştırır.
# Sonuçlar: logs\verify.log (ayrıntı) ve logs\verify-summary.txt (özet)
#
# Kullanım:  scripts\verify.cmd           (çift tıklama veya terminal)
#            scripts\verify.cmd -SkipInstall

param([switch]$SkipInstall)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
New-Item -ItemType Directory -Force -Path (Join-Path $root 'logs') | Out-Null
$summaryPath = Join-Path $root 'logs\verify-summary.txt'
$results = New-Object System.Collections.Generic.List[string]

function Write-Step($text) { Write-Host ""; Write-Host "=== $text ===" -ForegroundColor Cyan }

function Get-ToolVersion($cmd, $arg) {
  $c = Get-Command $cmd -ErrorAction SilentlyContinue
  if (-not $c) { return $null }
  try { return (& $cmd $arg 2>&1 | Select-Object -First 1).ToString().Trim() } catch { return 'bulundu (sürüm okunamadı)' }
}

function Invoke-Step($name, [scriptblock]$block) {
  Write-Step $name
  $sw = [Diagnostics.Stopwatch]::StartNew()
  & $block 2>&1 | ForEach-Object { Write-Host "$_" }
  $code = $LASTEXITCODE
  $sw.Stop()
  $status = if ($code -eq 0) { 'BAŞARILI' } else { "HATA (çıkış kodu $code)" }
  $line = '{0,-28} {1}  [{2:n0} sn]' -f $name, $status, $sw.Elapsed.TotalSeconds
  $results.Add($line)
  Write-Host $line -ForegroundColor $(if ($code -eq 0) { 'Green' } else { 'Red' })
  return ($code -eq 0)
}

# Rust/Cargo yeni kurulduysa PATH'te olmayabilir.
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if ((Test-Path $cargoBin) -and ($env:PATH -notlike "*$cargoBin*")) { $env:PATH = "$cargoBin;$env:PATH" }
$nodeDir = Join-Path $env:LOCALAPPDATA 'Programs\nodejs'
if ((Test-Path $nodeDir) -and ($env:PATH -notlike "*$nodeDir*")) { $env:PATH = "$nodeDir;$env:PATH" }

Write-Step 'Ortam'
$env_lines = @(
  "Tarih       : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
  "Klasör      : $root",
  "Windows     : $([Environment]::OSVersion.VersionString)",
  "node        : $(Get-ToolVersion 'node' '--version')",
  "npm         : $(Get-ToolVersion 'npm.cmd' '--version')",
  "rustc       : $(Get-ToolVersion 'rustc' '--version')",
  "cargo       : $(Get-ToolVersion 'cargo' '--version')"
)
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$msvc = $null
if (Test-Path $vswhere) {
  $msvc = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property displayName 2>$null
}
$env_lines += "MSVC        : $(if ($msvc) { $msvc } else { 'BULUNAMADI' })"
$wv = Get-ItemProperty -Path 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue
if (-not $wv) { $wv = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue }
$env_lines += "WebView2    : $(if ($wv) { $wv.pv } else { 'BULUNAMADI' })"
$env_lines | ForEach-Object { Write-Host $_ }

$missing = @()
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += 'Node.js (https://nodejs.org — 22 LTS)' }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { $missing += 'Rust (https://rustup.rs — stable-msvc)' }
if (-not $msvc) { $missing += 'Visual Studio Build Tools — "C++ ile masaüstü geliştirme" iş yükü' }

$ok = $true
if ($missing.Count -gt 0) {
  Write-Host ''
  Write-Host 'Eksik araçlar:' -ForegroundColor Yellow
  $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}

if (Get-Command node -ErrorAction SilentlyContinue) {
  if (-not $SkipInstall) {
    $ok = (Invoke-Step 'npm install' { npm.cmd install --no-fund --no-audit }) -and $ok
  }
  $ok = (Invoke-Step 'TypeScript (typecheck)' { npm.cmd run typecheck }) -and $ok
  $ok = (Invoke-Step 'ESLint (lint)' { npm.cmd run lint }) -and $ok
  $ok = (Invoke-Step 'Vitest (test)' { npm.cmd test }) -and $ok
  $ok = (Invoke-Step 'Vite build' { npm.cmd run build }) -and $ok
} else {
  $results.Add('Node.js adımları         ATLANDI (Node.js yok)')
  $ok = $false
}

if ((Get-Command cargo -ErrorAction SilentlyContinue) -and $msvc) {
  $ok = (Invoke-Step 'cargo check' { cargo check --manifest-path src-tauri/Cargo.toml --color never }) -and $ok
  $ok = (Invoke-Step 'cargo test' { cargo test --manifest-path src-tauri/Cargo.toml --color never }) -and $ok
} else {
  $results.Add('Rust adımları            ATLANDI (Rust veya MSVC yok)')
  $ok = $false
}

$summary = @('Alpicim doğrulama özeti', '') + $env_lines + @('') + $results + @('', "GENEL: $(if ($ok) { 'TÜM KONTROLLER BAŞARILI' } else { 'SORUN VAR — logs\verify.log dosyasına bakın' })")
if ($missing.Count -gt 0) { $summary += @('', 'Eksik araçlar:') + ($missing | ForEach-Object { "  - $_" }) }
$summary | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host ''
$summary | ForEach-Object { Write-Host $_ }
if (-not $ok) { exit 1 }
