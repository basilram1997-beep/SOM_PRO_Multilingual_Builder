# SOM PRO

SOM PRO هو نظام مدرسي هجين يجمع بين واجهة ويب، وخادم Backend، وخادم ترخيص مستقل، وتطبيق سطح مكتب Windows.
المشروع مُعد للتشغيل المحلي، ونسخة Local Trial، ونسخة SaaS التجارية.

## Overview

الهدف من المشروع هو إدارة المدرسة من مكان واحد مع الحفاظ على العزل بين المدارس، والترخيص، والجداول، والحضور، والبدائل، والشهادات، وباقي صفحات العمل اليومي.

حزمة الخصوصية والامتثال والاعتماد الخارجي أصبحت جاهزة للمراجعة والاعتماد الخارجي، مع سياسات الخصوصية والاحتفاظ والحذف وسجل القرار وقالب DPA في `docs/`.

### What the project includes

- واجهة أمامية `frontend`
- خادم API وعمليات المدرسة `backend`
- خادم ترخيص `license-server`
- تطبيق سطح مكتب `desktop`
- حزم مشتركة للأنواع والمنطق `packages/shared`

## Tech Stack

- React 18
- Vite
- TypeScript
- Express
- Prisma
- PostgreSQL
- Redis
- Electron
- electron-builder
- Zod
- Lucide React

## Project Structure

```text
apps/
  backend/
  desktop/
  frontend/
  license-server/
packages/
  shared/
assets/
deploy/
docs/
release/
scripts/
web-page/
```

### أهم الملفات

- `apps/frontend/src/` واجهة المستخدم
- `apps/backend/src/` منطق الخادم
- `apps/backend/prisma/schema.prisma` قاعدة البيانات
- `apps/license-server/src/server.js` خادم الترخيص
- `apps/desktop/src/main.js` تشغيل سطح المكتب
- `apps/desktop/installer.nsh` إعدادات المثبت
- `packages/shared/src/` الأنواع والمنطق المشترك

## Getting Started

## أوامر التشغيل الرسمية

لتقليل الالتباس بين السكربتات القديمة والجديدة، استخدم هذه الأوامر كمرجع أساسي:

```bash
npm run clean
npm run local:deps
npm run setup:local
npm run dev:all
npm run check:quick
npm run check:release
npm run e2e:clean
npm run release:doctor
npm run release:prepare
npm run update:dry-run
npm run update:backup
npm run update:safe
```

- `clean`: حذف مخرجات البناء والاختبارات والإصدارات القديمة.
- `local:deps`: فحص PostgreSQL وRedis وتشغيلهما عبر Docker عند الحاجة.
- `setup:local`: تشغيل الاعتمادات المحلية ثم تجهيز قاعدة البيانات.
- `dev:all`: تشغيل خادم الترخيص والـ Backend والـ Frontend معاً.
- `check:quick`: فحص سريع للكود والتنسيق والأنواع.
- `check:release`: فحص إصدار كامل مع اختبارات المتصفح الأساسية والعميقة.
- `e2e:clean`: إيقاف بقايا تشغيل E2E والخوادم القديمة التابعة للمشروع.
- `release:doctor`: تقرير جاهزية التسليم.
- `release:prepare`: تنظيف ثم تقرير جاهزية.
- `update:dry-run`: فحص مسار التحديث بدون لمس قاعدة البيانات.
- `update:backup`: أخذ نسخة backup قبل التحديث فقط.
- `update:safe`: backup ثم migrations ثم فحص صحة ثم rollback تلقائي عند الفشل.

راجع أيضاً:

- `docs/DELIVERY_INDEX.md`
- `docs/USER_INSTALL_CHECKLIST_AR.md`
- `docs/ADMIN_BACKUP_RESTORE_AR.md`
- `docs/RELEASE_PROCESS_AR.md`
- `docs/SAFE_UPDATE_PROCESS_AR.md`
- `docs/TROUBLESHOOTING_AR.md`

### المتطلبات

