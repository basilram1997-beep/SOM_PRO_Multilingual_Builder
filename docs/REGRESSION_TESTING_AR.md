# اختبار الانحدار في SOM PRO

اختبار الانحدار هو إعادة تشغيل طبقات التحقق بعد أي تعديل للتأكد من أن ميزة قديمة لم تتكسر بصمت.

## لماذا نحتاجه

- لأن المشروع فيه Backend وFrontend وE2E وتحديثات وتركيبات ونسخ احتياطية وصلاحيات متعددة.
- لأن نجاح الاختبار الجديد لا يكفي إذا كسر سلوكًا قديمًا.

## الطبقات المقترحة

### 1) بعد تعديل صغير

```bash
npm run regression:quick
```

يغطي عادة:

- lint
- i18n audit
- typecheck
- format check
- unit tests

### 2) بعد تعديل في الواجهة أو التنقل

```bash
npm run regression:maintenance
```

يغطي:

- `maintenance:sanity`
- `maintenance:smoke`

### 3) قبل التسليم أو الدمج النهائي

```bash
npm run regression:release
```

يغطي:

- `release:doctor`
- `acceptance:check`

### 4) عندما نريد أكبر تغطية ممكنة

```bash
npm run regression:full
```

## الترتيب الأفضل

1. `regression:quick`
2. `regression:maintenance`
3. `regression:release`
4. `acceptance:check`
5. `acceptance:run` على staging عند الحاجة

## متى نعتبره فشلًا؟

- إذا فشل أي اختبار في الصلاحيات أو التقارير أو الشهادات أو تسجيل الدخول.
- إذا ظهرت شاشة بيضاء أو routing مكسورة.
- إذا ظهرت مشكلة في البيانات أو الحفظ أو التصدير.
- إذا أعاد تعديل قديم كسر سلوكًا كان يعمل.

## ملاحظة

Regression Testing ليس بديلًا عن pen test أو acceptance، لكنه طبقة حماية يومية تمنع عودة العيوب القديمة أثناء التطوير.
