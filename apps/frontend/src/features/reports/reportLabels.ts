import type { AppLanguage } from "../../features/daily/dailyTypes";

export function chartTitle(kind: "classes" | "subjects" | "teachers", language: AppLanguage) {
  if (language === "he") {
    if (kind === "classes") return "תרשים כיתות";
    if (kind === "subjects") return "תרשים מקצועות";
    return "תרשים מורים";
  }
  if (language === "en") {
    if (kind === "classes") return "Classes chart";
    if (kind === "subjects") return "Subjects chart";
    return "Teachers chart";
  }
  if (kind === "classes") return "رسم بياني للصفوف";
  if (kind === "subjects") return "رسم بياني للمواد";
  return "رسم بياني للمعلمين";
}
