import { useI18n } from "../../i18n/i18n";
import type { AuthUser } from "../auth/LoginPage";
import { StudentMarksPage } from "../students/StudentMarksPage";

function portalTitle(language: string) {
  if (language === "he") return "העמוד האישי";
  if (language === "en") return "Personal page";
  return "الصفحة الشخصية";
}

export function StudentPortalPage({ currentUser }: { currentUser: AuthUser }) {
  const { language } = useI18n();

  return (
    <div className="page student-portal-page">
      <h2>{portalTitle(language)}</h2>
      <p className="student-portal-username">
        <strong>{currentUser.name}</strong>
      </p>
      <StudentMarksPage currentUser={currentUser} />
    </div>
  );
}
