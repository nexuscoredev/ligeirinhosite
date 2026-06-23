@echo off
title Ligeirinho Totem
set URL=https://ligeirinhoparceiros.vercel.app/totem.html
set PRINTER_NAME=ELGIN i9

set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe

if not exist "%CHROME%" (
    echo Instale o Google Chrome e tente de novo.
    pause
    exit /b 1
)

set PS1=%~dp0totem-servidor-impressao.ps1
if exist "%PS1%" (
    start "Ligeirinho Impressao" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -PrinterName "%PRINTER_NAME%"
    timeout /t 2 /nobreak >nul
)

start "" "%CHROME%" --kiosk --no-first-run --disable-infobars --disable-session-crashed-bubble "%URL%"
