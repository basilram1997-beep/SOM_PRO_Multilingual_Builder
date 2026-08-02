@echo off
setlocal EnableExtensions
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$startup=[Environment]::GetFolderPath('Startup'); $target=(Resolve-Path '%SCRIPT_DIR%START_SOM_PRO_SERVICES_WINDOWS.cmd').Path; $shortcut=Join-Path $startup 'SOM PRO Services.lnk'; $shell=New-Object -ComObject WScript.Shell; $s=$shell.CreateShortcut($shortcut); $s.TargetPath=$target; $s.WorkingDirectory='%PROJECT_ROOT%'; $s.WindowStyle=7; $s.Save(); Write-Host 'SOM PRO services will start automatically with Windows.'"
pause