- Node.js 20+
- npm
- Docker Desktop عند تشغيل Local Trial محليًا أو عند رغبتك بتشغيل PostgreSQL/Redis تلقائياً
- PostgreSQL وRedis، أو Docker Desktop ليشغلهما الأمر `npm run local:deps`
- Windows عند بناء أو تجربة مثبت سطح المكتب

### التثبيت

```bash
npm install
```

### إعداد البيئة

الملفات المرجعية موجودة في الجذر وفي المجلدات الفرعية الخاصة بكل تطبيق:

- `.env.example`
- `.env.development.example`
- `.env.local-trial.example`
- `.env.saas.example`
- `.env.staging.example`
- `apps/backend/.env.example`
- `apps/frontend/.env.example`
- `apps/license-server/.env.production.example`
- `apps/desktop/.env.saas.production.example`

أهم القيم التي يعتمد عليها المشروع عادة:

- `SOM_RUNTIME_MODE`
- `VITE_API_URL`
- `SOM_API_URL`
- `SOM_LICENSE_SERVER_URL`
- `DATABASE_URL`
- `REDIS_URL`
- `SOM_ENABLE_OPERATOR_HEALTH`
- `VITE_SOM_SHOW_OPERATOR_HEALTH`
- `CORS_ORIGIN`
- `JWT_SECRET`

لا تضع أسرارًا حقيقية داخل Git.

صفحة `صحة التشغيل` مخصصة للدعم الفني والمطورين. لا تظهر للمستخدم النهائي افتراضياً؛ فعّلها فقط عند الحاجة عبر
`SOM_ENABLE_OPERATOR_HEALTH=true` في الـ Backend و`VITE_SOM_SHOW_OPERATOR_HEALTH=true` في الـ Frontend.

### Recommended runtime

- Use Node.js 22.12.0 or newer, matching the repository `.nvmrc` and Electron 42 support.
- Keep npm aligned with the `packageManager` field in `package.json`.

### أول تشغيل محلي

إذا كنت تشغّل المشروع للمرة الأولى على جهاز جديد، اتبع هذا الترتيب:

1. انسخ ملفات البيئة المطلوبة من ملفات المثال.
2. جهز PostgreSQL وRedis. الأمر الرسمي يحاول تشغيلهما عبر Docker إذا لم يكونا يعملان:

   ```bash
   npm run local:deps
   ```

3. أنشئ قاعدة البيانات وفعّل الترحيلات وتهيئة البيانات. يمكن تنفيذ الخطوتين السابقتين معاً عبر:

   ```bash
   npm run setup:local
   ```

   إذا أردت منع التشغيل التلقائي عبر Docker واستخدام PostgreSQL/Redis يدويين فقط، عيّن `SOM_SKIP_LOCAL_DATA_START=true`.

4. شغّل الواجهة الخلفية والواجهة الأمامية:

   ```bash
   npm run dev
   ```

5. إذا احتجت خادم الترخيص المحلي أيضًا، شغّله في نافذة منفصلة:

   ```bash
   npm run dev:license-server
   ```

6. إذا أردت تجربة سطح المكتب محليًا، استخدم:

   ```bash
   npm run desktop:dev
   ```

### ملفات الإعداد المهمة

| الملف                                         | الاستخدام                         |
| --------------------------------------------- | --------------------------------- |
| `.env.example`                                | إعدادات الجذر للوضع المحلي        |
| `.env.development.example`                    | إعدادات التطوير                   |
| `.env.local-trial.example`                    | إعدادات التجربة المحلية           |
| `.env.saas.example`                           | إعدادات SaaS                      |
| `.env.staging.example`                        | إعدادات staging                   |
| `apps/backend/.env.example`                   | إعدادات خادم الـ Backend          |
| `apps/frontend/.env.example`                  | إعدادات الواجهة الأمامية          |
| `apps/license-server/.env.production.example` | إعدادات خادم الترخيص الإنتاجية    |
| `apps/desktop/.env.saas.production.example`   | إعدادات سطح المكتب SaaS الإنتاجية |

