@echo off
title Ligeirinho - Ponte impressao totem
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-totem-print-bridge.ps1" %*
if errorlevel 1 pause
