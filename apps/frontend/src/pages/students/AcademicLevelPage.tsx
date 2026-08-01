import { Card } from "../../components/ui/Card";
import { localizeClassName, localizeDay, localizeSubjectName } from "../../i18n/displayNames";
import { useI18n } from "../../i18n/i18n";
import { AcademicLevelTable } from "../../features/students/AcademicLevelTable";
import { AcademicRecordModal } from "../../features/students/AcademicRecordModal";
import { useAcademicLevel } from "../../features/students/useAcademicLevel";

export function AcademicLevelPage() {
  const { t, language } = useI18n();
  const academic = useAcademicLevel();
  const selectedClassName = academic.selectedClass
    ? localizeClassName(academic.selectedClass.name, language)
    : t("common.none");
  const selectedSubjectName = academic.selectedSubject
    ? localizeSubjectName(academic.selectedSubject.name, language)
    : t("common.none");

  return (
    <div className="page student-academic-page">
      <h2>{t("academic.title")}</h2>

      <Card title={t("academic.filterTitle")}>
        <div className="attendance-controls academic-controls">
          <label>
            {t("common.class")}
            <select value={academic.classId} onChange={(event) => academic.setClassId(event.target.value)}>
              <option value="">{t("students.selectClass")}</option>
              {academic.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {localizeClassName(item.name, language)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("common.subject")}
            <select value={academic.subjectId} onChange={(event) => academic.setSubjectId(event.target.value)}>
              <option value="">{t("academic.selectSubject")}</option>
              {academic.subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {localizeSubjectName(item.name, language)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("common.date")}
            <input type="date" value={academic.date} onChange={(event) => academic.setDate(event.target.value)} />
          </label>
          <label>
            {t("common.day")}
            <input value={localizeDay(academic.day, language)} readOnly aria-readonly="true" />
          </label>
        </div>
        {academic.message && (
          <div className="form-message" role="status" aria-live="polite">
            {academic.message}
          </div>
        )}
      </Card>

      <Card title={t("academic.summaryTitle")}>
        <div className="attendance-summary academic-summary">
          <div className="attendance-summary-card">
            <span>{t("academic.totalRecords")}</span>
            <strong>{academic.summary.total}</strong>
          </div>
          <div className="attendance-summary-card attendance-summary-present">
            <span>{t("academic.positive")}</span>
            <strong>{academic.summary.positive}</strong>
          </div>
          <div className="attendance-summary-card attendance-summary-absent">
            <span>{t("academic.negative")}</span>
            <strong>{academic.summary.negative}</strong>
          </div>
        </div>
        <div className="academic-subject-summary">
          <h4>{t("academic.subjectStats")}</h4>
          <div className="table-wrap academic-subject-summary-wrap">
            <table className="academic-subject-table">
              <thead>
                <tr>
                  <th>{t("common.subject")}</th>
                  <th>{t("academic.totalRecords")}</th>
                  <th>{t("academic.positive")}</th>
                  <th>{t("academic.negative")}</th>
                </tr>
              </thead>
              <tbody>
                {academic.subjectRows.length === 0 && (
                  <tr>
                    <td colSpan={4}>{t("academic.noSubjectStats")}</td>
                  </tr>
                )}
                {academic.subjectRows.map((item) => (
                  <tr key={item.subjectId}>
                    <td>{localizeSubjectName(item.subjectName, language)}</td>
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

      <AcademicLevelTable
        t={t}
        language={language}
        rows={academic.rows}
        loading={academic.loading}
        savingStudentId={academic.savingStudentId}
        onEdit={academic.openEditor}
      />

      {academic.editingStudent && (
        <AcademicRecordModal
          t={t}
          language={language}
          row={academic.editingStudent}
          form={academic.form}
          day={academic.day}
          selectedClassName={selectedClassName}
          selectedSubjectName={selectedSubjectName}
          saving={academic.savingStudentId === academic.editingStudent.id}
          onChange={academic.setForm}
          onSave={academic.saveRecord}
          onClose={academic.closeEditor}
        />
      )}
    </div>
  );
}
