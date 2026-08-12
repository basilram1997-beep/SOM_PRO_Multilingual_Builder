# طبقات الاختبار في SOM PRO

هذا الملف يربط بين مفاهيم الاختبار والأوامر الحالية فقط.

## White-box

الاختبارات التي تنظر داخل الكود والمنطق الداخلي:

- `npm run test:white-box`

يغطي عادة:

- اختبارات الخدمات والمنطق الداخلي في backend
- اختبارات الوحدات في frontend

## Grey-box

الاختبارات التي تعرف البنية الداخلية جزئيًا وتفحص سلوك API أو قاعدة البيانات:

- `npm run test:grey-box`
- `npm run test:grey-box:load`

يغطي عادة:

- اختبارات العقود
- التكامل داخل backend
- مسارات بيانات أثقل عند الحاجة

## Black-box

الاختبارات التي تتعامل مع النظام من الخارج كما يراه المستخدم:

- `npm run test:black-box`

يغطي عادة:

- browser smoke
- usability
- compatibility

## Matrix

لتشغيل الطبقات الثلاث معًا:

```bash
npm run test:matrix
```

## أوامر قريبة ومهمة

- `npm run maintenance:sanity` = فحص E2E سريع لمسار القفل/الدخول والتنقل
- `npm run maintenance:smoke` = smoke browser أوسع
- `npm run regression:quick` = lint + i18n + typecheck + format + tests
- `npm run regression:maintenance` = sanity + smoke
- `npm run regression:release` = release gate + acceptance check
- `npm run check:release` = build + lint + typecheck + format + audit + smoke + deep
- `npm run chaos:test` = outage fault injection with recovery verification
- `npm run redundancy:test` = same outage recovery path with an explicit redundancy label
- `npm run resilience:test` = chaos + redundancy معًا

## ملاحظة عملية

الاختبارات الثقيلة مثل `load:test` و`stress:test` و`volume:test` و`scalability:test` و`reliability:test` تُشغّل منفصلة كي تبقى المقارنة واضحة ولا تختلط مع اختبارات الوحدة أو المتصفح.
اختبار `chaos:test` صار مناسبًا كفحص CI خفيف، بينما `reliability:test` و`soak` يظلان خارج المسار السريع حتى لا نكسر وقت التنفيذ اليومي.
اختبارات المرونة المحلية الأخرى تبقى أيضًا منفصلة إلى أن يكون عندنا failover حقيقي متعدد العقد في staging أو الإنتاج.
