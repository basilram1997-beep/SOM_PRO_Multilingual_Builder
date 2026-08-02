@echo off
setlocal EnableExtensions
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\start-sompro-local-services.ps1" -ProjectRoot "%PROJECT_ROOT%"
pause