### Production Operations Rules

The canonical production reference is [`SALE_READINESS_REPORT.md`](SALE_READINESS_REPORT.md); keep this section as the short operator reminder only.

- Keep local `.env` files on the developer machine only and use the `*.production.example` files on the server.
- Set `APP_ENV=production` and `APP_DEBUG=false` in production.
- Keep the production database separate, use a dedicated least-privilege user, and keep the database port private.
- Run migrations on the production database before users go live and verify Arabic text / RTL after any migration.
- Build and release only from a clean checkout with the committed `package-lock.json` via `npm ci`; do not ship artifacts from a dirty install or a mutated lockfile.
- Install dependencies with `npm install`, build with `npm run build`, and run database setup and migrations with `npm run setup:db`.
- Start the backend and license server with `npm run start -w apps/backend` and `npm run start:license-server`.
- Run `npm run production:check` before opening the system to users.
- Keep the scheduled GitHub Actions release gate enabled so the same checks run automatically on a fixed cadence.
- Use a service manager such as `systemd`, `Docker`, `docker compose` with restart policy, or `PM2` so services restart automatically.
- Never include `.env`, passwords, API keys, real database dumps, logs, temporary test files, `node_modules`, or cache folders in the delivery package.

## Available Scripts

### Development

- `npm run dev`
- `npm run setup:db`
- `npm run dev:license-server`
- `npm run start:license-server`
- `npm run desktop:dev`

### Build

- `npm run build`
- `npm run build:hybrid`
- `npm run desktop:build:win`
- `npm run desktop:build:win:signed`
- `npm run desktop:build:dir:signed`
- `npm run release:build:trial`
- `npm run release:build:saas`

### Validation

- `npm run check`
- `npm run test`
- `npm run test:contracts`
- `npm run test:e2e`
- `npm run test:e2e:browser`
- `npm run test:e2e:browser:headed`
- `npm run test:e2e:browser:install`
- `npm run test:all`
- `npm run release:check`
- `npm run production:check`
- `npm run security:review`

### Browser smoke groups

Use these when you want a quick, ordered browser verification before handoff:

- `npm run test:e2e:browser:smoke:core` - login and navigation
- `npm run test:e2e:browser:smoke:students` - attendance, marks, certificates
- `npm run test:e2e:browser:smoke:daily` - daily program, substitutions, reports, archive
- `npm run test:e2e:browser:smoke` - runs the three groups in sequence

Browser E2E expects the local database stack to be reachable before it starts:

- PostgreSQL on `localhost:5432`
- Redis when the local stack requires it

The browser runner applies Prisma migrations, seeds the E2E school, starts temporary Backend and Frontend processes, waits for `4000/health` and `4188/`, runs Playwright, then stops the temporary services.

### Recent verified checks in this branch

These are the checks we have already confirmed in the current working tree and should now be treated as the live reference point:

- `npm run test:e2e:browser:usability` passed on desktop and mobile.
- `npm run volume:test` passed on the `tiny` and `normal` profiles.
- `node --test --import tsx src/services/migrationUpgradeIntegration.test.ts` passed.
- `npm run stress:test` passed on the login burst and outage recovery path.

### Acceptance matrix

The acceptance matrix below is shared across `README.md`, `HANDOFF.md`, and `SALE_READINESS_REPORT.md`.

| Area                  | Status    | Notes                                                                        |
| --------------------- | --------- | ---------------------------------------------------------------------------- |
| Local run             | Automated | The app starts locally and the main build passes                             |
| Core tests            | Automated | Backend and browser smoke coverage are in place                              |
| Chrome browser        | Automated | Passed in this session                                                       |
| Edge browser          | Automated | Passed in this session                                                       |
| Firefox browser       | Manual    | Not installed on this machine                                                |
| Screen sizes          | Manual    | Still needs a full manual pass                                               |
| School printers       | Manual    | Still needs a full manual pass                                               |
| Slow network          | Manual    | Still needs a full manual pass                                               |
| Older device          | Manual    | Still needs a full manual pass                                               |
| Clean Windows install | Manual    | Still needs a real-device pass                                               |
| Backup / restore      | Complete  | Backup and restore are now formally closed within the current release scope. |

