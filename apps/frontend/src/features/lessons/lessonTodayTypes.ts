import type { SchoolClass, Subject, Teacher, TeacherLessonToday as SharedTeacherLessonToday } from "@som/shared";

export type LessonTodayStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type LessonTodayRow = Omit<SharedTeacherLessonToday, "id" | "teacherId" | "classId" | "subjectId"> & {
  id: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  teacher: Pick<Teacher, "id" | "name">;
  class: Pick<SchoolClass, "id" | "name">;
  subject: Pick<Subject, "id" | "name">;
};

export type LessonTodayAssignment = {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  weeklyPeriods: number;
};

export type LessonTodayTeacher = {
  id: string;
  name: string;
  assignments: LessonTodayAssignment[];
};

export type LessonTodayResponse = {
  teacher: { id: string; name: string } | null;
  assignments: LessonTodayAssignment[];
  lessons: LessonTodayRow[];
  summary: {
    total: number;
    notStarted: number;
    inProgress: number;
    completed: number;
  };
};

export type LessonTodayForm = SharedTeacherLessonToday;

export const emptyLessonTodayForm: LessonTodayForm = {
  teacherId: "",
  classId: "",
  subjectId: "",
  date: new Date().toISOString().slice(0, 10),
  day: "",
  period: 1,
  title: "",
  summary: "",
  status: "NOT_STARTED",
  note: "",
  attachments: ""
};
