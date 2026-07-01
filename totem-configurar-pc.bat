@echo off
title Ligeirinho Totem — configurar PC

cd /d "%~dp0"

echo.
echo Ligeirinho Totem — configuracao do PC
echo.
echo Este assistente vai:
echo   1. Bloquear gestos de borda no registro
echo   2. Abrir Configuracoes ^> Tela sensivel ao toque
echo   3. Criar atalho na Inicializacao do Windows (totem-kiosk.bat)
echo   4. Criar atalho na Area de trabalho
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\totem-pc-setup.ps1"
if errorlevel 1 (
    echo.
    echo Falha na configuracao.
    pause
    exit /b 1
)

echo.
pause
