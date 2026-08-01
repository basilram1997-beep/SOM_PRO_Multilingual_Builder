@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if not exist logs mkdir logs

:menu
cls
echo ============================================
echo        SOM PRO - لوحة التحكم
echo ============================================
echo.
echo 1. فحص متطلبات الجهاز
echo 2. تشغيل تجربة Desktop محلية
echo 3. تشغيل نسخة Web محلية للتطوير
echo 4. بناء نسخة Desktop Trial محلية
echo 5. بناء نسخة Desktop SaaS تجارية
echo 6. عرض إعدادات API الحالية
echo 7. فتح ملف إعدادات SaaS المثال
echo 8. فتح مجلد الوثائق
echo 9. فتح معاينة صفحة التسويق
echo 10. إصلاح تعارض Docker
echo 0. خروج
echo.
set /p choice=اختر رقمًا: 

if "%choice%"=="1" call "%~dp001_CHECK_SYSTEM_WINDOWS.cmd"
if "%choice%"=="2" call "%~dp002_RUN_DESKTOP_TEST_WINDOWS.cmd"
if "%choice%"=="3" call "%~dp003_RUN_WEB_LOCAL_WINDOWS.cmd"
if "%choice%"=="4" call "%~dp004_BUILD_SOM_PRO_SETUP_EXE_WINDOWS.cmd" trial
if "%choice%"=="5" call "%~dp004_BUILD_SOM_PRO_SETUP_EXE_WINDOWS.cmd" saas
if "%choice%"=="6" call :show_settings
if "%choice%"=="7" notepad "%~dp0.env.saas.example"
if "%choice%"=="8" explorer "%~dp0docs"
if "%choice%"=="9" call "%~dp005_OPEN_WEB_PAGE_PREVIEW_WINDOWS.cmd"
if "%choice%"=="10" call "%~dp000_FIX_DOCKER_CONFLICT_WINDOWS.cmd"
if "%choice%"=="0" exit /b 0

goto menu

:show_settings
echo.
echo وضع التشغيل الحالي: %SOM_RUNTIME_MODE%
echo API URL: %SOM_API_URL%
echo VITE API URL: %VITE_API_URL%
echo License Server URL: %SOM_LICENSE_SERVER_URL%
echo.
echo ملاحظة: في وضع SaaS يجب استخدام روابط HTTPS حقيقية قبل بناء النسخة التجارية.
pause
exit /b 0
