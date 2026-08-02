@echo off
chcp 65001 >nul
setlocal EnableExtensions
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
if not exist logs mkdir logs
set "LOG_FILE=logs\02_run_desktop_test.log"
set "SOM_RUNTIME_MODE=local-trial"

echo SOM PRO Desktop Local Trial > "%LOG_FILE%"
echo ============================================
echo SOM PRO - Run local Desktop trial
echo ============================================
echo.
echo This mode is for local testing and may require Docker and Node.
echo The commercial SaaS installer does not require these tools on the school device.
echo.
call :require node "Node.js LTS" || goto failed
call :require npm "npm" || goto failed
call :require docker "Docker Desktop" || goto failed
docker info >> "%LOG_FILE%" 2>&1 || (echo Docker Desktop is not running. Open it and try again. & goto failed)
call :prepare_env || goto failed
call "%SCRIPT_DIR%00_FIX_DOCKER_CONFLICT_WINDOWS.cmd" >> "%LOG_FILE%" 2>&1
echo Starting PostgreSQL and Redis...
docker compose up -d postgres redis >> "%LOG_FILE%" 2>&1 || goto failed
echo Installing packages...
call npm install >> "%LOG_FILE%" 2>&1 || goto failed
echo Preparing environment and database...
call npm run setup:env >> "%LOG_FILE%" 2>&1 || goto failed
call npm run build:shared >> "%LOG_FILE%" 2>&1 || goto failed
call npm run setup:db >> "%LOG_FILE%" 2>&1 || goto failed
echo Opening backend in a separate window...
start "SOM PRO Backend" cmd /k "chcp 65001 >nul && cd /d ""%PROJECT_ROOT%"" && set SOM_RUNTIME_MODE=local-trial&& npm run dev:backend"
powershell -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\wait-for-url.ps1" -Url "http://localhost:4000/health" -Seconds 120 -Name "Backend" >> "%LOG_FILE%" 2>&1 || goto failed
echo Opening frontend in a separate window...
start "SOM PRO Frontend" cmd /k "chcp 65001 >nul && cd /d ""%PROJECT_ROOT%"" && set SOM_RUNTIME_MODE=local-trial&& npm run dev:frontend"
powershell -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\wait-for-url.ps1" -Url "http://localhost:5173" -Seconds 120 -Name "Frontend" >> "%LOG_FILE%" 2>&1 || goto failed
echo Starting Desktop app...
call npm run desktop:dev
echo.
echo Run finished. Log: %LOG_FILE%
pause
exit /b 0

:prepare_env
if not exist "apps\backend\.env" copy /Y "apps\backend\.env.example" "apps\backend\.env" >> "%LOG_FILE%" 2>&1
if not exist "apps\frontend\.env" copy /Y "apps\frontend\.env.example" "apps\frontend\.env" >> "%LOG_FILE%" 2>&1
if not exist ".env" copy /Y ".env.example" ".env" >> "%LOG_FILE%" 2>&1
exit /b 0

:require
where %~1 >> "%LOG_FILE%" 2>&1
if errorlevel 1 (echo %~2 is not installed. Install it and try again. & exit /b 1)
exit /b 0

:failed
echo.
echo An error occurred. See log: %LOG_FILE%
pause
exit /b 1
