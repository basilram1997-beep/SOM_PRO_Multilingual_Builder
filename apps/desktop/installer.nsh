!include nsDialogs.nsh
!include LogicLib.nsh

!ifndef BUILD_UNINSTALLER

Var SomTermsCheckbox
Var SomTermsAccepted
Var SomLicenseDialog
Var SomSchoolNameInput
Var SomInstitutionCodeInput
Var SomLicenseCodeInput
Var SomSchoolName
Var SomInstitutionCode
Var SomLicenseCode
Var SomSidebarBitmap

Function SomResizeWizard
  System::Call 'user32::SetWindowPos(p $HWNDPARENT, p 0, i 0, i 0, i 760, i 560, i 0x0006)'
FunctionEnd

!macro customWelcomePage
  Page custom SomIntroPageCreate
  Page custom SomTermsPageCreate SomTermsPageLeave
!macroend

!macro PaintSteps ACTIVE
  File /oname=$PLUGINSDIR\sompro-sidebar.bmp "${PROJECT_DIR}\build\sompro-sidebar.bmp"
  ${NSD_CreateBitmap} 0 0 31% 188u ""
  Pop $SomSidebarBitmap
  ${NSD_SetImage} $SomSidebarBitmap "$PLUGINSDIR\sompro-sidebar.bmp" $0
  ${NSD_CreateLabel} 8u 18u 26% 14u "1 التعريف"
  Pop $0
  SetCtlColors $0 0xFFFFFF transparent
  ${If} "${ACTIVE}" == "1"
    SetCtlColors $0 0x00FFFF transparent
  ${EndIf}
  ${NSD_CreateLabel} 8u 42u 26% 14u "2 الشروط"
  Pop $0
  SetCtlColors $0 0xFFFFFF transparent
  ${If} "${ACTIVE}" == "2"
    SetCtlColors $0 0x00FFFF transparent
  ${EndIf}
  ${NSD_CreateLabel} 8u 66u 26% 14u "3 الترخيص"
  Pop $0
  SetCtlColors $0 0xFFFFFF transparent
  ${If} "${ACTIVE}" == "3"
    SetCtlColors $0 0x00FFFF transparent
  ${EndIf}
  ${NSD_CreateLabel} 8u 112u 26% 14u "Basil Ramoni"
  Pop $0
  SetCtlColors $0 0xFFFFFF transparent
  ${NSD_CreateLabel} 8u 128u 26% 12u "0542366524"
  Pop $0
  SetCtlColors $0 0xFFFFFF transparent
  ${NSD_CreateLabel} 8u 142u 26% 12u "BasilRam1997@gmail.com"
  Pop $0
  SetCtlColors $0 0xFFFFFF transparent
!macroend

Function SomIntroPageCreate
  Call SomResizeWizard
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  !insertmacro PaintSteps 1
  ${NSD_CreateLabel} 34% 0 64% 18u "SOM PRO"
  Pop $0
  CreateFont $1 "Tahoma" 17 800
  SendMessage $0 ${WM_SETFONT} $1 1
  SetCtlColors $0 0x2563EB transparent
  ${NSD_CreateLabel} 34% 22u 64% 14u "مدير تشغيل المدرسة"
  Pop $0
  CreateFont $1 "Tahoma" 10 700
  SendMessage $0 ${WM_SETFONT} $1 1
  ${NSD_CreateGroupBox} 34% 48u 64% 98u "نظام مدرسي محمي"
  Pop $0
  ${NSD_CreateLabel} 37% 68u 58% 34u "ينظم ملفات المعلمين والبرنامج الثابت واليومي والاستبدالات."
  Pop $0
  CreateFont $1 "Tahoma" 9 400
  SendMessage $0 ${WM_SETFONT} $1 1
  ${NSD_CreateLabel} 37% 110u 58% 24u "التثبيت يتم على مراحل: تعريف، شروط، ترخيص، ثم تنصيب."
  Pop $0
  SetCtlColors $0 0x475569 transparent
  nsDialogs::Show
FunctionEnd

Function SomTermsPageCreate
  Call SomResizeWizard
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  !insertmacro PaintSteps 2
  ${NSD_CreateLabel} 34% 0 64% 18u "شروط الاستخدام"
  Pop $0
  CreateFont $1 "Tahoma" 15 800
  SendMessage $0 ${WM_SETFONT} $1 1
  SetCtlColors $0 0x2563EB transparent
  nsDialogs::CreateControl EDIT "${DEFAULT_STYLES}|${WS_TABSTOP}|${WS_VSCROLL}|${ES_MULTILINE}|${ES_READONLY}|${ES_AUTOVSCROLL}" "${WS_EX_CLIENTEDGE}" 33% 20u 65% 82u "هذه نسخة تجريبية مخصصة للتجربة والفحص.$\r$\n* تستخدم للتجربة داخل المدرسة المسجلة فقط.$\r$\n* تتوقف بعد المدة المحددة من لوحة المالك.$\r$\n* يمنع نسخ أو مشاركة كود الترخيص على جهاز آخر بدون إذن.$\r$\n* يمكن إيقاف أو تمديد الترخيص من لوحة المالك."
  Pop $0
  CreateFont $1 "Tahoma" 9 400
  SendMessage $0 ${WM_SETFONT} $1 1
  ${NSD_CreateCheckbox} 33% 112u 8u 12u ""
  Pop $SomTermsCheckbox
  ${NSD_CreateLabel} 40% 108u 56% 18u "أوافق على شروط الاستخدام"
  Pop $0
  CreateFont $1 "Tahoma" 9 700
  SendMessage $0 ${WM_SETFONT} $1 1
  SetCtlColors $0 0x0F172A transparent
  ${If} $SomTermsAccepted == 1
    ${NSD_Check} $SomTermsCheckbox
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function SomTermsPageLeave
  ${NSD_GetState} $SomTermsCheckbox $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $SomTermsAccepted 1
  ${Else}
    MessageBox MB_ICONEXCLAMATION "يجب تحديد خانة الموافقة للمتابعة."
    Abort
  ${EndIf}
