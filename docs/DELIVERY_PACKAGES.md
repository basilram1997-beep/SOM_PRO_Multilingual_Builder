# Delivery Packages

هذا الملف هو المرجع الرسمي لما يجب أن يكون قابلًا للتسليم من المستودع، وما يجب أن يبقى خارج Git ويعاد توليده عند الحاجة.

## Source Handoff Package

الغرض: تسليم المشروع للمبرمجين بحيث يمكنهم عمل `clean clone` والحصول على نفس baseline المصدرية.

يجب أن يحتوي:

- كود التطبيقات تحت `apps/`.
- كود الحزم المشتركة تحت `packages/`.
- طبقات الترخيص الجديدة في backend.
- بنية `license-server` المفككة: routes, security, policy, store, request protection, runtime.
- مشاريع Android وiOS المصدرية المطلوبة للبناء.
- أصول mobile المصدرية المتتبعة داخل `android/`, `ios/`, و`assets/`.
- سكربتات التشغيل والاختبار تحت `scripts/`.
- ملفات Docker وdeploy وCI.
- ملفات `.env.example` فقط.
- وثائق التشغيل والاختبار والتسليم تحت `docs/`.
- آخر تقرير تحقق قاعدة بيانات متتبع: `docs/test-reports/database-verification-latest.md`.

يجب ألا يحتوي:

- أي `.env` حقيقي.
- أي secrets أو مفاتيح API أو كلمات مرور.
- `node_modules`.
- مجلدات `dist`, `build`, `coverage`, `reports`, `test-results`, `logs`, `tmp`.
- database dumps مثل `*.sql`, `*.dump`, `*.sqlite`, `*.sqlite3`.
- installers أو package archives generated مثل `site-package.tgz`.
- مجلد `deliverables/` نفسه لأنه output وليس source baseline.

طريقة التحقق:

```powershell
npm run delivery:verify
```

## Publishing Package

الغرض: تجهيز ما يدعم النشر أو الرفع للمتاجر أو مشاركة الأدلة، بدون تسليم كامل كود المصدر إذا كان الهدف فقط النشر.

يجب أن يحتوي عند توليده:

- وثائق النشر والجاهزية.
- ملفات marketing/store copy.
- evidences/reports المطلوبة للمراجعة.
- brand assets والصور التسويقية المطلوبة.
- ملفات deploy الآمنة وملفات `.example` فقط.
- Windows installer من `release/*.exe` عند توفره.
- Android signed output مثل `*.aab` أو `*.apk` عند توفره.
- iOS archive أو `*.ipa` عند توفره.
- أي package نهائي موقّع مطلوب للمتجر.

يجب ألا يحتوي:

- كود المصدر الكامل إذا كان الهدف Publishing فقط.
- أي `.env` حقيقي.
- أي secrets أو database dumps.
- `node_modules`.
- debug logs أو temporary artifacts.
- artifacts غير مطلوبة لمنصة النشر نفسها.

طريقة البناء:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/runtime/build-delivery-packages.ps1
```

## Database Verification

تمت معالجة مشكلة عدم قابلية التحقق بإضافة مسار رسمي:

```powershell
npm run test:db:verify
```

هذا المسار يحضر PostgreSQL/Redis المحليين، يطبق migrations، ثم يشغل اختبارات backend الحرجة واختبارات license-server database flow، ويكتب التقرير إلى:

- `docs/test-reports/database-verification-latest.md`

## Clean Clone Rule

أي ملف source مطلوب للتطوير أو البناء يجب أن يكون tracked في Git. أي ملف generated أو secret-bearing يجب أن يبقى ignored ويعاد توليده من السكربتات.

التحقق الرسمي لهذه القاعدة:

```powershell
npm run delivery:verify
```
