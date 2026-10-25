# Alpicim — geliştirme ön koşullarını kurar (hepsi ücretsiz, resmî kaynaklar)
#  1) Node.js 22 LTS  : nodejs.org taşınabilir zip → %LOCALAPPDATA%\Programs\nodejs (yönetici gerekmez)
#  2) Rust (MSVC)     : rustup-init.exe → %USERPROFILE%\.cargo (yönetici gerekmez)
#  3) VS C++ Build Tools : winget (yönetici onayı / UAC ister)
# Günlük: logs\setup.log

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path -Parent $PSScriptRoot
New-Item -ItemType Directory -Force -Path (Join-Path $root 'logs') | Out-Null
$tmp = Join-Path $env:TEMP 'alpicim-setup'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

function Say($t) { Write-Host "[$(Get-Date -Format HH:mm:ss)] $t" }

function Add-UserPath($dir) {
  $current = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not $current) { $current = '' }
  if (($current -split ';') -notcontains $dir) {
    [Environment]::SetEnvironmentVariable('Path', ($dir + ';' + $current).TrimEnd(';'), 'User')
    Say "Kullanıcı PATH'ine eklendi: $dir"
  }
  if (($env:PATH -split ';') -notcontains $dir) { $env:PATH = "$dir;$env:PATH" }
}

# ---------------------------------------------------------------- Node.js
$nodeDir = Join-Path $env:LOCALAPPDATA 'Programs\nodejs'
if ((Get-Command node -ErrorAction SilentlyContinue) -or (Test-Path (Join-Path $nodeDir 'node.exe'))) {
  Say 'Node.js zaten var.'
  Add-UserPath $nodeDir
} else {
  try {
    Say 'Node.js sürüm listesi alınıyor...'
    $index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing
    $rel = $index | Where-Object { $_.lts -and $_.version -like 'v22.*' } | Select-Object -First 1
    if (-not $rel) { $rel = $index | Where-Object { $_.lts } | Select-Object -First 1 }
    $ver = $rel.version
    $zipName = "node-$ver-win-x64.zip"
    $zip = Join-Path $tmp $zipName
    Say "Node.js $ver indiriliyor..."
    Invoke-WebRequest -Uri "https://nodejs.org/dist/$ver/$zipName" -OutFile $zip -UseBasicParsing
    # SHA256 doğrulaması
    $sums = (Invoke-WebRequest -Uri "https://nodejs.org/dist/$ver/SHASUMS256.txt" -UseBasicParsing).Content
    $expected = ($sums -split "`n" | Where-Object { $_ -match [regex]::Escape($zipName) } | ForEach-Object { ($_ -split '\s+')[0] }) | Select-Object -First 1
    $actual = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
    if ($expected -and ($expected.ToLower() -ne $actual)) { throw "SHA256 uyuşmuyor ($actual)" }
    Say 'SHA256 doğrulandı. Açılıyor...'
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    if (Test-Path $nodeDir) { Remove-Item $nodeDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path (Split-Path $nodeDir) | Out-Null
    Move-Item (Join-Path $tmp "node-$ver-win-x64") $nodeDir
    Add-UserPath $nodeDir
    Say "Node.js kuruldu: $(& (Join-Path $nodeDir 'node.exe') --version)"
  } catch { Say "HATA (Node.js): $_" }
}

# ---------------------------------------------------------------- Rust
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if (Test-Path (Join-Path $cargoBin 'cargo.exe')) {
  Say 'Rust zaten var.'
  Add-UserPath $cargoBin
} else {
  try {
    $rustup = Join-Path $tmp 'rustup-init.exe'
    Say 'rustup-init indiriliyor...'
    Invoke-WebRequest -Uri 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe' -OutFile $rustup -UseBasicParsing
    Say 'Rust (stable-msvc) kuruluyor...'
    & $rustup -y --default-toolchain stable --profile minimal --default-host x86_64-pc-windows-msvc 2>&1 | ForEach-Object { Write-Host $_ }
    Add-UserPath $cargoBin
    Say "Rust: $(& (Join-Path $cargoBin 'rustc.exe') --version)"
  } catch { Say "HATA (Rust): $_" }
}

# ---------------------------------------------------------------- MSVC Build Tools
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$hasMsvc = $false
if (Test-Path $vswhere) {
  $hasMsvc = [bool](& $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null)
}
if ($hasMsvc) {
  Say 'Visual Studio C++ Build Tools zaten var.'
} else {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Say 'Visual Studio 2022 Build Tools (C++ iş yükü) kuruluyor — Windows yönetici onayı (UAC) isteyebilir; 10-20 dk sürebilir...'
    winget install --id Microsoft.VisualStudio.2022.BuildTools -e --silent --accept-package-agreements --accept-source-agreements `
      --override "--quiet --wait --norestart --nocache --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" 2>&1 | ForEach-Object { Write-Host $_ }
    Say "winget çıkış kodu: $LASTEXITCODE"
  } else {
    Say 'winget bulunamadı. Build Tools elle kurulmalı: https://visualstudio.microsoft.com/visual-cpp-build-tools/'
  }
}

Say 'Kurulum betiği bitti.'
