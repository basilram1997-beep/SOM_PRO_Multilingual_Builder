import type { Teacher } from "@som/shared";
import type { AppLanguage, BaseScheduleSlotWithDetails, TeacherWithAssignments, Translate } from "./teacherTypes";

export type TeacherEditorFormProps = {
  t: Translate;
  language: AppLanguage;
  form: Teacher;
  selected: TeacherWithAssignments | null;
  schoolClasses: { id: string; name: string }[];
  schoolSubjects: { id: string; name: string }[];
  workingDays: string[];
  periodsPerDay: number;
  lessonsToday: (teacherId?: string) => number;
  weeklyLessons: (teacherId?: string) => number;
  weeklySlots: BaseScheduleSlotWithDetails[];
  substitutionsToday: (teacherId?: string) => number;
  affectedToday: (teacherId?: string) => number;
  onFormChange: (teacher: Teacher) => void;
  onSave: () => void;
  onNewTeacher: () => void;
  onRemove: () => void;
  onRemoveAssignment?: (assignmentId: string) => void;
  onAssignmentWeeklyPeriodsChange?: (assignmentId: string, weeklyPeriods: number) => void;
  onAddAssignment?: (classId: string, subjectId: string, weeklyPeriods: number) => void;
};
