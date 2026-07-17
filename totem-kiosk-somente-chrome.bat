@echo off
title Ligeirinho Totem
cd /d "%~dp0"
set URL=https://ligeirinhoparceiros.vercel.app/totem.html
set PROFILE=%LocalAppData%\LigeirinhoTotem\ChromeProfile
set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" (echo Instale o Google Chrome & pause & exit /b 1)
if not exist "%PROFILE%" mkdir "%PROFILE%"
:loop
start /wait "" "%CHROME%" --user-data-dir="%PROFILE%" --remote-debugging-port=9222 --kiosk --kiosk-printing --disable-scripted-print-throttling --no-first-run --disable-infobars --disable-session-crashed-bubble --noerrdialogs --disable-translate --disable-pinch --overscroll-history-navigation=0 --disable-features=TranslateUI,OverscrollHistoryNavigation,TouchpadOverscrollHistoryNavigation,InsecureDownloadWarnings --disable-popup-blocking --disable-component-update --check-for-update-interval=31536000 "%URL%"
goto loop
