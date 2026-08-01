# تقرير عقود API في SOM PRO

## الهدف

تثبيت توقعات Frontend من Backend قبل مرحلة staging حتى لا تتغير أسماء الحقول أو شكل الردود دون قصد.

## الشكل الحالي

معظم endpoints الناجحة ترجع:

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

في الأخطاء، كثير من endpoints ترجع:

```json
{
  "error": "ERROR_CODE",
  "message": "رسالة للمستخدم"
}
```

بعض endpoints قد تضيف حقولًا مثل `conflicts` أو `license` بجانب الخطأ.

## endpoints التي تمت مراجعتها

- `/api/teachers`
- `/api/classes`
- `/api/subjects`
- `/api/settings`
- `/api/schedules`
- `/api/daily`
- `/api/archive`
- `/api/reports`
- `/api/license`

## endpoints المتوافقة مبدئيًا

- teachers
- classes
- subjects
- settings
- schedules
- daily
- archive
- reports
- license

كلها تعتمد غالبًا على `data` للنجاح و `error` للفشل.

## نقاط تحتاج توحيد لاحقًا

- بعض رسائل الخطأ لا تحتوي دائمًا على `message`.
- بعض الردود في 204 لا تحتوي body، وهذا مقبول لكنه يجب توثيقه للواجهة.
- بعض الأخطاء ترجع `conflicts` أو `license` خارج شكل موحد.
- لا يوجد `meta` موحد للصفحات أو العدّ أو وقت السيرفر.

## المعيار المقترح لاحقًا

نجاح:

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

خطأ:

```json
{
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "رسالة واضحة"
  }
}
```

## توصية

لا نغير كل الردود الآن حتى لا نكسر الواجهة. الأفضل في مرحلة لاحقة إضافة helper في backend لتوحيد الردود تدريجيًا، ثم تحديث frontend API client مرة واحدة.
