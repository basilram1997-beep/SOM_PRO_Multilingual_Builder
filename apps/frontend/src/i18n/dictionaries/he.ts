import { buildReviewedLocaleDictionary } from "../localeTranslation.ts";
import { en } from "./en.ts";

export const he: Record<string, string> = buildReviewedLocaleDictionary(en, "he");

Object.assign(he, {
  "common.skipToContent": "דילוג לתוכן",
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
  "login.title": "כניסה",
  "login.heroAriaLabel": "מידע מערכת",
  "login.heroWelcome": "ברוכים הבאים ל-SOM PRO, פלטפורמת ניהול בית הספר היומית",
  "login.systemStatus": "מצב המערכת",
  "login.systemOnline": "מחובר",
  "login.systemOffline": "לא מחובר",
  "login.licenseCode": "קוד רישיון",
  "login.username": "שם משתמש",
  "login.password": "סיסמה",
  "login.passwordShort": "הסיסמה חייבת לכלול לפחות 6 תווים",
  "login.remember": "שמירת פרטי הכניסה במכשיר זה",
  "login.submit": "כניסה",
  "login.loading": "מתחבר...",
  "login.failed": "שם המשתמש, הסיסמה או קוד הרישיון אינם נכונים",
  "login.missingLicense": "יש להזין תחילה את קוד הרישיון",
  "login.licenseMismatch": "קוד הרישיון אינו תואם לרישיון ההתקנה במכשיר זה. השתמש באותו קוד שהוזן בזמן ההתקנה.",
  "login.createCardTitle": "יצירת חשבון חדש",
  "login.createCardHelp": 'הזן שם, דוא"ל וסיסמה, ואז צור את החשבון ישירות.',
  "login.createCardHint": "אפשר ליצור חשבון תלמיד, הורה, מורה או מחנך כיתה.",
  "login.createRole": "סוג חשבון",
  "login.createStudent": "תלמיד",
  "login.createParent": "הורה",
  "login.createTeacher": "מורה",
  "login.createHomeroomTeacher": "מחנך כיתה",
  "login.createName": "שם החשבון",
  "login.createUsername": 'דוא"ל',
  "login.createPassword": "סיסמה",
  "login.createAccount": "יצירת חשבון",
  "login.createCreating": "יוצר...",
  "login.createSaved": "החשבון נוצר ואפשר להתחבר כעת",
  "login.createFailed": "לא ניתן ליצור את החשבון",
  "login.createRequired": "יש להשלים תחילה את פרטי החשבון",
  "certificates.printPdf": "הדפסה",
  "certificates.previewAction": "הצגת תעודות",
  "certificates.classDetailsTitle": "בחירת כיתה ופרטי תעודה",
  "certificates.studentsSelectionTitle": "בחירת תלמידים",
  "certificates.curriculumType": "סוג תוכנית לימודים",
  "certificates.curriculum.palestinian": "תוכנית לימודים פלסטינית",
  "certificates.curriculum.bagrut": "תוכנית בגרות",
  "certificates.signaturesTitle": "חתימות",
  "nav.mainContent": "תוכן ראשי"
});

export default he;
