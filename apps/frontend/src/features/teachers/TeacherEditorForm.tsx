import { TeacherKpisPanel } from "./TeacherKpisPanel";
import { TeacherPeriodSummaryTable } from "./TeacherPeriodSummaryTable";
import { TeacherProfileFields } from "./TeacherProfileFields";
import { TeacherWeeklyLoadTable } from "./TeacherWeeklyLoadTable";
import type { TeacherEditorFormProps } from "./teacherEditorTypes";

export function TeacherEditorForm(props: TeacherEditorFormProps) {
  const { t, language, form, selected } = props;

  return (
    <>
      <h3>
        {form.id ? `${t("teachers.editing")}: ${selected ? selected.name : form.name}` : t("teachers.newTeacher")}
      </h3>
      <TeacherProfileFields
        t={t}
        language={language}
        form={form}
        schoolClasses={props.schoolClasses}
        workingDays={props.workingDays}
        periodsPerDay={props.periodsPerDay}
        onFormChange={props.onFormChange}
      />
      <TeacherWeeklyLoadTable
        selected={selected}
        teacherId={form.id}
        weeklySlots={props.weeklySlots}
        schoolClasses={props.schoolClasses}
        schoolSubjects={props.schoolSubjects}
        language={language}
        onRemoveAssignment={props.onRemoveAssignment}
        onWeeklyPeriodsChange={props.onAssignmentWeeklyPeriodsChange}
        onAddAssignment={props.onAddAssignment}
      />
      <TeacherKpisPanel
        t={t}
        language={language}
        form={form}
        lessonsToday={props.lessonsToday(form.id)}
        substitutionsToday={props.substitutionsToday(form.id)}
        affectedToday={props.affectedToday(form.id)}
        weeklyLessons={props.weeklyLessons(form.id)}
      />
      <h3>{t("teachers.byPeriod")}</h3>
      <TeacherPeriodSummaryTable
        t={t}
        lessonsToday={props.lessonsToday(form.id)}
        substitutionsToday={props.substitutionsToday(form.id)}
        affectedToday={props.affectedToday(form.id)}
      />
      <div className="actions">
        <button onClick={props.onSave}>{t("teachers.saveChanges")}</button>
        <button className="secondary" onClick={props.onNewTeacher}>
          {t("teachers.newTeacher")}
        </button>
        {form.id && (
          <button className="danger" onClick={props.onRemove}>
            {t("common.delete")}
          </button>
        )}
      </div>
    </>
  );
}
