require("dotenv").config();

const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { parseArgs } = require("node:util");

const prisma = new PrismaClient();

const DAY_NAMES_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED", "LEFT_EARLY"];
const GRADE_TYPES = ["EXAM", "QUIZ", "ASSIGNMENT", "PROJECT", "PARTICIPATION", "ORAL"];
const CERTIFICATE_TYPES = ["TERM1_BIMONTHLY", "TERM1_FINAL", "TERM2_BIMONTHLY", "TERM2_FINAL"];
const CERTIFICATE_RESULTS = ["PASS", "PASS_WITH_WARNING", "REVIEW", "INCOMPLETE"];
const CERTIFICATE_BEHAVIORS = ["EXCELLENT", "VERY_GOOD", "GOOD", "NEEDS_ATTENTION"];
const NOTIFICATION_EVENT_TYPES = [
  "ATTENDANCE",
  "GRADE",
  "CERTIFICATE",
  "DAILY_NOTE",
  "MESSAGE",
  "SUBSTITUTION",
  "HOMEWORK",
  "EXAM",
  "REMINDER",
  "ALERT"
];
const NOTIFICATION_STATUSES = ["QUEUED", "SENT", "FAILED"];
const REPORT_EXPORT_STATUSES = ["REQUESTED", "READY", "FAILED"];
const BACKUP_STATUSES = ["PENDING", "RUNNING", "COMPLETED"];
const DAILY_EVENT_TYPES = ["ASSEMBLY", "EXAM", "VISIT", "ACTIVITY", "FIELD_TRIP"];
const SUBSTITUTION_KINDS = [
  "SAME_CLASS_AND_SUBJECT",
  "SAME_CLASS",
  "SAME_GRADE_AND_SUBJECT",
  "SAME_SUBJECT",
  "SAME_GRADE",
  "FREE_ONLY"
];
const TEACHER_STATUS_TYPES = ["ABSENT", "LATE", "LEFT", "UNAVAILABLE"];

const PERIODS = [
  { period: 1, label: "Period 1", startTime: "08:10", endTime: "09:00" },
  { period: 2, label: "Period 2", startTime: "09:00", endTime: "09:50" },
  { period: 3, label: "Period 3", startTime: "09:50", endTime: "10:35" },
  { period: 4, label: "Period 4", startTime: "11:00", endTime: "11:45" },
  { period: 5, label: "Period 5", startTime: "11:45", endTime: "12:30" },
  { period: 6, label: "Period 6", startTime: "12:30", endTime: "13:15" },
  { period: 7, label: "Period 7", startTime: "13:15", endTime: "14:00" }
];

const PROFILES = {
  tiny: {
    teachers: 8,
    classes: 4,
    subjects: 6,
    students: 40,
    lessonsPerClass: 12,
    attendanceDaysPerStudent: 3,
    gradesPerStudent: 8,
    certificatesPerStudent: 2,
    notificationsPerStudent: 5,
    auditLogsPerStudent: 10,
    reportExports: 20,
    backupJobs: 5,
    dailyScheduleDays: 30,
    dailyTeacherStatusesPerDay: 2,
    substitutionsPerDay: 1,
    dailyEventsPerDay: 1
  },
  high: {
    teachers: 500,
    classes: 300,
    subjects: 40,
    students: 10000,
    lessonsPerClass: 40,
    attendanceDaysPerStudent: 10,
    gradesPerStudent: 50,
    certificatesPerStudent: 5,
    notificationsPerStudent: 10,
    auditLogsPerStudent: 25,
    reportExports: 5000,
    backupJobs: 500,
    dailyScheduleDays: 365,
    dailyTeacherStatusesPerDay: 5,
    substitutionsPerDay: 3,
    dailyEventsPerDay: 1
  },
  strong: {
    teachers: 2000,
    classes: 800,
    subjects: 60,
    students: 50000,
    lessonsPerClass: 75,
    attendanceDaysPerStudent: 10,
    gradesPerStudent: 20,
    certificatesPerStudent: 5,
    notificationsPerStudent: 10,
    auditLogsPerStudent: 20,
    reportExports: 25000,
    backupJobs: 1000,
    dailyScheduleDays: 365,
    dailyTeacherStatusesPerDay: 5,
    substitutionsPerDay: 3,
    dailyEventsPerDay: 1
  }
};

function nowIso() {
  return new Date().toISOString();
}

