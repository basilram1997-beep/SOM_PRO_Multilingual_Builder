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

export default he;
