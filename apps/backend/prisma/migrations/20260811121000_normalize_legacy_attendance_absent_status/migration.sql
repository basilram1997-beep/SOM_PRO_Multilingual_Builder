-- Normalize legacy attendance data so the current Prisma enum can read it safely.
UPDATE "StudentAttendance"
SET "status" = 'ABSENT_UNEXCUSED'
WHERE "status" = 'ABSENT';
