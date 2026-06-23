@echo off
title Ligeirinho Totem
set URL=https://ligeirinhoparceiros.vercel.app/totem.html

set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe

if not exist "%CHROME%" (
    echo Instale o Google Chrome e tente de novo.
    pause
    exit /b 1
)

start "" "%CHROME%" --kiosk --kiosk-printing --no-first-run --disable-infobars --disable-session-crashed-bubble "%URL%"
