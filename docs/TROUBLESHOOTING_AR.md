# حل مشاكل التشغيل الشائعة

## المنفذ 4000 مشغول

هذا يعني أن Backend قديم أو عملية اختبار قديمة ما زالت تعمل.

الحل الرسمي:

```bash
npm run e2e:clean
```

ثم أعد الفحص.

## المنفذ 4100 مشغول

هذا غالباً خادم الترخيص المحلي.

- إذا كنت تحتاجه في التشغيل المحلي، اتركه يعمل.
- إذا كنت تشغل E2E أو تنظف البيئة، أوقفه عبر:

```bash
npm run e2e:clean
```

## المنفذ 4188 مشغول

هذا غالباً Frontend E2E قديم.

الحل:

```bash
npm run e2e:clean
```

## قاعدة البيانات لا تعمل

شغل الفحص الرسمي أولاً. سيحاول تشغيل PostgreSQL وRedis عبر Docker إذا لم يكونا يعملان:

```bash
npm run local:deps
```

ثم شغل:

```bash
npm run setup:db
```

إذا أردت التشغيل اليدوي فقط، شغل:

```bash
docker compose up -d postgres redis
```

ثم أعد `npm run local:deps` للتأكد.

## فشل اختبارات المتصفح

اتبع هذا الترتيب:

```bash
npm run e2e:clean
npm run test:e2e:browser:smoke:core
```

إذا نجح smoke الأساسي، شغل:

```bash
npm run test:e2e:browser:deep
```

## ظهور نتائج قديمة أو مثبتات قديمة

نظف المخرجات:

```bash
npm run clean
```

ثم أعد البناء:

```bash
npm run build
```

## قبل طلب دعم فني

أرسل نتيجة:

```bash
npm run release:doctor
```

مع ذكر:

- إصدار البرنامج.
- هل PostgreSQL وRedis يعملان.
- هل يوجد خطأ في `4000` أو `4100`.
- آخر خطوة نجحت قبل ظهور المشكلة.
