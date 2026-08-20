import { Card } from "../../components/ui/Card";
import { useI18n } from "../../i18n/i18n";
import { TeacherEditorForm } from "../../features/teachers/TeacherEditorForm";
import { TeachersTable } from "../../features/teachers/TeachersTable";
import { useTeachers } from "../../features/teachers/useTeachers";

export function TeachersPage() {
  const { t, language } = useI18n();
  const teachers = useTeachers({ language });

  return (
    <div className="page teachers-page" data-e2e="teachers-page">
      <h2>{t("nav.teachers")}</h2>

      <Card
        title={t("nav.teachers")}
      >
        <TeachersTable
          t={t}
          language={language}
          filtered={teachers.filtered}
          selected={teachers.selected}
          schoolClasses={teachers.schoolClasses}
          query={teachers.query}
          day={teachers.day}
          workingDays={teachers.workingDays}
          lessonsToday={teachers.lessonsToday}
          weeklyLessons={teachers.weeklyLessons}
          substitutionsToday={teachers.substitutionsToday}
          onQueryChange={teachers.setQuery}
          onDayChange={teachers.loadSlots}
          onOpenTeacher={teachers.openTeacher}
          onRemove={teachers.remove}
          onAddTeacher={teachers.newTeacher}
          onEditSelected={() => (teachers.selected ? teachers.setForm(teachers.selected) : alert(t("teachers.select")))}
          onDeleteSelected={() => teachers.remove()}
        />
      </Card>

      <Card title={t("teachers.addEdit")}>
        <TeacherEditorForm
          t={t}
          language={language}
          form={teachers.form}
          selected={teachers.selected}
          schoolClasses={teachers.schoolClasses}
          schoolSubjects={teachers.schoolSubjects}
          workingDays={teachers.workingDays}
          periodsPerDay={teachers.periodsPerDay}
          lessonsToday={teachers.lessonsToday}
          weeklyLessons={teachers.weeklyLessons}
          weeklySlots={teachers.weeklySlots}
          substitutionsToday={teachers.substitutionsToday}
          affectedToday={teachers.affectedToday}
          onFormChange={teachers.setForm}
          onSave={teachers.save}
          onNewTeacher={teachers.newTeacher}
          onRemove={() => teachers.remove()}
          onAddAssignment={teachers.addAssignment}
          onRemoveAssignment={teachers.removeAssignment}
          onAssignmentWeeklyPeriodsChange={teachers.updateAssignmentWeeklyPeriods}
        />
      </Card>
    </div>
  );
}
