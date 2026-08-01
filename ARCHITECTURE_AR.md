# بنية SOM PRO

هذا الملف يشرح البنية كما هي الآن داخل المستودع، بشكل مختصر وواضح.

## القاعدة الأساسية

- الواجهة تعرض البيانات وتتلقى تفاعل المستخدم.
- backend يطبق القوانين ويحفظ البيانات ويتحقق من الصلاحيات.
- سطح المكتب Electron يختار بين Trial المحلي وSaaS.
- خادم الترخيص مستقل عن الواجهة الأساسية.

## توزيع المسؤوليات

### Frontend

- عرض صفحات النظام.
- إرسال الطلبات إلى API.
- عرض الجداول والنماذج والتقارير.
- تطبيق الترجمة وRTL/LTR.

### Backend

- التحقق من الدخول والصلاحيات.
- عزل المدارس.
- إدارة المعلمين والصفوف والمواد والإعدادات.
- بناء البرنامج الثابت واليومي.
- إدارة الأرشيف والتقارير والبدائل.
- التعامل مع الترخيص والتفعيل.

### Desktop

- تشغيل الواجهة داخل Electron.
- اختيار الواجهة المناسبة حسب الوضع.
- دعم تشغيل محلي للتجربة أو اتصال SaaS.

### Shared

- الأنواع المشتركة.
- المخططات المشتركة.
- القيم التي يستخدمها frontend وbackend معًا.

## أماكن التعديل

- الواجهة: `apps/frontend/src/`
- backend: `apps/backend/src/`
- سطح المكتب: `apps/desktop/src/`
- الأنواع المشتركة: `packages/shared/src/`
- الترخيص: `apps/license-server/src/server.js`

## ملفات القرار المهمة

- `apps/frontend/src/app/main.tsx`
- `apps/frontend/src/components/layout/Layout.tsx`
- `apps/backend/src/app.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/desktop/src/main.js`
- `apps/desktop/src/runtimeConfig.js`
- `apps/license-server/src/server.js`

## لماذا هذا التقسيم مهم؟

لأنه يجعل كل نوع من التعديل في مكانه الصحيح:

- تعديل واجهة → Frontend
- تعديل قانون أو تحقق → Backend
- تعديل ترخيص → License Server
- تعديل نوع مشترك → Shared
- تعديل تشغيل Windows → Desktop

## ملاحظة

إذا احتجت فهم تدفق ميزة معينة، ارجع إلى README الرئيسي وملفات `docs/PHASE_*.md` بدل الاعتماد على هذا الملف وحده.
