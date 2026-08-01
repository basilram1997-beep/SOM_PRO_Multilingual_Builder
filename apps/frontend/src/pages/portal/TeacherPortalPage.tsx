import { Card } from "../../components/ui/Card";
import { useI18n } from "../../i18n/i18n";
import type { AuthUser } from "../auth/LoginPage";

const visibleKeys = [
  "teacherPortal.visible.baseSchedule",
  "teacherPortal.visible.dailyProgram",
  "teacherPortal.visible.dutySchedule",
  "teacherPortal.visible.teacherProgram"
] as const;

const workKeys = [
  "teacherPortal.work.grades",
  "teacherPortal.work.behavior",
  "teacherPortal.work.attendance",
  "teacherPortal.work.lessonToday",
  "teacherPortal.work.homework",
  "teacherPortal.work.exams",
  "teacherPortal.work.permissions"
] as const;

export function TeacherPortalPage({ currentUser }: { currentUser: AuthUser }) {
  const { t } = useI18n();

  return (
    <div className="page teacher-portal-page">
      <h2>{t("nav.teacherPortal")}</h2>

      <div className="portal-grid">
        <Card title={t("teacherPortal.visibleTitle")}>
          <p className="muted">{currentUser.name}</p>
          <ul className="portal-bullet-list">
            {visibleKeys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </Card>

        <Card title={t("teacherPortal.workTitle")}>
          <ul className="portal-bullet-list">
            {workKeys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
