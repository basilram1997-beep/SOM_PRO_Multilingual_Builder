import type { DailyBaseSlot, DailyDuty, DailyEvent, DailyStatusDraft, DailySubstitution } from "./dailyTypes";

export type DailyLoadResult = {
  id?: string;
  date?: string;
  day?: string;
  daily?: { id?: string; date?: string; day?: string };
  baseSlots?: DailyBaseSlot[];
  substitutions?: DailySubstitution[];
  statuses?: DailyStatusDraft[];
  events?: DailyEvent[];
  duties?: DailyDuty[];
};

export const defaultWorkingDays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
export const defaultDay = "الاثنين";

export function normalizeDaily(existing: DailyLoadResult | null | undefined) {
  if (!existing) return null;
  return {
    id: existing.id,
    date: existing.date,
    day: existing.day,
    daily: {
      id: existing.daily?.id || existing.id,
      date: existing.daily?.date || existing.date,
      day: existing.daily?.day || existing.day
    },
    baseSlots: existing.baseSlots || [],
    substitutions: existing.substitutions || [],
    statuses: existing.statuses || [],
    events: existing.events || [],
    duties: existing.duties || []
  };
}

export function emptyEventForm() {
  return {
    type: "EXAM" as const,
    fromPeriod: 1,
    toPeriod: 1,
    classIds: [] as string[],
    note: ""
  };
}

export function dailyErrorMessage(value: unknown, fallback: string) {
  if (value instanceof Error) {
    const message = value.message.trim();
    if (message) return message;
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}
