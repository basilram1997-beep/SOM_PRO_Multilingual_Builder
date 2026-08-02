@echo off
chcp 65001 >nul
setlocal EnableExtensions
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
if not exist logs mkdir logs
set "LOG_FILE=logs\01_check_system.log"

echo SOM PRO System Check > "%LOG_FILE%"
echo ============================================
echo SOM PRO - System requirements check
echo ============================================
echo.
call :check node "Node.js LTS"
call :check npm "npm"
call :check docker "Docker Desktop"
echo.
where docker >nul 2>nul
if not errorlevel 1 (
  docker info >> "%LOG_FILE%" 2>&1
  if errorlevel 1 (
    echo [WARN] Docker is installed but not running. Open Docker Desktop and try again.
  ) else (
    echo [OK] Docker Desktop is running.
  )
)
echo.
echo Check result saved to: %LOG_FILE%
echo SaaS desktop users do not need Docker or Node after installation.
echo.
pause
exit /b 0

:check
where %~1 >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
  echo [MISSING] %~2 is not installed.
) else (
  echo [OK] %~2 is installed.
  %~1 --version >> "%LOG_FILE%" 2>&1
)
exit /b 0
