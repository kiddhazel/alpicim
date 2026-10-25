@echo off
rem Alpicim gelistirme on kosullarini kurar: Node.js, Rust, VS C++ Build Tools.
setlocal
cd /d "%~dp0.."
if not exist logs mkdir logs
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '%~dp0setup-prereqs.ps1' *>&1 | Tee-Object -FilePath 'logs\setup.log'"
echo.
echo Bitti. Gunluk: logs\setup.log
echo done> logs\setup.done
if "%ALPICIM_NO_PAUSE%"=="" pause
