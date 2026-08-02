@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
if not exist logs mkdir logs
set "LOG_FILE=logs\04_build_setup_exe.log"
set "MODE=%~1"

echo SOM PRO Build Setup EXE > "%LOG_FILE%"
echo ============================================
echo SOM PRO - Build Windows installer
echo ============================================
echo.
if "%MODE%"=="" (
  echo 1. Build local Trial installer
  echo 2. Build commercial SaaS installer
  echo.
  set /p build_choice=Choose build type: 
  if "!build_choice!"=="2" (set "MODE=saas") else (set "MODE=trial")
)

call :require node "Node.js LTS" || goto failed
call :require npm "npm" || goto failed
if not exist "apps\backend\.env" copy /Y "apps\backend\.env.example" "apps\backend\.env" >> "%LOG_FILE%" 2>&1
if not exist "apps\frontend\.env" copy /Y "apps\frontend\.env.example" "apps\frontend\.env" >> "%LOG_FILE%" 2>&1
if not exist ".env" copy /Y ".env.example" ".env" >> "%LOG_FILE%" 2>&1

echo Installing packages...
call npm install >> "%LOG_FILE%" 2>&1 || goto failed
echo Preparing environment...
call npm run setup:env >> "%LOG_FILE%" 2>&1 || goto failed

if /I "%MODE%"=="saas" goto build_saas
goto build_trial

:build_trial
set "SOM_RUNTIME_MODE=local-trial"
echo Building local Desktop Trial installer...
echo This installer is for local testing and may require Node/Docker in local runtime. >> "%LOG_FILE%"
call npm run build >> "%LOG_FILE%" 2>&1 || goto failed
call npm run desktop:check >> "%LOG_FILE%" 2>&1 || goto failed
call npm run desktop:build:trial >> "%LOG_FILE%" 2>&1 || goto failed
goto success

:build_saas
set "SOM_RUNTIME_MODE=saas"
if "%SOM_API_URL%"=="" (
  echo.
  echo Enter commercial API URL, example: https://api.your-domain.com
  set /p SOM_API_URL=API URL: 
)
if "%SOM_LICENSE_SERVER_URL%"=="" (
  echo.
  echo Enter license server URL, example: https://license.your-domain.com
  set /p SOM_LICENSE_SERVER_URL=License Server URL: 
)
set "VITE_API_URL=%SOM_API_URL%"
set "SOM_PRO_LICENSE_SERVER_URL=%SOM_LICENSE_SERVER_URL%"
echo Building Desktop SaaS installer...
echo SaaS API: %SOM_API_URL% >> "%LOG_FILE%"
echo License Server: %SOM_LICENSE_SERVER_URL% >> "%LOG_FILE%"
call npm run desktop:build:saas >> "%LOG_FILE%" 2>&1 || goto failed
goto success

:success
echo.
echo Build finished. Installer output:
echo apps\desktop\release
echo Log: %LOG_FILE%
if exist "apps\desktop\release" explorer "apps\desktop\release"
pause
exit /b 0

:require
where %~1 >> "%LOG_FILE%" 2>&1
if errorlevel 1 (echo %~2 is not installed. & exit /b 1)
exit /b 0

:failed
echo.
echo Build failed. See log: %LOG_FILE%
echo For SaaS builds, verify API and license server URLs.
pause
exit /b 1
