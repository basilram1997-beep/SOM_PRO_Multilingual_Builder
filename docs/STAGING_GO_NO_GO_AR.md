# قرار Go / No-Go لـ staging

هذا المستند يختصر قرار الإطلاق التجريبي:

## Go

- health checks تعمل.
- login والتقارير والحضور والنسخ الاحتياطي تعمل.
- operator health تعرض alerting وbackup automation وredundancy بوضوح.

## No-Go

- وجود أخطاء تشغيلية حرجة.
- فشل backup أو restore.
- فشل إقلاع backend أو frontend أو license server.
- ظهور بيانات مختلطة بين المدارس.

إذا كان هناك أي No-Go، فالإطلاق يتوقف حتى يتم الإصلاح وإعادة الفحص.
