import { Card } from "../../components/ui/Card";
import { DailyDutiesPanel } from "../../features/daily/DailyDutiesPanel";
import { DailyEventsPanel } from "../../features/daily/DailyEventsPanel";
import { DailyFullScheduleTable } from "../../features/daily/DailyFullScheduleTable";
import { DailyStatusForm } from "../../features/daily/DailyStatusForm";
import { DailyStatusList } from "../../features/daily/DailyStatusList";
import { FreeTeachersPanel } from "../../features/daily/FreeTeachersPanel";
import { SubstitutionsTable } from "../../features/daily/SubstitutionsTable";
import { TeacherDailyProgramsPanel } from "../../features/daily/TeacherDailyProgramsPanel";
import { exportSectionPdf } from "../../features/daily/dailyHelpers";
import { confirmAndRecordExport } from "../../features/exports/exportAudit";
import { useDailySchedule } from "../../features/daily/useDailySchedule";
import { useI18n } from "../../i18n/i18n";
import { localizeTeacherName } from "../../i18n/displayNames";
import type { DailySectionKey } from "../../app/main";
import { useEffect, type ReactNode } from "react";
import type { AuthUser } from "../auth/LoginPage";

function DailySectionFrame({
  title,
  hint,
  children,
  sectionId,
  sectionKey
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  sectionId: string;
  sectionKey: DailySectionKey;
}) {
  return (
    <section id={sectionId} className={`daily-section daily-section-shell daily-section-shell--${sectionKey}`}>
      {(title || hint) && (
        <div className="daily-section-shell-header">
          <div>
            {title ? <span className="daily-section-shell-kicker">{title}</span> : null}
            {hint ? <p>{hint}</p> : null}
          </div>
        </div>
      )}
      <div className="daily-section-shell-body">{children}</div>
    </section>
  );
}

