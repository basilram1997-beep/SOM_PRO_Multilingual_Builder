import type { BaseScheduleSlot, Teacher, TeacherAssignment } from "@som/shared";
import type { LanguageCode, TranslationKey } from "../../i18n/i18n";

export type Translate = (key: TranslationKey) => string;
export type AppLanguage = LanguageCode;

export type TeacherAssignmentWithDetails = TeacherAssignment & {
  baseSchedulePeriods?: number;
  class: { id?: string; name: string };
  subject: { id?: string; name: string };
};

export type TeacherWithAssignments = Teacher & {
  assignments?: TeacherAssignmentWithDetails[];
};

export type BaseScheduleSlotWithDetails = BaseScheduleSlot & {
  class?: { id?: string; name?: string | null } | null;
  subject?: { id?: string; name?: string | null } | null;
};

export type DailySubstitutionSummary = {
  absentTeacherId?: string | null;
  substituteTeacherId?: string | null;
};

export type DailyScheduleSummary = {
  substitutions?: DailySubstitutionSummary[];
} | null;
