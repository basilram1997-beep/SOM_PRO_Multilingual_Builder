@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-sompro-local-services.ps1" -ProjectRoot "%~dp0"
pause

