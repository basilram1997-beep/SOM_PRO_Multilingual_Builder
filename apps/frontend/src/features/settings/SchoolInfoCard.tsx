import { Card } from "../../components/ui/Card";
import { localizeSchoolText } from "../../i18n/displayNames";
import type { AppLanguage } from "../../features/daily/dailyTypes";
import type { SchoolInfo } from "./settingsTypes";

type Props = {
  t: (key: string) => string;
  language: AppLanguage;
  schoolInfo: SchoolInfo;
  message: string;
  onChange: (next: SchoolInfo) => void;
  onSave: () => void;
};

export function SchoolInfoCard({ t, language, schoolInfo, message, onChange, onSave }: Props) {
  return (
    <Card title={t("settings.schoolInfo")}>
      <div className="form school-info-form">
        <label>
          {t("settings.schoolName")}
          <input
            value={localizeSchoolText(schoolInfo.name, language)}
            onChange={(e) => onChange({ ...schoolInfo, name: e.target.value })}
          />
        </label>
        <label>
          {t("settings.managerName")}
          <input
            value={localizeSchoolText(schoolInfo.managerName || "", language)}
            onChange={(e) => onChange({ ...schoolInfo, managerName: e.target.value })}
          />
        </label>
        <label>
          {t("settings.institutionCode")}
          <input
            value={schoolInfo.institutionCode || ""}
            onChange={(e) => onChange({ ...schoolInfo, institutionCode: e.target.value })}
          />
        </label>
        <label>
          {t("settings.address")}
          <input
            value={localizeSchoolText(schoolInfo.address || "", language)}
            onChange={(e) => onChange({ ...schoolInfo, address: e.target.value })}
          />
        </label>
        <button onClick={onSave}>{t("settings.saveSchoolInfo")}</button>
      </div>
      {message && <div className="success">{message}</div>}
    </Card>
  );
}
