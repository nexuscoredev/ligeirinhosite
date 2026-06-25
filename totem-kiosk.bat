@echo off
title Ligeirinho Totem
cd /d "%~dp0"
set URL=https://ligeirinhoparceiros.vercel.app/totem.html

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js nao encontrado. Instale em https://nodejs.org e tente de novo.
    pause
    exit /b 1
)

set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe

if not exist "%CHROME%" (
    echo Instale o Google Chrome e tente de novo.
    pause
    exit /b 1
)

rem Ponte silenciosa ESC/POS — sem dialogo do Chrome
if exist "%~dp0scripts\start-totem-print-bridge.ps1" (
    start "Ligeirinho Print" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-totem-print-bridge.ps1" -LocalOnly
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; 1..30 | ForEach-Object { try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8787/health' -TimeoutSec 1; if($r.StatusCode -eq 200){$ok=$true;break} } catch {}; Start-Sleep -Milliseconds 500 }; if($ok){ Write-Host '[totem] Ponte de impressao OK' -ForegroundColor Green } else { Write-Host '[totem] AVISO: ponte nao respondeu. Veja a janela Ligeirinho Print.' -ForegroundColor Yellow; timeout /t 5 /nobreak >nul }"
) else (
    echo AVISO: scripts\start-totem-print-bridge.ps1 nao encontrado.
    echo Copie o totem-kiosk.bat para dentro da pasta ligeirinhosite.
    pause
    exit /b 1
)

start "" "%CHROME%" --kiosk --no-first-run --disable-infobars --disable-session-crashed-bubble "%URL%"
