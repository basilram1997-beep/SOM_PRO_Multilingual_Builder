@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$startup=[Environment]::GetFolderPath('Startup'); $target=(Resolve-Path '.\START_SOM_PRO_SERVICES_WINDOWS.cmd').Path; $shortcut=Join-Path $startup 'SOM PRO Services.lnk'; $shell=New-Object -ComObject WScript.Shell; $s=$shell.CreateShortcut($shortcut); $s.TargetPath=$target; $s.WorkingDirectory=(Get-Location).Path; $s.WindowStyle=7; $s.Save(); Write-Host 'SOM PRO services will start automatically with Windows.'"
pause
