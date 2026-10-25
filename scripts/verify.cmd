@echo off
rem Alpicim dogrulama: cift tiklayin veya terminalde calistirin.
rem Ayrinti: logs\verify.log  Ozet: logs\verify-summary.txt
setlocal
cd /d "%~dp0.."
if not exist logs mkdir logs
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '%~dp0verify.ps1' %* *>&1 | Tee-Object -FilePath 'logs\verify.log'"
set CODE=%ERRORLEVEL%
echo.
echo Bitti. Ozet: logs\verify-summary.txt
if "%ALPICIM_NO_PAUSE%"=="" pause
exit /b %CODE%
