export type BaseRuleTeacher = {
  id: string;
  name: string;
  targetLoad: number;
  releaseHours: number;
  workDays?: string[];
  preferredPeriods?: number[];
};

export type BaseRuleSlot = {
  id: string;
  day: string;
  period: number;
  teacherId: string;
  classId: string;
  subjectId: string;
  teacher: BaseRuleTeacher;
  class: { name: string };
  subject: { name: string };
};

export type BaseRuleAssignment = {
  teacherId: string;
  classId: string;
  subjectId: string;
  weeklyPeriods?: number;
};

export type BaseScheduleRuleInput = {
  workingDays: string[];
  periodsPerDay: number;
  slots: BaseRuleSlot[];
  assignments: BaseRuleAssignment[];
};

function assignmentKey(value: { teacherId: string; classId: string; subjectId: string }) {
  return `${value.teacherId}:${value.classId}:${value.subjectId}`;
}

export function effectiveTeacherLoad(teacher: Pick<BaseRuleTeacher, "targetLoad" | "releaseHours">) {
  return Math.max(0, (teacher.targetLoad || 0) - (teacher.releaseHours || 0));
}

export function validateBaseScheduleRules(input: BaseScheduleRuleInput) {
  const conflicts: string[] = [];
  const teacherBusy = new Map<string, BaseRuleSlot>();
  const classBusy = new Map<string, BaseRuleSlot>();
  const assignmentSet = new Set(input.assignments.map(assignmentKey));
  const loadByTeacher = new Map<string, { teacher: BaseRuleTeacher; lessons: number }>();
  const assignmentLoad = new Map<string, { slot: BaseRuleSlot; lessons: number }>();

  for (const slot of input.slots) {
    if (!input.workingDays.includes(slot.day)) {
      conflicts.push(`اليوم ${slot.day} ليس ضمن أيام الدوام`);
    }
    if (slot.period < 1 || slot.period > input.periodsPerDay) {
      conflicts.push(`الحصة ${slot.period} للصف ${slot.class.name} خارج عدد الحصص المحدد`);
    }
    if (slot.teacher.workDays?.length && !slot.teacher.workDays.includes(slot.day)) {
      conflicts.push(`المعلم ${slot.teacher.name} غير متاح في اليوم ${slot.day}`);
    }
    if (slot.teacher.preferredPeriods?.length && !slot.teacher.preferredPeriods.includes(slot.period)) {
      conflicts.push(`المعلم ${slot.teacher.name} غير متاح في الحصة ${slot.period}`);
    }

    const timeKey = `${slot.day}:${slot.period}`;
    const teacherKey = `${timeKey}:${slot.teacherId}`;
    const classKey = `${timeKey}:${slot.classId}`;

    if (teacherBusy.has(teacherKey)) {
      conflicts.push(`تعارض معلم: ${slot.teacher.name} لديه أكثر من صف في نفس الحصة`);
    }
    if (classBusy.has(classKey)) {
      conflicts.push(`تعارض صف: ${slot.class.name} لديه أكثر من حصة في نفس الوقت`);
    }
    if (!assignmentSet.has(assignmentKey(slot))) {
      conflicts.push(`تكليف غير صحيح: ${slot.teacher.name} لا يعلّم ${slot.subject.name} للصف ${slot.class.name}`);
    }

    teacherBusy.set(teacherKey, slot);
    classBusy.set(classKey, slot);

    const load = loadByTeacher.get(slot.teacherId) || { teacher: slot.teacher, lessons: 0 };
    load.lessons += 1;
    loadByTeacher.set(slot.teacherId, load);

    const key = assignmentKey(slot);
    const currentAssignmentLoad = assignmentLoad.get(key) || { slot, lessons: 0 };
    currentAssignmentLoad.lessons += 1;
    assignmentLoad.set(key, currentAssignmentLoad);
  }

  for (const load of loadByTeacher.values()) {
    const effective = effectiveTeacherLoad(load.teacher);
    if (load.lessons > effective) {
      conflicts.push(
        `نصاب المعلم ${load.teacher.name} متجاوز: لديه ${load.lessons} حصة في البرنامج الثابت، والنصاب الفعلي بعد التفريغ هو ${effective} (${load.teacher.targetLoad} - ${load.teacher.releaseHours})`
      );
    }
  }

  for (const assignment of input.assignments) {
    const required = assignment.weeklyPeriods || 0;
    if (required <= 0) continue;

    const current = assignmentLoad.get(assignmentKey(assignment));
    const actual = current?.lessons || 0;
    if (actual !== required) {
      const slot = current?.slot;
      const teacherName = slot?.teacher.name || assignment.teacherId;
      const className = slot?.class.name || assignment.classId;
      const subjectName = slot?.subject.name || assignment.subjectId;
      conflicts.push(
        `عدد حصص ${subjectName} للصف ${className} مع ${teacherName} لا يطابق ملف المعلم: المطلوب ${required}، الموجود ${actual}`
      );
    }
  }

  return conflicts;
}

export type HomeroomRuleInput = {
  teacherId: string;
  classId: string;
  day: string;
  period: number;
  existingClassSlot?: { id: string } | null;
  teacherBusySlot?: { id: string; className: string } | null;
  overwriteConflicts: boolean;
};

export function decideHomeroomApplyAction(input: HomeroomRuleInput) {
  if (input.teacherBusySlot && !input.overwriteConflicts) return "CONFLICT_TEACHER_BUSY" as const;
  if (input.teacherBusySlot && input.overwriteConflicts) return "REPLACE_TEACHER_BUSY_SLOT" as const;
  if (input.existingClassSlot && !input.overwriteConflicts) return "CONFLICT_CLASS_BUSY" as const;
  if (input.existingClassSlot && input.overwriteConflicts) return "UPDATE_CLASS_SLOT" as const;
  return "CREATE_HOMEROOM_SLOT" as const;
}