FunctionEnd

!macro customPageAfterChangeDir
  Page custom SomLicensePageCreate SomLicensePageLeave
!macroend

Function SomLicensePageCreate
  Call SomResizeWizard
  nsDialogs::Create 1018
  Pop $SomLicenseDialog
  ${If} $SomLicenseDialog == error
    Abort
  ${EndIf}
  !insertmacro PaintSteps 3
  ${NSD_CreateLabel} 34% 0 64% 18u "بيانات الترخيص"
  Pop $0
  CreateFont $1 "Tahoma" 15 800
  SendMessage $0 ${WM_SETFONT} $1 1
  SetCtlColors $0 0x2563EB transparent
  ${NSD_CreateLabel} 34% 30u 64% 12u "اسم المدرسة"
  Pop $0
  ${NSD_CreateText} 34% 44u 64% 14u "$SomSchoolName"
  Pop $SomSchoolNameInput
  ${NSD_CreateLabel} 34% 66u 64% 12u "رقم المؤسسة"
  Pop $0
  ${NSD_CreateText} 34% 80u 64% 14u "$SomInstitutionCode"
  Pop $SomInstitutionCodeInput
  ${NSD_CreateLabel} 34% 102u 64% 12u "كود الترخيص"
  Pop $0
  ${NSD_CreateText} 34% 116u 64% 14u "$SomLicenseCode"
  Pop $SomLicenseCodeInput
  ${NSD_CreateLabel} 34% 142u 64% 20u "البيانات يجب أن تطابق الترخيص الصادر من لوحة المالك."
  Pop $0
  nsDialogs::Show
FunctionEnd

Function SomLicensePageLeave
  ${NSD_GetText} $SomSchoolNameInput $SomSchoolName
  ${NSD_GetText} $SomInstitutionCodeInput $SomInstitutionCode
  ${NSD_GetText} $SomLicenseCodeInput $SomLicenseCode
  ${If} $SomSchoolName == ""
    MessageBox MB_ICONEXCLAMATION "أدخل اسم المدرسة."
    Abort
  ${EndIf}
  ${If} $SomInstitutionCode == ""
    MessageBox MB_ICONEXCLAMATION "أدخل رقم المؤسسة."
    Abort
  ${EndIf}
  ${If} $SomLicenseCode == ""
    MessageBox MB_ICONEXCLAMATION "أدخل كود الترخيص."
    Abort
  ${EndIf}
  System::Call 'Kernel32::SetEnvironmentVariable(t,t)i("SOM_PRO_INSTALL_SCHOOL", "$SomSchoolName").r0'
  System::Call 'Kernel32::SetEnvironmentVariable(t,t)i("SOM_PRO_INSTALL_INSTITUTION", "$SomInstitutionCode").r0'
  System::Call 'Kernel32::SetEnvironmentVariable(t,t)i("SOM_PRO_INSTALL_LICENSE", "$SomLicenseCode").r0'
  FileOpen $0 "$PLUGINSDIR\sompro-validate-license.ps1" w
  FileWrite $0 "$$ErrorActionPreference = 'Stop'$\r$\n"
  FileWrite $0 "$$ProgressPreference = 'SilentlyContinue'$\r$\n"
  FileWrite $0 "$$machineGuid = ''$\r$\n"
  FileWrite $0 "try { $$machineGuid = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Cryptography').MachineGuid } catch { $$machineGuid = $$env:COMPUTERNAME }$\r$\n"
  FileWrite $0 "$$body = @{ schoolName = $$env:SOM_PRO_INSTALL_SCHOOL; institutionCode = $$env:SOM_PRO_INSTALL_INSTITUTION; licenseCode = $$env:SOM_PRO_INSTALL_LICENSE; licenseKey = $$env:SOM_PRO_INSTALL_LICENSE; machineGuid = $$machineGuid; computerName = $$env:COMPUTERNAME; userName = $$env:USERNAME } | ConvertTo-Json -Compress$\r$\n"
  FileWrite $0 "$$errorFile = '$PLUGINSDIR\sompro-license-error.txt'$\r$\n"
  FileWrite $0 "try {$\r$\n"
  FileWrite $0 "  Invoke-RestMethod -Uri 'http://localhost:4100/api/client/preinstall' -Method Post -ContentType 'application/json; charset=utf-8' -Body $$body -TimeoutSec 6 | Out-Null$\r$\n"
  FileWrite $0 "  exit 0$\r$\n"
  FileWrite $0 "} catch {$\r$\n"
  FileWrite $0 "  $$message = $$_.Exception.Message$\r$\n"
  FileWrite $0 "  if ($$_.ErrorDetails -and $$_.ErrorDetails.Message) {$\r$\n"
  FileWrite $0 "    try { $$response = $$_.ErrorDetails.Message | ConvertFrom-Json; if ($$response.message) { $$message = $$response.message } elseif ($$response.error) { $$message = $$response.error } } catch { $$message = $$_.ErrorDetails.Message }$\r$\n"
  FileWrite $0 "  }$\r$\n"
  FileWrite $0 "  [System.IO.File]::WriteAllText($$errorFile, $$message, [System.Text.Encoding]::UTF8)$\r$\n"
  FileWrite $0 "  exit 1$\r$\n"
  FileWrite $0 "}$\r$\n"
  FileClose $0
  nsExec::ExecToStack 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\sompro-validate-license.ps1"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    StrCpy $2 ""
    ClearErrors
    FileOpen $3 "$PLUGINSDIR\sompro-license-error.txt" r
    ${IfNot} ${Errors}
      FileRead $3 $2
      FileClose $3
    ${EndIf}
    ${If} $2 == ""
      StrCpy $2 "تأكد من تشغيل خادم الترخيص وصحة البيانات."
    ${EndIf}
    MessageBox MB_ICONSTOP "تعذر التحقق من الترخيص.$\r$\n$2"
    Abort
  ${EndIf}
