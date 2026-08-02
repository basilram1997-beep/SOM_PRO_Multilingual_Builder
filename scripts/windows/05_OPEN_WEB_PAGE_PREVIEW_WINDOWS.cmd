@echo off
setlocal EnableExtensions
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
echo Opening SOM PRO web page preview...
start "" "%PROJECT_ROOT%\web-page\index.html"
