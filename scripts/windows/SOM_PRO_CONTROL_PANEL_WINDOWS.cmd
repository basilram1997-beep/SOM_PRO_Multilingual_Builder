@echo off
chcp 65001 >nul
setlocal EnableExtensions
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"
if not exist logs mkdir logs

:menu
cls
echo ============================================
echo        SOM PRO - Windows Control Panel
echo ============================================
echo.
echo 1. Check system requirements
echo 2. Run local Desktop trial
echo 3. Run local Web development
echo 4. Build local Desktop Trial installer
echo 5. Build commercial Desktop SaaS installer
echo 6. Show current API settings
echo 7. Open SaaS env example
echo 8. Open docs folder
echo 9. Open marketing page preview
echo 10. Clean old SOM PRO Docker containers
echo 0. Exit
echo.
set /p choice=Choose a number: 

if "%choice%"=="1" call "%SCRIPT_DIR%01_CHECK_SYSTEM_WINDOWS.cmd"
if "%choice%"=="2" call "%SCRIPT_DIR%02_RUN_DESKTOP_TEST_WINDOWS.cmd"
if "%choice%"=="3" call "%SCRIPT_DIR%03_RUN_WEB_LOCAL_WINDOWS.cmd"
if "%choice%"=="4" call "%SCRIPT_DIR%04_BUILD_SOM_PRO_SETUP_EXE_WINDOWS.cmd" trial
if "%choice%"=="5" call "%SCRIPT_DIR%04_BUILD_SOM_PRO_SETUP_EXE_WINDOWS.cmd" saas
if "%choice%"=="6" call :show_settings
if "%choice%"=="7" notepad "%PROJECT_ROOT%\.env.saas.example"
if "%choice%"=="8" explorer "%PROJECT_ROOT%\docs"
if "%choice%"=="9" call "%SCRIPT_DIR%05_OPEN_WEB_PAGE_PREVIEW_WINDOWS.cmd"
if "%choice%"=="10" call "%SCRIPT_DIR%00_FIX_DOCKER_CONFLICT_WINDOWS.cmd"
if "%choice%"=="0" exit /b 0

goto menu

:show_settings
echo.
echo Runtime mode: %SOM_RUNTIME_MODE%
echo API URL: %SOM_API_URL%
echo VITE API URL: %VITE_API_URL%
echo License Server URL: %SOM_LICENSE_SERVER_URL%
echo.
echo For SaaS builds, use real HTTPS URLs before building the commercial installer.
pause
exit /b 0
