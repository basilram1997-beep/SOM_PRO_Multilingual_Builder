import { useI18n } from "../../i18n/i18n";
import { DutyEditorForm } from "../../features/duties/DutyEditorForm";
import { DutiesTable } from "../../features/duties/DutiesTable";
import { useDuties } from "../../features/duties/useDuties";
import type { AuthUser } from "../auth/LoginPage";

export function DutiesPage({ currentUser }: { currentUser: AuthUser }) {
  const { t, language } = useI18n();
  const duties = useDuties();
  const isTeacher = currentUser.role === "TEACHER";

  return (
    <div className="page duties-page">
      <h2>{t("duties.title")}</h2>
      {!isTeacher && (
        <div className="grid">
          <DutyEditorForm
            t={t}
            language={language}
            form={duties.form}
            teachers={duties.teachers}
            workingDays={duties.workingDays}
            saving={duties.saving}
            message={duties.message}
            onChange={duties.setForm}
            onSave={duties.save}
            onReset={duties.resetForm}
          />
        </div>
      )}

      <DutiesTable
        t={t}
        language={language}
        rows={duties.sortedRows}
        readOnly={isTeacher}
        onEdit={(row) => duties.setForm(row)}
        onDelete={duties.remove}
      />
    </div>
  );
}
