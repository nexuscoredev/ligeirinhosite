@echo off
rem Compat: redireciona para o launcher na raiz do repo
cd /d "%~dp0.."
call "%~dp0..\totem-print-bridge.bat" %*
