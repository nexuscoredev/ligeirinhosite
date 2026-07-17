@echo off
title Ligeirinho Print Bridge
cd /d "%~dp0"

if not defined TOTEM_PRINTER_HOST set "TOTEM_PRINTER_HOST=192.168.15.31"
if not defined TOTEM_PRINTER_PORT set "TOTEM_PRINTER_PORT=9100"
if not defined TOTEM_BRIDGE_HOST set "TOTEM_BRIDGE_HOST=0.0.0.0"
if not defined TOTEM_BRIDGE_PORT set "TOTEM_BRIDGE_PORT=8787"

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
    echo [ERRO] Node.js nao encontrado. Instale LTS em https://nodejs.org
    pause
    exit /b 1
)

if not exist "%~dp0scripts\totem-print-bridge.mjs" (
    echo [ERRO] Falta scripts\totem-print-bridge.mjs - rode git pull em %CD%
    pause
    exit /b 1
)

if not exist "%~dp0node_modules\ws\package.json" (
    echo Instalando componente da ponte (uma vez)...
    call npm.cmd install --omit=dev --no-audit --no-fund
    if errorlevel 1 (
        echo [ERRO] Nao foi possivel instalar o componente ws.
        pause
        exit /b 1
    )
)

netsh advfirewall firewall delete rule name="Ligeirinho Totem Print Bridge" >nul 2>&1
netsh advfirewall firewall add rule name="Ligeirinho Totem Print Bridge" dir=in action=allow protocol=TCP localport=%TOTEM_BRIDGE_PORT% >nul 2>&1

echo Ligeirinho Print Bridge
echo Impressora: %TOTEM_PRINTER_HOST%:%TOTEM_PRINTER_PORT%
echo Teste: http://127.0.0.1:%TOTEM_BRIDGE_PORT%/health
echo Deixe esta janela rodando (pode ficar minimizada).
echo.

node "%~dp0scripts\totem-print-bridge.mjs"
echo.
echo Ponte encerrou.
pause
