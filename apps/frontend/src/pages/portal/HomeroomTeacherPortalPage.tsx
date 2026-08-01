import { Card } from "../../components/ui/Card";
import { useI18n } from "../../i18n/i18n";
import type { AuthUser } from "../auth/LoginPage";

export function HomeroomTeacherPortalPage({ currentUser }: { currentUser: AuthUser }) {
  const { t } = useI18n();
  const displayName = currentUser.name.trim() || currentUser.email.trim();

  return (
    <div className="page teacher-portal-page homeroom-teacher-portal-page">
      <h2>{t("nav.homeroomPortal")}</h2>

      <div className="portal-grid">
        <Card>
          <p className="muted">{displayName}</p>
        </Card>
      </div>
    </div>
  );
}
