# تقرير عقد استجابات API في SOM PRO

تاريخ المراجعة: 2026-09-06

## الهدف

تثبيت الشكل الرسمي لاستجابات Backend حتى يعرف Frontend والمطورون ما هو مضمون، وما هو استثناء مقصود، وما الذي يجب ألا يتغير بدون تحديث اختبارات العقد.

## الحكم الحالي

عقد API الحالي مستقر وقابل للاعتماد للتطوير والتسليم الهندسي.

لا توجد مطالبة حالية بنقل كل الردود إلى شكل جديد مثل `error: { code, message }` لأن ذلك سيكسر الواجهة والعملاء الحاليين. العقد المعتمد في هذه النسخة هو العقد المسطح المستخدم فعليًا في الكود والاختبارات.

## عقد النجاح

معظم ردود النجاح ترجع payload تحت `data`:

```json
{
  "data": {}
}
```

أو:

```json
{
  "data": []
}
```

يجوز أن تكون `data` بقيمة `null` عندما يكون المورد غير موجود لكن الطلب نفسه صحيح ولا يمثل خطأ.

## عقد الخطأ

ردود الخطأ تستخدم كودًا آليًا مستقرًا تحت `error` ورسالة صالحة للعرض أو التشخيص تحت `message` عندما يكون ذلك مناسبًا:

```json
{
  "error": "ERROR_CODE",
  "message": "رسالة واضحة"
}
```

حقول إضافية مثل `conflicts` أو `license` مسموحة فقط كـ details مرتبطة بالخطأ، وليست بديلًا عن `error`.

مثال:

```json
{
  "error": "CLASS_ALREADY_EXISTS",
  "message": "الصف موجود مسبقًا",
  "conflicts": []
}
```

## استثناءات مقصودة

- `204 No Content`: لا يحتوي body، وهذا سلوك HTTP صحيح ومقصود للحذف أو العمليات التي لا تحتاج payload.
- `/health` و`/api/version`: endpoints تشغيلية/تشخيصية وقد ترجع شكلًا مختصرًا خاصًا بها.
- بعض endpoints التشغيلية قد تضيف metadata بجانب `data` عندما تكون جزءًا من payload معروف للواجهة.

## endpoints التي يغطيها العقد

- `/api/auth`
- `/api/teachers`
- `/api/classes`
- `/api/subjects`
- `/api/settings`
- `/api/schedules`
- `/api/daily`
- `/api/archive`
- `/api/reports`
- `/api/audit-logs`
- `/api/security-incidents`
- `/api/schools`
- `/api/students`
- `/api/uploads`
- `/api/license`

## أدلة الاختبار

العقد محمي في:

- `apps/backend/src/services/apiContracts.test.ts`
- `docs/test-reports/database-verification-latest.md`

نتيجة التحقق الأخيرة:

- Backend database-critical suite: `40 pass`, `0 fail`, `0 skipped`.
- License server database flow: `4 pass`, `0 fail`, `0 skipped`.
- Frontend tests: `35 pass`, `0 fail`.
- Lint: `0 errors`, `0 warnings`.
- Dependency audit: `0 vulnerabilities`.

## قواعد تغيير العقد

أي تغيير مستقبلي على شكل الردود يجب أن يلتزم بالآتي:

- تحديث `apiContracts.test.ts`.
- تحديث هذا التقرير.
- تحديث frontend API client إذا تغير شكل `data` أو `error`.
- عدم إزالة `error` المسطح قبل إصدار breaking-change واضح أو compatibility adapter.
- عدم إضافة تفاصيل خطأ حساسة مثل tokens، passwords، database URLs، stack traces، أو license secrets.

## الخلاصة

عقد API ليس عائق تسليم حاليًا. الشكل الحالي موحد بما يكفي للاستخدام والإنتاج المرحلي، والاستثناءات الموجودة موثقة ومقصودة. أي توحيد أعمق إلى envelope جديد يجب أن يتم كـ migration لاحق مخطط، وليس كشرط لإغلاق جاهزية هذه النسخة.
