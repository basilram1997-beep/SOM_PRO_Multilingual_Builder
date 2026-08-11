# ملخص جاهز للمراجعة الخارجية

هذا الملخص يجهّز SOM PRO لمراجعة أمنية خارجية.  
الهدف هو إعطاء المختبر صورة سريعة عن الكود، ما يدخل إليه، ما يخرج منه، وما يعتمد عليه من مكتبات.

## الكود الأساسي المراد مراجعته

- [apps/backend/src/modules/students/students.routes.ts](../apps/backend/src/modules/students/students.routes.ts)
- [apps/backend/src/modules/reports/reports.routes.ts](../apps/backend/src/modules/reports/reports.routes.ts)
- [apps/backend/src/services/studentNotifications.ts](../apps/backend/src/services/studentNotifications.ts)
- [apps/backend/src/services/artifactRecords.ts](../apps/backend/src/services/artifactRecords.ts)
- [apps/backend/src/services/securityEventExport.ts](../apps/backend/src/services/securityEventExport.ts)
- [apps/backend/src/services/authService.ts](../apps/backend/src/services/authService.ts)
- [apps/backend/src/services/licenseService.ts](../apps/backend/src/services/licenseService.ts)
- [apps/backend/prisma/schema.prisma](../apps/backend/prisma/schema.prisma)
- [scripts/security-secrets-check.js](../scripts/security-secrets-check.js)
- [scripts/staging-smoke.js](../scripts/staging-smoke.js)
- [scripts/run-e2e-browser.js](../scripts/run-e2e-browser.js)

## المدخلات المتوقعة

- طلبات HTTP بصيغة JSON.
- توكنات جلسة أو Authorization Bearer عند المسارات المحمية.
- `schoolId` أو سياق المدرسة القادم من الطلب.
- معرّفات مثل `studentId` و`classId` و`subjectId` و`teacherId`.
- ملفات مرفوعة في مسارات الرفع والفحص.
- بيانات ترخيص مثل `licenseCode` و`licenseKey`.
- استعلامات تقارير مثل `from` و`to` و`classId` و`subjectId` و`dimension`.

## المخرجات المطلوبة

- ردود JSON داخل `data` في المسارات الناجحة.
- أكواد HTTP واضحة مثل `200` و`201` و`400` و`401` و`403` و`404`.
- سجلات audit عند العمليات الحساسة.
- سجلات إشعارات عند الحضور والتنبيهات الإدارية.
- تقارير export وملفات تحميل عند الحاجة.
- رسائل فشل صريحة عند نقص الصلاحية أو عدم تطابق السياق.

## ما يجب فحصه أمنياً

- صلاحيات كل دور: طالب، ولي أمر، معلم، مربي، مدير، مطور.
- العزل بين المدارس والصفوف والمواد.
- إعادة استخدام التوكنات والجلسات المنتهية.
- التكرار في الحفظ وإعادة الإرسال.
- التصدير والرفع والملفات المؤقتة.
- الترخيص وتجاوزات الجهاز أو الجلسة.
- المسارات الإدارية والتقارير.
- اختبارات الأمان: رصد ثغرات الحقن مثل SQL Injection، ومشاكل المصادقة، والتحقق من المدخلات.

## المكتبات الخارجية المستخدمة

### Runtime

- `express`
- `zod`
- `@prisma/client`
- `prisma`
- `cors`
- `helmet`
- `morgan`
- `ioredis`

### Testing and automation

- `@playwright/test`
- `cypress`
- `concurrently`
- `tsx`

### Build / packaging

- `7zip-bin`
- `app-builder-bin`
- `typescript`
- `prettier`
- `eslint`

## نقاط مختصرة للمختبر

- اختبر السلوك كأن الواجهة غير موثوقة.
- عدّل المعرفات يدوياً في الطلبات.
- أعد إرسال نفس الطلب أكثر من مرة.
- جرّب أدواراً أقل صلاحية على endpoints أعلى صلاحية.
- راقب أي كشف لبيانات مدرسة أخرى أو سجل سابق أو ملف تصدير قديم.
- اعتبر أي رسالة خطأ غامضة أو استجابة صامتة نقطة تستحق التوثيق.

## ملفات داعمة

- [docs/PEN_TEST_SCOPE_AR.md](./PEN_TEST_SCOPE_AR.md)
- [docs/PEN_TEST_EDGE_CASES_AR.md](./PEN_TEST_EDGE_CASES_AR.md)
- [docs/SECURITY_TESTING.md](./SECURITY_TESTING.md)
- [docs/OWASP_TOP_10_AR.md](./OWASP_TOP_10_AR.md)
