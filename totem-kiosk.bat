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

rem Ponte dos tablets em OUTRA janela (nao bloqueia o Chrome / impressao silenciosa).
if exist "%~dp0totem-print-bridge.bat" (
    echo Iniciando ponte de impressao dos tablets...
    start "Ligeirinho Print Bridge" "%~dp0totem-print-bridge.bat"
) else (
    echo Aviso: totem-print-bridge.bat nao encontrado — tablets nao imprimem pela ponte.
    echo Rode git pull nesta pasta: %CD%
)

rem Primeira vez no PC? Execute totem-configurar-pc.bat (gestos de borda + inicializacao automatica).

echo.
echo Ligeirinho Totem — modo quiosque
echo.
echo Impressao do Totem padrao: Chrome --kiosk-printing (impressora padrao do Windows)
echo Impressao dos Tablets: janela "Ligeirinho Print Bridge" (deixe aberta)
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