### Stress tests

Use these when you want to verify safe failure under concurrent load:

- `npm run stress:run` - runs login, grades, attendance, reports, and outage simulation together
- `npm run stress:login` - concurrent login burst
- `npm run stress:grades` - concurrent grade save burst with allowed and forbidden users
- `npm run stress:attendance` - concurrent attendance save burst
- `npm run stress:reports` - concurrent report export burst
- `npm run stress:outage` - local fault-injection run that stops the backend during saves

For a real database-shutdown rehearsal, repeat the outage scenario on a staging environment where you can stop the database service explicitly.

## Runtime Modes

- `development` للتطوير المحلي
- `local-trial` للتجربة المحلية
- `saas` للنشر التجاري عبر خادم بعيد

في وضع `saas` لا يفترض أن يحتاج المدير إلى Docker أو Node أو PostgreSQL محليًا.  
في وضع `local-trial` قد تحتاج فقط إلى PostgreSQL وRedis محليين عبر Docker.

## Build and Deployment

### Web / Backend

```bash
npm run setup:db
npm run build
npm run prisma:migrate:deploy -w apps/backend
npm run start -w apps/backend
npm run start:license-server
```

### Local Trial

```bash
docker compose up -d postgres redis
npm run setup:db
npm run dev
```

### Docker and CI/CD

- `docker-compose.yml` يشغّل PostgreSQL وRedis فقط للوضع المحلي.
- `docker-compose.production.yml` ينسّق backend وfrontend وlicense-server وnginx للنشر الإنتاجي.
- `.github/workflows/ci.yml` يشغّل فحوصات الاعتماديات وSAST واللينت والبناء والاختبارات وفحص سطح المكتب وbrowser smoke.

### Delivery Package Rules

يمكن رفع المشروع إلى الخادم عبر Git أو GitHub/GitLab خاص أو SSH/SFTP أو CI/CD أو Docker، بحسب البنية المتاحة.

قواعد الحزمة الآمنة:

- لا تضع `.env` أو أي ملف أسرار داخل الحزمة.
- لا تضع كلمات المرور أو مفاتيح API.
- لا تضع نسخ قاعدة البيانات الحقيقية.
- لا تضع ملفات السجلات أو ملفات الاختبار المؤقتة.
- لا تضع `node_modules`.
- لا تضع مجلدات `cache`.
- اترك الحزمة النهائية تحتوي فقط على الملفات التي يحتاجها الخادم للبناء أو التشغيل أو التسليم.

### Windows Desktop

- Build سطح المكتب من `npm run desktop:build:win`
- Build موقّع عند توفر شهادة التوقيع من `npm run desktop:build:win:signed`
- مثبت الاختبار من `npm run release:build:trial`
- مثبت SaaS من `npm run release:build:saas`
- إذا كان جهاز البناء غير متصل بالشبكة، قد يحتاج electron-builder إلى cache محلي أو اتصال أولي لجلب أدوات NSIS والتوقيع.

### Logging

- سجلات التشغيل المحلية تُحفظ داخل `logs/`.
- لا تضع كلمات مرور أو رموزًا أو بيانات شخصية داخل السجلات.
- عند فشل التهيئة أو تشغيل الخدمات، راجع `logs/sompro-services.log` وملف التشخيص المشار إليه من شاشة البدء.

### Database and backups

- قاعدة البيانات الإنتاجية معتمدة على PostgreSQL.
- لا تستخدم قاعدة بيانات الإنتاج في التطوير.
- راجع `docs/BACKUP_RESTORE_RUNBOOK_AR.md` و`docs/BACKUP_RESTORE_SECURITY_AR.md` قبل أي تسليم رسمي.

### File uploads

