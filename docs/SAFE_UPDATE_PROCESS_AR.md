# نظام التحديث الآمن

هذا المسار يستخدم عند نقل SOM PRO من نسخة إلى نسخة بدون فقدان بيانات.

## الأوامر الرسمية

```bash
npm run update:dry-run
npm run update:backup
npm run update:safe
```

## ماذا يفعل `update:safe`

1. يتأكد أن PostgreSQL وRedis يعملان.
2. يأخذ نسخة backup قبل أي migration.
3. يشغل Prisma migrations.
4. يفحص اتصال قاعدة البيانات بعد التحديث.
5. يحاول فحص `/health` إذا كان Backend يعمل.
6. إذا فشل migration أو فحص الصحة، يرجع قاعدة البيانات من backup الذي أخذه قبل التحديث.
7. يكتب تقرير محاولة التحديث داخل:

```text
deploy/backup/update-runs/
```

## مكان النسخ الاحتياطية

```text
deploy/backup/postgres/
```

اسم الملف يكون مثل:

```text
sompro-pre-update-YYYY-MM-DDTHH-MM-SS.sql
```

## اختبار بدون تنفيذ

قبل تشغيل تحديث حقيقي:

```bash
npm run update:dry-run
```

هذا لا يلمس قاعدة البيانات.

## أخذ backup فقط

```bash
npm run update:backup
```

هذا مفيد قبل بناء Installer أو قبل نقل الجهاز.

## استرجاع يدوي

إذا احتجت استرجاع نسخة معينة:

```bash
node scripts/runtime/update-manager.js --restore deploy/backup/postgres/name.sql
```

## فحص Backend الإجباري

افتراضياً إذا لم يكن Backend يعمل، لا يفشل التحديث بسبب `/health`، لأن بعض التحديثات تتم والخادم متوقف.

إذا أردت جعل فحص Backend إلزامياً:

```powershell
$env:SOM_UPDATE_REQUIRE_BACKEND_HEALTH='true'
npm run update:safe
```

على Linux/macOS:

```bash
SOM_UPDATE_REQUIRE_BACKEND_HEALTH=true npm run update:safe
```

ويمكن تغيير عنوان الفحص:

```powershell
$env:SOM_UPDATE_HEALTH_URL='http://127.0.0.1:4000/health'
npm run update:safe
```

على Linux/macOS:

```bash
SOM_UPDATE_HEALTH_URL=http://127.0.0.1:4000/health npm run update:safe
```

## قواعد مهمة

- لا تشغل التحديث أثناء إدخال بيانات من المستخدمين.
- لا تحذف backup الناتج قبل التأكد أن النسخة الجديدة تعمل.
- إذا حدث rollback، لا تكمل على نفس النسخة قبل قراءة تقرير `update-runs`.
- على production، احتفظ بنسخة backup خارج نفس الجهاز أيضاً.
