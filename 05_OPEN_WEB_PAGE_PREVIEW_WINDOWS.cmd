@echo off
setlocal
cd /d "%~dp0"
echo Opening SOM PRO web page preview...
start "" "%CD%\web-page\index.html"
