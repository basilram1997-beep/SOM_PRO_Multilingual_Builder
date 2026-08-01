# 44. حالة الوحدات الأساسية

تربط هذه الوثيقة البنود الأساسية في المواصفات بالوضع الحالي داخل المشروع، حتى يكون واضحًا ما هو موجود فعليًا الآن، وما الذي ما زال يعمل بطبقة تشغيلية قديمة، وما الذي أصبح مهيأً للتوحيد لاحقًا.

## الحالة النهائية

- وظائف النظام البيداغوجي: مكتملة ضمن النطاق الحالي.
- الوحدات الأساسية المذكورة أدناه موجودة ومربوطة بالفعل بالواجهة والخلفية.
- ما تبقى هو تحسينات تشغيلية وتجارية أو توحيد طبقات لاحقة، وليس نقصًا وظيفيًا في الأساس.

## 44.1 إدارة الطلاب

- الحالة: مكتملة ومربوطة بالواجهة والخلفية.
- الموجود حاليًا:
  - إنشاء الطالب وتعديله وتعطيله.
  - ربط الطالب بالصف.
  - استيراد الطلاب من Excel.
  - تسجيل عمليات الحفظ والتعديل والحذف في سجل التدقيق.
- ملاحظات:
  - `nationalId` ليس مفتاحًا أساسيًا.
  - `externalId` موجود كحقل احتياطي لاستخدامات لاحقة.
- ملفات مهمة:
  - `apps/backend/src/modules/students/students.routes.ts`
  - `apps/backend/prisma/schema.prisma`
  - `apps/frontend/src/pages/students/StudentsPage.tsx`

هذه الوحدة أصبحت تمثل النواة البيداغوجية الأساسية داخل المشروع، وهي الآن مكتملة من ناحية التشغيل والربط والاختبارات الأساسية.

## 44.2 إدارة الصفوف

- الحالة: موجودة.
- الموجود حاليًا:
  - إنشاء الصف وتعديله وتعطيله.
  - إسناد مربي الصف.
  - ربط الطلاب بالصف.
  - استخدام الصف كمدخل رئيسي للتقارير والجداول.
- ملفات مهمة:
  - `apps/backend/src/modules/classes/classes.routes.ts`
  - `apps/backend/src/modules/homeroom/homeroom.routes.ts`
  - `apps/frontend/src/pages/classes/ClassesPage.tsx`
  - `apps/backend/prisma/schema.prisma`

## 44.3 إدارة المعلمين

- الحالة: موجودة.
- الموجود حاليًا:
  - إنشاء المعلم وتعديله وتعطيله.
  - ربط المعلم بالمستخدم.
  - إسناد المعلم إلى المواد والصفوف.
  - تقييد وصول المعلم بما يتوافق مع الإسناد المسموح له.
- ملفات مهمة:
  - `apps/backend/src/modules/teachers/teachers.routes.ts`
  - `apps/backend/src/services/teacherScope.ts`
  - `apps/frontend/src/pages/teachers/TeachersPage.tsx`
  - `apps/backend/prisma/schema.prisma`

## 44.4 المواد

- الحالة: موجودة.
- الموجود حاليًا:
  - إنشاء المواد.
  - إسناد المواد إلى الصفوف.
  - إسناد المعلمين إلى المواد.
- ملفات مهمة:
  - `apps/backend/src/modules/subjects/subjects.routes.ts`
  - `apps/backend/src/modules/teachers/teachers.routes.ts`
  - `apps/frontend/src/pages/subjects/SubjectsPage.tsx`
  - `apps/backend/prisma/schema.prisma`

## 44.5 الحضور والغياب

- الحالة: موجودة في المسار التشغيلي الحالي، مع طبقة مهيأة للتوسع إلى نموذج أكثر تفصيلاً لاحقًا.
- الموجود حاليًا:
  - تسجيل الحضور حسب الطالب والصف والتاريخ.
  - تحديث سجلات الحضور وأرشفتها.
  - تقارير الحضور حسب الصف واليوم.
  - سجل تدقيق لكل عملية حساسة.
  - إشعارات مرتبطة بالحضور.
- ملاحظات:
  - المسار التشغيلي الحالي يعتمد على `StudentAttendance`.
  - المخطط يحتوي أيضًا على طبقة مستقبلية قابلة للتوسع نحو `Lesson` و`AttendanceRecord`.
- ملفات مهمة:
  - `apps/backend/src/modules/students/students.routes.ts`
  - `apps/backend/src/modules/reports/reports.routes.ts`
  - `apps/backend/src/services/studentNotifications.ts`
  - `apps/backend/prisma/schema.prisma`

## 44.6 العلامات

- الحالة: موجودة.
- الموجود حاليًا:
  - تسجيل العلامات حسب الطالب والصف والمادة والمعلم.
  - خطط علامات بحسب الصف ونوع الشهادة.
  - سجل تدقيق عند الإنشاء والتحديث.
  - تقارير العلامات ضمن المسارات الإدارية.
- ملفات مهمة:
  - `apps/backend/src/modules/students/students.routes.ts`
  - `apps/backend/src/modules/reports/reports.routes.ts`
  - `apps/backend/prisma/schema.prisma`

## 44.7 دفتر الصف

- الحالة: موجود جزئيًا في الصفحة التشغيلية الحالية لدرس اليوم، مع طبقة معيارية مستقبلية في المخطط.
- الموجود حاليًا:
  - إدخال درس اليوم.
  - سجل صفّي مرتبط بالدرس والمعلم والصف والمادة.
  - سجل تدقيق للتعديل والحذف.
- ملاحظات:
  - الطبقة التشغيلية الحالية تعتمد على `TeacherLessonToday`.
  - المخطط يحتوي على `ClassroomLog` كمسار معياري مستقبلي.
- ملفات مهمة:
  - `apps/backend/src/modules/lessons/today.routes.ts`
  - `apps/backend/src/modules/reports/reports.routes.ts`
  - `apps/backend/prisma/schema.prisma`

## 44.8 التقارير

- الحالة: موجودة.
- الموجود حاليًا:
  - تقارير الحضور حسب الصف والطالب.
  - تقارير العلامات.
  - تقارير دفتر الصف.
  - تصدير Excel.
  - تصدير PDF في بعض المسارات التشغيلية.
  - تسجيل طلبات التصدير في قاعدة البيانات.
- ملاحظات:
  - التصدير الحالي يعتمد على المسار التشغيلي في الواجهة/سطح المكتب، مع بنية قاعدة بيانات جاهزة لتخزين سجلات المخرجات.
- ملفات مهمة:
  - `apps/backend/src/modules/reports/reports.routes.ts`
  - `apps/backend/src/services/artifactRecords.ts`
  - `apps/desktop/src/window.js`

## خلاصة

الوحدات الأساسية المذكورة في هذا القسم موجودة فعلًا داخل المشروع ومكتملة ضمن النطاق الحالي.  
الخطوة الطبيعية التالية ليست سد فجوة وظيفية، بل مواصلة التوحيد والتحسين في طبقات التشغيل، والوثائق، وتجربة الاستخدام، والتوسع المستقبلي.