FunctionEnd

!macro customInstall
  WriteINIStr "$INSTDIR\license-setup.ini" "license" "schoolName" "$SomSchoolName"
  WriteINIStr "$INSTDIR\license-setup.ini" "license" "institutionCode" "$SomInstitutionCode"
  WriteINIStr "$INSTDIR\license-setup.ini" "license" "licenseCode" "$SomLicenseCode"
  FileOpen $0 "$PLUGINSDIR\sompro-register-license.ps1" w
  FileWrite $0 "$$ErrorActionPreference = 'Stop'$\r$\n"
  FileWrite $0 "$$ProgressPreference = 'SilentlyContinue'$\r$\n"
  FileWrite $0 "$$machineGuid = ''$\r$\n"
  FileWrite $0 "try { $$machineGuid = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Cryptography').MachineGuid } catch { $$machineGuid = $$env:COMPUTERNAME }$\r$\n"
  FileWrite $0 "$$body = @{ schoolName = $$env:SOM_PRO_INSTALL_SCHOOL; institutionCode = $$env:SOM_PRO_INSTALL_INSTITUTION; licenseCode = $$env:SOM_PRO_INSTALL_LICENSE; licenseKey = $$env:SOM_PRO_INSTALL_LICENSE; machineGuid = $$machineGuid; computerName = $$env:COMPUTERNAME; userName = $$env:USERNAME } | ConvertTo-Json -Compress$\r$\n"
  FileWrite $0 "$$errorFile = '$PLUGINSDIR\sompro-register-error.txt'$\r$\n"
  FileWrite $0 "try {$\r$\n"
  FileWrite $0 "  Invoke-RestMethod -Uri 'http://localhost:4100/api/client/register-install' -Method Post -ContentType 'application/json; charset=utf-8' -Body $$body -TimeoutSec 6 | Out-Null$\r$\n"
  FileWrite $0 "  exit 0$\r$\n"
  FileWrite $0 "} catch {$\r$\n"
  FileWrite $0 "  $$message = $$_.Exception.Message$\r$\n"
  FileWrite $0 "  if ($$_.ErrorDetails -and $$_.ErrorDetails.Message) {$\r$\n"
  FileWrite $0 "    try { $$response = $$_.ErrorDetails.Message | ConvertFrom-Json; if ($$response.message) { $$message = $$response.message } elseif ($$response.error) { $$message = $$response.error } } catch { $$message = $$_.ErrorDetails.Message }$\r$\n"
  FileWrite $0 "  }$\r$\n"
  FileWrite $0 "  [System.IO.File]::WriteAllText($$errorFile, $$message, [System.Text.Encoding]::UTF8)$\r$\n"
  FileWrite $0 "  exit 1$\r$\n"
  FileWrite $0 "}$\r$\n"
  FileClose $0
  nsExec::ExecToStack 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\sompro-register-license.ps1"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    StrCpy $2 ""
    ClearErrors
    FileOpen $3 "$PLUGINSDIR\sompro-register-error.txt" r
    ${IfNot} ${Errors}
      FileRead $3 $2
      FileClose $3
    ${EndIf}
    ${If} $2 == ""
      StrCpy $2 "تعذر تسجيل استخدام الترخيص. تأكد من تشغيل خادم الترخيص."
    ${EndIf}
    MessageBox MB_ICONSTOP "تعذر إكمال التثبيت.$\r$\n$2"
    Abort
  ${EndIf}
!macroend

!endif
