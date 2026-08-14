# تقرير الجاهزية المحلية للاعتماد الوزاري

تاريخ التشغيل: 2026-08-15

الغرض: توثيق ما يمكن إنجازه داخل المشروع الآن، وفصل النواقص الخارجية التي لا يجوز إغلاقها بالكود فقط.

## نتيجة الفحوصات المحلية

| الأمر | النتيجة | ملاحظة |
| --- | --- | --- |
| `npm.cmd run ministry:review-pack` | نجح مع عناصر معلقة | `submissionReady=false` لأن هناك أدلة خارجية ناقصة. |
| `npm.cmd run acceptance:check` | نجح | يحتاج `SOM_E2E_BASE_URL` و `SOM_E2E_API_BASE_URL` عند وجود staging حي. |
| `npm.cmd run security:secrets` | نجح | لا توجد أسرار runtime متتبعة أو أسرار واضحة في الملفات المتتبعة. |
| `npm.cmd run build` | نجح | تم بناء shared/backend/frontend بنجاح. |

## النواقص التي لا تغلق من داخل الكود

| البند | المطلوب لإغلاقه | مكان الأرشفة |
| --- | --- | --- |
| Staging حي على HTTPS | دومين حقيقي، شهادة TLS، تشغيل Docker/Nginx، ثم تشغيل فحوصات DAST وstaging strict. | `reports/security/` و `docs/PHASE_10_STAGING_VERIFICATION_REPORT.md` |
| مصادر الوزارة الرسمية | ملفات أو روابط رسمية من `sapakim.education.gov.il` أو مصدر وزارة معتمد، مع SHA-256 وتاريخ/نسخة. | `docs/official-ministry-standards/` و `docs/MINISTRY_OFFICIAL_STANDARDS_INTAKE.md` |
| تقرير اختراق خارجي موقّع | تقرير من جهة اختبار خارجية مع حالة إعادة الفحص وإغلاق النتائج. | `reports/ministry-review/external-pentest-signed-report.pdf` |

## تجهيز staging على سيرفر HTTPS

1. تجهيز سيرفر Linux عليه Docker وDocker Compose.
2. توجيه `APP_DOMAIN` إلى السيرفر في DNS.
3. نسخ ملفات البيئة من أمثلة production، واستبدال كل القيم الافتراضية بأسرار قوية.
4. ضبط `CORS_ORIGIN` و `SOM_API_URL` و `SOM_LICENSE_SERVER_URL` على نفس دومين HTTPS المستخدم.
5. إصدار الشهادة:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml --profile certbot run --rm certbot
```

6. تشغيل الخدمات:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

7. تطبيق migrations على قاعدة staging:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec backend npm run prisma:migrate:deploy
```

8. تشغيل أدلة الاعتماد الحية بعد اكتمال النشر:

```bash
STAGING_URL=https://your-domain.example ZAP_USE_DOCKER=true npm run security:dast
STAGING_URL=https://your-domain.example STAGING_EVIDENCE_STRICT=true npm run security:staging-evidence
STAGING_URL=https://your-domain.example STAGING_EVIDENCE_STRICT=true STAGING_EVIDENCE_LIVE_DB=true DATABASE_URL=postgresql://... npm run security:staging-evidence
```

## ضوابط عدم تزوير الجاهزية

- لا يتم تغيير `submissionReady` إلى `true` يدوياً.
- لا يتم اعتماد أي صف `MOS-*` قبل أرشفة المصدر الرسمي وحسابه hash ومراجعته.
- لا يتم استخدام tunnel مؤقت أو localhost كدليل وزارة.
- لا يتم إرفاق أسرار `.env.production` في أي تقرير.
