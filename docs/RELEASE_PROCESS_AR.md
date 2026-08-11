# عملية تجهيز الإصدار

هذا هو المسار الرسمي قبل تسليم نسخة جديدة من SOM PRO.

## الأوامر الرسمية

```bash
npm run clean
npm run local:deps
npm run check:quick
npm run release:doctor
npm run release:prepare
npm run update:safe
```

## معنى الأوامر

- `npm run clean`: يحذف المخرجات القديمة وملفات التشغيل المؤقتة.
- `npm run local:deps`: يتأكد من PostgreSQL وRedis ويشغلهما محليًا عند الحاجة.
- `npm run check:quick`: فحص سريع للكود والأنواع والتنسيق.
- `npm run release:doctor`: تقرير جاهزية الإصدار من نقطة واحدة.
- `npm run release:prepare`: تنظيف ثم تقرير الجاهزية.
- `npm run update:safe`: backup ثم migrations ثم فحص صحة، مع إيقاف آمن عند الفشل.

## الترتيب المقترح

1. شغّل `npm run e2e:clean` إذا كان هناك بقايا تشغيل قديمة.
2. شغّل `npm run clean`.
3. شغّل `npm run local:deps`.
4. شغّل `npm run release:doctor`.
5. لا تبنِ Installer جديدًا إلا إذا كانت نتيجة `release:doctor` سليمة.
6. احتفظ بنسخة واحدة فقط من ناتج الإصدار داخل مجلد التسليم.

## قواعد تمنع الالتباس

- لا تترك أكثر من Installer قديم داخل مجلد التسليم.
- لا تشغّل خوادم التطوير أثناء E2E.
- لا تعتبر `dist` مصدرًا نهائيًا؛ هو ناتج بناء فقط.
- إن أردت تعديل منطق التشغيل، انقله إلى `scripts/runtime/` بدل تكرار الأوامر في أكثر من سكربت.

## قبل رفع المشروع

- تأكد أن `git status` نظيف أو يحوي تغييرات مقصودة فقط.
- لا ترفع `.env` أو ملفات الأسرار.
- لا ترفع `release/` أو `dist/` أو `test-results/`.

## GitHub CI

الـ CI الرسمي يجب أن يشغّل على الأقل:

- `npm run check:quick`
- `npm run release:doctor`

إذا فشل `release:doctor` فلا تعتبر النسخة جاهزة للدمج أو التسليم.
