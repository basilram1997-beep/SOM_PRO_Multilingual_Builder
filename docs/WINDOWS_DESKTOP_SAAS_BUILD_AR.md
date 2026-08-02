# بناء نسخة SOM PRO Desktop SaaS على Windows

## الفكرة

نسخة SaaS هي النسخة التجارية المقترحة. في هذا الوضع تطبيق سطح المكتب لا يشغل backend محلي، ولا يحتاج Docker أو Node.js عند مدير المدرسة بعد التثبيت.

## المتطلبات على جهاز المطور فقط

- Node.js و npm.
- مشروع SOM PRO كامل.
- رابط API حقيقي يعمل عبر HTTPS.
- رابط License Server حقيقي يعمل عبر HTTPS.

## تحديد رابط API

قبل البناء ضع المتغيرات التالية في نافذة CMD أو PowerShell:

```cmd
set SOM_API_URL=https://api.your-domain.com
set VITE_API_URL=https://api.your-domain.com
set SOM_LICENSE_SERVER_URL=https://license.your-domain.com
set SOM_PRO_LICENSE_SERVER_URL=https://license.your-domain.com
set SOM_RUNTIME_MODE=saas
```

يمكن استخدام `.env.saas.example` كقالب، لكن لا تترك روابط example في نسخة تجارية.

## أمر البناء

```cmd
npm run desktop:build:saas
```

أو من لوحة التحكم:

```cmd
START_HERE_WINDOWS.cmd
```

ثم اختر:

```text
5. بناء نسخة Desktop SaaS تجارية
```

## أين يظهر ملف التثبيت؟

بعد نجاح البناء يظهر الملف داخل:

```text
apps\desktop\release
```

## كيف أختبر النسخة؟

1. تأكد أن API يعمل من المتصفح.
2. تأكد أن License Server يعمل.
3. شغّل:

```cmd
npm run desktop:check:saas
```

4. ثبّت ملف `SOM PRO Setup.exe` على جهاز اختبار.
5. أدخل الترخيص وبيانات الدخول.

## لماذا لا يحتاج المدير Docker أو Node؟

لأن نسخة SaaS لا تشغّل الخادم وقاعدة البيانات على جهاز المدير. التطبيق يتصل بسيرفر SOM PRO المركزي، لذلك كل العمل الثقيل يبقى عند صاحب النظام.

## تنبيه مهم

هذه المرحلة تجهز مسار النشر التجاري، لكنها لا تعني أن المنتج جاهز للبيع النهائي وحده. ما زال يلزم سيرفر production، دومين، HTTPS، توقيع Windows installer، وتجربة تثبيت على جهاز نظيف.
