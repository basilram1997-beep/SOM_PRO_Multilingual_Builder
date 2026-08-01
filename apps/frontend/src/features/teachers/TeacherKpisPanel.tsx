import { localizeDay } from "../../i18n/displayNames";
import { effectiveLoad } from "./teacherHelpers";
import type { Teacher } from "@som/shared";
import type { AppLanguage, Translate } from "./teacherTypes";

type Props = {
  t: Translate;
  language: AppLanguage;
  form: Teacher;
  lessonsToday: number;
  substitutionsToday: number;
  affectedToday: number;
  weeklyLessons: number;
};

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function TeacherKpisPanel({
  t,
  language,
  form,
  lessonsToday,
  substitutionsToday,
  affectedToday,
  weeklyLessons
}: Props) {
  const preferredDays = (form.preferredDays || []).map((day) => localizeDay(day, language));

  return (
    <div className="teacher-kpis">
      <Metric label={t("teachers.todayLessons")} value={lessonsToday} />
      <Metric label={t("teachers.todaySubstitutions")} value={substitutionsToday} />
      <Metric label={t("teachers.affectionToday")} value={affectedToday} />
      <Metric label={t("teachers.targetLoad")} value={form.targetLoad || 25} />
      <Metric label={t("teachers.employmentRatio")} value={`${form.employmentRatio || 100}%`} />
      <Metric label={t("teachers.releaseHours")} value={form.releaseHours || 0} />
      <Metric label={t("teachers.effectiveLoad")} value={effectiveLoad(form)} />
      <Metric label={t("teachers.weeklyLessons")} value={weeklyLessons} />
      <Metric label={t("teachers.preferredDays")} value={preferredDays.length ? preferredDays.join("، ") : "-"} />
      <Metric
        label={t("teachers.preferredPeriods")}
        value={(form.preferredPeriods || []).length ? (form.preferredPeriods || []).join("، ") : "-"}
      />
    </div>
  );
}
