# جاهزية تثبيت قاعدة البيانات

هذا المسار يهدف إلى جعل تثبيت SOM PRO أوضح عند التسليم التجاري، خصوصاً عندما تكون PostgreSQL غير جاهزة أو Docker Desktop غير مشغل.

## الأوامر الرسمية

```bash
npm run install:doctor
```

يفحص:

- وجود ملف `apps/backend/.env`.
- صحة `DATABASE_URL`.
- صحة `REDIS_URL`.
- وصول PostgreSQL.
- وصول Redis.
- جاهزية Docker عند استخدام التشغيل المحلي.
- وجود `docker-compose.yml`.

```bash
npm run install:prepare
```

يحاول:

- تشغيل PostgreSQL وRedis عبر Docker Compose عند الحاجة.
- انتظار المنافذ الفعلية من `DATABASE_URL` و`REDIS_URL`.
- تنفيذ إعداد قاعدة البيانات والمigrations عبر `npm run setup:db`.

## للتطوير المحلي

استخدم Docker Compose المحلي:

```bash
npm run install:prepare
```

PostgreSQL وRedis مربوطان على `127.0.0.1` فقط، وليس على كل الشبكة. هذا يقلل المخاطر على جهاز المدرسة أو جهاز الفحص.

## للتسليم التجاري

الأفضل أن تكون PostgreSQL خدمة مُدارة أو سيرفر إنتاج مضبوط مسبقاً، ثم توضع قيمة `DATABASE_URL` النهائية في:

```text
apps/backend/.env
```

بعدها شغّل:

```bash
npm run install:doctor
```

لا تعتبر الجهاز جاهزاً إذا ظهر `FAIL` أمام PostgreSQL أو Redis أو `DATABASE_URL`.

## ماذا تغير؟

- لم يعد الفحص يفترض دائماً `localhost:5432`.
- الفحص يقرأ `DATABASE_URL` و`REDIS_URL`.
- Docker ما زال مدعوماً للتطوير، لكنه أصبح مساراً واضحاً لا افتراضاً صامتاً.
- `docker-compose.yml` يحتوي healthchecks ويقيّد PostgreSQL وRedis على الجهاز المحلي.
