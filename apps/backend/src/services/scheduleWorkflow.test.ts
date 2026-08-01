import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("weekly schedule routes keep save, validate, and audit wiring", () => {
  const source = readFileSync("src/modules/schedules/schedules.routes.ts", "utf8");
  const builderSource = readFileSync("src/services/scheduleBuilder.ts", "utf8");
  const editingSource = readFileSync("src/services/scheduleEditing.ts", "utf8");

  assert.match(source, /schedulesRouter\.get\("\/base"/, "weekly schedule list route should exist");
  assert.match(source, /schedulesRouter\.post\("\/base"/, "weekly schedule save route should exist");
  assert.match(source, /schedulesRouter\.post\("\/base\/validate"/, "weekly schedule validation route should exist");
  assert.match(source, /schedulesRouter\.post\("\/base\/copy-week"/, "weekly schedule copy route should exist");
  assert.match(
    source,
    /schedulesRouter\.post\("\/base\/copy-week\/preview"/,
    "weekly schedule copy preview route should exist"
  );
  assert.match(source, /schedulesRouter\.post\("\/base\/swap-periods"/, "weekly schedule swap route should exist");
  assert.match(
    source,
    /schedulesRouter\.post\("\/base\/swap-periods\/preview"/,
    "weekly schedule swap preview route should exist"
  );
  assert.match(source, /saveBaseScheduleSlotFromRules\(/, "weekly schedule edits should update the same row");
  assert.match(source, /recordAuditLog\(prisma,/, "weekly schedule saves should be audited");
  assert.match(builderSource, /validateBaseScheduleConflicts/, "weekly schedule validation helper should stay wired");
  assert.match(
    builderSource,
    /validateBaseScheduleSlotRules/,
    "weekly schedule slot validation helper should stay wired"
  );
  assert.match(editingSource, /copyBaseScheduleDayFromRules/, "weekly schedule copy helper should stay wired");
  assert.match(
    editingSource,
    /previewBaseScheduleDayCopyFromRules/,
    "weekly schedule copy preview helper should stay wired"
  );
  assert.match(editingSource, /swapBaseSchedulePeriodsFromRules/, "weekly schedule swap helper should stay wired");
  assert.match(
    editingSource,
    /previewBaseScheduleSwapPeriodsFromRules/,
    "weekly schedule swap preview helper should stay wired"
  );
});

test("weekly schedule page keeps export and reopen behavior", () => {
  const schedulesPage = readFileSync("../frontend/src/pages/schedules/SchedulesPage.tsx", "utf8");
  const schedulesHook = readFileSync("../frontend/src/features/schedules/useSchedules.ts", "utf8");
  const dailyPage = readFileSync("../frontend/src/pages/daily/DailyPage.tsx", "utf8");
  const teacherPanel = readFileSync("../frontend/src/features/daily/TeacherDailyProgramsPanel.tsx", "utf8");
  const fullSchedulePanel = readFileSync("../frontend/src/features/daily/DailyFullScheduleTable.tsx", "utf8");
  const apiSource = readFileSync("../frontend/src/api/somApi.ts", "utf8");

  assert.match(schedulesPage, /t\("schedules\.exportBase"\)/, "class schedule export button should stay visible");
  assert.match(
    schedulesPage,
    /copyWeek|swapPeriods|schedule-room-cell|editRoom|roomEditorTitle|schedule-swap-preview|schedule-copy-preview/,
    "schedule page should expose copy, swap, room display, room editing, copy preview, and swap preview controls"
  );
  assert.match(
    schedulesHook,
    /somApi\.schedules\.base\(selectedDay\)/,
    "schedule reopening should reload the selected day"
  );
  assert.match(
    schedulesHook,
    /useEffect\(\(\) => \{\s*loadBase\(day\)\.catch/,
    "schedule page should refresh when day changes"
  );
  assert.match(apiSource, /copyWeek:/, "schedule API should expose copy-week");
  assert.match(apiSource, /previewCopyWeek:/, "schedule API should expose copy-week preview");
  assert.match(apiSource, /swapPeriods:/, "schedule API should expose swap-periods");
  assert.match(apiSource, /previewSwapPeriods:/, "schedule API should expose swap preview");
  assert.match(dailyPage, /t\("daily\.fullSchedule"\)/, "daily full schedule export should stay visible");
  assert.match(dailyPage, /t\("daily\.teacherPrograms"\)/, "teacher daily program export should stay visible");
  assert.match(teacherPanel, /onClick=\{props\.onExport\}/, "teacher program export action should remain wired");
  assert.match(fullSchedulePanel, /onClick=\{onExport\}/, "full schedule export action should remain wired");
});

test("weekly base schedule model does not claim room handling that it does not store", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const baseScheduleSection = schema.match(/model BaseScheduleSlot \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(baseScheduleSection, /subjectId String/);
  assert.match(baseScheduleSection, /teacherId String/);
  assert.match(baseScheduleSection, /room\s+String\?/);
  assert.match(baseScheduleSection, /updatedAt DateTime @updatedAt/);
  assert.match(baseScheduleSection, /@@unique\(\[schoolId, day, period, classId\]\)/);
  assert.doesNotMatch(baseScheduleSection, /roomId/, "weekly base schedule stores room directly, not roomId");
});
