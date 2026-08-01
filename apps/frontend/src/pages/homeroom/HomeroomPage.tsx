import { Card } from "../../components/ui/Card";
import { useI18n } from "../../i18n/i18n";
import { HomeroomAssignmentsTable } from "../../features/homeroom/HomeroomAssignmentsTable";
import { HomeroomEditorPanel } from "../../features/homeroom/HomeroomEditorPanel";
import { useHomeroom } from "../../features/homeroom/useHomeroom";

export function HomeroomPage() {
  const { t, language } = useI18n();
  const homeroomState = useHomeroom();

  return (
    <div className="page homeroom-page">
      <h2>{t("homeroom.title")}</h2>
      <Card title={t("homeroom.cardTitle")}>
        <p className="muted">{t("homeroom.info")}</p>
        <div className="system-note">{t("system.homeroomPriority")}</div>
        <HomeroomEditorPanel
          t={t}
          language={language}
          form={homeroomState.form}
          teachers={homeroomState.teachers}
          classes={homeroomState.classes}
          workingDays={homeroomState.workingDays}
          periods={homeroomState.periods}
          bulkDay={homeroomState.bulkDay}
          bulkPeriod={homeroomState.bulkPeriod}
          conflicts={homeroomState.conflicts}
          teacherIdFromClassName={homeroomState.teacherIdFromClassName}
          onFormChange={homeroomState.setForm}
          onBulkDayChange={homeroomState.setBulkDay}
          onBulkPeriodChange={homeroomState.setBulkPeriod}
          onSelectAll={homeroomState.selectAllClasses}
          onApplyBulkTime={homeroomState.applyBulkTime}
          onSaveHomeroom={homeroomState.saveHomeroom}
          onApplyNoOverwrite={() => homeroomState.applyHomerooms(false)}
          onApplyOverwrite={() => homeroomState.applyHomerooms(true)}
          onToggleClass={homeroomState.toggleClass}
        />
      </Card>

      <Card title={t("homeroom.table")}>
        <HomeroomAssignmentsTable
          t={t}
          language={language}
          classes={homeroomState.classes}
          teachers={homeroomState.teachers}
          homeroomFor={homeroomState.homeroomFor}
          teacherIdFromClassName={homeroomState.teacherIdFromClassName}
          selectedClassIds={homeroomState.selectedClassIds}
          onToggleClass={homeroomState.toggleClass}
          onRemove={homeroomState.removeHomeroom}
        />
      </Card>
    </div>
  );
}
