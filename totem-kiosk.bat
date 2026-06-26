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

echo.
echo Ligeirinho Totem — modo quiosque
echo.
echo Para bloquear gestos do Windows (deslizar da borda / Task View), execute UMA VEZ como Admin:
echo   scripts\totem-windows-lockdown.ps1
echo   ou importe scripts\totem-windows-lockdown.reg
echo.
echo No Windows 11: Configuracoes ^> Bluetooth e dispositivos ^> Tela sensivel ao toque
echo   ^> desative gestos das bordas esquerda e direita.
echo.
timeout /t 4 /nobreak >nul

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
