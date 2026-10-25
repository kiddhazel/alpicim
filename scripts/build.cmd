@echo off
rem Alpicim Windows kurulum paketlerini uretir (NSIS + MSI). Cikti: src-tauri\target\release\bundle
rem Temiz derleme icin:  build.cmd clean
cd /d "%~dp0.."
if not exist logs mkdir logs
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%USERPROFILE%\.cargo\bin;%PATH%"
if not exist node_modules call npm install --no-fund --no-audit
if /i "%~1"=="clean" cargo clean --release --manifest-path src-tauri\Cargo.toml
call npm run tauri build > logs\build.log 2>&1
echo exit=%ERRORLEVEL%>> logs\build.log
type logs\build.log
pause
