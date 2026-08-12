# المراقبة و Health Checks في SOM PRO

## ما الذي يجب مراقبته؟

- Backend API.
- License Server.
- PostgreSQL.
- Redis.
- Nginx/reverse proxy.
- مساحة القرص.
- استهلاك الذاكرة والمعالج.
- نجاح النسخ الاحتياطي.
- أخطاء تسجيل الدخول والترخيص.
- حالة alerting وhealth checks من لوحة صحة التشغيل.
- هل redundancy/failover مهيأ فعليًا أم أن التشغيل ما زال single-region.

## كيف أعرف أن الخادم يعمل؟

افحص:

```bash
curl https://api.your-domain.com/health
curl https://license.your-domain.com/health
```

النتيجة المتوقعة تحتوي `ok: true`.

## كيف أفحص قاعدة البيانات؟

```bash
docker compose -f docker-compose.production.yml exec postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

ولفحص الحجم:

```bash
docker compose -f docker-compose.production.yml exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
```

## كيف أفحص الترخيص؟

- افتح `https://license.your-domain.com/health`.
- افتح لوحة المالك.
- تحقق من وجود التراخيص والأجهزة.
- جرّب تفعيل جهاز اختبار.

## كيف أقرأ صحة التشغيل من داخل النظام؟

- افتح صفحة `صحة التشغيل` من حساب الإدارة أو الدعم.
- راقب:
  - آخر backup ناجح.
  - هل النسخ الاحتياطي التلقائي مفعّل.
  - هل التنبيهات الخارجية مهيأة.
  - هل يوجد replica فعلي أو ما زال التشغيل single-region.
- إذا كانت بيئة staging أو production، فلا تكتفِ بالصفحة وحدها: اربطها أيضًا بتنبيه خارجي حقيقي وخطة failover مكتوبة.

## ماذا أفعل إذا توقف backend؟

1. افحص logs:

```bash
docker compose -f docker-compose.production.yml logs backend --tail=200
```

2. افحص قاعدة البيانات و Redis.
3. أعد تشغيل backend فقط:

```bash
docker compose -f docker-compose.production.yml restart backend
```

## لوحة السجلات والتصدير

- تعرض لوحة الإدارة في قسم التقارير مخرجات Audit Log وملفات التصدير والنسخ الاحتياطية بدل الاعتماد على فحص الملفات اليدوي فقط.
- يجب أن يكون التصدير من هذه اللوحة محميًا ومقيدًا بالصلاحيات ومُسجلًا في Audit Log.
- أي حدث مراقبة مهم يجب أن يبقى قابلًا للتصفية حسب المدرسة والمستخدم والنوع والفترة الزمنية.

## ماذا أفعل إذا امتلأت قاعدة البيانات أو القرص؟

1. لا تحذف ملفات عشوائيًا.
2. خذ backup فوري.
3. افحص أكبر الجداول.
4. انقل backups القديمة إلى تخزين خارجي.
5. استخدم `rotate-backups.sh` فقط بعد التأكد:

```bash
CONFIRM_ROTATE=yes KEEP_DAYS=30 deploy/scripts/rotate-backups.sh
```

## تنبيه

المراقبة التجارية تحتاج لاحقًا خدمة خارجية مثل Uptime Kuma أو Grafana/Prometheus أو خدمة مراقبة من شركة الاستضافة.
وإذا كان الهدف التجاري جديًا، فاجعل `alerting` والتنبيه الفوري و`replica/failover` جزءًا من النشر، لا جزءًا من التوثيق فقط.
