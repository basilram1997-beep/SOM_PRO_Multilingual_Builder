# SOM PRO - ملخص عربي سريع

هذا الملف ليس بديلًا عن `README.md` الرئيسي.  
هو فقط ملخص عربي سريع لمن يستلم المشروع ويريد أن يعرف من أين يبدأ.

## أين أبدأ؟

1. `HANDOFF.md`
2. `README.md`
3. `SALE_READINESS_REPORT.md`
4. `KNOWN_ISSUES.md`

## كيف أشغل المشروع على Windows؟

```text
SOM_PRO_CONTROL_PANEL_WINDOWS.cmd
```

ثم اختر خطوة التشغيل المناسبة من القائمة.

## الترتيب الموصى به

1. `01_CHECK_SYSTEM_WINDOWS.cmd`
2. `02_RUN_DESKTOP_TEST_WINDOWS.cmd`
3. `03_RUN_WEB_LOCAL_WINDOWS.cmd`
4. `04_BUILD_SOM_PRO_SETUP_EXE_WINDOWS.cmd`

## تشغيل محلي سريع

إذا كنت تشغّل المشروع لأول مرة، فابدأ بهذا الترتيب:

1. انسخ ملفات البيئة من ملفات المثال الموجودة في الجذر والمجلدات الفرعية.
2. شغّل PostgreSQL وRedis إن كان التشغيل محليًا.
3. نفّذ:

```text
npm run setup:db
```

4. شغّل التطبيق:

```text
npm run dev
```

5. إذا احتجت خادم الترخيص المحلي:

```text
npm run dev:license-server
```

## أوامر مهمة

- `npm run test`
- `npm run build`
- `npm run check`
- `npm run release:check`
- `npm run production:check`

## أين أجد ملف التثبيت؟

- `apps\desktop\release`
- وأحيانًا `release`

## ماذا ينتج بعد البناء؟

- ملف تثبيت Windows باسم واضح.
- نسخة Trial ونسخة SaaS منفصلتان.
- لا يحتاج مدير المدرسة إلى الكود المصدري.

## ما الذي يجب أن أعرفه بسرعة؟

- المشروع يدعم العربية وEnglish وHebrew.
- اتجاه النص RTL / LTR مضبوط داخل الواجهة.
- إذا ظهرت مشكلة تشغيل محلي، راجع ملفات `.env.*` أولًا.
- ملف `README.md` الرئيسي يحتوي تفاصيل التثبيت والبناء والتطوير بشكل كامل.
- ملفات الإعداد المهمة موجودة في الجذر وفي `apps/backend/` و`apps/frontend/` و`apps/license-server/`.
- ملف السجلات موجود داخل `logs/` عند الحاجة إلى التشخيص.

## ملاحظات تسليم

- لا تضع أي أسرار حقيقية داخل Git.
- لا تعتمد على قاعدة بيانات الإنتاج في التطوير.
- راجع `SALE_READINESS_REPORT.md` قبل أي تسليم خارجي.
- إذا كنت ستسلم نسخة تجريبية أو SaaS، فتأكد من إعداد العناوين الصحيحة في ملفات البيئة.
