import type { SchoolClass, Subject, Teacher, TeacherExam as SharedTeacherExam } from "@som/shared";

export type ExamScheduleRow = Omit<SharedTeacherExam, "id" | "teacherId" | "classId" | "subjectId"> & {
  id: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  teacher: Pick<Teacher, "id" | "name">;
  class: Pick<SchoolClass, "id" | "name">;
  subject: Pick<Subject, "id" | "name">;
  hasConflict: boolean;
  conflictCount: number;
};

export type ExamScheduleAssignment = {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  weeklyPeriods: number;
};

export type ExamScheduleTeacher = {
  id: string;
  name: string;
  assignments: ExamScheduleAssignment[];
};

export type ExamScheduleConflictRow = {
  id: string;
  title: string;
  className: string;
  subjectName: string;
  date: string;
  startTime: string;
  endTime: string;
};

export type ExamScheduleResponse = {
  teacher: { id: string; name: string } | null;
  assignments: ExamScheduleAssignment[];
  exams: ExamScheduleRow[];
  summary: {
    total: number;
    conflicts: number;
  };
};

export type ExamScheduleSaveResponse = {
  exam: ExamScheduleRow;
  conflicts: ExamScheduleConflictRow[];
  warning: string | null;
};

export type ExamScheduleForm = SharedTeacherExam;

export const emptyExamScheduleForm: ExamScheduleForm = {
  teacherId: "",
  classId: "",
  subjectId: "",
  date: new Date().toISOString().slice(0, 10),
  day: "",
  title: "",
  startTime: "",
  endTime: "",
  room: "",
  notes: "",
  instructions: ""
};
