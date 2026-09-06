# دليل نشر SOM PRO على Production

## الهدف

هذا الدليل مخصص لمالك النظام أو المطور المسؤول عن تشغيل SOM PRO كخدمة SaaS مركزية. مدير المدرسة لا يحتاج هذه الخطوات.

## متطلبات السيرفر

- Linux VPS أو Dedicated Server.
- Docker و Docker Compose.
- ذاكرة 4GB كحد أدنى، ويفضل 8GB عند وجود عدة مدارس.
- مساحة تخزين تبدأ من 40GB مع نسخ احتياطي خارجي.
- دومينات موجهة إلى السيرفر.

## الموقع التجاري الحالي

- الموقع التجاري المعتمد حاليًا هو `https://som-pro.pages.dev/` على Cloudflare Pages.
- الدومين المخصص اختياري وليس blocker للتسليم إلا إذا طلبه العميل تعاقديًا.
- يمكن توجيه backend تحت `https://som-pro.pages.dev/api` وخادم الترخيص تحت `https://som-pro.pages.dev/license` فقط إذا كانت Cloudflare Pages/Workers/Tunnel أو reverse proxy تربط هذه المسارات فعليًا بالخدمات.
- إذا كانت الخدمات على hosts منفصلة، اترك `APP_URL` و`PUBLIC_APP_URL` على `https://som-pro.pages.dev` واضبط `SOM_API_URL` و`SOM_LICENSE_SERVER_URL` و`SOM_PRO_LICENSE_SERVER_URL` على endpoints التشغيل الحقيقية.

## تجهيز ملفات البيئة

انسخ ملفات المثال ثم عدلها على السيرفر:

```bash
cp .env.production.example .env.production
cp apps/backend/.env.production.example apps/backend/.env.production
cp apps/license-server/.env.production.example apps/license-server/.env.production
cp apps/frontend/.env.production.example apps/frontend/.env.production
```

غيّر كل قيم `change-me` إلى أسرار قوية. لا تستخدم أي كلمة مرور افتراضية.

## Redis والـ License Server

لإعداد Redis المشترك بين Backend و License Server، راجع:

- [Redis Settings for Backend + License Server](/C:/Users/asus/Desktop/SOM_PRO_Multilingual_Builder_v1_5_5_Database_ENV_Fixed/docs/REDIS_SETTINGS_BACKEND_LICENSE_SERVER.md)

الملف يوضح القيم المطلوبة في `REDIS_URL` و `LICENSE_REQUEST_BACKING` و `LICENSE_REDIS_URL`، ومتى يُسمح بوضع `memory` محليًا فقط.

## Redis في production

- لا تفتح Redis للعالم الخارجي.
- لا تضف `ports: 6379:6379` في `docker-compose.production.yml`.
- ضع كلمة مرور قوية في `REDIS_PASSWORD` داخل `.env.production`.
- اجعل `REDIS_URL` في `apps/backend/.env.production` يحتوي نفس كلمة المرور:

```env
REDIS_PASSWORD=change-me-strong-redis-password
REDIS_URL=redis://:change-me-strong-redis-password@redis:6379
```

الـ Backend فقط يجب أن يصل إلى Redis عبر شبكة Docker الداخلية.

## PostgreSQL في production

- لا تفتح PostgreSQL للعالم الخارجي.
- لا تضف `ports: 5432:5432` في `docker-compose.production.yml`.
- في التشغيل المحلي فقط، يستخدم `docker-compose.yml` الربط الآمن `127.0.0.1:5432:5432`.
- في الإنتاج، الـ Backend فقط يجب أن يصل إلى PostgreSQL عبر شبكة Docker الداخلية باسم الخدمة `postgres`.

## File upload scanner

- اضبط `SOM_FILE_UPLOAD_SCANNING_ENABLED=true` في production.
- اضبط `SOM_FILE_UPLOAD_SCANNER_URL` على خدمة ClamAV-compatible حقيقية داخل الشبكة الخاصة، مثل `tcp://scanner.internal:3310`.
- لا تستخدم scanner عامًا على الإنترنت، ولا تترك URL فارغًا.
- إذا كان scanner غير متاح أو URL غير صحيح، مسار الرفع يفشل مغلقًا ولا يقبل الملف.
- `docker-compose.production.yml` لا ينشئ scanner تلقائيًا؛ يجب توفيره كخدمة داخلية مدارة أو إضافته صراحة إلى stack التشغيل.

