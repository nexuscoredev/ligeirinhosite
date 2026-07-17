@echo off
title Ligeirinho Print Bridge
cd /d "%~dp0"

rem Impressora termica da loja (Bematech RAW 9100)
if not defined TOTEM_PRINTER_HOST set "TOTEM_PRINTER_HOST=192.168.15.31"
if not defined TOTEM_PRINTER_PORT set "TOTEM_PRINTER_PORT=9100"
if not defined TOTEM_BRIDGE_HOST set "TOTEM_BRIDGE_HOST=0.0.0.0"
if not defined TOTEM_BRIDGE_PORT set "TOTEM_BRIDGE_PORT=8787"

rem Node no PATH (ou pastas padrao do instalador)
where node >nul 2>&1
if errorlevel 1 (
    if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
)
where node >nul 2>&1
if errorlevel 1 (
    if exist "%LocalAppData%\Programs\node\node.exe" set "PATH=%LocalAppData%\Programs\node;%PATH%"
)
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERRO] Node.js nao encontrado no PATH.
    echo Instale o LTS em https://nodejs.org e abra este .bat de novo.
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0scripts\totem-print-bridge.mjs" (
    echo.
    echo [ERRO] Nao encontrei scripts\totem-print-bridge.mjs
    echo Pasta atual: %CD%
    echo.
    echo Rode nesta pasta:
    echo   git pull
    echo.
    pause
    exit /b 1
)

rem Libera a porta 8787 no firewall (ignora se nao tiver permissao)
netsh advfirewall firewall delete rule name="Ligeirinho Totem Print Bridge" >nul 2>&1
netsh advfirewall firewall add rule name="Ligeirinho Totem Print Bridge" dir=in action=allow protocol=TCP localport=%TOTEM_BRIDGE_PORT% >nul 2>&1

echo.
echo ========================================
echo  Ligeirinho — ponte de impressao
echo ========================================
echo  Impressora: %TOTEM_PRINTER_HOST%:%TOTEM_PRINTER_PORT%
echo  HTTP:       http://0.0.0.0:%TOTEM_BRIDGE_PORT%/print
echo  Teste:      http://127.0.0.1:%TOTEM_BRIDGE_PORT%/health
echo.
echo  Janela minimizada — pode deixar na barra de tarefas.
echo  Feche so se quiser desligar a ponte.
echo ========================================
echo.

node "%~dp0scripts\totem-print-bridge.mjs"
set ERR=%ERRORLEVEL%
echo.
echo Ponte encerrou (codigo %ERR%).
pause
exit /b %ERR%
