export type ArchiveRow = {
  id: string;
  date: string;
  day: string;
  updatedAt: string;
  statuses: ArchiveStatus[];
  substitutions: ArchiveSubstitution[];
  events: ArchiveEvent[];
  archiveSnapshot?: ArchiveSnapshot | null;
};

export type ArchiveStatus = {
  id: string;
  type: string;
  label?: string;
  teacher?: { name?: string | null } | null;
  fromPeriod?: number | string | null;
  toPeriod?: number | string | null;
};

export type ArchiveSubstitution = {
  id: string;
  period?: number | string | null;
  kind?: string | null;
  class?: { name?: string | null } | null;
  subject?: { name?: string | null } | null;
  absentTeacher?: { name?: string | null } | null;
  substituteTeacher?: { name?: string | null } | null;
};

export type ArchiveEvent = {
  id: string;
  type?: string | null;
  fromPeriod?: number | string | null;
  toPeriod?: number | string | null;
  note?: string | null;
};

export type ArchiveDuty = {
  id: string;
  startTime?: string | null;
  endTime?: string | null;
  place?: string | null;
  teacher?: { name?: string | null } | null;
  affected?: boolean | null;
  affectedReason?: string | null;
};

export type ArchiveClass = {
  id: string;
  name?: string | null;
  periods?: Array<number | string>;
  reasons?: string[];
};

export type ArchiveFreeTeachersRow = {
  period?: number | string | null;
  teachers?: Array<{ name?: string | null }>;
  total?: number | string | null;
};

export type ArchiveSnapshot = {
  date?: string;
  day?: string;
  archivedAt?: string;
  statusSummary?: {
    absent?: number;
    late?: number;
    left?: number;
    unavailable?: number;
  };
  statuses?: ArchiveStatus[];
  substitutions?: ArchiveSubstitution[];
  baseSlots?: Array<{
    period?: number | string | null;
    className?: string | null;
    subjectName?: string | null;
    teacherName?: string | null;
  }>;
  dailyModifiedSlots?: Array<{
    period?: number | string | null;
    className?: string | null;
    subjectName?: string | null;
    teacherName?: string | null;
    originalTeacherName?: string | null;
    changed?: boolean;
    note?: string | null;
    changeType?: string | null;
  }>;
  freeTeachers?: ArchiveFreeTeachersRow[];
  duties?: ArchiveDuty[];
  affectedClasses?: ArchiveClass[];
  events?: ArchiveEvent[];
  report?: {
    totalStatuses?: number;
    totalSubstitutions?: number;
    affectedClasses?: number;
    dutiesAffected?: number;
  };
};
