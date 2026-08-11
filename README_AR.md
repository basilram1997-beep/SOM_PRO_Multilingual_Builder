# SOM PRO - ملخص عربي سريع

هذا الملف ليس بديلاً عن [README.md](README.md)، بل هو نقطة بدء مختصرة لمن يريد تشغيل المشروع أو تسليمه بسرعة.

## من أين أبدأ؟

1. [README.md](README.md)
2. [HANDOFF.md](HANDOFF.md)
3. [SALE_READINESS_REPORT.md](SALE_READINESS_REPORT.md)
4. [docs/DELIVERY_INDEX.md](docs/DELIVERY_INDEX.md)
5. [KNOWN_ISSUES.md](KNOWN_ISSUES.md)

## الأوامر الرسمية الحالية

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

## ما تم التحقق منه في هذه النسخة

- اختبار المتصفح `npm run test:e2e:browser:usability` نجح.
- اختبار الحجم `npm run volume:test` نجح على `tiny` و `normal`.
- اختبار الترحيل `migrationUpgradeIntegration.test.ts` نجح.
- اختبار الإجهاد `npm run stress:test` نجح في مسار login / outage recovery.

## ملاحظات مهمة

- النسخ القديمة من المثبت أو ملفات `release/` لا تعتبر مصدر الحقيقة.
- ملفات الأسرار `.env` لا تُرفع إلى Git.
- `README.md` هو المرجع التفصيلي الأساسي، وهذا الملف مجرد اختصار عربي.
- إذا ظهر سلوك قديم أو ملف منسوخ، ارجع إلى `docs/DELIVERY_INDEX.md` لتعرف المرجع الحالي.
