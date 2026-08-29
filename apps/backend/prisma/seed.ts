import { prisma } from "../src/db/prisma";
import { logSafeError } from "../src/lib/safeLog";
import { hashPassword } from "../src/services/authService";

const schoolId = "default-school";

const workingDays = ["السبت", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const offDays = ["الأحد", "الجمعة"];

const defaultPeriods = [
  { period: 1, label: "الحصة 1", startTime: "08:10", endTime: "09:00" },
  { period: 2, label: "الحصة 2", startTime: "09:00", endTime: "09:50" },
  { period: 3, label: "الحصة 3", startTime: "09:50", endTime: "10:35" },
  { period: 4, label: "الحصة 4", startTime: "11:00", endTime: "11:45" },
  { period: 5, label: "الحصة 5", startTime: "11:45", endTime: "12:30" },
  { period: 6, label: "الحصة 6", startTime: "12:30", endTime: "13:15" },
  { period: 7, label: "الحصة 7", startTime: "13:15", endTime: "14:00" }
];

const subjectSeeds = [
  { name: "عربي", code: "ARB" },
  { name: "رياضيات", code: "MTH" },
  { name: "علوم", code: "SCI" },
  { name: "الدراسات الاجتماعية", code: "SOC" },
  { name: "تاريخ", code: "HIS" },
  { name: "جغرافيا", code: "GEO" },
  { name: "عبري", code: "HEB" },
  { name: "اللغة الانجليزية", code: "ENG" },
  { name: "بيولوجيا", code: "BIO" },
  { name: "تكنولوجيا", code: "TEC" },
  { name: "ثقافة علمية", code: "SCL" },
  { name: "مدنيات", code: "CIV" },
  { name: "دين", code: "REL" }
];

const teacherSeeds = [
  { name: "سامي الخطيب", specialty: "عربي" },
  { name: "ليلى منصور", specialty: "رياضيات" },
  { name: "أحمد الزعبي", specialty: "علوم / بيولوجيا" },
  { name: "نور حجازي", specialty: "الدراسات الاجتماعية / جغرافيا" },
  { name: "رامي أبو حسين", specialty: "تاريخ / مدنيات" },
  { name: "سارة ناصر", specialty: "اللغة الانجليزية" },
  { name: "محمود شقير", specialty: "عبري" },
  { name: "هناء عبيد", specialty: "تكنولوجيا / ثقافة علمية" },
  { name: "يوسف عودة", specialty: "دين" },
  { name: "ريم كيوان", specialty: "مربية صفية" },
  { name: "باسل خطيب", specialty: "مناوبة وإشراف" },
  { name: "فادي صوالحة", specialty: "عربي" },
  { name: "دينا مراد", specialty: "رياضيات" },
  { name: "هبة بشارات", specialty: "علوم" },
  { name: "جواد حمد", specialty: "اللغة الانجليزية" },
  { name: "رلى إسماعيل", specialty: "تكنولوجيا / ثقافة علمية" }
];

const classSeeds = [
  { gradeLevel: "9", grade: "تاسع", section: "أ", name: "الصف التاسع أ", homeroomTeacherName: "سامي الخطيب" },
  { gradeLevel: "9", grade: "تاسع", section: "ب", name: "الصف التاسع ب", homeroomTeacherName: "ليلى منصور" },
  { gradeLevel: "9", grade: "تاسع", section: "ج", name: "الصف التاسع ج", homeroomTeacherName: "أحمد الزعبي" },
  { gradeLevel: "9", grade: "تاسع", section: "د", name: "الصف التاسع د", homeroomTeacherName: "نور حجازي" },
  { gradeLevel: "10", grade: "عاشر", section: "أ", name: "الصف العاشر أ", homeroomTeacherName: "رامي أبو حسين" },
  { gradeLevel: "10", grade: "عاشر", section: "ب", name: "الصف العاشر ب", homeroomTeacherName: "سارة ناصر" },
  { gradeLevel: "10", grade: "عاشر", section: "ج", name: "الصف العاشر ج", homeroomTeacherName: "محمود شقير" },
  { gradeLevel: "11", grade: "حادي عشر", section: "أ", name: "الصف الحادي عشر أ", homeroomTeacherName: "هناء عبيد" },
  { gradeLevel: "11", grade: "حادي عشر", section: "ب", name: "الصف الحادي عشر ب", homeroomTeacherName: "يوسف عودة" },
  { gradeLevel: "12", grade: "ثاني عشر", section: "أ", name: "الصف الثاني عشر أ", homeroomTeacherName: "ريم كيوان" },
  { gradeLevel: "12", grade: "ثاني عشر", section: "ب", name: "الصف الثاني عشر ب", homeroomTeacherName: "باسل خطيب" }
];

const studentFirstNames = [
  "أحمد",
  "محمد",
  "سارة",
  "ليان",
  "نور",
  "ياسمين",
  "علي",
  "عمر",
  "ريم",
  "جنى",
  "مريم",
  "يوسف",
  "آدم",
  "هنا",
  "تقى",
  "سلمى",
  "رامي",
  "لين",
  "كريم",
  "شهد",
  "لينا",
  "ياسر",
  "سعيد",
  "دانا",
  "إياد",
  "تالا",
  "فارس",
  "روان",
  "مازن",
  "رنا"
];

const studentLastNames = [
  "الخطيب",
  "النجار",
  "الزعبي",
  "حجازي",
  "منصور",
  "ناصر",
  "شقير",
  "عبيد",
  "عودة",
  "كيوان",
  "مطر",
  "صباغ",
  "حسن",
  "سليم",
  "الرفاعي",
  "الحداد",
  "أبو حسين",
  "العمري",
  "ياسين",
  "الخالدي",
  "الحموري",
  "الشامي",
  "الحسن",
  "السمرا",
  "درويش",
  "الحاج",
  "السقا",
  "المصري",
  "مصلح",
  "بدارنة"
];

function stableId(...parts: Array<string | number>) {
  return parts
    .map((part) => String(part).trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]+/gu, ""))
    .join("-");
}

async function ensureOptionalMfaColumns() {
  await prisma.$executeRaw`
    ALTER TABLE "School"
    ADD COLUMN IF NOT EXISTS "admin_mfa_required" BOOLEAN NOT NULL DEFAULT false;
  `;

  await prisma.$executeRaw`
    ALTER TABLE "SchoolSettings"
    ADD COLUMN IF NOT EXISTS "admin_mfa_required" BOOLEAN NOT NULL DEFAULT false;
  `;
}