function trace(message, details) {
  if (details === undefined) {
    console.log(`[${nowIso()}] ${message}`);
    return;
  }
  console.log(`[${nowIso()}] ${message}`, details);
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/perf-seed.js [--cleanup] [--profile=tiny|high|strong] [--datasetSize=tiny|high|strong] [--runId=RUN_ID]",
      "",
      "Required:",
      "  PERF_RUN_ID must be set, or pass --runId.",
      "",
      "Examples:",
      "  PERF_RUN_ID=demo-001 node scripts/perf-seed.js",
      "  node scripts/perf-seed.js --cleanup --runId=demo-001",
      "  PERF_RUN_ID=staging-01 PERF_DATASET_SIZE=strong node scripts/perf-seed.js"
    ].join("\n")
  );
}

function sanitizeRunId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function hashPassword(password) {
  const salt = crypto.createHash("sha256").update("perf-seed-salt").digest("hex").slice(0, 32);
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:v1:${salt}:${hash}`;
}

function hashString(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function chunk(array, size) {
  const result = [];
  for (let index = 0; index < array.length; index += size) {
    result.push(array.slice(index, index + size));
  }
  return result;
}

function pad(value, length = 4) {
  return String(value).padStart(length, "0");
}

function addDays(baseDate, days) {
  return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dayName(date) {
  return DAY_NAMES_AR[date.getUTCDay()];
}

function buildProfile(profileName) {
  const profile = PROFILES[profileName] || PROFILES.high;

  return {
    ...profile,
    teachers: Number(process.env.PERF_TEACHERS || profile.teachers),
    classes: Number(process.env.PERF_CLASSES || profile.classes),
    subjects: Number(process.env.PERF_SUBJECTS || profile.subjects),
    students: Number(process.env.PERF_STUDENTS || profile.students),
    lessonsPerClass: Number(process.env.PERF_LESSONS_PER_CLASS || profile.lessonsPerClass),
    attendanceDaysPerStudent: Number(process.env.PERF_ATTENDANCE_DAYS || profile.attendanceDaysPerStudent),
    gradesPerStudent: Number(process.env.PERF_GRADES_PER_STUDENT || profile.gradesPerStudent),
    certificatesPerStudent: Number(process.env.PERF_CERTIFICATES_PER_STUDENT || profile.certificatesPerStudent),
    notificationsPerStudent: Number(process.env.PERF_NOTIFICATIONS_PER_STUDENT || profile.notificationsPerStudent),
    auditLogsPerStudent: Number(process.env.PERF_AUDIT_LOGS_PER_STUDENT || profile.auditLogsPerStudent),
    reportExports: Number(process.env.PERF_REPORT_EXPORTS || profile.reportExports),
    backupJobs: Number(process.env.PERF_BACKUP_JOBS || profile.backupJobs),
    dailyScheduleDays: Number(process.env.PERF_DAILY_SCHEDULE_DAYS || profile.dailyScheduleDays),
    dailyTeacherStatusesPerDay: Number(process.env.PERF_DAILY_STATUSES_PER_DAY || profile.dailyTeacherStatusesPerDay),
    substitutionsPerDay: Number(process.env.PERF_SUBSTITUTIONS_PER_DAY || profile.substitutionsPerDay),
    dailyEventsPerDay: Number(process.env.PERF_DAILY_EVENTS_PER_DAY || profile.dailyEventsPerDay)
  };
}

function isLocalDatabaseUrl(url) {
  return !url || /localhost|127\.0\.0\.1|sqlite:/i.test(url);
}

async function createManyInChunks(modelName, rows, batchSize = 1000) {
  if (!rows.length) return 0;

  let inserted = 0;
  for (const batch of chunk(rows, batchSize)) {
    await prisma[modelName].createMany({ data: batch, skipDuplicates: true });
    inserted += batch.length;
  }
  return inserted;
}

async function deleteMany(modelName, where) {
  await prisma[modelName].deleteMany({ where }).catch(() => null);
}

async function cleanupPerfDataset(schoolId) {
  trace("cleanup started", { schoolId });
  const deleteOrder = [
    "reportExport",
    "backupJob",
    "auditLog",
    "studentNotification",
    "studentCertificate",
    "gradeRecord",
    "studentAttendance",
    "attendanceRecord",
    "studentAcademicRecord",
    "studentBehaviorRecord",
    "teacherHomeworkSubmission",
    "teacherHomework",
    "teacherExam",
    "teacherLessonToday",
    "dailyEvent",
    "substitution",
    "dailyTeacherStatus",
    "dailySchedule",
    "lesson",
    "teacherAssignment",
    "teacherSubject",
    "baseScheduleSlot",
    "homeroomAssignment",
    "dutyAssignment",
    "schoolClass",
    "student",
    "teacher",
    "subject",
    "periodDefinition",
    "schoolSettings",
    "user",
    "securityIncident",
    "licenseActivation"
  ];

  for (const modelName of deleteOrder) {
    await deleteMany(modelName, { schoolId });
  }

  await deleteMany("school", { id: schoolId });
  trace("cleanup completed", { schoolId });
}

async function seedCoreSchool(schoolId, runKey) {
  await prisma.school.upsert({
    where: { id: schoolId },
    update: {
      name: `Load School ${runKey}`,
      managerName: `Load Manager ${runKey}`,
      institutionCode: `PERF-${runKey.toUpperCase().slice(0, 16)}`
    },
    create: {
      id: schoolId,
      name: `Load School ${runKey}`,
      address: "",
      managerName: `Load Manager ${runKey}`,
      institutionCode: `PERF-${runKey.toUpperCase().slice(0, 16)}`
    }
  });

  await prisma.schoolSettings.upsert({
    where: { schoolId },
    update: {
      workingDays: ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"],
      offDays: ["الجمعة"],
      periodsPerDay: 7,
      maxTeachers: 1000
    },
    create: {
      schoolId,
      workingDays: ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"],
      offDays: ["الجمعة"],
      periodsPerDay: 7,
      maxTeachers: 1000
    }
  });

  for (const period of PERIODS) {
    await prisma.periodDefinition.upsert({
      where: { schoolId_period: { schoolId, period: period.period } },
      update: {
        label: period.label,
        startTime: period.startTime,
        endTime: period.endTime,
        isActive: true
      },
      create: {
        schoolId,
        period: period.period,
        label: period.label,
        startTime: period.startTime,
        endTime: period.endTime,
        isActive: true
      }
    });
  }
}

async function seedUsersAndTeachers({ schoolId, runKey, counts }) {
  const adminEmail = `perf-admin-${runKey}@perf.local`;
  const managerEmail = `perf-manager-${runKey}@perf.local`;
  const teacherPassword = "Perf-Teacher-123!";
  const adminPassword = "Perf-Admin-123!";
  const managerPassword = "Perf-Manager-123!";

  await prisma.user.createMany({
    data: [
      {
        schoolId,
        name: `Load Admin ${runKey}`,
        fullName: `Load Admin ${runKey}`,
        email: adminEmail,
        phone: `059${pad(1, 7)}`,
        password: hashPassword(adminPassword),
        mfaEnabled: false,
        status: "ACTIVE",
        role: "ADMIN"
      },
      {
        schoolId,
        name: `Load Manager ${runKey}`,
        fullName: `Load Manager ${runKey}`,
        email: managerEmail,
        phone: `059${pad(2, 7)}`,
        password: hashPassword(managerPassword),
        mfaEnabled: false,
        status: "ACTIVE",
        role: "MANAGER"
      }
    ],
    skipDuplicates: true
  });

  const teacherUsers = [];
  for (let index = 0; index < counts.teachers; index += 1) {
    teacherUsers.push({
      schoolId,
      name: `Load Teacher ${pad(index + 1, 5)}`,
      fullName: `Load Teacher ${pad(index + 1, 5)}`,
      email: `perf-teacher-${runKey}-${pad(index + 1, 5)}@perf.local`,
      phone: `05${pad(index + 10, 9)}`,
      password: hashPassword(teacherPassword),
      mfaEnabled: false,
      status: "ACTIVE",
      role: "TEACHER"
    });
  }

  await createManyInChunks("user", teacherUsers, 1000);

  const users = await prisma.user.findMany({
    where: { schoolId, role: "TEACHER" },
    orderBy: { email: "asc" }
  });

  const teachers = users.map((user, index) => ({
    schoolId,
    name: `Load Teacher ${pad(index + 1, 5)}`,
    userId: user.id,
    employeeNumber: `EMP-${runKey.toUpperCase()}-${pad(index + 1, 5)}`,
    externalId: `EXT-${runKey.toUpperCase()}-${pad(index + 1, 5)}`,
    status: "ACTIVE",
    nationalId: `T${runKey.replace(/[^a-z0-9]/g, "")}${pad(index + 1, 10)}`,
    specialty: `Load Subject ${pad((index % counts.subjects) + 1, 2)}`,
    adminRole: "",
    employmentRatio: 100,
    workDays: ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"],
    preferredDays: ["السبت", "الأحد"],
    preferredClasses: [],
    preferredPeriods: [1, 2, 3, 4, 5, 6, 7],
    releaseHours: index % 4,
    targetLoad: 25 + (index % 5),
    notes: `Load seed teacher ${runKey}`
  }));

  await createManyInChunks("teacher", teachers, 1000);

  const teacherRows = await prisma.teacher.findMany({
    where: { schoolId },
    orderBy: { name: "asc" }
  });

  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  const managerUser = await prisma.user.findUnique({ where: { email: managerEmail } });

  return {
    adminUser,
    managerUser,
    teacherUsers: users,
    teachers: teacherRows,
    passwords: { adminPassword, managerPassword, teacherPassword }
  };
}

async function seedClassesAndSubjects({ schoolId, counts, teachers }) {
  const classes = [];
  for (let index = 0; index < counts.classes; index += 1) {
    const gradeLevel = (index % 12) + 1;
    const section = String.fromCharCode(65 + (index % 26));
    const homeroomTeacher = teachers[index % teachers.length];

    classes.push({
      schoolId,
      name: `Load Class ${pad(index + 1, 3)}`,
      gradeLevel: String(gradeLevel),
      homeroomTeacherId: homeroomTeacher?.id || null,
      status: "ACTIVE",
      grade: String(gradeLevel),
      section,
      maxStudents: 40
    });
  }
  await createManyInChunks("schoolClass", classes, 1000);

  const subjects = [];
  for (let index = 0; index < counts.subjects; index += 1) {
    subjects.push({
      schoolId,
      name: `Load Subject ${pad(index + 1, 2)}`,
      code: `S${pad(index + 1, 2)}`,
      status: "ACTIVE",
      isHomeroom: false,
      maxMark: 100,
      passMark: 50
    });
  }
  await createManyInChunks("subject", subjects, 1000);

  const classRows = await prisma.schoolClass.findMany({
    where: { schoolId },
    orderBy: { name: "asc" }
  });
  const subjectRows = await prisma.subject.findMany({
    where: { schoolId },
    orderBy: { name: "asc" }
  });

  return { classes: classRows, subjects: subjectRows };
}

async function seedAssignments({ schoolId, classes, subjects, teachers }) {
  const teacherAssignments = [];
  const teacherSubjects = [];
  const homeroomAssignments = [];
  const assignmentMap = new Map();

  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    const schoolClass = classes[classIndex];
    const homeroomTeacher = teachers[classIndex % teachers.length];
    homeroomAssignments.push({
      schoolId,
      teacherId: homeroomTeacher.id,
      classId: schoolClass.id,
      weeklyDay: "السبت",
      weeklyPeriod: 1,
      isActive: true,
      notes: `Load homeroom ${classIndex + 1}`
    });

    for (let subjectIndex = 0; subjectIndex < subjects.length; subjectIndex += 1) {
      const subject = subjects[subjectIndex];
      const teacher = teachers[(classIndex * subjects.length + subjectIndex) % teachers.length];
      const key = `${schoolClass.id}:${subject.id}`;

      teacherAssignments.push({
        schoolId,
        teacherId: teacher.id,
        classId: schoolClass.id,
        subjectId: subject.id,
        weeklyPeriods: 4 + ((classIndex + subjectIndex) % 3)
      });
      teacherSubjects.push({
        schoolId,
        teacherId: teacher.id,
        subjectId: subject.id,
        classId: schoolClass.id
      });
      assignmentMap.set(key, teacher.id);
    }
  }

  await createManyInChunks("teacherAssignment", teacherAssignments, 2000);
  await createManyInChunks("teacherSubject", teacherSubjects, 2000);
  await createManyInChunks("homeroomAssignment", homeroomAssignments, 1000);

  const baseSlots = [];
  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    const schoolClass = classes[classIndex];
    for (let periodIndex = 0; periodIndex < PERIODS.length; periodIndex += 1) {
      const period = PERIODS[periodIndex];
      const subject = subjects[(classIndex + periodIndex) % subjects.length];
      baseSlots.push({
        schoolId,
        day: DAY_NAMES_AR[periodIndex % DAY_NAMES_AR.length],
        period: period.period,
        classId: schoolClass.id,
        subjectId: subject.id,
        teacherId: assignmentMap.get(`${schoolClass.id}:${subject.id}`) || teachers[0].id,
        room: `R-${pad((classIndex % 30) + 1, 2)}`
      });
    }
  }
  await createManyInChunks("baseScheduleSlot", baseSlots, 2000);

  const baseSlotRows = await prisma.baseScheduleSlot.findMany({
    where: { schoolId },
    orderBy: [{ classId: "asc" }, { day: "asc" }, { period: "asc" }]
  });

  const baseSlotMap = new Map();
  for (const baseSlot of baseSlotRows) {
    baseSlotMap.set(`${baseSlot.day}:${baseSlot.classId}:${baseSlot.period}`, baseSlot.id);
  }

  return { assignmentMap, baseSlotMap };
}

async function seedDailySchedules({ schoolId, counts, teachers, classes, subjects, baseSlotMap }) {
  const startDate = new Date(Date.UTC(2025, 8, 1));
  const dailySchedules = [];
  for (let dayIndex = 0; dayIndex < counts.dailyScheduleDays; dayIndex += 1) {
    const date = addDays(startDate, dayIndex);
    dailySchedules.push({
      schoolId,
      date: toIsoDate(date),
      day: dayName(date)
    });
  }
  await createManyInChunks("dailySchedule", dailySchedules, 1000);

  const scheduleRows = await prisma.dailySchedule.findMany({
    where: { schoolId },
    orderBy: { date: "asc" }
  });

  const dailyStatuses = [];
  const substitutions = [];
  const dailyEvents = [];

  for (let dayIndex = 0; dayIndex < scheduleRows.length; dayIndex += 1) {
    const schedule = scheduleRows[dayIndex];
    for (let statusIndex = 0; statusIndex < counts.dailyTeacherStatusesPerDay; statusIndex += 1) {
      const teacher = teachers[(dayIndex * counts.dailyTeacherStatusesPerDay + statusIndex) % teachers.length];
      dailyStatuses.push({
        schoolId,
        dailyScheduleId: schedule.id,
        teacherId: teacher.id,
        type: TEACHER_STATUS_TYPES[(dayIndex + statusIndex) % TEACHER_STATUS_TYPES.length],
        fromPeriod: ((dayIndex + statusIndex) % 7) + 1,
        toPeriod: Math.min(7, ((dayIndex + statusIndex) % 7) + 2),
        reason: `Load status ${dayIndex}-${statusIndex}`
      });
    }

    for (let substitutionIndex = 0; substitutionIndex < counts.substitutionsPerDay; substitutionIndex += 1) {
      const classRow = classes[(dayIndex + substitutionIndex) % classes.length];
      const subjectRow = subjects[(dayIndex + substitutionIndex) % subjects.length];
      const absentTeacher = teachers[(dayIndex * counts.substitutionsPerDay + substitutionIndex) % teachers.length];
      const substituteTeacher =
        teachers[(dayIndex * counts.substitutionsPerDay + substitutionIndex + 7) % teachers.length];
      const period = ((dayIndex + substitutionIndex) % 7) + 1;
      const dayLabel = schedule.day;

      substitutions.push({
        schoolId,
        dailyScheduleId: schedule.id,
        period,
        baseSlotId: baseSlotMap.get(`${dayLabel}:${classRow.id}:${period}`) || null,
        classId: classRow.id,
        subjectId: subjectRow.id,
        absentTeacherId: absentTeacher.id,
        substituteTeacherId: substituteTeacher.id,
        kind: SUBSTITUTION_KINDS[(dayIndex + substitutionIndex) % SUBSTITUTION_KINDS.length],
        isManual: substitutionIndex % 2 === 0,
        note: `Load substitution ${dayIndex}-${substitutionIndex}`
      });
    }

    for (let eventIndex = 0; eventIndex < counts.dailyEventsPerDay; eventIndex += 1) {
      const classRow = classes[(dayIndex + eventIndex) % classes.length];
      dailyEvents.push({
        schoolId,
        dailyScheduleId: schedule.id,
        type: DAILY_EVENT_TYPES[(dayIndex + eventIndex) % DAILY_EVENT_TYPES.length],
        classId: classRow.id,
        fromPeriod: ((dayIndex + eventIndex) % 7) + 1,
        toPeriod: Math.min(7, ((dayIndex + eventIndex) % 7) + 1 + (eventIndex % 2)),
        color: ["#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#dc2626"][(dayIndex + eventIndex) % 5],
        note: `Load daily event ${dayIndex}-${eventIndex}`
      });
    }
  }

  await createManyInChunks("dailyTeacherStatus", dailyStatuses, 2000);
  await createManyInChunks("substitution", substitutions, 2000);
  await createManyInChunks("dailyEvent", dailyEvents, 2000);
}

async function seedStudents({ schoolId, counts, classes }) {
  const students = [];
  for (let index = 0; index < counts.students; index += 1) {
    const schoolClass = classes[index % classes.length];
    const serial = pad(index + 1, 6);
    students.push({
      schoolId,
      classId: schoolClass.id,
      name: `Load Student ${serial}`,
      firstName: "Load",
      lastName: `Student ${serial}`,
      internalStudentNumber: `INT-${serial}`,
      externalId: `EXT-${serial}`,
      status: "ACTIVE",
      nationalId: `N${schoolId.replace(/[^a-z0-9]/gi, "")}${serial}`,
      fatherName: `Father ${serial}`,
      motherName: `Mother ${serial}`,
      residence: `Load City ${(index % 20) + 1}`,
      fatherPhone: `050${pad(index, 7)}`,
      motherPhone: `051${pad(index, 7)}`,
      guardianPhone: `052${pad(index, 7)}`,
      healthFund: "Load Health Fund",
      studentPhone: `053${pad(index, 7)}`
    });
  }

  await createManyInChunks("student", students, 2000);

  return prisma.student.findMany({
    where: { schoolId },
    orderBy: { internalStudentNumber: "asc" }
  });
}

async function seedLessons({ schoolId, counts, classes, subjects, teachers, assignmentMap }) {
  const lessons = [];
  const lessonStart = new Date(Date.UTC(2025, 8, 1));

  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    const schoolClass = classes[classIndex];
    for (let lessonIndex = 0; lessonIndex < counts.lessonsPerClass; lessonIndex += 1) {
      const subject = subjects[(classIndex + lessonIndex) % subjects.length];
      const teacherId =
        assignmentMap.get(`${schoolClass.id}:${subject.id}`) ||
        teachers[(classIndex + lessonIndex) % teachers.length].id;
      const period = PERIODS[lessonIndex % PERIODS.length];
      const lessonDate = addDays(lessonStart, (classIndex * counts.lessonsPerClass + lessonIndex) % 365);

      lessons.push({
        schoolId,
        classId: schoolClass.id,
        subjectId: subject.id,
        teacherId,
        lessonDate: toIsoDate(lessonDate),
        startTime: period.startTime,
        endTime: period.endTime,
        roomId: `ROOM-${pad((classIndex % 50) + 1, 2)}`,
        timetableSlotId: `SLOT-${pad(classIndex + 1, 3)}-${pad(lessonIndex + 1, 3)}`
      });
    }
  }

  await createManyInChunks("lesson", lessons, 2000);

  return prisma.lesson.findMany({
    where: { schoolId },
    orderBy: [{ classId: "asc" }, { lessonDate: "asc" }, { startTime: "asc" }]
  });
}

async function seedAttendance({ schoolId, counts, students }) {
  const rows = [];
  const startDate = new Date(Date.UTC(2025, 8, 1));

  for (let studentIndex = 0; studentIndex < students.length; studentIndex += 1) {
    const student = students[studentIndex];
    for (let dayOffset = 0; dayOffset < counts.attendanceDaysPerStudent; dayOffset += 1) {
      const currentDate = addDays(startDate, dayOffset);
      const status = ATTENDANCE_STATUSES[(studentIndex + dayOffset) % ATTENDANCE_STATUSES.length];
      rows.push({
        schoolId,
        studentId: student.id,
        date: toIsoDate(currentDate),
        day: dayName(currentDate),
        status,
        lateAt: status === "LATE" ? "08:20" : null,
        leftAt: status === "LEFT_EARLY" ? "12:10" : null,
        note: `Load attendance ${studentIndex}-${dayOffset}`
      });
    }
  }

  await createManyInChunks("studentAttendance", rows, 5000);
}

async function seedGrades({ schoolId, counts, students, subjects, teachers, assignmentMap }) {
  const rows = [];
  const gradeTypes = GRADE_TYPES;

  for (let studentIndex = 0; studentIndex < students.length; studentIndex += 1) {
    const student = students[studentIndex];
    for (let gradeIndex = 0; gradeIndex < counts.gradesPerStudent; gradeIndex += 1) {
      const subject = subjects[(studentIndex + gradeIndex) % subjects.length];
      const teacherId =
        assignmentMap.get(`${student.classId}:${subject.id}`) ||
        teachers[(studentIndex + gradeIndex) % teachers.length].id;
      const gradeValue = Number((((studentIndex * 13 + gradeIndex * 7) % 101) + (gradeIndex % 3) * 0.1).toFixed(1));

      rows.push({
        schoolId,
        studentId: student.id,
        classId: student.classId,
        subjectId: subject.id,
        teacherId,
        gradeValue,
        gradeType: gradeTypes[(studentIndex + gradeIndex) % gradeTypes.length],
        note: `Load grade ${studentIndex}-${gradeIndex}`
      });
    }
  }

  await createManyInChunks("gradeRecord", rows, 5000);
}

async function seedCertificates({ schoolId, counts, students, subjects, teachers, assignmentMap }) {
  const years = ["2022", "2023", "2024", "2025", "2026"];
  const rows = [];

  for (let studentIndex = 0; studentIndex < students.length; studentIndex += 1) {
    const student = students[studentIndex];
    for (let yearIndex = 0; yearIndex < counts.certificatesPerStudent; yearIndex += 1) {
      const subject = subjects[(studentIndex + yearIndex) % subjects.length];
      const teacherId =
        assignmentMap.get(`${student.classId}:${subject.id}`) ||
        teachers[(studentIndex + yearIndex) % teachers.length].id;
      const average = 70 + ((studentIndex + yearIndex) % 30);
      const certificateType = CERTIFICATE_TYPES[yearIndex % CERTIFICATE_TYPES.length];
      const year = years[yearIndex % years.length];

      rows.push({
        schoolId,
        studentId: student.id,
        certificateType,
        academicYear: year,
        issueDate: `${year}-06-${pad((studentIndex % 28) + 1, 2)}`,
        schoolNumber: `SN-${pad(studentIndex + 1, 6)}-${year}`,
        presentDays: 150 - (studentIndex % 15),
        absentDays: studentIndex % 5,
        lateDays: studentIndex % 4,
        earlyExitDays: studentIndex % 3,
        behaviorLevel: CERTIFICATE_BEHAVIORS[(studentIndex + yearIndex) % CERTIFICATE_BEHAVIORS.length],
        behaviorNote: `Load behavior ${studentIndex}-${yearIndex}`,
        teacherNotes: `Load teacher notes ${studentIndex}-${yearIndex}`,
        adminNotes: `Load admin notes ${studentIndex}-${yearIndex}`,
        teacherSignature: `Teacher ${pad((studentIndex % teachers.length) + 1, 4)}`,
        principalSignature: `Principal ${runKeySuffix(studentIndex)}`,
        average,
        grade: String.fromCharCode(65 + ((studentIndex + yearIndex) % 5)),
        result: CERTIFICATE_RESULTS[(studentIndex + yearIndex) % CERTIFICATE_RESULTS.length],
        saved: yearIndex % 2 === 0,
        published: yearIndex % 3 === 0,
        subjectRows: [
          {
            subjectId: subject.id,
            subjectName: subject.name,
            teacherId,
            average
          }
        ]
      });
    }
  }

  await createManyInChunks("studentCertificate", rows, 2000);
}

function runKeySuffix(index) {
  return pad((index % 9999) + 1, 4);
}

async function seedNotifications({ schoolId, counts, students }) {
  const rows = [];

  for (let studentIndex = 0; studentIndex < students.length; studentIndex += 1) {
    const student = students[studentIndex];
    for (let eventIndex = 0; eventIndex < counts.notificationsPerStudent; eventIndex += 1) {
      rows.push({
        schoolId,
        studentId: student.id,
        eventType: NOTIFICATION_EVENT_TYPES[(studentIndex + eventIndex) % NOTIFICATION_EVENT_TYPES.length],
        channel: ["SMS", "IN_APP", "WHATSAPP"][(studentIndex + eventIndex) % 3],
        recipientType: "PARENT",
        status: NOTIFICATION_STATUSES[(studentIndex + eventIndex) % NOTIFICATION_STATUSES.length],
        title: `Load notification ${studentIndex}-${eventIndex}`,
        message: `Load message ${studentIndex}-${eventIndex}`,
        recipientPhones: [
          student.guardianPhone || student.fatherPhone || student.motherPhone || `059${pad(studentIndex, 7)}`
        ],
        recipientNames: [`Parent ${pad(studentIndex + 1, 6)}`],
        payload: {
          studentId: student.id,
          runId: schoolId,
          eventIndex
        },
        errorMessage: (studentIndex + eventIndex) % 7 === 0 ? "Simulated failure" : null
      });
    }
  }

  await createManyInChunks("studentNotification", rows, 5000);
}

async function seedReportsAndBackups({ schoolId, counts, adminUser }) {
  const reportRows = [];
  for (let index = 0; index < counts.reportExports; index += 1) {
    reportRows.push({
      schoolId,
      reportType: ["attendance", "grades", "certificates", "daily-schedule"][index % 4],
      fileType: "PDF",
      filePath: `/perf/${schoolId}/reports/report-${pad(index + 1, 6)}.pdf`,
      requestedBy: adminUser?.id || null,
      status: REPORT_EXPORT_STATUSES[index % REPORT_EXPORT_STATUSES.length],
      expiresAt: addDays(new Date(Date.UTC(2026, 0, 1)), 7 + (index % 10))
    });
  }
  await createManyInChunks("reportExport", reportRows, 2000);

  const backupRows = [];
  for (let index = 0; index < counts.backupJobs; index += 1) {
    backupRows.push({
      schoolId,
      backupType: index % 4 === 0 ? "FULL" : "INCREMENTAL",
      status: BACKUP_STATUSES[index % BACKUP_STATUSES.length],
      filePath: `/perf/${schoolId}/backups/backup-${pad(index + 1, 6)}.enc`,
      checksum: hashString(`${schoolId}:backup:${index}`),
      encrypted: true,
      startedAt: new Date(Date.UTC(2026, 0, 1, 0, index % 59, index % 59)),
      finishedAt: index % 3 === 0 ? new Date(Date.UTC(2026, 0, 1, 0, (index + 2) % 59, (index + 2) % 59)) : null,
      createdBy: adminUser?.id || null
    });
  }
  await createManyInChunks("backupJob", backupRows, 1000);
}

async function seedAuditLogs({ schoolId, counts, adminUser, students, teachers, classes, subjects }) {
  const rows = [];
  const actionTypes = [
    "CREATE_STUDENT",
    "UPDATE_STUDENT",
    "CREATE_GRADE",
    "UPDATE_GRADE",
    "MARK_ATTENDANCE",
    "EXPORT_REPORT",
    "APPROVE_CERTIFICATE",
    "CREATE_DAILY_SCHEDULE",
    "CREATE_SUBSTITUTION",
    "CREATE_EVENT"
  ];
  const entityTypes = [
    "Student",
    "GradeRecord",
    "StudentAttendance",
    "ReportExport",
    "StudentCertificate",
    "DailySchedule",
    "Substitution",
    "DailyEvent"
  ];

  for (let index = 0; index < counts.auditLogsPerStudent * students.length; index += 1) {
    const student = students[index % students.length];
    const teacher = teachers[index % teachers.length];
    const schoolClass = classes[index % classes.length];
    const subject = subjects[index % subjects.length];
    const entityType = entityTypes[index % entityTypes.length];

    rows.push({
      schoolId,
      userId: adminUser?.id || null,
      action: actionTypes[index % actionTypes.length],
      entity: entityType,
      entityType,
      entityId: [student.id, teacher.id, schoolClass.id, subject.id][index % 4],
      before: { index, entityType, phase: "before" },
      after: { index, entityType, phase: "after" },
      oldValue: { index, entityType, phase: "before" },
      newValue: { index, entityType, phase: "after" },
      accessResult: "ALLOWED",
      ipAddress: `10.0.${index % 255}.${(index * 7) % 255}`,
      userAgent: "PerfSeeder/1.0"
    });
  }

  await createManyInChunks("auditLog", rows, 5000);
}

async function main() {
  const { values } = parseArgs({
    options: {
      cleanup: { type: "boolean", short: "c" },
      profile: { type: "string" },
      datasetSize: { type: "string" },
      runId: { type: "string" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true
  });

  if (values.help) {
    printUsage();
    return;
  }

  const runIdRaw = values.runId || process.env.PERF_RUN_ID;
  if (!runIdRaw) {
    throw new Error("PERF_RUN_ID is required so the dataset can be deleted deterministically later.");
  }

  const runKey = sanitizeRunId(runIdRaw);
  if (!runKey) {
    throw new Error("PERF_RUN_ID must contain at least one alphanumeric character.");
  }

  const profileName = String(
    values.datasetSize || values.profile || process.env.PERF_DATASET_SIZE || process.env.PERF_PROFILE || "high"
  ).toLowerCase();
  const counts = buildProfile(profileName);
  const schoolId = `perf-${runKey}`;

  if (
    profileName === "strong" &&
    isLocalDatabaseUrl(process.env.DATABASE_URL) &&
    process.env.PERF_ALLOW_STRONG_LOCAL_DB !== "1"
  ) {
    throw new Error(
      "Strong performance seeding must run on a separate perf/staging database, not the local development database."
    );
  }

  trace("perf seed started", { runKey, schoolId, profile: profileName, counts });

  try {
    await cleanupPerfDataset(schoolId);
    if (values.cleanup) {
      return;
    }

    await seedCoreSchool(schoolId, runKey);
    const core = await seedUsersAndTeachers({ schoolId, runKey, counts });
    const { classes, subjects } = await seedClassesAndSubjects({ schoolId, counts, teachers: core.teachers });
    const { assignmentMap, baseSlotMap } = await seedAssignments({
      schoolId,
      classes,
      subjects,
      teachers: core.teachers
    });
    await seedDailySchedules({
      schoolId,
      counts,
      teachers: core.teachers,
      classes,
      subjects,
      assignmentMap,
      baseSlotMap
    });
    const students = await seedStudents({ schoolId, counts, classes });
    const lessonRows = await seedLessons({
      schoolId,
      counts,
      classes,
      subjects,
      teachers: core.teachers,
      assignmentMap
    });
    await seedAttendance({ schoolId, counts, students });
    await seedGrades({ schoolId, counts, students, classes, subjects, teachers: core.teachers, assignmentMap });
    await seedCertificates({ schoolId, counts, students, subjects, teachers: core.teachers, assignmentMap });
    await seedNotifications({ schoolId, counts, students });
    await seedReportsAndBackups({ schoolId, counts, adminUser: core.adminUser });
    await seedAuditLogs({
      schoolId,
      counts,
      adminUser: core.adminUser,
      students,
      teachers: core.teachers,
      classes,
      subjects
    });

    trace("perf seed completed", {
      schoolId,
      teachers: core.teachers.length,
      classes: classes.length,
      subjects: subjects.length,
      students: students.length,
      lessons: lessonRows.length
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
