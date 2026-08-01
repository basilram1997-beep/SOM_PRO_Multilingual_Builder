import { useRef, useState, type ChangeEvent } from "react";
import { Card } from "../../components/ui/Card";
import { StudentEditorForm } from "../../features/students/StudentEditorForm";
import { StudentsTable } from "../../features/students/StudentsTable";
import { downloadStudentImportTemplate } from "../../features/students/studentImport";
import { downloadStudentExportWorkbook } from "../../features/students/studentExport";
import { useStudents } from "../../features/students/useStudents";
import { studentText } from "../../features/students/studentText";
import { localizeClassName } from "../../i18n/displayNames";
import { useI18n } from "../../i18n/i18n";

export function StudentsPage() {
  const { t, language } = useI18n();
  const students = useStudents();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const currentMoveClass = students.classes.find((item) => item.id === students.movingStudent?.classId) || null;
  const selectedClass = students.classes.find((item) => item.id === students.selectedClassId) || null;
  const selectedClassLabel = selectedClass ? localizeClassName(selectedClass.name, language) : "";
  const pageTitle = studentText(t, language, "students.title", "ملفات الطلاب", "תיקי תלמידים");
  const listTitle = studentText(t, language, "students.listTitle", "الطلاب", "תלמידים");
  const allClassesLabel = studentText(t, language, "students.allClasses", "كل الصفوف", "כל הכיתות");
  const downloadTemplateLabel = studentText(t, language, "students.downloadTemplate", "تنزيل النموذج", "הורדת טופס");
  const filterClassLabel = studentText(t, language, "students.filterClass", "الصف:", "הכיתה:");
  const importStudentsLabel = studentText(t, language, "students.import", "استيراد ملف إكسل", "ייבוא קובץ אקסל");
  const importStudentsBusyLabel = studentText(t, language, "students.importing", "جارٍ الاستيراد...", "מייבא...");
  const exportStudentsLabel = studentText(
    t,
    language,
    "students.exportData",
    "تصدير بيانات الطلاب",
    "ייצוא נתוני תלמידים"
  );
  const exportStudentsBusyLabel = studentText(t, language, "students.exporting", "جارٍ التصدير...", "מייצא...");

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;
    await students.importFromFile(file);
  }

  async function handleExportStudents() {
    if (!students.selectedClassId || students.students.length === 0 || exporting) return;
    setExporting(true);
    try {
      await downloadStudentExportWorkbook({
        classLabel: selectedClassLabel || students.selectedClassId,
        fileNamePrefix: `students-${selectedClassLabel || students.selectedClassId}-${new Date().toISOString().slice(0, 10)}`,
        sheetName: t("students.exportSheet"),
        title: exportStudentsLabel,
        headers: {
          name: t("students.name"),
          nationalId: t("students.nationalId"),
          fatherName: t("students.fatherName"),
          motherName: t("students.motherName"),
          residence: t("students.residence"),
          fatherPhone: t("students.fatherPhone"),
          motherPhone: t("students.motherPhone"),
          guardianPhone: t("students.guardianPhone"),
          healthFund: t("students.healthFund"),
          studentPhone: t("students.studentPhone")
        },
        students: students.students
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page students-page" data-e2e="students-page">
      <h2>{pageTitle}</h2>
      <Card title={listTitle}>
        <div className="student-list-toolbar">
          <label className="student-filter">
            <span>{filterClassLabel}</span>
            <select
              data-e2e="students-class-filter"
              value={students.selectedClassId}
              onChange={(event) => students.setSelectedClassId(event.target.value)}
            >
              <option value="">{allClassesLabel}</option>
              {students.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {localizeClassName(item.name, language)}
                </option>
              ))}
            </select>
          </label>
          <div className="student-list-tools">
            <div className="student-list-count">
              {students.students.length} / {students.allStudents.length}
            </div>
            <button
              type="button"
              data-e2e="students-download-template"
              className="secondary"
              onClick={() => void downloadStudentImportTemplate()}
            >
              {downloadTemplateLabel}
            </button>
            <button
              type="button"
              data-e2e="students-import-button"
              className="secondary"
              onClick={() => importInputRef.current?.click()}
              disabled={!students.selectedClassId || students.importing}
            >
              {students.importing ? importStudentsBusyLabel : importStudentsLabel}
            </button>
            <button
              type="button"
              data-e2e="students-export-button"
              className="secondary"
              onClick={() => void handleExportStudents()}
              disabled={!students.selectedClassId || students.students.length === 0 || exporting}
            >
              {exporting ? exportStudentsBusyLabel : exportStudentsLabel}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx"
              className="hidden-file-input"
              onChange={handleImportFile}
            />
          </div>
        </div>
      </Card>
      <StudentEditorForm
        t={t}
        language={language}
        classes={students.classes}
        form={students.form}
        saving={students.saving}
        message={students.message}
        onChange={students.setForm}
        onSave={students.save}
        onReset={students.reset}
      />
      {students.selectedClassId && (
        <StudentsTable
          t={t}
          language={language}
          students={students.students}
          deletingId={students.deletingId}
          onEdit={students.setForm}
          onDelete={students.remove}
          onMove={students.openMove}
        />
      )}
      {students.movingStudent && (
        <div className="modal-backdrop" onClick={students.closeMove}>
          <div className="modal-card student-move-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{t("students.moveTitle")}</h3>
            <div className="student-move-summary">
              <div>
                <span>{t("students.name")}</span>
                <strong>{students.movingStudent.name}</strong>
              </div>
              <div>
                <span>{t("students.currentClass")}</span>
                <strong>
                  {currentMoveClass ? localizeClassName(currentMoveClass.name, language) : t("common.none")}
                </strong>
              </div>
            </div>
            <label className="student-move-field">
              <span>{t("students.moveTo")}</span>
              <select
                data-e2e="student-move-class"
                value={students.moveClassId}
                onChange={(event) => students.setMoveClassId(event.target.value)}
              >
                <option value="">{t("students.selectClass")}</option>
                {students.classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {localizeClassName(item.name, language)}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-group">
              <button
                type="button"
                data-e2e="student-move-confirm"
                onClick={students.confirmMove}
                disabled={students.saving || !students.moveClassId}
              >
                {t("students.confirmMove")}
              </button>
              <button type="button" data-e2e="student-move-cancel" className="secondary" onClick={students.closeMove}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