async function main() {
  await ensureOptionalMfaColumns();

  const school =
    (await prisma.school.findUnique({ where: { id: schoolId } })) ||
    (await prisma.school.create({
      data: {
        id: schoolId,
        name: "مدرسة جديدة",
        address: "",
        managerName: "",
        institutionCode: ""
      }
    }));

  await prisma.schoolSettings.upsert({
    where: { schoolId: school.id },
    update: {
      workingDays,
      offDays,
      periodsPerDay: defaultPeriods.length,
      maxTeachers: 100
    },
    create: {
      schoolId: school.id,
      workingDays,
      offDays,
      periodsPerDay: defaultPeriods.length,
      maxTeachers: 100
    }
  });

  for (const period of defaultPeriods) {
    await prisma.periodDefinition.upsert({
      where: { schoolId_period: { schoolId: school.id, period: period.period } },
      update: {
        label: period.label,
        startTime: period.startTime,
        endTime: period.endTime,
        isActive: true
      },
      create: {
        schoolId: school.id,
        period: period.period,
        label: period.label,
        startTime: period.startTime,
        endTime: period.endTime,
        isActive: true
      }
    });
  }

  const subjectByName = new Map<string, Awaited<ReturnType<typeof prisma.subject.upsert>>>();
  for (const subject of subjectSeeds) {
    const record = await prisma.subject.upsert({
      where: { schoolId_name: { schoolId: school.id, name: subject.name } },
      update: {
        code: subject.code,
        status: "ACTIVE",
        maxMark: 100,
        passMark: 50
      },
      create: {
        id: stableId("subject", school.id, subject.code),
        schoolId: school.id,
        name: subject.name,
        code: subject.code,
        status: "ACTIVE",
        maxMark: 100,
        passMark: 50
      }
    });
    subjectByName.set(subject.name, record);
  }

  const teacherByName = new Map<string, Awaited<ReturnType<typeof prisma.teacher.upsert>>>();
  for (const teacher of teacherSeeds) {
    const record = await prisma.teacher.upsert({
      where: { schoolId_name: { schoolId: school.id, name: teacher.name } },
      update: {
        specialty: teacher.specialty,
        status: "ACTIVE",
        employmentRatio: 100,
        targetLoad: 25
      },
      create: {
        id: stableId("teacher", school.id, teacher.name),
        schoolId: school.id,
        name: teacher.name,
        specialty: teacher.specialty,
        status: "ACTIVE",
        employmentRatio: 100,
        targetLoad: 25
      }
    });
    teacherByName.set(teacher.name, record);
  }

  const classByName = new Map<string, Awaited<ReturnType<typeof prisma.schoolClass.upsert>>>();
  for (const classSeed of classSeeds) {
    const homeroomTeacher = teacherByName.get(classSeed.homeroomTeacherName);
    if (!homeroomTeacher) {
      throw new Error(`Missing homeroom teacher seed for ${classSeed.name}`);
    }

    const record = await prisma.schoolClass.upsert({
      where: { schoolId_name: { schoolId: school.id, name: classSeed.name } },
      update: {
        gradeLevel: classSeed.gradeLevel,
        grade: classSeed.grade,
        section: classSeed.section,
        maxStudents: 30,
        homeroomTeacherId: homeroomTeacher.id,
        status: "ACTIVE"
      },
      create: {
        id: stableId("class", school.id, classSeed.name),
        schoolId: school.id,
        name: classSeed.name,
        gradeLevel: classSeed.gradeLevel,
        grade: classSeed.grade,
        section: classSeed.section,
        maxStudents: 30,
        homeroomTeacherId: homeroomTeacher.id,
        status: "ACTIVE"
      }
    });
    classByName.set(classSeed.name, record);
  }

  const homeroomDays = ["السبت", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  for (let index = 0; index < classSeeds.length; index += 1) {
    const classSeed = classSeeds[index];
    const schoolClass = classByName.get(classSeed.name);
    const teacher = teacherByName.get(classSeed.homeroomTeacherName);
    if (!schoolClass || !teacher) continue;

    const weeklyDay = homeroomDays[index % homeroomDays.length];
    const weeklyPeriod = (index % 3) + 1;

    await prisma.homeroomAssignment.upsert({
      where: { schoolId_classId: { schoolId: school.id, classId: schoolClass.id } },
      update: {
        teacherId: teacher.id,
        weeklyDay,
        weeklyPeriod,
        isActive: true,
        notes: "بيانات تجريبية للمربّي الأساسي"
      },
      create: {
        id: stableId("homeroom", school.id, schoolClass.id),
        schoolId: school.id,
        teacherId: teacher.id,
        classId: schoolClass.id,
        weeklyDay,
        weeklyPeriod,
        isActive: true,
        notes: "بيانات تجريبية للمربّي الأساسي"
      }
    });
  }

  const scheduleDays = workingDays;
  const weeklySubjectCycle = subjectSeeds.map((subject) => subject.name);
  const subjectTeacherPool = new Map<string, string[]>([
    ["عربي", ["سامي الخطيب", "فادي صوالحة"]],
    ["رياضيات", ["ليلى منصور", "دينا مراد"]],
    ["علوم", ["أحمد الزعبي", "هبة بشارات"]],
    ["الدراسات الاجتماعية", ["نور حجازي"]],
    ["تاريخ", ["رامي أبو حسين"]],
    ["جغرافيا", ["نور حجازي"]],
    ["عبري", ["محمود شقير"]],
    ["اللغة الانجليزية", ["سارة ناصر", "جواد حمد"]],
    ["بيولوجيا", ["أحمد الزعبي"]],
    ["تكنولوجيا", ["هناء عبيد", "رلى إسماعيل"]],
    ["ثقافة علمية", ["هناء عبيد", "رلى إسماعيل"]],
    ["مدنيات", ["رامي أبو حسين"]],
    ["دين", ["يوسف عودة"]]
  ]);
  const assignmentTotals = new Map<string, number>();
  const subjectLinks = new Map<string, true>();

  for (let classIndex = 0; classIndex < classSeeds.length; classIndex += 1) {
    const classSeed = classSeeds[classIndex];
    const schoolClass = classByName.get(classSeed.name);
    if (!schoolClass) continue;

    for (let dayIndex = 0; dayIndex < scheduleDays.length; dayIndex += 1) {
      const day = scheduleDays[dayIndex];

      for (let periodIndex = 0; periodIndex < defaultPeriods.length; periodIndex += 1) {
        const period = periodIndex + 1;
        const subjectName = weeklySubjectCycle[(classIndex * 5 + dayIndex * 7 + periodIndex) % weeklySubjectCycle.length];
        const subject = subjectByName.get(subjectName);
        const teacherPool = subjectTeacherPool.get(subjectName) || teacherSeeds.map((item) => item.name);
        const teacherName = teacherPool[(classIndex + dayIndex + periodIndex) % teacherPool.length];
        const teacherRecord = teacherByName.get(teacherName);

        if (!subject || !teacherRecord) {
          continue;
        }

        const slotId = stableId("base-slot", school.id, day, period, schoolClass.id);
        await prisma.baseScheduleSlot.upsert({
          where: { id: slotId },
          update: {
            day,
            period,
            classId: schoolClass.id,
            subjectId: subject.id,
            teacherId: teacherRecord.id,
            room: null
          },
          create: {
            id: slotId,
            schoolId: school.id,
            day,
            period,
            classId: schoolClass.id,
            subjectId: subject.id,
            teacherId: teacherRecord.id,
            room: null
          }
        });

        const assignmentKey = `${teacherRecord.id}|${schoolClass.id}|${subject.id}`;
        assignmentTotals.set(assignmentKey, (assignmentTotals.get(assignmentKey) || 0) + 1);
        subjectLinks.set(assignmentKey, true);
      }
    }
  }

  for (const [assignmentKey, weeklyPeriods] of assignmentTotals.entries()) {
    const [teacherId, classId, subjectId] = assignmentKey.split("|");
    const assignmentId = stableId("teacher-assignment", school.id, teacherId, classId, subjectId);
    const subjectLinkId = stableId("teacher-subject", school.id, teacherId, classId, subjectId);

    await prisma.teacherAssignment.upsert({
      where: { id: assignmentId },
      update: { weeklyPeriods },
      create: {
        id: assignmentId,
        schoolId: school.id,
        teacherId,
        classId,
        subjectId,
        weeklyPeriods
      }
    });

    await prisma.teacherSubject.upsert({
      where: { id: subjectLinkId },
      update: {},
      create: {
        id: subjectLinkId,
        schoolId: school.id,
        teacherId,
        classId,
        subjectId
      }
    });
  }

  const studentsPerClass = 30;
  const studentsByClass = new Map<string, Awaited<ReturnType<typeof prisma.student.upsert>>[]>();
  for (let classIndex = 0; classIndex < classSeeds.length; classIndex += 1) {
    const classSeed = classSeeds[classIndex];
    const schoolClass = classByName.get(classSeed.name);
    if (!schoolClass) continue;

    for (let studentIndex = 0; studentIndex < studentsPerClass; studentIndex += 1) {
      const firstName = studentFirstNames[(studentIndex + classIndex) % studentFirstNames.length];
      const lastName = studentLastNames[(studentIndex * 2 + classIndex) % studentLastNames.length];
      const studentId = stableId("student", school.id, schoolClass.id, studentIndex + 1);
      const serial = String(studentIndex + 1).padStart(2, "0");

      const studentRecord = await prisma.student.upsert({
        where: { id: studentId },
        update: {
          schoolId: school.id,
          classId: schoolClass.id,
          name: `${firstName} ${lastName}`,
          firstName,
          lastName,
          internalStudentNumber: `${classSeed.gradeLevel}-${classIndex + 1}-${serial}`,
          status: "ACTIVE"
        },
        create: {
          id: studentId,
          schoolId: school.id,
          classId: schoolClass.id,
          name: `${firstName} ${lastName}`,
          firstName,
          lastName,
          internalStudentNumber: `${classSeed.gradeLevel}-${classIndex + 1}-${serial}`,
          status: "ACTIVE"
        }
      });

      const classStudents = studentsByClass.get(classSeed.name) || [];
      classStudents.push(studentRecord);
      studentsByClass.set(classSeed.name, classStudents);
    }
  }

  const demoDate = "2026-08-29";
  const previousDay = "2026-08-28";
  const academicYear = "2026/2027";
  const demoClass = classByName.get("الصف التاسع أ");
  const demoStudents = (studentsByClass.get("الصف التاسع أ") || []).slice(0, 4);
  const demoSubjects = {
    arabic: subjectByName.get("عربي"),
    math: subjectByName.get("رياضيات"),
    english: subjectByName.get("اللغة الانجليزية")
  };

  if (!demoClass || demoStudents.length < 4 || !demoSubjects.arabic || !demoSubjects.math || !demoSubjects.english) {
    throw new Error("Missing demo seeds for showcase data");
  }
  const [demoStudent1, demoStudent2, demoStudent3, demoStudent4] = demoStudents as [
    Awaited<ReturnType<typeof prisma.student.upsert>>,
    Awaited<ReturnType<typeof prisma.student.upsert>>,
    Awaited<ReturnType<typeof prisma.student.upsert>>,
    Awaited<ReturnType<typeof prisma.student.upsert>>
  ];
  const demoSubjectArabic = demoSubjects.arabic;
  const demoSubjectMath = demoSubjects.math;
  const demoSubjectEnglish = demoSubjects.english;

  const demoAssignments = await prisma.teacherAssignment.findMany({
    where: { schoolId: school.id, classId: demoClass.id },
    include: { teacher: true, class: true, subject: true }
  });

  const assignmentBySubjectId = new Map(demoAssignments.map((assignment) => [assignment.subjectId, assignment]));
  const teacherForSubject = (subjectId: string) => {
    const assignment = assignmentBySubjectId.get(subjectId);
    if (!assignment) {
      throw new Error(`Missing teacher assignment for subject ${subjectId}`);
    }
    return assignment.teacher;
  };

  const demoClassStudents = studentsByClass.get("الصف التاسع أ") || [];
  const attendanceDayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const shiftDate = (baseDate: string, offsetDays: number) => {
    const date = new Date(`${baseDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
  };
  const dayNameFor = (isoDate: string) => attendanceDayNames[new Date(`${isoDate}T00:00:00.000Z`).getUTCDay()];

  if (demoClassStudents.length < 26) {
    throw new Error("Missing class roster for attendance demo data");
  }

  const attendancePlan = [
    ...demoClassStudents.slice(0, 26).map((student, index) => ({
      student,
      date: shiftDate("2026-07-20", index),
      status: "PRESENT" as const,
      lateAt: null,
      leftAt: null,
      note: "حضور منتظم"
    })),
    ...demoClassStudents.slice(0, 4).map((student, index) => ({
      student,
      date: shiftDate("2026-08-15", index),
      status: "LATE" as const,
      lateAt: "07:42",
      leftAt: null,
      note: "تأخر بسيط مع التزام جيد"
    })),
    ...demoClassStudents.slice(4, 7).map((student, index) => ({
      student,
      date: shiftDate("2026-08-19", index),
      status: "ABSENT_UNEXCUSED" as const,
      lateAt: null,
      leftAt: null,
      note: "غياب غير مبرر"
    })),
    ...demoClassStudents.slice(7, 9).map((student, index) => ({
      student,
      date: shiftDate("2026-08-22", index),
      status: "ABSENT_EXCUSED" as const,
      lateAt: null,
      leftAt: null,
      note: "غياب بعذر"
    })),
    ...demoClassStudents.slice(0, 1).map((student, index) => ({
      student,
      date: shiftDate("2026-08-24", index),
      status: "LEFT_EARLY" as const,
      lateAt: null,
      leftAt: "11:20",
      note: "مغادرة مبكرة بعد إذن"
    })),
    ...demoClassStudents.slice(9, 10).map((student, index) => ({
      student,
      date: shiftDate("2026-08-25", index),
      status: "LEFT_EARLY" as const,
      lateAt: null,
      leftAt: "11:35",
      note: "مغادرة مبكرة بسبب ظرف عائلي"
    }))
  ];

  const certificateTypes = ["TERM1_BIMONTHLY", "TERM1_FINAL", "TERM2_BIMONTHLY", "TERM2_FINAL"] as const;
  const certificateTypeSubjects: Record<
    (typeof certificateTypes)[number],
    Array<NonNullable<(typeof demoSubjects)[keyof typeof demoSubjects]>>
  > = {
    TERM1_BIMONTHLY: [demoSubjectArabic, demoSubjectMath, demoSubjectEnglish],
    TERM1_FINAL: [demoSubjectArabic, demoSubjectMath, demoSubjectEnglish],
    TERM2_BIMONTHLY: [demoSubjectArabic, demoSubjectMath, demoSubjectEnglish],
    TERM2_FINAL: [demoSubjectArabic, demoSubjectMath, demoSubjectEnglish]
  };

  const gradeSectionsByType: Record<(typeof certificateTypes)[number], Array<{ id: string; name: string; percentage: number; outOf: number }>> =
    {
      TERM1_BIMONTHLY: [
        { id: "daily-exam", name: "امتحان يومي", percentage: 10, outOf: 10 },
        { id: "attendance-participation", name: "الحضور والمشاركة", percentage: 10, outOf: 10 },
        { id: "bimonthly-exam", name: "امتحان شهرين", percentage: 20, outOf: 20 }
      ],
      TERM1_FINAL: [
        { id: "daily-exam", name: "امتحان يومي", percentage: 10, outOf: 10 },
        { id: "attendance-participation", name: "الحضور والمشاركة", percentage: 10, outOf: 10 },
        { id: "final-exam", name: "الامتحان النهائي", percentage: 40, outOf: 40 }
      ],
      TERM2_BIMONTHLY: [
        { id: "daily-exam", name: "امتحان يومي", percentage: 10, outOf: 10 },
        { id: "attendance-participation", name: "الحضور والمشاركة", percentage: 10, outOf: 10 },
        { id: "bimonthly-exam", name: "امتحان شهرين", percentage: 20, outOf: 20 }
      ],
      TERM2_FINAL: [
        { id: "daily-exam", name: "امتحان يومي", percentage: 10, outOf: 10 },
        { id: "attendance-participation", name: "الحضور والمشاركة", percentage: 10, outOf: 10 },
        { id: "final-exam", name: "الامتحان النهائي", percentage: 40, outOf: 40 }
      ]
    };

  const gradeEntriesByType: Record<(typeof certificateTypes)[number], Record<string, Record<string, string>>> = {
    TERM1_BIMONTHLY: {
      [demoStudent1.id]: { "daily-exam": "9", "attendance-participation": "10", "bimonthly-exam": "18" },
      [demoStudent2.id]: { "daily-exam": "8", "attendance-participation": "9", "bimonthly-exam": "16" },
      [demoStudent3.id]: { "daily-exam": "10", "attendance-participation": "10", "bimonthly-exam": "19" }
    },
    TERM1_FINAL: {
      [demoStudent1.id]: { "daily-exam": "9", "attendance-participation": "10", "final-exam": "35" },
      [demoStudent2.id]: { "daily-exam": "7", "attendance-participation": "8", "final-exam": "31" },
      [demoStudent3.id]: { "daily-exam": "8", "attendance-participation": "9", "final-exam": "33" }
    },
    TERM2_BIMONTHLY: {
      [demoStudent1.id]: { "daily-exam": "10", "attendance-participation": "10", "bimonthly-exam": "17" },
      [demoStudent2.id]: { "daily-exam": "9", "attendance-participation": "9", "bimonthly-exam": "15" },
      [demoStudent3.id]: { "daily-exam": "10", "attendance-participation": "10", "bimonthly-exam": "18" }
    },
    TERM2_FINAL: {
      [demoStudent1.id]: { "daily-exam": "9", "attendance-participation": "10", "final-exam": "36" },
      [demoStudent2.id]: { "daily-exam": "8", "attendance-participation": "9", "final-exam": "30" },
      [demoStudent3.id]: { "daily-exam": "9", "attendance-participation": "10", "final-exam": "34" }
    }
  };

  for (const certificateType of certificateTypes) {
    for (const subject of Object.values(certificateTypeSubjects[certificateType])) {
      const schemeId = stableId("grade-scheme", school.id, demoClass.id, subject.id, certificateType);
      await prisma.studentGradeScheme.upsert({
        where: {
          schoolId_classId_subjectId_certificateType: {
            schoolId: school.id,
            classId: demoClass.id,
            subjectId: subject.id,
            certificateType
          }
        },
        update: {
          title: `${subject.name} - ${certificateType}`,
          maxScore: certificateType.endsWith("FINAL") ? 40 : 20,
          sections: gradeSectionsByType[certificateType]
        },
        create: {
          id: schemeId,
          schoolId: school.id,
          classId: demoClass.id,
          subjectId: subject.id,
          certificateType,
          title: `${subject.name} - ${certificateType}`,
          maxScore: certificateType.endsWith("FINAL") ? 40 : 20,
          sections: gradeSectionsByType[certificateType]
        }
      });

      const entryId = stableId("grade-entry", school.id, demoClass.id, subject.id, certificateType);
      await prisma.studentGradeEntry.upsert({
        where: {
          schoolId_classId_subjectId_certificateType: {
            schoolId: school.id,
            classId: demoClass.id,
            subjectId: subject.id,
            certificateType
          }
        },
        update: {
          rows: gradeEntriesByType[certificateType]
        },
        create: {
          id: entryId,
          schoolId: school.id,
          classId: demoClass.id,
          subjectId: subject.id,
          certificateType,
          rows: gradeEntriesByType[certificateType]
        }
      });
    }
  }

  const certificatePayloads = [
    {
      student: demoStudent1,
      type: "TERM1_BIMONTHLY" as const,
      subjectRows: [
        {
          id: stableId("cert-row", demoStudent1.id, "arabic", "t1b"),
          subjectId: demoSubjectArabic.id,
          subjectName: demoSubjectArabic.name,
          mark: "38",
          maxScore: 40,
          grade: "certificates.grades.excellent",
          note: "إتقان ممتاز في القراءة والتحليل"
        },
        {
          id: stableId("cert-row", demoStudent1.id, "math", "t1b"),
          subjectId: demoSubjectMath.id,
          subjectName: demoSubjectMath.name,
          mark: "34",
          maxScore: 40,
          grade: "certificates.grades.veryGood",
          note: "يحتاج إلى مزيد من السرعة في حل المسائل"
        },
        {
          id: stableId("cert-row", demoStudent1.id, "english", "t1b"),
          subjectId: demoSubjectEnglish.id,
          subjectName: demoSubjectEnglish.name,
          mark: "36",
          maxScore: 40,
          grade: "certificates.grades.excellent",
          note: "مشاركة شفوية واضحة وثقة ملحوظة"
        }
      ],
      presentDays: 17,
      absentDays: 1,
      lateDays: 1,
      earlyExitDays: 0,
      behaviorLevel: "VERY_GOOD" as const,
      behaviorNote: "سلوك ملتزم وحضور مميز داخل الصف.",
      teacherNotes: "طالب نشيط ويستفيد بسرعة من التغذية الراجعة.",
      adminNotes: "بيانات تجريبية للشهادة الأولى.",
      teacherSignature: teacherForSubject(demoSubjectArabic.id).name,
      principalSignature: "مدير المدرسة",
      average: 90,
      result: "PASS" as const
    },
    {
      student: demoStudent2,
      type: "TERM1_FINAL" as const,
      subjectRows: [
        {
          id: stableId("cert-row", demoStudent2.id, "arabic", "t1f"),
          subjectId: demoSubjectArabic.id,
          subjectName: demoSubjectArabic.name,
          mark: "31",
          maxScore: 40,
          grade: "certificates.grades.good",
          note: "أداء ثابت مع حاجة لمراجعة القواعد"
        },
        {
          id: stableId("cert-row", demoStudent2.id, "math", "t1f"),
          subjectId: demoSubjectMath.id,
          subjectName: demoSubjectMath.name,
          mark: "30",
          maxScore: 40,
          grade: "certificates.grades.good",
          note: "يجيد التطبيقات الأساسية ويحتاج تعزيز الحلول"
        },
        {
          id: stableId("cert-row", demoStudent2.id, "english", "t1f"),
          subjectId: demoSubjectEnglish.id,
          subjectName: demoSubjectEnglish.name,
          mark: "33",
          maxScore: 40,
          grade: "certificates.grades.veryGood",
          note: "تحسن واضح في الفهم والاستجابة"
        }
      ],
      presentDays: 16,
      absentDays: 2,
      lateDays: 1,
      earlyExitDays: 1,
      behaviorLevel: "GOOD" as const,
      behaviorNote: "سلوك جيد مع بعض الملاحظات البسيطة في الالتزام بالوقت.",
      teacherNotes: "يظهر تقدماً ثابتاً مع الحاجة للمتابعة المنزلية.",
      adminNotes: "اعتماد تجريبي للفصل الأول النهائي.",
      teacherSignature: teacherForSubject(demoSubjectMath.id).name,
      principalSignature: "مدير المدرسة",
      average: 78.3,
      result: "PASS_WITH_WARNING" as const
    },
    {
      student: demoStudent3,
      type: "TERM2_BIMONTHLY" as const,
      subjectRows: [
        {
          id: stableId("cert-row", demoStudent3.id, "arabic", "t2b"),
          subjectId: demoSubjectArabic.id,
          subjectName: demoSubjectArabic.name,
          mark: "35",
          maxScore: 40,
          grade: "certificates.grades.veryGood",
          note: "قراءة سليمة وتحليل مناسب"
        },
        {
          id: stableId("cert-row", demoStudent3.id, "math", "t2b"),
          subjectId: demoSubjectMath.id,
          subjectName: demoSubjectMath.name,
          mark: "32",
          maxScore: 40,
          grade: "certificates.grades.good",
          note: "تحسن في التمارين الكتابية"
        },
        {
          id: stableId("cert-row", demoStudent3.id, "english", "t2b"),
          subjectId: demoSubjectEnglish.id,
          subjectName: demoSubjectEnglish.name,
          mark: "34",
          maxScore: 40,
          grade: "certificates.grades.veryGood",
          note: "أداء متوازن في المحادثة والاستماع"
        }
      ],
      presentDays: 18,
      absentDays: 0,
      lateDays: 1,
      earlyExitDays: 0,
      behaviorLevel: "EXCELLENT" as const,
      behaviorNote: "انضباط واضح وتعاون مع الزملاء.",
      teacherNotes: "الطالب ينجز المطلوب بسرعة ويمكن تكليفه بمهام إثرائية.",
      adminNotes: "نسخة تجريبية للشهرين الثاني.",
      teacherSignature: teacherForSubject(demoSubjectEnglish.id).name,
      principalSignature: "مدير المدرسة",
      average: 83.3,
      result: "PASS" as const
    },
    {
      student: demoStudent4,
      type: "TERM2_FINAL" as const,
      subjectRows: [
        {
          id: stableId("cert-row", demoStudent4.id, "arabic", "t2f"),
          subjectId: demoSubjectArabic.id,
          subjectName: demoSubjectArabic.name,
          mark: "33",
          maxScore: 40,
          grade: "certificates.grades.good",
          note: "استيعاب جيد للنصوص"
        },
        {
          id: stableId("cert-row", demoStudent4.id, "math", "t2f"),
          subjectId: demoSubjectMath.id,
          subjectName: demoSubjectMath.name,
          mark: "29",
          maxScore: 40,
          grade: "certificates.grades.good",
          note: "بحاجة إلى مراجعة منتظمة قبل الاختبار"
        },
        {
          id: stableId("cert-row", demoStudent4.id, "english", "t2f"),
          subjectId: demoSubjectEnglish.id,
          subjectName: demoSubjectEnglish.name,
          mark: "35",
          maxScore: 40,
          grade: "certificates.grades.veryGood",
          note: "استجابة قوية في المهارات الشفوية"
        }
      ],
      presentDays: 15,
      absentDays: 3,
      lateDays: 2,
      earlyExitDays: 0,
      behaviorLevel: "GOOD" as const,
      behaviorNote: "مستوى سلوكي جيد مع ملاحظات بسيطة على الالتزام الزمني.",
      teacherNotes: "يحتاج إلى دعم إضافي في الرياضيات فقط.",
      adminNotes: "اعتماد تجريبي للنسخة النهائية.",
      teacherSignature: teacherForSubject(demoSubjectArabic.id).name,
      principalSignature: "مدير المدرسة",
      average: 79,
      result: "PASS_WITH_WARNING" as const
    }
  ];

  for (const certificate of certificatePayloads) {
    await prisma.studentCertificate.upsert({
      where: {
        schoolId_studentId_certificateType_academicYear: {
          schoolId: school.id,
          studentId: certificate.student.id,
          certificateType: certificate.type,
          academicYear
        }
      },
      update: {
        issueDate: demoDate,
        schoolNumber: certificate.student.internalStudentNumber,
        presentDays: certificate.presentDays,
        absentDays: certificate.absentDays,
        lateDays: certificate.lateDays,
        earlyExitDays: certificate.earlyExitDays,
        behaviorLevel: certificate.behaviorLevel,
        behaviorNote: certificate.behaviorNote,
        teacherNotes: certificate.teacherNotes,
        adminNotes: certificate.adminNotes,
        teacherSignature: certificate.teacherSignature,
        principalSignature: certificate.principalSignature,
        average: certificate.average,
        grade: certificate.average >= 90 ? "certificates.grades.excellent" : certificate.average >= 80 ? "certificates.grades.veryGood" : certificate.average >= 70 ? "certificates.grades.good" : "certificates.grades.pass",
        result: certificate.result,
        saved: true,
        published: true,
        subjectRows: certificate.subjectRows
      },
      create: {
        id: stableId("certificate", school.id, certificate.student.id, certificate.type, academicYear),
        schoolId: school.id,
        studentId: certificate.student.id,
        certificateType: certificate.type,
        academicYear,
        issueDate: demoDate,
        schoolNumber: certificate.student.internalStudentNumber,
        presentDays: certificate.presentDays,
        absentDays: certificate.absentDays,
        lateDays: certificate.lateDays,
        earlyExitDays: certificate.earlyExitDays,
        behaviorLevel: certificate.behaviorLevel,
        behaviorNote: certificate.behaviorNote,
        teacherNotes: certificate.teacherNotes,
        adminNotes: certificate.adminNotes,
        teacherSignature: certificate.teacherSignature,
        principalSignature: certificate.principalSignature,
        average: certificate.average,
        grade: certificate.average >= 90 ? "certificates.grades.excellent" : certificate.average >= 80 ? "certificates.grades.veryGood" : certificate.average >= 70 ? "certificates.grades.good" : "certificates.grades.pass",
        result: certificate.result,
        saved: true,
        published: true,
        subjectRows: certificate.subjectRows
      }
    });
  }

  for (const record of attendancePlan) {
    await prisma.studentAttendance.upsert({
      where: {
        schoolId_studentId_date: {
          schoolId: school.id,
          studentId: record.student.id,
          date: record.date
        }
      },
      update: {
        day: dayNameFor(record.date),
        status: record.status,
        lateAt: record.lateAt,
        leftAt: record.leftAt,
        note: record.note
      },
      create: {
        id: stableId("attendance", school.id, record.student.id, record.date),
        schoolId: school.id,
        studentId: record.student.id,
        date: record.date,
        day: dayNameFor(record.date),
        status: record.status,
        lateAt: record.lateAt,
        leftAt: record.leftAt,
        note: record.note
      }
    });
  }

  const academicRecords = [
    {
      student: demoStudent1,
      subject: demoSubjectArabic,
      tone: "POSITIVE" as const,
      strengths: "قراءة سليمة وحضور ممتاز للدرس.",
      weaknesses: "تحتاج الكتابة إلى مزيد من التدقيق الإملائي.",
      assignments: "تمرين صفحة 24 وملخص فقرتين.",
      lessonProgress: "أنجز النشاط التمهيدي وناقش الأفكار الرئيسة.",
      certificate: "مرشح لشهادة التميز في اللغة العربية.",
      note: "ممتاز في المشاركة داخل الصف."
    },
    {
      student: demoStudent2,
      subject: demoSubjectMath,
      tone: "NEGATIVE" as const,
      strengths: "يفهم القاعدة عند الشرح الفردي.",
      weaknesses: "يحتاج إلى سرعة أكبر في الحل.",
      assignments: "حل 10 مسائل من الكتاب المدرسي.",
      lessonProgress: "أكمل نصف التمارين فقط.",
      certificate: "يحتاج متابعة قبل اعتماد الشهادة.",
      note: "متفاوت الأداء ويستفيد من التوجيه المباشر."
    },
    {
      student: demoStudent3,
      subject: demoSubjectEnglish,
      tone: "POSITIVE" as const,
      strengths: "محادثة جيدة ونطق واضح.",
      weaknesses: "الإملاء يحتاج مراجعة إضافية.",
      assignments: "كتابة فقرة قصيرة عن المدرسة.",
      lessonProgress: "شارك في الحوار واستعمل مفردات جديدة.",
      certificate: "مستوى قوي في المحادثة والاستماع.",
      note: "طالب مجتهد ينجز سريعًا."
    }
  ];

  for (const record of academicRecords) {
    await prisma.studentAcademicRecord.upsert({
      where: {
        schoolId_studentId_subjectId_date: {
          schoolId: school.id,
          studentId: record.student.id,
          subjectId: record.subject.id,
          date: demoDate
        }
      },
      update: {
        day: "السبت",
        tone: record.tone,
        strengths: record.strengths,
        weaknesses: record.weaknesses,
        assignments: record.assignments,
        lessonProgress: record.lessonProgress,
        certificate: record.certificate,
        note: record.note
      },
      create: {
        id: stableId("academic-record", school.id, record.student.id, record.subject.id, demoDate),
        schoolId: school.id,
        studentId: record.student.id,
        subjectId: record.subject.id,
        date: demoDate,
        day: "السبت",
        tone: record.tone,
        strengths: record.strengths,
        weaknesses: record.weaknesses,
        assignments: record.assignments,
        lessonProgress: record.lessonProgress,
        certificate: record.certificate,
        note: record.note
      }
    });
  }

  const behaviorRecords = [
    {
      student: demoStudent1,
      category: "الانضباط",
      tone: "POSITIVE" as const,
      template: "سلوك إيجابي والتزام واضح",
      note: "يحافظ على هدوء الصف ويساعد زملاءه."
    },
    {
      student: demoStudent2,
      category: "الالتزام بالوقت",
      tone: "NEGATIVE" as const,
      template: "تأخر بسيط عن بداية الحصة",
      note: "تمت المتابعة مع ولي الأمر."
    },
    {
      student: demoStudent3,
      category: "المشاركة الصفية",
      tone: "POSITIVE" as const,
      template: "مشاركة فعالة في النقاش",
      note: "إسهام واضح في شرح الفكرة الأساسية."
    }
  ];

  for (const record of behaviorRecords) {
    await prisma.studentBehaviorRecord.upsert({
      where: {
        schoolId_studentId_date_category_tone: {
          schoolId: school.id,
          studentId: record.student.id,
          date: demoDate,
          category: record.category,
          tone: record.tone
        }
      },
      update: {
        day: "السبت",
        template: record.template,
        note: record.note
      },
      create: {
        id: stableId("behavior-record", school.id, record.student.id, demoDate, record.category, record.tone),
        schoolId: school.id,
        studentId: record.student.id,
        date: demoDate,
        day: "السبت",
        category: record.category,
        tone: record.tone,
        template: record.template,
        note: record.note
      }
    });
  }

  const lessonTeachers = {
    arabic: teacherForSubject(demoSubjectArabic.id),
    math: teacherForSubject(demoSubjectMath.id),
    english: teacherForSubject(demoSubjectEnglish.id)
  };

  const demoPassword = "Demo12345!";
  const teacherAccountEmail = "teacher.default@som.local";
  const studentAccountEmail = "student.demo@som.local";

  const teacherUser = await prisma.user.upsert({
    where: { email: teacherAccountEmail },
    update: {
      schoolId: school.id,
      name: "سامي الخطيب",
      fullName: "سامي الخطيب",
      password: hashPassword(demoPassword),
      role: "TEACHER",
      status: "ACTIVE",
      studentId: null
    },
    create: {
      id: stableId("user", school.id, teacherAccountEmail),
      schoolId: school.id,
      name: "سامي الخطيب",
      fullName: "سامي الخطيب",
      email: teacherAccountEmail,
      password: hashPassword(demoPassword),
      role: "TEACHER",
      status: "ACTIVE"
    }
  });

  const studentUser = await prisma.user.upsert({
    where: { email: studentAccountEmail },
    update: {
      schoolId: school.id,
      name: demoStudent1.name,
      fullName: demoStudent1.name,
      password: hashPassword(demoPassword),
      role: "STUDENT",
      studentId: demoStudent1.id,
      status: "ACTIVE"
    },
    create: {
      id: stableId("user", school.id, studentAccountEmail),
      schoolId: school.id,
      name: demoStudent1.name,
      fullName: demoStudent1.name,
      email: studentAccountEmail,
      password: hashPassword(demoPassword),
      role: "STUDENT",
      studentId: demoStudent1.id,
      status: "ACTIVE"
    }
  });

  await prisma.teacher.update({
    where: { id: lessonTeachers.arabic.id },
    data: {
      userId: teacherUser.id,
      notes: `${lessonTeachers.arabic.name} - حساب المعلم التجريبي مرتبط بالبذرة الأساسية`
    }
  });

  await prisma.student.update({
    where: { id: demoStudent1.id },
    data: {
    }
  });

  const lessonEntries = [
    {
      teacher: lessonTeachers.arabic,
      subject: demoSubjectArabic,
      period: 1,
      title: "قراءة تحليلية لنص قصير",
      summary: "مراجعة الفكرة الرئيسة واستخراج المفردات الجديدة.",
      status: "COMPLETED" as const,
      note: "استخدام سبورة رقمية وعرض أمثلة إضافية.",
      attachments: "ملف نصي تجريبي"
    },
    {
      teacher: lessonTeachers.math,
      subject: demoSubjectMath,
      period: 2,
      title: "حل مسائل معادلات من الدرجة الأولى",
      summary: "تدريب عملي مع متابعة فردية للطلاب المتعثرين.",
      status: "IN_PROGRESS" as const,
      note: "بدء الدرس بنشاط قصير ثم العمل الجماعي.",
      attachments: "ورقة عمل"
    },
    {
      teacher: lessonTeachers.english,
      subject: demoSubjectEnglish,
      period: 3,
      title: "Listening and speaking practice",
      summary: "تطبيق على مفردات الوحدة ومحادثة قصيرة.",
      status: "NOT_STARTED" as const,
      note: "ينفذ بعد الاستراحة مباشرة.",
      attachments: null
    }
  ];

  for (const entry of lessonEntries) {
    await prisma.teacherLessonToday.upsert({
      where: {
        schoolId_teacherId_date_period_classId_subjectId: {
          schoolId: school.id,
          teacherId: entry.teacher.id,
          date: demoDate,
          period: entry.period,
          classId: demoClass.id,
          subjectId: entry.subject.id
        }
      },
      update: {
        day: "السبت",
        title: entry.title,
        summary: entry.summary,
        status: entry.status,
        note: entry.note,
        attachments: entry.attachments
      },
      create: {
        id: stableId("lesson-today", school.id, entry.teacher.id, demoDate, entry.period, demoClass.id, entry.subject.id),
        schoolId: school.id,
        teacherId: entry.teacher.id,
        classId: demoClass.id,
        subjectId: entry.subject.id,
        date: demoDate,
        day: "السبت",
        period: entry.period,
        title: entry.title,
        summary: entry.summary,
        status: entry.status,
        note: entry.note,
        attachments: entry.attachments
      }
    });
  }

  const homeworkEntries = [
    {
      teacher: lessonTeachers.arabic,
      subject: demoSubjectArabic,
      kind: "HOMEWORK" as const,
      title: "واجب قراءة الفقرة الثالثة",
      description: "استخراج ثلاث أفكار رئيسة وكتابتها بخط واضح.",
      dueDate: "2026-09-01",
      notes: "يرسل مع الطالب في الدفتر."
    },
    {
      teacher: lessonTeachers.math,
      subject: demoSubjectMath,
      kind: "PREPARATION" as const,
      title: "الاستعداد لاختبار قصير",
      description: "مراجعة القوانين الأساسية وحل نموذجين قصيرين.",
      dueDate: "2026-09-02",
      notes: "يفضل العمل ثنائيًا في الحصة القادمة."
    }
  ];

  for (const entry of homeworkEntries) {
    await prisma.teacherHomework.upsert({
      where: { id: stableId("homework", school.id, entry.teacher.id, demoDate, entry.subject.id, entry.kind) },
      update: {
        schoolId: school.id,
        teacherId: entry.teacher.id,
        classId: demoClass.id,
        subjectId: entry.subject.id,
        date: demoDate,
        day: "السبت",
        kind: entry.kind,
        title: entry.title,
        description: entry.description,
        dueDate: entry.dueDate,
        attachment: null,
        notes: entry.notes
      },
      create: {
        id: stableId("homework", school.id, entry.teacher.id, demoDate, entry.subject.id, entry.kind),
        schoolId: school.id,
        teacherId: entry.teacher.id,
        classId: demoClass.id,
        subjectId: entry.subject.id,
        date: demoDate,
        day: "السبت",
        kind: entry.kind,
        title: entry.title,
        description: entry.description,
        dueDate: entry.dueDate,
        attachment: null,
        notes: entry.notes
      }
    });
  }

  const examEntries = [
    {
      teacher: lessonTeachers.english,
      subject: demoSubjectEnglish,
      title: "امتحان استماع ومفردات",
      startTime: "08:15",
      endTime: "09:00",
      room: "قاعة 2",
      notes: "التركيز على المفردات الأساسية.",
      instructions: "ممنوع استخدام الهاتف."
    },
    {
      teacher: lessonTeachers.math,
      subject: demoSubjectMath,
      title: "امتحان رياضيات قصير",
      startTime: "09:15",
      endTime: "10:00",
      room: "قاعة 4",
      notes: "يحتوي على ثلاثة أسئلة مقالية.",
      instructions: "إحضار آلة حاسبة غير مبرمجة."
    }
  ];

  for (const entry of examEntries) {
    await prisma.teacherExam.upsert({
      where: { id: stableId("exam", school.id, entry.teacher.id, demoDate, entry.subject.id, entry.title) },
      update: {
        schoolId: school.id,
        teacherId: entry.teacher.id,
        classId: demoClass.id,
        subjectId: entry.subject.id,
        date: demoDate,
        day: "السبت",
        title: entry.title,
        startTime: entry.startTime,
        endTime: entry.endTime,
        room: entry.room,
        notes: entry.notes,
        instructions: entry.instructions
      },
      create: {
        id: stableId("exam", school.id, entry.teacher.id, demoDate, entry.subject.id, entry.title),
        schoolId: school.id,
        teacherId: entry.teacher.id,
        classId: demoClass.id,
        subjectId: entry.subject.id,
        date: demoDate,
        day: "السبت",
        title: entry.title,
        startTime: entry.startTime,
        endTime: entry.endTime,
        room: entry.room,
        notes: entry.notes,
        instructions: entry.instructions
      }
    });
  }

  const studentNotifications = [
    {
      student: demoStudent1,
      eventType: "ATTENDANCE",
      status: "SENT",
      title: "تأكيد حضور الطالب",
      message: "تم تسجيل حضور الطالب في الحصة الأولى بنجاح.",
      recipientPhones: [{ label: "ولي الأمر", phone: "0599000001" }],
      recipientNames: [{ label: "الأب", name: "أبو محمد" }],
      payload: {
        classId: demoClass.id,
        className: demoClass.name,
        studentName: demoStudent1.name,
        date: demoDate,
        status: "PRESENT"
      }
    },
    {
      student: demoStudent2,
      eventType: "INVITATION",
      status: "QUEUED",
      title: "دعوة اجتماع أولياء الأمور",
      message: "تم إرسال دعوة لحضور اجتماع أولياء الأمور في قاعة الأنشطة.",
      recipientPhones: [{ label: "ولي الأمر", phone: "0599000002" }],
      recipientNames: [{ label: "الأم", name: "أم أحمد" }],
      payload: {
        classId: demoClass.id,
        className: demoClass.name,
        studentName: demoStudent2.name,
        date: demoDate,
        time: "10:30",
        reason: "متابعة الأداء الأكاديمي"
      }
    },
    {
      student: demoStudent3,
      eventType: "PLEDGE",
      status: "SENT",
      title: "رسالة تعهد سلوكي",
      message: "تمت مشاركة تعهد الطالب وولي الأمر على المنصة.",
      recipientPhones: [{ label: "ولي الأمر", phone: "0599000003" }],
      recipientNames: [{ label: "الأب", name: "أبو سارة" }],
      payload: {
        classId: demoClass.id,
        className: demoClass.name,
        studentName: demoStudent3.name,
        date: demoDate,
        title: "تعهد بالالتزام المدرسي"
      }
    },
    {
      student: null,
      eventType: "SCHOOL_MESSAGE",
      status: "SENT",
      title: "رسالة مدرسية عامة",
      message: "يرجى متابعة برنامج اليومي المحدث من لوحة الإدارة.",
      recipientPhones: [{ label: "جميع أولياء الأمور", phone: "0599000099" }],
      recipientNames: [{ label: "الصف", name: demoClass.name }],
      payload: {
        classId: demoClass.id,
        className: demoClass.name,
        date: demoDate,
        note: "إشعار تجريبي"
      }
    }
  ];

  for (const notification of studentNotifications) {
    await prisma.studentNotification.upsert({
      where: { id: stableId("notification", school.id, notification.eventType, notification.title) },
      update: {
        schoolId: school.id,
        studentId: notification.student?.id || null,
        eventType: notification.eventType,
        channel: "SMS",
        recipientType: "PARENT",
        status: notification.status,
        title: notification.title,
        message: notification.message,
        recipientPhones: notification.recipientPhones,
        recipientNames: notification.recipientNames,
        payload: notification.payload,
        errorMessage: null,
        sentAt: notification.status === "SENT" ? new Date(`${demoDate}T08:00:00.000Z`) : null
      },
      create: {
        id: stableId("notification", school.id, notification.eventType, notification.title),
        schoolId: school.id,
        studentId: notification.student?.id || null,
        eventType: notification.eventType,
        channel: "SMS",
        recipientType: "PARENT",
        status: notification.status,
        title: notification.title,
        message: notification.message,
        recipientPhones: notification.recipientPhones,
        recipientNames: notification.recipientNames,
        payload: notification.payload,
        errorMessage: null,
        sentAt: notification.status === "SENT" ? new Date(`${demoDate}T08:00:00.000Z`) : null
      }
    });
  }

  console.log(
    `Seed completed: 11 classes, 16 teachers, 13 subjects, ${classSeeds.length * studentsPerClass} students, demo certificates, grades, attendance, teacher tasks, and notifications were created for ${school.name}.`
  );
  console.log(`Demo teacher login: ${teacherAccountEmail} / ${demoPassword}`);
  console.log(`Demo student login: ${studentAccountEmail} / ${demoPassword}`);

  void subjectLinks;
}

main()
  .catch((error) => {
    logSafeError("prisma.seed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
