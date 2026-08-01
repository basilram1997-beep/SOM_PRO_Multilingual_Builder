@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo        SOM PRO - Local Diagnostics
echo ============================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\diagnose-sompro-local.ps1" -ProjectRoot "%~dp0"
echo.
echo Diagnostics report created inside logs\sompro-local-diagnostics.txt
echo.
pause