- لا توجد ميزة رفع ملفات عامة في MVP الآن.
- إذا أُضيف أو استُخدم endpoint رفع ملفات فعلي لاحقًا، فيجب أن يمر أولًا عبر scanner fail-closed ثم يُقبل أو يُرفض قبل الحفظ، مع التسجيل في السجلات كما هو موضح في `docs/FILE_UPLOAD_SCANNING_POLICY.md`.

### أين تظهر ملفات التثبيت؟

عادة تظهر داخل:

- `release/`
- `apps/desktop/release/`

إذا تغيّر الإخراج، راجع إعدادات `electron-builder` في `apps/desktop`.

## How to Modify the App

### Pages

عدّل الملفات داخل `apps/frontend/src/pages/` عند تغيير صفحة كاملة أو Route.

### Components

عدّل الملفات داخل `apps/frontend/src/components/` أو مجلدات الميزات داخل `apps/frontend/src/features/` عند تغيير مكونات قابلة لإعادة الاستخدام.

### API Calls

عدّل `apps/frontend/src/api/` أو خدمات الميزة ذات العلاقة عند تغيير الاتصال بالخادم.

### Reusable Logic

عدّل `apps/frontend/src/features/` أو `apps/frontend/src/hooks/` أو `apps/frontend/src/utils/` عندما يكون المنطق مشتركًا.

### Constants and Config

عدّل `apps/frontend/src/i18n/` و `apps/frontend/src/config/` وملفات `.env*` عند تغيير النصوص أو الثوابت أو الإعدادات.

### Styles

عدّل `apps/frontend/src/styles/` أو ملفات CSS الخاصة بالصفحات والمكونات عند تغيير الشكل.

### Backend Logic

عدّل `apps/backend/src/` عند تغيير الصلاحيات، المدرسة، الجداول، الترخيص، التقارير، أو التخزين.

### Shared Types

عدّل `packages/shared/src/` عندما يُستخدم نفس النوع أو القاعدة في الواجهة والخادم معًا.

### Desktop and Installer

عدّل `apps/desktop/src/` و `apps/desktop/installer.nsh` و `apps/desktop/package.json` عند تغيير تشغيل Electron أو سلوك المثبت.

### قبل أي تعديل

- اقرأ الملف المرتبط أولًا.
- تأكد أن المنطق غير موجود بالفعل.
- لا تكرر الحلول.
- اجعل التغيير صغيرًا وواضحًا.
- لا تغيّر routes أو API أو متغيرات البيئة أو حقول قاعدة البيانات إلا عند الضرورة.

### بعد أي تعديل

- شغّل lint.
- شغّل الاختبارات المتاحة.
- شغّل build.
- اختبر الصفحة أو الميزة المتأثرة يدويًا.
- حدّث README إذا تغيرت البنية أو الأوامر.

## Manual QA Checklist

- افتح الصفحة الرئيسية وتأكد من أن القائمة الجانبية تعمل.
- سجّل الدخول باستخدام ترخيص صالح.
- افتح صفحة إدخال العلامات وتأكد من اختيار الصف والمادة والقسم.
- أدخل بيانات واحفظها ثم أعد تحميل الصفحة.
- افتح صفحة الشهادات وتأكد من أن المعاينة تعتمد على البيانات المحفوظة.
- صدّر شهادة وتأكد أن الناتج يطابق المعاينة.
- افتح البرنامج اليومي والأرشيف والتقارير وتأكد من عدم ظهور نصوص placeholder.
- بدّل بين العربية والإنجليزية والعبرية وتأكد من وضوح النصوص.
- راجع [browser flows](docs/BROWSER_FLOW_QA_AR.md) على Chrome وEdge وFirefox على الأقل.
- اختبر الشاشة الضيقة والواسعة.
- تأكد أن الحالات الفارغة والخطأ والتحميل تظهر بشكل مفهوم.

## Browser Compatibility

