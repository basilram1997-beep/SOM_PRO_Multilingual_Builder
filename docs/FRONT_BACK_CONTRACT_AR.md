# عقد التوافق بين Frontend و Backend

هذا الملف هو أهم ضمان لعدم هدم المشروع مستقبلًا.

## القاعدة

الواجهة لا تعدّل البيانات مباشرة.  
كل تعديل يذهب إلى API.

## مثال

### إضافة معلم

Frontend يرسل:

```json
{
  "name": "باسل",
  "specialty": "تاريخ وجغرافيا",
  "targetLoad": 25
}
```

Backend يحفظ ويرجع:

```json
{
  "data": {
    "id": "teacher_id",
    "name": "باسل"
  }
}
```

## البرنامج اليومي

Frontend يرسل الحالات فقط:

```json
{
  "date": "2026-06-27",
  "day": "الاثنين",
  "statuses": [
    {
      "teacherId": "id",
      "type": "ABSENT",
      "fromPeriod": 1,
      "toPeriod": 7
    }
  ]
}
```

Backend يرجع الاستبدالات الجاهزة.

بهذا يبقى منطق الاستبدال داخل الباك إند وليس داخل الواجهة.

## توليد برامج المعلمين اليومية

بعد توليد البرنامج اليومي، تستطيع الواجهة طلب برامج المعلمين:

```http
POST /api/daily/:date/teacher-programs/generate
```

يرجع الباك إند قائمة برامج، كل برنامج يحتوي:

```json
{
  "teacherId": "...",
  "teacherName": "...",
  "status": "غياب كامل أو تأخر أو null",
  "totalOriginalLessons": 4,
  "totalSubstitutions": 1,
  "totalLessons": 5,
  "lessons": [
    {
      "period": 2,
      "className": "العاشر أ / محمود",
      "subjectName": "إنجليزي",
      "lessonType": "ORIGINAL",
      "note": "حصة أصلية"
    },
    {
      "period": 4,
      "className": "التاسع ب / عنان",
      "subjectName": "عربي",
      "lessonType": "SUBSTITUTION",
      "substituteForName": "رولا"
    }
  ]
}
```
