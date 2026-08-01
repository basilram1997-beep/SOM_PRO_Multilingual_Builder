import { Card } from "../../components/ui/Card";
import { localizeClassName, localizeSubjectName, localizeTeacherName } from "../../i18n/displayNames";
import { teacherColorStyle } from "../../utils/teacherColors";
import type { AppLanguage, DailyBaseSlot, DailyClass, DailyEvent, DailySubstitution, Translate } from "./dailyTypes";

type Props = {
  t: Translate;
  language: AppLanguage;
  readOnly?: boolean;
  classes: DailyClass[];
  periods: number[];
  periodDisplay: (period: number) => { name: string; time?: string };
  slotFor: (classId: string, period: number) => DailyBaseSlot | undefined;
  substitutionFor: (classId: string, period: number) => DailySubstitution | undefined;
  eventForCell: (classId: string, period: number) => DailyEvent | undefined;
  eventTypeLabel: (type: string) => string;
  onOpenSubstitution: (substitution: DailySubstitution) => void;
  onExport: () => void;
};

export function DailyFullScheduleTable(props: Props) {
  const {
    t,
    language,
    readOnly,
    classes,
    periods,
    periodDisplay,
    slotFor,
    substitutionFor,
    eventForCell,
    eventTypeLabel,
    onOpenSubstitution,
    onExport
  } = props;
  return (
    <Card
      title={t("daily.fullSchedule")}
      actions={
        !readOnly ? (
          <button className="secondary" onClick={onExport}>
            {t("daily.exportFullSchedule")}
          </button>
        ) : undefined
      }
    >
      <p className="muted">{t("daily.fullScheduleHint")}</p>
      <div className="table-wrap daily-schedule-wrap" id="daily-full-schedule-section">
        <table className="daily-grid-table flipped-daily-grid">
          <thead>
            <tr>
              <th>{t("common.period")}</th>
              {classes.map((cls) => (
                <th key={cls.id}>{localizeClassName(cls.name, language)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classes.length === 0 && (
              <tr>
                <td colSpan={Math.max(2, classes.length + 1)}>{t("daily.emptyTeacherPrograms")}</td>
              </tr>
            )}
            {classes.length > 0 &&
              periods.map((period) => {
                const display = periodDisplay(period);
                return (
                  <tr key={period}>
                    <th className="period-time-header">
                      <strong>{display.name}</strong>
                      {display.time && <span>{display.time}</span>}
                    </th>
                    {classes.map((cls) => {
                      const classId = cls.id || "";
                      const slot = slotFor(classId, period);
                      const sub = substitutionFor(classId, period);
                      const event = eventForCell(classId, period);
                      if (event)
                        return (
                          <td
                            key={classId}
                            data-e2e={`daily-cell-${classId}-${period}`}
                            className={"daily-cell event-cell event-" + String(event.type).toLowerCase()}
                          >
                            <strong>{eventTypeLabel(event.type || "")}</strong>
                            <span>{event.note}</span>
                          </td>
                        );
                      if (!slot)
                        return (
                          <td key={classId} className="free-period">
                            {t("daily.free")}
                          </td>
                        );
                      if (sub)
                        return (
                          <td
                            key={classId}
                            data-e2e={`daily-substitution-cell-${sub.id}`}
                            className="daily-cell substitution-cell teacher-color-cell"
                            style={teacherColorStyle(sub.substituteTeacher || sub.absentTeacher || slot.teacher)}
                            onClick={readOnly ? undefined : () => onOpenSubstitution(sub)}
                            title={readOnly ? undefined : t("daily.editSubstituteHint")}
                          >
                            <strong>{localizeSubjectName(slot.subject?.name || "", language)}</strong>
                            <span className="old-teacher">
                              {t("daily.original")}:{" "}
                              {localizeTeacherName(sub.absentTeacher?.name || slot.teacher?.name || "", language)}
                            </span>
                            <span className="new-teacher">
                              {t("daily.substitute")}:{" "}
                              {sub.substituteTeacher?.name
                                ? localizeTeacherName(sub.substituteTeacher.name, language)
                                : t("daily.noSubstitute")}
                            </span>
                          </td>
                        );
                      return (
                        <td
                          key={classId}
                          data-e2e={`daily-slot-cell-${classId}-${period}`}
                          className="daily-cell teacher-color-cell"
                          style={teacherColorStyle(slot.teacher)}
                        >
                          <strong>{localizeSubjectName(slot.subject?.name || "", language)}</strong>
                          <span>{localizeTeacherName(slot.teacher?.name || "", language)}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
