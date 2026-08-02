@echo off
chcp 65001 >nul
setlocal EnableExtensions
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
echo ============================================
echo        SOM PRO - Local Diagnostics
echo ============================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\diagnose-sompro-local.ps1" -ProjectRoot "%PROJECT_ROOT%"
echo.
echo Diagnostics report created inside logs\sompro-local-diagnostics.txt
echo.
pause
