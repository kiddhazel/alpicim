@echo off
rem Alpicim'i gelistirici modunda baslatir (Vite + Tauri). Cikti: logs\dev.log
cd /d "%~dp0.."
if not exist logs mkdir logs
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%USERPROFILE%\.cargo\bin;%PATH%"
if not exist node_modules call npm install --no-fund --no-audit
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "npm.cmd run tauri dev 2>&1 | ForEach-Object { \"$_\" } | Tee-Object -FilePath 'logs\dev.log'"
pause
