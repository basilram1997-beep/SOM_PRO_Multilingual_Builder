@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if not exist logs mkdir logs
set "LOG_FILE=logs\01_check_system.log"
echo SOM PRO System Check > "%LOG_FILE%"
echo ============================================
echo SOM PRO - فحص متطلبات الجهاز
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
    echo [تنبيه] Docker موجود لكنه غير شغال. افتح Docker Desktop وانتظر حتى يعمل.
  ) else (
    echo [OK] Docker Desktop يعمل.
  )
)
echo.
echo تم حفظ نتيجة الفحص في: %LOG_FILE%
echo في نسخة SaaS التجارية لا يحتاج مدير المدرسة Docker أو Node بعد التثبيت.
echo.
pause
exit /b 0

:check
where %~1 >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
  echo [ناقص] %~2 غير مثبت.
) else (
  echo [OK] %~2 موجود.
  %~1 --version >> "%LOG_FILE%" 2>&1
)
exit /b 0
