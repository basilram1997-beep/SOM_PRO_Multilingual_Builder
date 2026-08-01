export function classHasCapacity(maxStudents: number | null | undefined, currentStudentCount: number) {
  if (maxStudents == null) return true;
  return currentStudentCount < maxStudents;
}

export function classRemainingSeats(maxStudents: number | null | undefined, currentStudentCount: number) {
  if (maxStudents == null) return null;
  return Math.max(maxStudents - currentStudentCount, 0);
}
