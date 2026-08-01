# دليل نشر SOM PRO على Production

## الهدف

هذا الدليل مخصص لمالك النظام أو المطور المسؤول عن تشغيل SOM PRO كخدمة SaaS مركزية. مدير المدرسة لا يحتاج هذه الخطوات.

## متطلبات السيرفر

- Linux VPS أو Dedicated Server.
- Docker و Docker Compose.
- ذاكرة 4GB كحد أدنى، ويفضل 8GB عند وجود عدة مدارس.
- مساحة تخزين تبدأ من 40GB مع نسخ احتياطي خارجي.
- دومينات موجهة إلى السيرفر.

## الدومينات المقترحة

- `api.your-domain.com` للـ backend.
- `license.your-domain.com` لخادم الترخيص.
- `app.your-domain.com` للواجهة web.

## تجهيز ملفات البيئة

انسخ ملفات المثال ثم عدلها على السيرفر:

```bash
cp .env.production.example .env.production
cp apps/backend/.env.production.example apps/backend/.env.production
cp apps/license-server/.env.production.example apps/license-server/.env.production
cp apps/frontend/.env.production.example apps/frontend/.env.production
```

غيّر كل قيم `change-me` إلى أسرار قوية. لا تستخدم أي كلمة مرور افتراضية.

## تشغيل الخدمات

```bash
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
```

## Prisma migrations

في التطوير يمكن استخدام `db push`، لكن في production يجب استخدام migrations:

```bash
npm run prisma:migrate:deploy
```

لا تستخدم `prisma db push` على قاعدة production.

## إنشاء أول مدرسة أو seed

بعد تشغيل قاعدة البيانات والخادم، استخدم seed بحذر فقط إذا كان مناسبًا للبيئة:

```bash
npm run prisma:seed -w apps/backend
```

في الإنتاج الحقيقي الأفضل إنشاء المدرسة الأولى عبر أداة إدارية أو سكربت مضبوط.

## تفعيل HTTPS

1. وجه DNS للدومينات الثلاثة إلى السيرفر.
2. شغّل nginx على HTTP أولًا.
3. استخدم Certbot أو لوحة الاستضافة لإصدار الشهادات.
4. عدّل `deploy/nginx/sompro.conf` لإضافة `listen 443 ssl` ومسارات الشهادات.
5. بعد التأكد، فعّل redirect من HTTP إلى HTTPS.

## فحص الصحة

```bash
curl https://api.your-domain.com/health
curl https://license.your-domain.com/health
curl https://app.your-domain.com
```

## اختبار تسجيل الدخول والترخيص

1. افتح لوحة المالك على `https://license.your-domain.com`.
2. أنشئ ترخيصًا لمدرسة.
3. شغّل نسخة Desktop SaaS مبنية على `https://api.your-domain.com`.
4. أدخل الترخيص وسجل الدخول.
5. راقب عدد الأجهزة المفعلة من لوحة المالك.

## بناء Desktop SaaS ضد production

على جهاز البناء:

```cmd
set SOM_API_URL=https://api.your-domain.com
set VITE_API_URL=https://api.your-domain.com
set SOM_LICENSE_SERVER_URL=https://license.your-domain.com
set SOM_PRO_LICENSE_SERVER_URL=https://license.your-domain.com
npm run desktop:build:saas
```

ملف التثبيت يظهر داخل:

```text
apps\desktop\release
```

## ملاحظات مهمة

هذه الملفات تجهز النشر، لكنها لا تشتري السيرفر ولا تضبط الدومين تلقائيًا. قبل البيع الحقيقي يجب اختبار clean install، النسخ الاحتياطي، HTTPS، وتوقيع Windows installer.
