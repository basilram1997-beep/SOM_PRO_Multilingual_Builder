export type ExamScheduleEntry = {
  id: string;
  classId: string;
  date: string;
  startTime: string;
  endTime: string;
};

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.NaN;
  return hours * 60 + minutes;
}

export function examTimeOverlaps(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) {
  const leftStartMinutes = toMinutes(leftStart);
  const leftEndMinutes = toMinutes(leftEnd);
  const rightStartMinutes = toMinutes(rightStart);
  const rightEndMinutes = toMinutes(rightEnd);

  if ([leftStartMinutes, leftEndMinutes, rightStartMinutes, rightEndMinutes].some(Number.isNaN)) {
    return false;
  }

  return leftStartMinutes < rightEndMinutes && rightStartMinutes < leftEndMinutes;
}

export function findExamConflicts<T extends ExamScheduleEntry>(entries: T[], candidate: T) {
  return entries.filter(
    (entry) =>
      entry.id !== candidate.id &&
      entry.classId === candidate.classId &&
      entry.date === candidate.date &&
      examTimeOverlaps(entry.startTime, entry.endTime, candidate.startTime, candidate.endTime)
  );
}
