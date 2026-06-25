@echo off
title Ligeirinho Totem
cd /d "%~dp0"
set URL=https://ligeirinhoparceiros.vercel.app/totem.html

set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe

if not exist "%CHROME%" (
    echo Instale o Google Chrome e tente de novo.
    pause
    exit /b 1
)

rem Ponte silenciosa (ESC/POS) — sem dialogo de impressao do Chrome
if exist "%~dp0scripts\start-totem-print-bridge.ps1" (
    start "Ligeirinho Print" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-totem-print-bridge.ps1"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; 1..24 | ForEach-Object { try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8787/health' -TimeoutSec 1; if($r.StatusCode -eq 200){$ok=$true;break} } catch {}; Start-Sleep -Milliseconds 500 }; if(-not $ok){ Write-Host '[totem] AVISO: ponte de impressao nao respondeu. Verifique Node.js e a impressora.' -ForegroundColor Yellow; timeout /t 4 /nobreak >nul }"
) else (
    echo AVISO: scripts\start-totem-print-bridge.ps1 nao encontrado.
    echo Impressao silenciosa exige a ponte local. Use o repositorio completo.
    timeout /t 4 /nobreak >nul
)

start "" "%CHROME%" --kiosk --no-first-run --disable-infobars --disable-session-crashed-bubble "%URL%"
