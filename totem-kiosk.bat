@echo off
title Ligeirinho Totem
cd /d "%~dp0"

set URL=https://ligeirinhoparceiros.vercel.app/totem.html
if defined TOTEM_URL set "URL=%TOTEM_URL%"

set PROFILE=%LocalAppData%\LigeirinhoTotem\ChromeProfile

set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe

if not exist "%CHROME%" (
    echo Instale o Google Chrome e tente de novo.
    pause
    exit /b 1
)

if not exist "%PROFILE%" mkdir "%PROFILE%"

rem Ponte dos tablets minimizada - nao cobre o quiosque.
if exist "%~dp0totem-print-bridge.bat" (
    echo Iniciando ponte de impressao dos tablets (minimizada)...
    start "Ligeirinho Print Bridge" /min cmd /c ""%~dp0totem-print-bridge.bat""
) else (
    echo Aviso: totem-print-bridge.bat nao encontrado - tablets nao imprimem pela ponte.
    echo Rode git pull nesta pasta: %CD%
)

echo.
echo Ligeirinho Totem - modo quiosque
echo.
echo Impressao Totem: Chrome silencioso na impressora padrao do Windows
echo Impressao Tablets: ponte minimizada na barra de tarefas
echo.
timeout /t 2 /nobreak >nul

:loop
start /wait "" "%CHROME%" --user-data-dir="%PROFILE%" --kiosk --kiosk-printing --disable-print-preview --no-first-run --disable-infobars --disable-session-crashed-bubble --noerrdialogs --disable-translate --disable-pinch --overscroll-history-navigation=0 --disable-features=TranslateUI,OverscrollHistoryNavigation,TouchpadOverscrollHistoryNavigation,InsecureDownloadWarnings --disable-popup-blocking --disable-component-update --check-for-update-interval=31536000 "%URL%"
goto loop