- افحص التطبيق على Chrome وEdge وFirefox وSafari عند الإمكان.
- تأكد من أن النماذج تعمل وأن التخطيط لا ينكسر.
- تأكد من أن التواريخ والأوقات لا تسبب مشاكل واضحة.
- تأكد من أن التخزين المحلي لا يسبب أخطاء عند التحديث أو عند وجود قيم قديمة.

## Troubleshooting

### App does not start

- Check the environment files.
- Make sure PostgreSQL and Redis are running when required.
- Re-run the install step if dependencies are missing.
- Verify the documented Node.js version.

### Frontend cannot connect to the server

- Check `VITE_API_URL` and `SOM_API_URL`.
- Verify that `backend` is running on the expected port.

### Browser E2E does not start

- Run `npm run test:e2e:browser:install` once to install the Playwright browser.
- Verify that `npm run e2e:serve` can start the local backend and frontend.
- Check that PostgreSQL and Redis are available if the local stack depends on them.
- Verify that `license-server` is running when the page depends on it.
- If a fresh machine keeps failing, re-run `npm run setup:db` after the database service is healthy.

### Build fails

- Run `npm run check` first.
- Review TypeScript and lint errors.
- Verify that all required environment files exist.

### Unexpected cached data or stale state

- Clear the local browser storage used by the app.
- Re-open the page after logout or after changing school context.
- Make sure old drafts are not being reused across school changes.

## Known Issues

راجع:

- `KNOWN_ISSUES.md`
- `SALE_READINESS_REPORT.md`
- `docs/API_RESPONSE_CONTRACT_REPORT.md`
- `docs/PRODUCTION_SECURITY_CHECKLIST_AR.md`

## Sale / Handoff Notes

- هذا المشروع ليس نسخة تجريبية فقط، لكنه يحتاج إلى ضبط نهائي قبل البيع التجاري الكامل.
- أهم المراجع للتسليم:
  - `HANDOFF.md`
  - `README_AR.md`
  - `CHANGELOG.md`
  - `SALE_READINESS_REPORT.md`
- `docs/DELIVERY_INDEX.md`
- `docs/LOCAL_STATE_POLICY_AR.md`
- `KNOWN_ISSUES.md`
- `docs/WINDOWS_*.md`

## Admin / Operations Guide

- Who can access it: the backend-enforced administrative roles, not just hidden buttons in the UI.
- Available permissions: school administration, schedules, users, archive, reports, and licensing depending on role.
- Dangerous operations: delete, cancel license, re-activate, export, and restore.
- Before deletion: show a clear confirmation and explain the impact.
- Logs and audit records: keep the current pattern of audit logging and route protection for sensitive actions.
- Admin errors: keep them readable, non-technical, and action-oriented.

## Support and Maintenance Guide

- How to run the project: start from this README and follow the Available Scripts section.
- How to add a feature: begin with the related page or feature, then move shared logic to backend or shared code when needed.
- How to fix a bug: inspect the affected file first, keep the change small, then run check.
- Important files: `apps/frontend/src/`, `apps/backend/src/`, `apps/desktop/src/`, `apps/license-server/src/server.js`.
- How to build production: use the build and release commands listed above.
- How to check common errors: use Troubleshooting first, then verify environment variables and logs.
- Modify carefully: licensing, tenant isolation, daily generation, and certificates.

## Legal and Commercial Notes

This is a practical review checklist, not legal advice.

- A standalone `LICENSE` file was not found during this review.
- Dependencies, fonts, icons, and images should still be reviewed before sale.
- The app handles school and user data, so a Privacy Policy is recommended before broad deployment.
- Terms of Use are also recommended if the product will be sold or licensed externally.
- Demo or seed data should be removed from production flows or kept only in clearly documented test paths.
- Verify that no branding, artwork, or assets come from unknown sources before commercial handoff.
- See [Asset and License Review](docs/ASSET_AND_LICENSE_REVIEW_AR.md) for the current asset inventory and review notes.

## MVP Scope and Future Readiness

