@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if not exist logs mkdir logs
set "LOG_FILE=logs\02_run_desktop_test.log"
set "SOM_RUNTIME_MODE=local-trial"
echo SOM PRO Desktop Local Trial > "%LOG_FILE%"
echo ============================================
echo SOM PRO - تشغيل تجربة Desktop محلية
echo ============================================
echo.
echo هذا الوضع للتطوير أو التجربة المحلية، وقد يحتاج Docker و Node.
echo النسخة التجارية SaaS لا تحتاج هذه الأدوات على جهاز مدير المدرسة.
echo.
call :require node "Node.js LTS" || goto failed
call :require npm "npm" || goto failed
call :require docker "Docker Desktop" || goto failed
docker info >> "%LOG_FILE%" 2>&1 || (echo Docker Desktop غير شغال. افتحه ثم أعد المحاولة. & goto failed)
call :prepare_env || goto failed
call "%~dp000_FIX_DOCKER_CONFLICT_WINDOWS.cmd" >> "%LOG_FILE%" 2>&1
echo تشغيل PostgreSQL و Redis...
docker compose up -d postgres redis >> "%LOG_FILE%" 2>&1 || goto failed
echo تثبيت الحزم...
call npm install >> "%LOG_FILE%" 2>&1 || goto failed
echo تجهيز البيئة وقاعدة البيانات...
call npm run setup:env >> "%LOG_FILE%" 2>&1 || goto failed
call npm run build:shared >> "%LOG_FILE%" 2>&1 || goto failed
call npm run setup:db >> "%LOG_FILE%" 2>&1 || goto failed
echo فتح backend في نافذة مستقلة...
start "SOM PRO Backend" cmd /k "chcp 65001 >nul && cd /d ""%~dp0"" && set SOM_RUNTIME_MODE=local-trial&& npm run dev:backend"
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\wait-for-url.ps1" -Url "http://localhost:4000/health" -Seconds 120 -Name "Backend" >> "%LOG_FILE%" 2>&1 || goto failed
echo فتح frontend في نافذة مستقلة...
start "SOM PRO Frontend" cmd /k "chcp 65001 >nul && cd /d ""%~dp0"" && set SOM_RUNTIME_MODE=local-trial&& npm run dev:frontend"
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\wait-for-url.ps1" -Url "http://localhost:5173" -Seconds 120 -Name "Frontend" >> "%LOG_FILE%" 2>&1 || goto failed
echo تشغيل تطبيق سطح المكتب...
call npm run desktop:dev
echo.
echo انتهى التشغيل. السجل: %LOG_FILE%
pause
exit /b 0

:prepare_env
if not exist "apps\backend\.env" copy /Y "apps\backend\.env.example" "apps\backend\.env" >> "%LOG_FILE%" 2>&1
if not exist "apps\frontend\.env" copy /Y "apps\frontend\.env.example" "apps\frontend\.env" >> "%LOG_FILE%" 2>&1
if not exist ".env" copy /Y ".env.example" ".env" >> "%LOG_FILE%" 2>&1
exit /b 0

:require
where %~1 >> "%LOG_FILE%" 2>&1
if errorlevel 1 (echo %~2 غير مثبت. ثبته ثم أعد المحاولة. & exit /b 1)
exit /b 0

:failed
echo.
echo حدث خطأ. راجع السجل: %LOG_FILE%
pause
exit /b 1
