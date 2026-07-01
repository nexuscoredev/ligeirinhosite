@echo off

title Ligeirinho Totem

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

rem Primeira vez no PC? Execute totem-configurar-pc.bat (gestos de borda + inicializacao automatica).

echo.
echo Ligeirinho Totem — modo quiosque
echo.
echo Configuracao do PC (gestos de borda + iniciar sempre por aqui):
echo   totem-configurar-pc.bat
echo.
echo Bloqueio maximo do Windows (Admin, uma vez):
echo   scripts\totem-windows-lockdown.ps1
echo.
timeout /t 3 /nobreak >nul

rem --kiosk-printing + --disable-print-preview = impressao silenciosa na padrao
rem Reinicia o Chrome automaticamente se a janela for fechada (exceto logout admin com PIN).

:loop
start /wait "" "%CHROME%" ^
  --user-data-dir="%PROFILE%" ^
  --kiosk ^
  --kiosk-printing ^
  --disable-print-preview ^
  --no-first-run ^
  --disable-infobars ^
  --disable-session-crashed-bubble ^
  --noerrdialogs ^
  --disable-translate ^
  --disable-pinch ^
  --overscroll-history-navigation=0 ^
  --disable-features=TranslateUI,OverscrollHistoryNavigation,TouchpadOverscrollHistoryNavigation,InsecureDownloadWarnings ^
  --disable-popup-blocking ^
  --disable-component-update ^
  --check-for-update-interval=31536000 ^
  "%URL%"
goto loop
