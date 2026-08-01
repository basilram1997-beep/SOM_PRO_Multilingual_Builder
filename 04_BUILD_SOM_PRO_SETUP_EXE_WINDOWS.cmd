@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if not exist logs mkdir logs
set "LOG_FILE=logs\04_build_setup_exe.log"
set "MODE=%~1"

echo SOM PRO Build Setup EXE > "%LOG_FILE%"
echo ============================================
echo SOM PRO - بناء ملف التثبيت Windows
echo ============================================
echo.
if "%MODE%"=="" (
  echo 1. بناء نسخة Trial محلية
  echo 2. بناء نسخة SaaS تجارية
  echo.
  set /p build_choice=اختر نوع البناء: 
  if "!build_choice!"=="2" (set "MODE=saas") else (set "MODE=trial")
)

call :require node "Node.js LTS" || goto failed
call :require npm "npm" || goto failed
if not exist "apps\backend\.env" copy /Y "apps\backend\.env.example" "apps\backend\.env" >> "%LOG_FILE%" 2>&1
if not exist "apps\frontend\.env" copy /Y "apps\frontend\.env.example" "apps\frontend\.env" >> "%LOG_FILE%" 2>&1
if not exist ".env" copy /Y ".env.example" ".env" >> "%LOG_FILE%" 2>&1

echo تثبيت الحزم...
call npm install >> "%LOG_FILE%" 2>&1 || goto failed
echo تجهيز البيئة...
call npm run setup:env >> "%LOG_FILE%" 2>&1 || goto failed

if /I "%MODE%"=="saas" goto build_saas
goto build_trial

:build_trial
set "SOM_RUNTIME_MODE=local-trial"
echo بناء نسخة Desktop Trial محلية...
echo هذه النسخة مخصصة للتجربة، وقد تحتاج Node/Docker في بيئة التشغيل المحلية. >> "%LOG_FILE%"
call npm run build >> "%LOG_FILE%" 2>&1 || goto failed
call npm run desktop:check >> "%LOG_FILE%" 2>&1 || goto failed
call npm run desktop:build:trial >> "%LOG_FILE%" 2>&1 || goto failed
goto success

:build_saas
set "SOM_RUNTIME_MODE=saas"
if "%SOM_API_URL%"=="" (
  echo.
  echo أدخل رابط API التجاري، مثال: https://api.your-domain.com
  set /p SOM_API_URL=API URL: 
)
if "%SOM_LICENSE_SERVER_URL%"=="" (
  echo.
  echo أدخل رابط خادم الترخيص، مثال: https://license.your-domain.com
  set /p SOM_LICENSE_SERVER_URL=License Server URL: 
)
set "VITE_API_URL=%SOM_API_URL%"
set "SOM_PRO_LICENSE_SERVER_URL=%SOM_LICENSE_SERVER_URL%"
echo بناء نسخة Desktop SaaS...
echo SaaS API: %SOM_API_URL% >> "%LOG_FILE%"
echo License Server: %SOM_LICENSE_SERVER_URL% >> "%LOG_FILE%"
call npm run desktop:build:saas >> "%LOG_FILE%" 2>&1 || goto failed
goto success

:success
echo.
echo تم البناء. ملف التثبيت يظهر هنا بعد نجاح electron-builder:
echo apps\desktop\release
echo السجل: %LOG_FILE%
if exist "apps\desktop\release" explorer "apps\desktop\release"
pause
exit /b 0

:require
where %~1 >> "%LOG_FILE%" 2>&1
if errorlevel 1 (echo %~2 غير مثبت. & exit /b 1)
exit /b 0

:failed
echo.
echo فشل البناء. راجع السجل: %LOG_FILE%
echo في نسخة SaaS تأكد من وضع رابط API ورابط الترخيص بشكل صحيح.
pause
exit /b 1