- The MVP includes no AI features.
- The current architecture is organized for later expansion into IDM, secure vault flows, timetable systems, and a parent portal without rewriting the core product.
- The Hebrew and Arabic interfaces are treated as first-class RTL languages in the UI layer, with direction handling and translation fallbacks already in place.
- The default seed is intentionally empty of demo schools, teachers, students, schedules, or daily data.

## Definition of Done

The project is ready only when the following are true as much as possible:

- The app runs locally.
- Build works.
- Lint works or known issues are documented.
- Tests run or a manual checklist is completed.
- There are no critical console errors.
- No secrets are committed in the code.
- README is clear.
- `.env.example` exists when needed.
- Main user flows are checked.
- Loading, error, empty, and success states exist.
- No demo data is visible in production.
- No major unused libraries remain.
- No unnecessarily large files remain.
- Stress testing is documented or marked as not applicable.
- Known issues are documented.
- Sale readiness report exists.

## Final Delivery Checklist

- [ ] App runs locally.
- [ ] Production build succeeds.
- [ ] Lint passes or known issues are documented.
- [ ] Tests pass or manual QA checklist is completed.
- [ ] No secrets are committed.
- [ ] `.env.example` is available if needed.
- [ ] README explains setup, development, build, and modification guide.
- [ ] Stress test is documented or explained as not applicable.
- [ ] Main user flows are tested.
- [ ] Error, loading, empty, and success states are handled.
- [ ] No unused major code remains.
- [ ] No obvious placeholder content remains.
- [ ] Dependencies are reviewed.
- [ ] License and asset risks are documented.
- [ ] Known issues are documented.
- [ ] Sale readiness report is created.

## White-Label / Branding Readiness

- App name: update the branding strings in `apps/frontend/src/i18n/dictionaries/*.ts`, `web-page/index.html`, and `apps/license-server/public/index.html`.
- Logo and favicon: update `assets/brand/` and `apps/frontend/public/favicon.png`.
- Desktop icon: update `apps/desktop/icon.ico`.
- Main colors: update `apps/frontend/src/styles/global.css`.
- If a future client needs a different name or theme, keep repeated values in one place first, then update the mapped UI strings.

## Documentation Map

### Core handoff

- `HANDOFF.md` ملخص عملي للمطور القادم
- `README_AR.md` نسخة عربية مختصرة للتشغيل السريع
- `CHANGELOG.md` سجل الإصدار
- `SALE_READINESS_REPORT.md` تقرير الجاهزية للبيع

### Operational references

- [docs/CI_CD_AND_RELEASE_PIPELINE_AR.md](docs/CI_CD_AND_RELEASE_PIPELINE_AR.md) خطة CI/CD و release pipeline
- [docs/OPERATIONAL_MATURITY_AND_RUNBOOK_AR.md](docs/OPERATIONAL_MATURITY_AND_RUNBOOK_AR.md) الطبقة التشغيلية والمراقبة والاستعادة
- [docs/BROWSER_E2E_STRATEGY_AR.md](docs/BROWSER_E2E_STRATEGY_AR.md) استراتيجية Playwright / Cypress
- [docs/BROWSER_FLOW_QA_AR.md](docs/BROWSER_FLOW_QA_AR.md) قائمة تحقق المتصفح
- [docs/ASSET_AND_LICENSE_REVIEW_AR.md](docs/ASSET_AND_LICENSE_REVIEW_AR.md) مراجعة الأصول والخطوط والترخيص التجاري

### Supporting reference

- `KNOWN_ISSUES.md` المشاكل المتبقية حسب الأولوية
- `docs/WINDOWS_*.md` أدلة Windows والتثبيت
- ملفات المراحل القديمة ومذكرات الإصلاح التاريخية ليست جزءًا من حزمة التسليم الأساسية.

## Final Note

إذا كان هناك سلوك غير واضح، فافحص الملف نفسه أولًا قبل التخمين.
هذا README مقصود أن يبقى مرجعًا رئيسيًا واحدًا ومختصرًا قدر الإمكان.
