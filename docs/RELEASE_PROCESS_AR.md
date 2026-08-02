# عملية تجهيز الإصدار

هذه هي العملية الرسمية قبل تسليم نسخة جديدة من SOM PRO.

## الأوامر الرسمية

استخدم هذه الأوامر بدل تشغيل سكربتات كثيرة بشكل متفرق:

```bash
npm run clean
npm run check:quick
npm run release:doctor
npm run release:prepare
```

## معنى الأوامر

- `npm run clean`: يحذف مخرجات البناء والاختبار والإصدارات القديمة فقط.
- `npm run e2e:clean`: يوقف عمليات E2E/Backend/License القديمة التابعة للمشروع.
- `npm run check:quick`: يشغل `lint` و`typecheck` و`format:check`.
- `npm run check:release`: يشغل بناء وفحوصات جودة وفحوصات متصفح أساسية وعميقة.
- `npm run release:doctor`: ينتج تقرير جاهزية واضح.
- `npm run release:prepare`: ينظف ثم يشغل تقرير الجاهزية.

## ترتيب التسليم المقترح

1. شغل:

   ```bash
   npm run e2e:clean
   npm run clean
   ```

2. تأكد من تشغيل PostgreSQL وRedis.
3. شغل:

   ```bash
   npm run release:doctor
   ```

4. لا تبني Installer جديداً إلا إذا كانت النتيجة `READY`.
5. بعد بناء Installer، احتفظ بنسخة واحدة فقط في مجلد التسليم.

## قواعد تمنع الالتباس

- لا تترك أكثر من Installer قديم داخل مجلد التسليم.
- لا تترك خوادم `dev` تعمل أثناء تشغيل E2E.
- لا تعتبر ملفات `dist` مصدراً؛ هي مخرجات قابلة لإعادة البناء.
- لا تعدل أكثر من سكربت تشغيل واحد لنفس السلوك؛ ضع المنطق المشترك في `scripts/runtime`.

## قبل رفع GitHub

- `git status` يجب أن يكون نظيفاً أو يحتوي فقط على تغييرات مقصودة.
- لا ترفع `.env` أو ملفات أسرار.
- لا ترفع `release` أو `dist` أو `test-results`.

## GitHub CI

عند الرفع إلى GitHub يعمل CI الرسمي على مرحلتين:

- `Quick Code Check`: يشغل `npm run check:quick`.
- `Release Doctor`: يشغل `npm run release:doctor` مع PostgreSQL وRedis وPlaywright.

لا تعتبر الفرع جاهزاً للدمج أو التسليم إذا فشل `Release Doctor`.
