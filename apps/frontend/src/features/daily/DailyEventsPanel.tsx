import { Card } from "../../components/ui/Card";
import { localizeClassName, localizeDay } from "../../i18n/displayNames";
import type { AppLanguage, DailyClass, DailyEvent, DailyEventForm, Translate } from "./dailyTypes";

type Props = {
  t: Translate;
  language: AppLanguage;
  date: string;
  day: string;
  workingDays: string[];
  periods: number[];
  eventForm: DailyEventForm;
  allClasses: DailyClass[];
  dailyEvents: DailyEvent[];
  onDateChange: (value: string) => void;
  onDayChange: (value: string) => void;
  onEventFormChange: (value: DailyEventForm) => void;
  onToggleClass: (classId: string) => void;
  onSave: () => void;
  onRemove: (id: string) => void;
  eventTypeLabel: (type: string) => string;
};

export function DailyEventsPanel(props: Props) {
  const { t, language, date, day, workingDays, periods, eventForm, allClasses, dailyEvents } = props;
  const eventNotePlaceholder = t("daily.eventNotePlaceholder");
  const saveEventLabel = t("daily.saveEvent");
  const localizedEventNotePlaceholder =
    eventNotePlaceholder === "daily.eventNotePlaceholder"
      ? language === "he"
        ? "תיאור בחינה / פעילות / טיול"
        : language === "ar"
          ? "وصف الامتحان / الفعالية / الرحلة"
          : "Exam / activity / trip description"
      : eventNotePlaceholder;
  const localizedSaveEventLabel =
    saveEventLabel === "daily.saveEvent"
      ? language === "he"
        ? "שמירת אירוע"
        : language === "ar"
          ? "حفظ الفعالية"
          : "Save event"
      : saveEventLabel;
  return (
    <Card>
      <div className="form-row daily-event-form">
        <input type="date" value={date} onChange={(e) => props.onDateChange(e.target.value)} />
        <select value={day} onChange={(e) => props.onDayChange(e.target.value)}>
          {workingDays.map((d) => (
            <option key={d} value={d}>
              {localizeDay(d, language)}
            </option>
          ))}
        </select>
        <select
          value={eventForm.type}
          onChange={(e) => props.onEventFormChange({ ...eventForm, type: e.target.value })}
        >
          <option value="EXAM">{t("daily.eventExam")}</option>
          <option value="ACTIVITY">{t("daily.eventActivity")}</option>
          <option value="TRIP">{t("daily.eventTrip")}</option>
        </select>
        <select
          value={eventForm.fromPeriod}
          onChange={(e) => props.onEventFormChange({ ...eventForm, fromPeriod: Number(e.target.value) })}
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {t("daily.fromPeriod")} {p}
            </option>
          ))}
        </select>
        <select
          value={eventForm.toPeriod}
          onChange={(e) => props.onEventFormChange({ ...eventForm, toPeriod: Number(e.target.value) })}
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {t("daily.toPeriod")} {p}
            </option>
          ))}
        </select>
        <textarea
          className="event-description-input"
          value={eventForm.note}
          onChange={(e) => props.onEventFormChange({ ...eventForm, note: e.target.value })}
          placeholder={localizedEventNotePlaceholder}
        />
        <button type="button" onClick={props.onSave}>
          {localizedSaveEventLabel}
        </button>
      </div>
      <div className="event-class-picker">
        <button
          type="button"
          className={eventForm.classIds.length === 0 ? "active" : "secondary"}
          onClick={() => props.onEventFormChange({ ...eventForm, classIds: [] })}
        >
          {t("daily.allClasses")}
        </button>
        {allClasses.map((cls) => (
          <button
            type="button"
            key={cls.id}
            className={eventForm.classIds.includes(cls.id || "") ? "active" : "secondary"}
            onClick={() => props.onToggleClass(cls.id || "")}
          >
            {localizeClassName(cls.name, language)}
          </button>
        ))}
      </div>
      <div className="table-wrap daily-events-table">
        <table>
          <thead>
            <tr>
              <th>{t("common.date")}</th>
              <th>{t("common.day")}</th>
              <th>{t("daily.eventType")}</th>
              <th>{t("common.class")}</th>
              <th>{t("common.from")}</th>
              <th>{t("common.to")}</th>
              <th>{t("common.details")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {dailyEvents.length === 0 && (
              <tr>
                <td colSpan={8}>{t("daily.noEvents")}</td>
              </tr>
            )}
            {dailyEvents.map((event) => (
              <tr
                key={
                  event.id || `${event.type || "event"}-${event.fromPeriod}-${event.toPeriod}-${event.classId || "all"}`
                }
              >
                <td>{date}</td>
                <td>{localizeDay(day, language)}</td>
                <td>{props.eventTypeLabel(event.type || "")}</td>
                <td>{event.class?.name ? localizeClassName(event.class.name, language) : t("daily.allClasses")}</td>
                <td>{event.fromPeriod}</td>
                <td>{event.toPeriod}</td>
                <td>{event.note}</td>
                <td>
                  <button className="danger light" onClick={() => event.id && props.onRemove(event.id)}>
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
