import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("attendance routes use the school-student-day unique key and upsert to prevent duplicate records", () => {
  const source = readFileSync("src/modules/students/students.routes.ts", "utf8");

  assert.match(source, /schoolId_studentId_date/, "attendance should rely on the school/student/date unique key");
  assert.match(
    source,
    /studentAttendance\.upsert\(/,
    "attendance should update the existing record instead of creating duplicates"
  );
  assert.match(source, /studentsRouter\.put\(\s*"\/attendance"/, "attendance update route should exist");
  assert.match(source, /studentsRouter\.post\(\s*"\/attendance"/, "attendance create route should exist");
  assert.match(source, /studentsRouter\.put\(\s*"\/attendance\/:id"/, "attendance edit route should exist");
  assert.match(source, /studentAttendance\.update\(/, "attendance edit route should update the existing record");
  assert.match(
    source,
    /action: existingRecord \? "ATTENDANCE_UPDATE" : "ATTENDANCE_CREATE"/,
    "attendance save route should distinguish create from update"
  );
  assert.match(
    source,
    /schoolId_classId_subjectId_certificateType/,
    "grade entries should rely on the school/class/subject/certificate unique key"
  );
  assert.match(
    source,
    /studentGradeEntry\.upsert\(/,
    "grade entries should update the existing record instead of creating duplicates"
  );
  assert.match(source, /studentsRouter\.post\(\s*"\/grades"/, "grade create route should exist");
  assert.match(source, /studentsRouter\.put\(\s*"\/grades\/:id"/, "grade update route should exist");
});

test("attendance routes keep permission, audit, archive, and notification wiring in place", () => {
  const source = readFileSync("src/modules/students/students.routes.ts", "utf8");
  const notificationsSource = readFileSync("src/services/studentNotifications.ts", "utf8");

  assert.match(source, /studentsRouter\.put\(\s*"\/attendance"/, "attendance edit route should exist");
  assert.match(source, /studentsRouter\.post\(\s*"\/attendance"/, "attendance create route should exist");
  assert.match(source, /studentsRouter\.put\(\s*"\/attendance\/:id"/, "attendance edit-by-id route should exist");
  assert.match(source, /studentsRouter\.post\(\s*"\/attendance\/archive"/, "attendance archive route should exist");
  assert.match(
    source,
    /requirePermissionForWrite\("manageLessons"\)|\(0, auth_1\.requirePermissionForWrite\)\("manageLessons"\)/,
    "attendance edits should be restricted to users with lesson write access"
  );
  assert.match(
    source,
    /teacherWriteForbidden\(res\)/,
    "attendance edits should reject teachers outside their class scope"
  );
  assert.match(
    source,
    /action: existingRecord \? "ATTENDANCE_UPDATE" : "ATTENDANCE_CREATE"/,
    "attendance saves should keep create/update audit records distinct"
  );
  assert.match(source, /action: "ATTENDANCE_UPDATE"/, "attendance edit-by-id should be audited");
  assert.match(source, /action: "ATTENDANCE_ARCHIVE"/, "attendance archive should be audited");
  assert.match(
    source,
    /createAttendanceNotification\(prisma,|\(0, studentNotifications_1\.createAttendanceNotification\)\(prisma_1\.prisma,/,
    "attendance saves should still trigger parent notifications"
  );
  assert.match(source, /buildAttendanceArchiveReport\(/, "attendance archive should keep its aggregate report builder");
  assert.match(
    notificationsSource,
    /composeAttendanceMessage/,
    "attendance notifications should keep readable parent-facing messages"
  );
  assert.match(
    notificationsSource,
    /uniqueRecipients\(/,
    "attendance notifications should deduplicate parent contacts"
  );
});

test("academic and behavior records update the same saved row on resave", () => {
  const source = readFileSync("src/modules/students/students.routes.ts", "utf8");

  assert.match(source, /studentsRouter\.put\(\s*"\/academic"/, "academic save route should exist");
  assert.match(
    source,
    /studentAcademicRecord\.upsert\(/,
    "academic save should update the existing record instead of duplicating it"
  );
  assert.match(
    source,
    /schoolId_studentId_subjectId_date/,
    "academic save should rely on the school/student/subject/date unique key"
  );
  assert.match(source, /studentsRouter\.put\(\s*"\/behavior"/, "behavior save route should exist");
  assert.match(
    source,
    /studentBehaviorRecord\.upsert\(/,
    "behavior save should update the existing record instead of duplicating it"
  );
  assert.match(
    source,
    /schoolId_studentId_date_category_tone/,
    "behavior save should rely on the school/student/day/category/tone unique key"
  );
  assert.match(source, /studentsRouter\.delete\(\s*"\/behavior"/, "behavior clear route should still exist");
});

test("lesson today saves reuse the same lesson row on repeated submit", () => {
  const source = readFileSync("src/modules/lessons/today.routes.ts", "utf8");

  assert.match(source, /lessonTodayRouter\.post\(\s*"\/"/, "lesson today create route should exist");
  assert.match(source, /teacherLessonToday\.findUnique\(/, "lesson today save should check for an existing row");
  assert.match(source, /teacherLessonToday\.upsert\(/, "lesson today save should upsert the existing row");
  assert.match(source, /teacherLessonToday\.update\(/, "lesson today edit route should update the existing lesson");
  assert.match(
    source,
    /schoolId_teacherId_date_period_classId_subjectId/,
    "lesson today should rely on the school/teacher/date/period/class/subject unique key"
  );
});

test("daily events reuse existing rows instead of duplicating the same save request", () => {
  const source = readFileSync("src/services/scheduleCoordinator.ts", "utf8");

  assert.match(source, /dailyEvent\.findFirst\(\{/, "daily event save should look up an existing matching row");
  assert.match(
    source,
    /dailyEvent\.update\(\{ where: \{ id: existing\.id \}, data \}\)/,
    "daily event save should update an existing row"
  );
  assert.match(source, /dailyEvent\.create\(\{ data \}\)/, "daily event save should create a row when none exists yet");
  assert.doesNotMatch(source, /dailyEvent\.createMany\(/, "daily event save should not bulk create duplicates");
});
