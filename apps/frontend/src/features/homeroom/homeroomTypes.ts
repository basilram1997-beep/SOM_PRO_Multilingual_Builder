export type HomeroomTeacher = { id: string; name: string };
export type HomeroomClass = { id: string; name: string };
export type HomeroomForm = {
  teacherId: string;
  classId: string;
  weeklyDay: string;
  weeklyPeriod: number;
};
export type HomeroomAssignment = {
  id?: string;
  teacherId: string;
  classId: string;
  weeklyDay?: string | null;
  weeklyPeriod?: number | null;
  isActive?: boolean;
  teacher?: { name?: string | null };
};
