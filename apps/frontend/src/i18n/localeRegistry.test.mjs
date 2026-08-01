import assert from "node:assert/strict";
import test from "node:test";
import { ar } from "./dictionaries/ar.ts";
import { he } from "./dictionaries/he.ts";
import { buildLocaleRegistry } from "./localeRegistry.ts";
import { isBrokenLocalizedText } from "./translationSafety.ts";

test("buildLocaleRegistry discovers future locale files and protects them with fallback", () => {
  const registry = buildLocaleRegistry({
    "./dictionaries/ar.ts": { ar: { hello: "????", "language.select": "?????" } },
    "./dictionaries/en.ts": { en: { hello: "Hello", "language.select": "Choose language" } },
    "./dictionaries/he.ts": { he: { hello: "????", "language.select": "????" } },
    "./dictionaries/pt.ts": { default: { hello: "OlÃƒÂ¡", "language.select": "Escolher idioma" } }
  });

  assert.equal(registry.dictionaries.ar.hello, "مرحبا");
  assert.equal(registry.dictionaries.he.hello, "שלום");
  assert.equal(registry.dictionaries.ar["language.select"], "اختر اللغة");
  assert.equal(registry.dictionaries.he["language.select"], "בחר שפה");
  assert.equal(registry.dictionaries.pt.hello, "Hello");
  assert.deepEqual(registry.options.map((option) => option.code).sort(), ["ar", "en", "he", "pt"]);
});

test("critical Arabic and Hebrew dictionary entries stay readable", () => {
  const criticalKeys = [
    "app.subtitle",
    "license.title",
    "license.subtitle",
    "license.plan",
    "license.status",
    "license.activeDevices",
    "license.deviceName",
    "dashboard.contactName",
    "language.select",
    "nav.dashboard",
    "nav.teachers",
    "common.save",
    "common.delete",
    "teachers.title"
  ];

  for (const key of criticalKeys) {
    assert.equal(isBrokenLocalizedText(ar[key]), false, key);
    assert.equal(isBrokenLocalizedText(he[key]), false, key);
  }

  assert.equal(ar["nav.dashboard"], "الرئيسية");
  assert.equal(ar["license.title"], "الترخيص");
  assert.equal(ar["license.subtitle"], "إدارة النسخة التجريبية والتفعيل وربط الأجهزة لهذه المدرسة.");
  assert.equal(ar["license.plan"], "الخطة");
  assert.equal(ar["license.status"], "الحالة");
  assert.equal(ar["license.activeDevices"], "الأجهزة النشطة");
  assert.equal(ar["license.deviceName"], "اسم الجهاز");
  assert.equal(ar["dashboard.contactName"], "باسل رموني");
  assert.equal(ar["teachers.searchPlaceholder"], "ابحث عن معلم أو صف أو تخصص...");
  assert.equal(ar["teachers.employeeNumber"], "رقم الموظف");
  assert.equal(ar["teachers.effectiveLoad"], "العبء الفعلي");
  assert.equal(ar["language.select"], "اختر اللغة");
  assert.equal(ar["common.save"], "حفظ");
  assert.equal(he["nav.dashboard"], "ראשי");
  assert.equal(he["license.title"], "רישיון");
  assert.equal(he["license.subtitle"], "ניהול גרסת ניסיון, הפעלה וקישור מכשירים לבית הספר הזה.");
  assert.equal(he["license.plan"], "תוכנית");
  assert.equal(he["license.status"], "מצב");
  assert.equal(he["license.activeDevices"], "מכשירים פעילים");
  assert.equal(he["license.deviceName"], "שם המכשיר");
  assert.equal(he["dashboard.contactName"], "באסל רמוני");
  assert.equal(he["teachers.searchPlaceholder"], "חפש מורה, כיתה או התמחות...");
  assert.equal(he["teachers.employeeNumber"], "מספר עובד");
  assert.equal(he["teachers.effectiveLoad"], "עומס אפקטיבי");
  assert.equal(he["common.save"], "שמירה");
});
