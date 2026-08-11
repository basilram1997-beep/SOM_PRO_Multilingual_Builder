# قائمة فحص Release Candidate - SOM PRO v0.9.0-rc.1

استخدم هذه القائمة قبل تسليم أي نسخة اختبار أو staging.

## قبل البناء

- [ ] نجاح `npm run check:quick`.
- [ ] نجاح `npm run release:doctor`.
- [ ] التأكد من أن `API URL` و `License Server URL` يشيران إلى staging أو البيئة الصحيحة.
- [ ] التأكد من عدم وجود أسرار production داخل ملفات المشروع.
- [ ] التأكد من أن رقم الإصدار هو `0.9.0-rc.1`.

## قبل التسليم الداخلي

- [ ] نجاح `npm run release:prepare`.
- [ ] إزالة أي ناتج قديم داخل `release/` أو `dist/` أو `test-results/`.
- [ ] عدم وجود أكثر من Installer واحد نهائي في مجلد التسليم.

## التثبيت على Windows

- [ ] التثبيت على Windows نظيف.
- [ ] فتح البرنامج بدون Node أو Docker على الجهاز.
- [ ] تسجيل الدخول بحساب صالح.
- [ ] فتح صفحات الطلاب والمعلمين والجداول والتقارير.

## التغطية التي يجب مراجعتها

- [ ] browser usability.
- [ ] browser smoke الأساسي.
- [ ] compatibility.
- [ ] migration / upgrade.
- [ ] volume tiny / normal.
- [ ] stress login / outage recovery.

## التحقق من staging

- [ ] نجاح health checks.
- [ ] نجاح migration على staging.
- [ ] نجاح backup / restore حسب runbook.
- [ ] توثيق أي مشكلة ظهرت.

## القبول النهائي

- [ ] نجاح `npm run acceptance:check`.
- [ ] ضبط `SOM_E2E_BASE_URL` و `SOM_E2E_API_BASE_URL` على staging الحقيقي قبل `npm run acceptance:run`.
- [ ] نجاح سيناريوهات القبول الأساسية: الدخول، التنقل، الحضور، التقارير، الشهادات، الصلاحيات.
- [ ] تعبئة [ACCEPTANCE_RESULTS_TEMPLATE_AR.md](./ACCEPTANCE_RESULTS_TEMPLATE_AR.md).
- [ ] اعتماد المالك/العميل النهائي على النتائج قبل التسليم.

## ملاحظة

إذا فشل أي بند مهم، لا تعتبر النسخة جاهزة للتسليم الخارجي حتى يُصلح السبب ويُعاد الفحص.
