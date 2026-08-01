import { Card } from "../../components/ui/Card";
import { localizeClassName, localizeDay } from "../../i18n/displayNames";
import { useI18n } from "../../i18n/i18n";
import { BehaviorPerformanceTable } from "../../features/students/BehaviorPerformanceTable";
import { BehaviorRecordModal } from "../../features/students/BehaviorRecordModal";
import { useBehaviorPerformance } from "../../features/students/useBehaviorPerformance";
import type { AuthUser } from "../auth/LoginPage";

export function BehaviorPerformancePage({ currentUser }: { currentUser: AuthUser }) {
  const { t, language } = useI18n();
  const behavior = useBehaviorPerformance();
  const selectedClassName = behavior.selectedClass
    ? localizeClassName(behavior.selectedClass.name, language)
    : t("common.none");
  const pageTitle = currentUser?.role === "TEACHER" ? t("nav.teacherBehavior") : t("behavior.title");

  return (
    <div className="page student-behavior-page">
      <h2>{pageTitle}</h2>

      <Card title={t("behavior.filterTitle")}>
        <div className="attendance-controls behavior-controls">
          <label>
            {t("common.class")}
            <select value={behavior.classId} onChange={(event) => behavior.setClassId(event.target.value)}>
              <option value="">{t("students.selectClass")}</option>
              {behavior.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {localizeClassName(item.name, language)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("common.date")}
            <input type="date" value={behavior.date} onChange={(event) => behavior.setDate(event.target.value)} />
          </label>
          <label>
            {t("common.day")}
            <input value={localizeDay(behavior.day, language)} readOnly aria-readonly="true" />
          </label>
        </div>
        {behavior.message && (
          <div className="form-message" role="status" aria-live="polite">
            {behavior.message}
          </div>
        )}
      </Card>

      <Card title={t("behavior.summaryTitle")}>
        <div className="attendance-summary behavior-summary">
          <div className="attendance-summary-card">
            <span>{t("behavior.totalRecords")}</span>
            <strong>{behavior.summary.total}</strong>
          </div>
          <div className="attendance-summary-card attendance-summary-present">
            <span>{t("behavior.positive")}</span>
            <strong>{behavior.summary.positive}</strong>
          </div>
          <div className="attendance-summary-card attendance-summary-absent">
            <span>{t("behavior.negative")}</span>
            <strong>{behavior.summary.negative}</strong>
          </div>
        </div>
        <div className="academic-subject-summary behavior-category-summary">
          <h4>{t("behavior.categoryStats")}</h4>
          <div className="table-wrap behavior-category-summary-wrap">
            <table className="behavior-category-table">
              <thead>
                <tr>
                  <th>{t("behavior.category")}</th>
                  <th>{t("behavior.totalRecords")}</th>
                  <th>{t("behavior.positive")}</th>
                  <th>{t("behavior.negative")}</th>
                </tr>
              </thead>
              <tbody>
                {behavior.categorySummary.length === 0 && (
                  <tr>
                    <td colSpan={4}>{t("behavior.noCategoryStats")}</td>
                  </tr>
                )}
                {behavior.categorySummary.map((item) => (
                  <tr key={item.category}>
                    <td>{t(`behavior.categories.${item.category}`) || item.category}</td>
                    <td>{item.total}</td>
                    <td>{item.positive}</td>
                    <td>{item.negative}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <BehaviorPerformanceTable
        t={t}
        rows={behavior.rows}
        loading={behavior.loading}
        savingStudentId={behavior.savingStudentId}
        onEdit={behavior.openEditor}
      />

      {behavior.editingStudent && (
        <BehaviorRecordModal
          t={t}
          language={language}
          row={behavior.editingStudent}
          form={behavior.form}
          day={behavior.day}
          selectedClassName={selectedClassName}
          saving={behavior.savingStudentId === behavior.editingStudent.id}
          canUndo={behavior.canUndo}
          onChange={behavior.setForm}
          onSelectCategory={behavior.updateCategory}
          onSelectTone={behavior.updateTone}
          onUndo={behavior.undoLastChange}
          onSave={behavior.saveRecord}
          onClose={behavior.closeEditor}
        />
      )}
    </div>
  );
}