## تشغيل الخدمات

```bash
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up migrate
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```

نفذ خدمة `migrate` قبل تشغيل `backend` في كل نشر production. في `docker-compose.production.yml` ينتظر `backend` اكتمال `migrate` بنجاح، لذلك أي migration فاشلة توقف النشر بدل تشغيل نسخة نصف محدثة.

## Prisma migrations

في التطوير يمكن استخدام `db push`، لكن في production يجب استخدام migrations. ملف `docker-compose.production.yml` يحتوي خدمة `migrate` تعمل مرة واحدة بعد جاهزية PostgreSQL وقبل تشغيل الـ Backend:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up migrate
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```

إذا كنت تشغّل migrations خارج Docker من نسخة source نظيفة، استخدم:

```bash
npm run prisma:migrate:deploy
```

لا تستخدم `prisma db push` على قاعدة production.

## Rollback وقاعدة البيانات

لا يوجد rollback migration تلقائي لكل migration. مسار الرجوع المعتمد في production هو:

1. إيقاف الخدمات التي تكتب على قاعدة البيانات.
2. استعادة backup معروف وسليم حسب [BACKUP_RESTORE_RUNBOOK_AR.md](./BACKUP_RESTORE_RUNBOOK_AR.md).
3. تشغيل `docker compose --env-file .env.production -f docker-compose.production.yml up migrate` على نسخة التطبيق المراد الرجوع إليها.
4. تشغيل الخدمات وفحص `/health` وتسجيل الدخول والترخيص.

لا تعتمد على حذف migration أو تشغيل `db push` كإجراء rollback.

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
curl https://som-pro.pages.dev/
curl https://som-pro.pages.dev/healthz
curl https://som-pro.pages.dev/api/health
curl https://som-pro.pages.dev/license/health
```

## إثبات Cloudflare / Production الخارجي

بعد ربط الدومين في Cloudflare وتشغيل الخدمات، شغّل من جهاز يستطيع الوصول للدومين:

```bash
PRODUCTION_URL=https://som-pro.pages.dev/ npm run production:external:verify
```

الفحص يكتب:

- `reports/security/production-external-evidence.json`
- `reports/security/production-external-evidence.md`

ويتحقق من DNS، وHTTPS redirect، وHSTS، وhealth endpoint، ووجود Cloudflare edge headers، وأن دليل قاعدة البيانات المحلي مغلق بـ `PASS`.

إذا كان الدومين لا يمر عبر Cloudflare عمدًا، استخدم:

```bash
PRODUCTION_EXPECT_CLOUDFLARE=false PRODUCTION_URL=https://som-pro.pages.dev/ npm run production:external:verify
```

## اختبار تسجيل الدخول والترخيص

1. افتح لوحة المالك على `https://som-pro.pages.dev/license` إذا كان مسار الترخيص مربوطًا، أو على URL خادم الترخيص التشغيلي إذا كان منفصلًا.
2. أنشئ ترخيصًا لمدرسة.
3. شغّل نسخة Desktop SaaS مبنية على `https://som-pro.pages.dev/api` إذا كان backend مربوطًا، أو على URL الـ backend التشغيلي إذا كان منفصلًا.
4. أدخل الترخيص وسجل الدخول.
5. راقب عدد الأجهزة المفعلة من لوحة المالك.

## بناء Desktop SaaS ضد production

على جهاز البناء:

```cmd
set SOM_API_URL=https://som-pro.pages.dev/api
set VITE_API_URL=https://som-pro.pages.dev/api
set SOM_LICENSE_SERVER_URL=https://som-pro.pages.dev/license
set SOM_PRO_LICENSE_SERVER_URL=https://som-pro.pages.dev/license
npm run desktop:build:saas
```

ملف التثبيت يظهر داخل:

```text
apps\desktop\release
```

## ملاحظات مهمة

هذه الملفات تجهز النشر، لكنها لا تشتري السيرفر ولا تضبط الدومين تلقائيًا. قبل البيع الحقيقي يجب اختبار clean install، النسخ الاحتياطي، HTTPS، وتوقيع Windows installer.
