import type { Teacher, TeacherDailyProgram } from "@som/shared";
import type { LanguageCode, TranslationKey } from "../../i18n/i18n";

export type Translate = (key: TranslationKey) => string;
export type AppLanguage = LanguageCode;
export type DailyStatusType = "ABSENT" | "LATE" | "LEFT" | "UNAVAILABLE";

export type DailyStatusDraft = {
  teacherId: string;
  type: DailyStatusType;
  fromPeriod: number;
  toPeriod: number;
  reason?: string | null;
};

export type DailyEventForm = {
  type: string;
  fromPeriod: number;
  toPeriod: number;
  classIds: string[];
  note: string;
};

export type NamedEntity = { id?: string; name: string; specialty?: string | null };
export type DailyClass = NamedEntity;
export type DailyTeacher = Teacher;
export type DailyEvent = {
  id?: string;
  type?: string;
  class?: { name?: string | null } | null;
  classId?: string | null;
  fromPeriod: number;
  toPeriod: number;
  note?: string | null;
  substituteTeacherId?: string | null;
};
export type DailySubstitution = {
  id?: string;
  classId?: string;
  period: number;
  absentTeacherId?: string;
  substituteTeacherId?: string | null;
  class?: { name?: string | null };
  subject?: { name?: string | null };
  absentTeacher?: { name?: string | null };
  substituteTeacher?: { name?: string | null };
  kind?: string;
  lessonType?: string;
};
export type DailyBaseSlot = {
  classId: string;
  period: number;
  class: { id?: string; name: string };
  subject?: { name?: string | null } | null;
  teacher?: { id?: string; name: string } | null;
  teacherId?: string;
  room?: string | null;
  className?: string | null;
  subjectName?: string | null;
  teacherName?: string | null;
};
export type DailyDuty = {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  place: string;
  notes?: string | null;
  affected?: boolean;
  affectedReason?: string | null;
  teacher?: { id?: string; name: string } | null;
};
export type TeacherProgram = TeacherDailyProgram;
