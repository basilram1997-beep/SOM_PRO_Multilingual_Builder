import type {
  SchoolClass,
  Subject,
  Teacher,
  TeacherHomework as SharedTeacherHomework,
  TeacherHomeworkSubmission as SharedTeacherHomeworkSubmission
} from "@som/shared";

export type HomeworkPreparationKind = "HOMEWORK" | "PREPARATION";
export type HomeworkSubmissionStatus = "SOLVED" | "UNSOLVED" | "LATE";

export type HomeworkPreparationRow = Omit<SharedTeacherHomework, "id" | "teacherId" | "classId" | "subjectId"> & {
  id: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  teacher: Pick<Teacher, "id" | "name">;
  class: Pick<SchoolClass, "id" | "name">;
  subject: Pick<Subject, "id" | "name">;
};

export type HomeworkPreparationAssignment = {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  weeklyPeriods: number;
};

export type HomeworkPreparationTeacher = {
  id: string;
  name: string;
  assignments: HomeworkPreparationAssignment[];
};

export type HomeworkPreparationStudent = {
  id: string;
  name: string;
  class?: SchoolClass | null;
  submission: HomeworkSubmissionRow | null;
};

export type HomeworkSubmissionRow = Omit<SharedTeacherHomeworkSubmission, "id" | "homeworkId" | "studentId"> & {
  id: string;
  homeworkId: string;
  studentId: string;
};

export type HomeworkPreparationDetailRow = HomeworkPreparationRow & {
  submissions: HomeworkSubmissionRow[];
};

export type HomeworkPreparationResponse = {
  teacher: { id: string; name: string } | null;
  assignments: HomeworkPreparationAssignment[];
  homeworks: HomeworkPreparationRow[];
  summary: {
    total: number;
    homework: number;
    preparation: number;
  };
};

export type HomeworkSubmissionListResponse = {
  homework: HomeworkPreparationDetailRow;
  students: HomeworkPreparationStudent[];
  summary: {
    total: number;
    solved: number;
    unsolved: number;
    late: number;
  };
};

export type HomeworkPreparationForm = SharedTeacherHomework;

export type HomeworkSubmissionForm = Omit<HomeworkSubmissionRow, "id">;

export const emptyHomeworkPreparationForm: HomeworkPreparationForm = {
  teacherId: "",
  classId: "",
  subjectId: "",
  date: new Date().toISOString().slice(0, 10),
  day: "",
  kind: "HOMEWORK",
  title: "",
  description: "",
  dueDate: "",
  attachment: "",
  notes: ""
};

export const emptyHomeworkSubmissionForm: HomeworkSubmissionForm = {
  homeworkId: "",
  studentId: "",
  status: "UNSOLVED",
  note: "",
  grade: ""
};
