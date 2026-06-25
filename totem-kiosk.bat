@echo off
title Ligeirinho Totem
cd /d "%~dp0"
set URL=https://ligeirinhoparceiros.vercel.app/totem.html

set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe

if not exist "%CHROME%" (
    echo Instale o Google Chrome e tente de novo.
    pause
    exit /b 1
)

rem Ponte de impressao silenciosa (sem dialogo do Chrome)
if exist "%~dp0scripts\start-totem-print-bridge.ps1" (
    start "Ligeirinho Print" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-totem-print-bridge.ps1"
    timeout /t 2 /nobreak >nul
)

start "" "%CHROME%" --kiosk --kiosk-printing --no-first-run --disable-infobars --disable-session-crashed-bubble "%URL%"