export function DailyPage({
  currentUser,
  onArchiveComplete,
  focusSection,
  initialDate
}: {
  currentUser: AuthUser;
  onArchiveComplete?: () => void;
  focusSection?: DailySectionKey;
  initialDate?: string;
}) {
  const { t, language } = useI18n();
  const resolvedInitialDate = initialDate || new Date().toISOString().slice(0, 10);
  const daily = useDailySchedule({ initialDate: resolvedInitialDate, language, onArchiveComplete });
  const isTeacher = currentUser.role === "TEACHER";

  useEffect(() => {
    if (!focusSection) return;
    const target = document.getElementById(`daily-section-${focusSection}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusSection]);

  const activeSection: DailySectionKey = isTeacher
    ? focusSection === "teacherPrograms"
      ? "teacherPrograms"
      : "fullSchedule"
    : focusSection || "fullSchedule";
  const sectionTitleByKey: Record<DailySectionKey, string> = {
    statusInput: t("daily.title"),
    fullSchedule: t("nav.programDaily"),
    duties: t("nav.programDuties"),
    freeTeachers: t("nav.programFreeTeachers"),
    substitutions: t("nav.programSubstitutions"),
    teacherPrograms: t("nav.programTeacher"),
    events: t("nav.programEvents")
  };

  function eventTypeLabel(type: string) {
    if (type === "EXAM") return t("daily.eventExam");
    if (type === "TRIP") return t("daily.eventTrip");
    return t("daily.eventActivity");
  }

  async function exportPdf(
    sectionId: string,
    title: string,
    permission: "manageSchedules" | "manageLessons" = "manageSchedules"
  ) {
    const notice = await confirmAndRecordExport(
      {
        page: "daily",
        title,
        fileName: `${title}-${daily.date}.html`,
        kind: "PDF",
        permission,
        expiresInMinutes: 15
      },
      t("export.privacyWarning")
    );
    if (!notice) return;
    void exportSectionPdf(sectionId, title, notice);
  }

  return (
    <div
      className={`page daily-page daily-page--${activeSection}`}
      data-e2e="daily-page"
      data-daily-section={activeSection}
    >
      {!isTeacher && activeSection === "events" && (
        <DailySectionFrame title={sectionTitleByKey.events} sectionId="daily-section-events" sectionKey="events">
          <DailyEventsPanel
            t={t}
            language={language}
            date={daily.date}
            day={daily.day}
            workingDays={daily.workingDays}
            periods={daily.periods}
            eventForm={daily.eventForm}
            allClasses={daily.allClasses}
            dailyEvents={daily.dailyEvents}
            onDateChange={daily.setDate}
            onDayChange={daily.setDay}
            onEventFormChange={daily.setEventForm}
            onToggleClass={daily.toggleEventClass}
            onSave={daily.saveEvent}
            onRemove={daily.removeEvent}
            eventTypeLabel={eventTypeLabel}
          />
        </DailySectionFrame>
      )}

      {!isTeacher && activeSection === "duties" && (
        <DailySectionFrame title={sectionTitleByKey.duties} sectionId="daily-section-duties" sectionKey="duties">
          <DailyDutiesPanel t={t} language={language} duties={daily.dailyDuties} />
        </DailySectionFrame>
      )}

      {!isTeacher && activeSection === "freeTeachers" && (
        <DailySectionFrame
          title={sectionTitleByKey.freeTeachers}
          sectionId="daily-section-freeTeachers"
          sectionKey="freeTeachers"
        >
          <FreeTeachersPanel
            t={t}
            language={language}
            periods={daily.periods}
            periodDisplay={daily.periodDisplay}
            freeTeachersForPeriod={daily.freeTeachersForPeriod}
            onExport={() => void exportPdf("daily-free-teachers-section", t("nav.programFreeTeachers"))}
          />
        </DailySectionFrame>
      )}

      {activeSection === "fullSchedule" && (
        <DailySectionFrame
          title={sectionTitleByKey.fullSchedule}
          sectionId="daily-section-fullSchedule"
          sectionKey="fullSchedule"
        >
          {!isTeacher ? (
            <Card title={t("daily.title")}>
              <DailyStatusForm
                t={t}
                language={language}
                date={daily.date}
                day={daily.day}
                workingDays={daily.workingDays}
                teachers={daily.teachers}
                teacherId={daily.teacherId}
                type={daily.type}
                fromPeriod={daily.fromPeriod}
                toPeriod={daily.toPeriod}
                reason={daily.reason}
                periods={daily.periods}
                onDateChange={daily.setDate}
                onDayChange={daily.setDay}
                onTeacherChange={daily.setTeacherId}
                onTypeChange={daily.setType}
                onFromPeriodChange={daily.setFromPeriod}
                onToPeriodChange={daily.setToPeriod}
                onReasonChange={daily.setReason}
                onAdd={daily.addStatus}
              />
              <DailyStatusList
                t={t}
                statuses={daily.statuses}
                teacherName={daily.teacherName}
                onRemove={daily.removeStatus}
              />
              <div className="actions">
                <button data-e2e="daily-generate" type="button" onClick={daily.generate}>
                  {t("daily.generate")}
                </button>
                <button data-e2e="daily-archive" type="button" className="secondary" onClick={daily.archiveDay}>
                  {t("archive.archiveToday")}
                </button>
              </div>
            </Card>
          ) : null}
          <DailyFullScheduleTable
            t={t}
            language={language}
            readOnly={isTeacher}
            classes={daily.classes}
            periods={daily.periods}
            periodDisplay={daily.periodDisplay}
            slotFor={daily.slotFor}
            substitutionFor={daily.substitutionFor}
            eventForCell={daily.eventForCell}
            eventTypeLabel={eventTypeLabel}
            onOpenSubstitution={daily.openSubstitutionCell}
            onExport={() => void exportPdf("daily-full-schedule-section", t("daily.fullSchedule"))}
          />
        </DailySectionFrame>
      )}

      {!isTeacher && activeSection === "substitutions" && (
        <DailySectionFrame
          title={sectionTitleByKey.substitutions}
          sectionId="daily-section-substitutions"
          sectionKey="substitutions"
        >
          <SubstitutionsTable
            t={t}
            language={language}
            substitutions={daily.substitutions}
            onExport={() => void exportPdf("daily-substitutions-section", t("daily.substitutions"))}
            onOpenSubstitution={daily.openSubstitutionCell}
          />
        </DailySectionFrame>
      )}

      {activeSection === "teacherPrograms" && (
        <DailySectionFrame
          title={sectionTitleByKey.teacherPrograms}
          sectionId="daily-section-teacherPrograms"
          sectionKey="teacherPrograms"
        >
          <TeacherDailyProgramsPanel
            t={t}
            language={language}
            periods={daily.periods}
            readOnly={isTeacher}
            teacherPrograms={
              isTeacher
                ? daily.teacherPrograms.filter((program) => program.teacherId === currentUser.id)
                : daily.teacherPrograms
            }
            visibleTeacherPrograms={
              isTeacher
                ? daily.teacherPrograms.filter((program) => program.teacherId === currentUser.id)
                : daily.visibleTeacherPrograms
            }
            teacherSearch={isTeacher ? "" : daily.teacherSearch}
            showOnlyBusyTeachers={isTeacher ? true : daily.showOnlyBusyTeachers}
            loadingTeacherPrograms={isTeacher ? false : daily.loadingTeacherPrograms}
            onGenerate={isTeacher ? () => undefined : daily.generateTeacherPrograms}
            onExport={() => void exportPdf("teacher-programs-section", t("daily.teacherPrograms"))}
            onTeacherSearchChange={isTeacher ? () => undefined : daily.setTeacherSearch}
            onShowOnlyBusyTeachersChange={isTeacher ? () => undefined : daily.setShowOnlyBusyTeachers}
          />
        </DailySectionFrame>
      )}

      {!isTeacher && daily.subModal && (
        <div className="modal-backdrop" onClick={() => daily.setSubModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>
              {t("daily.editSubstitute")} {daily.subModal.period}
            </h3>
            <p className="muted">
              {daily.subModal.class?.name} - {daily.subModal.subject?.name} - {t("daily.affectedTeacher")}:{" "}
              {daily.subModal.absentTeacher?.name}
            </p>
            <div className="candidate-list">
              <button
                data-e2e="daily-substitute-none"
                className="secondary full-width"
                onClick={() => daily.applyManualSubstitute(null)}
              >
                {t("daily.noSubstitute")}
              </button>
              {daily.availableTeachersFor(daily.subModal).map((candidate) => (
                <button
                  key={candidate.id}
                  data-e2e={`daily-substitute-option-${candidate.id}`}
                  className="candidate-button"
                  onClick={() => daily.applyManualSubstitute(candidate.id || null)}
                >
                  {localizeTeacherName(candidate.name, language)}
                  <span>{candidate.specialty || t("daily.noSpecialty")}</span>
                </button>
              ))}
            </div>
            <div className="actions">
              <button className="danger" onClick={() => daily.setSubModal(null)}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
