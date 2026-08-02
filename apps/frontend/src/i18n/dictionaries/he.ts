import { buildGeneratedLocaleDictionary } from "../localeTranslation.ts";
import { en } from "./en.ts";

export const he: Record<string, string> = buildGeneratedLocaleDictionary(en, "he");

Object.assign(he, {
  "common.none": "אין",
  "users.student": "תלמיד",
  "users.parent": "הורה",
  "users.teacher": "מורה",
  "users.homeroomTeacher": "מחנך הכיתה",
  "gradeEntry.selectSubject": "בחר מקצוע",
  "dashboard.contactName": "באסל רמוני",
  "nav.homeroomPortal": "העמוד שלי",
  "teacherPortal.visible.teacherProgram": "תכנית המורה שלי",
  "homeroomPortal.visibleTitle": "העמוד שלי"
});

Object.assign(he, {
  "users.title": "משתמשים",
  "users.name": "שם",
  "users.username": "שם משתמש",
  "users.password": "סיסמה",
  "users.role": "סוג חשבון",
  "users.fullAdmin": "מנהל מלא",
  "users.teacher": "מחנך",
  "users.homeroomTeacher": "מחנך",
  "users.student": "תלמיד",
  "users.parent": "הורה",
  "users.linkedStudent": "תלמיד מקושר",
  "users.selectStudent": "בחר תלמיד",
  "users.requiredStudent": "יש לבחור תלמיד מקושר",
  "users.readOnly": "קריאה בלבד",
  "users.add": "הוספת משתמש",
  "users.action": "פעולה",
  "users.saving": "שומר...",
  "users.saved": "המשתמש נשמר",
  "users.removed": "המשתמש נמחק",
  "users.required": "יש להזין שם וסיסמה",
  "users.passwordShort": "הסיסמה חייבת לכלול לפחות 6 תווים",
  "users.confirmDelete": "למחוק את המשתמש הזה?",
  "users.duplicate": "שם המשתמש כבר קיים",
  "users.saveFailed": "לא ניתן לשמור. בדוק את הנתונים ונסה שוב."
});

Object.assign(he, {
  "certificates.printPdf": "הדפסה / שמירת PDF"
});

export default he;
