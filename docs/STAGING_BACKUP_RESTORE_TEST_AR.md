# اختبار backup / restore على staging

هذا الاختبار يتأكد أن النسخ الاحتياطي والاسترجاع لا يعيقان التحديث أو التعافي:

1. إنشاء backup جديد.
2. التحقق من manifest وملفات PostgreSQL وlicense data.
3. تنفيذ restore على قاعدة staging أو نسخة اختبار معزولة.
4. التأكد من أن التطبيق يعود للحالة نفسها بعد الاسترجاع.

يجب ألا يمر أي تغيير تجاري أو إنتاجي قبل نجاح هذا المسار مرة واحدة على الأقل في بيئة staging.

## دليل التشفير و RPO/RTO

- يجب تشغيل backup بمتغير `SOM_BACKUP_PASSPHRASE` وعدم قبول أي artifact خام مثل `.sql` أو `.tar.gz` كدليل إنتاجي.
- يجب أن ينتج PostgreSQL backup ملفًا بصيغة `.sql.enc` وملف manifest بصيغة `.manifest.json`.
- يجب أن ينتج license backup ملفًا بصيغة `.tar.gz.enc` وملف manifest بصيغة `.manifest.json`.
- يجب أن يحتوي manifest على `artifactSha256`, `plaintextSha256`, `encrypted: true`, وحقول `targets.rpoMinutes` و`targets.rtoMinutes`.
- القيم الافتراضية قبل اتفاق إنتاجي مختلف: RPO = 60 دقيقة، RTO = 240 دقيقة.
- يجب توثيق زمن بداية restore ونهايته، وحساب هل تحقق RTO، وتوثيق أحدث نقطة بيانات مستعادة للتحقق من RPO.
