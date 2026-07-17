@echo off

title Ligeirinho Totem

set URL=https://ligeirinhoparceiros.vercel.app/totem.html
if defined TOTEM_URL set "URL=%TOTEM_URL%"

rem Impressora termica da loja (Tablets usam esta ponte)
if not defined TOTEM_PRINTER_HOST set "TOTEM_PRINTER_HOST=192.168.15.31"
if not defined TOTEM_PRINTER_PORT set "TOTEM_PRINTER_PORT=9100"
if not defined TOTEM_BRIDGE_PORT set "TOTEM_BRIDGE_PORT=8787"

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

rem Inicia a ponte de impressao (Tablets -> PC -> Bematech) em processo separado.
rem IMPORTANTE: nao usar "start powershell -File" direto — o CMD espera apps de console
rem e o .bat trava na ponte (Chrome nunca sobe com --kiosk-printing).
set "BRIDGE_PS1=%~dp0scripts\start-totem-print-bridge.ps1"
if exist "%BRIDGE_PS1%" (
    echo Iniciando ponte de impressao ^(%TOTEM_PRINTER_HOST%:%TOTEM_PRINTER_PORT%^)...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -WindowStyle Minimized -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','%BRIDGE_PS1%','-PrinterHost','%TOTEM_PRINTER_HOST%','-PrinterPort','%TOTEM_PRINTER_PORT%','-BridgePort','%TOTEM_BRIDGE_PORT%')"
) else (
    echo Aviso: nao encontrei scripts\start-totem-print-bridge.ps1
)

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
