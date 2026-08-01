# التنظيم الهندسي للمشروع

هذا الملف يوضح طريقة ترتيب المشروع حتى يكون سهل التطوير مستقبلًا.

## الطبقات

1. الواجهة Frontend
   - مكانها: apps/frontend/src
   - وظيفتها: عرض الصفحات والجداول والأزرار فقط.
   - لا نضع فيها قواعد الجداول الثقيلة.

2. الاتصال بالخادم API
   - مكانه: apps/frontend/src/api
   - أي طلب للخادم يمر من هنا.

3. منطق الجداول والترخيص Backend Services
   - مكانه: apps/backend/src/services
   - أهم الملفات:
     - scheduleRules.ts: قواعد صغيرة قابلة للاختبار.
     - scheduleCoordinator.ts: تنسيق البرنامج اليومي والمربي والأحداث.
     - scheduleBuilder.ts: تحقق البرنامج الثابت.
     - substitutionEngine.ts: توليد الاستبدالات.
     - licenseService.ts: الترخيص والتجربة وربط الجهاز.

4. مسارات الخادم Routes
   - مكانها: apps/backend/src/modules
   - يجب أن تبقى قصيرة، وتستدعي الخدمات بدل أن تحمل المنطق بنفسها.

5. قاعدة البيانات
   - مكانها: apps/backend/prisma/schema.prisma
   - مسؤولة عن الجداول والعلاقات فقط.

6. بوابة المدرسة والتواصل
   - مكانها: يجب أن تكون منفصلة عن النواة التربوية.
   - أي شاشات للأهالي أو الطلاب يجب أن تعتمد على صلاحيات عرض فقط قدر الإمكان.
   - الرسائل والإشعارات والاستدعاءات يجب أن تبقى في طبقة مستقلة لا تحسب الجداول ولا العلامات.

7. الاختبارات
   - مكانها حاليًا: apps/backend/src/services/*.test.ts
   - أي قانون مهم يجب أن يكون له اختبار.

## قواعد كتابة الكود

- الصفحة تعرض فقط، والخدمة تحسب وتقرر.
- لا نكرر نفس القاعدة في أكثر من ملف.
- الأسماء تكون واضحة: generateDailySchedule, validateBaseSchedule, applyHomeroomsToBaseSchedule.
- أي تعديل على منطق الجداول يجب أن يمر من الاختبارات.
- لا نضع نصوصًا مشوهة الترميز داخل الملفات.
- لا ندمج بوابة الأهالي أو الرسائل داخل النواة الأساسية.
- أي ربط مع الوزارة أو بوابة مدرسية يجب أن يمر عبر API منفصل وصلاحيات واضحة وسجل تدقيق.

## أكبر صفحات تحتاج تقسيمًا لاحقًا

- DailyPage.tsx: تقسم إلى DailyStatusPanel, DailyEventsPanel, DailyTables, FreeTeachersTable.
- TeachersPage.tsx: تقسم إلى TeacherForm, TeacherTable, TeacherStats.
- HomeroomPage.tsx: تقسم إلى HomeroomForm, HomeroomBulkActions, HomeroomTable.

## أمر الفحص

npm.cmd run check

هذا الأمر يفحص الخادم والواجهة والاختبارات المتاحة.
