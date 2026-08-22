const crypto = require("node:crypto");
const path = require("node:path");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");

dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "backend", ".env"), override: false });

const prisma = new PrismaClient();

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://som_user:som_password@127.0.0.1:5432/som?schema=public";
const schoolId = "demo-portal-school";
const classId = "demo-portal-class-7a";
const subjectId = "demo-portal-subject-math";
const teacherUserEmail = "teacher.demo@som.local";
const studentOneEmail = "student.demo@som.local";
const studentTwoEmail = "student2.demo@som.local";
const demoPassword = "Demo12345!";
const demoDate = "2026-08-22";
const demoDay = "السبت";

function assertLocalDatabase() {
  const url = new URL(DATABASE_URL);
  const localHosts = new Set(["localhost", "127.0.0.1", "postgres", "sompro_postgres"]);
  if (!localHosts.has(url.hostname)) {
    throw new Error(
      `Refusing to seed demo data into non-local database host "${url.hostname}". Set DEMO_SEED_ALLOW_NONLOCAL=true to override.`
    );
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:v1:${salt}:${hash}`;
}

async function upsertPeriod(period, label, startTime, endTime) {
  return prisma.periodDefinition.upsert({
    where: { schoolId_period: { schoolId, period } },
    create: { schoolId, period, label, startTime, endTime, isActive: true },
    update: { label, startTime, endTime, isActive: true }
  });
}

async function upsertUser({ id, email, name, role, studentId = null }) {
  return prisma.user.upsert({
    where: { email },
    create: {
      id,
      schoolId,
      name,
      fullName: name,
      email,
      password: hashPassword(demoPassword),
      role,
      studentId,
      status: "ACTIVE"
    },
    update: {
      schoolId,
      name,
      fullName: name,
      password: hashPassword(demoPassword),
      role,
      studentId,
      status: "ACTIVE",
      tokenVersion: { increment: 1 }
    }
  });
}

async function saveTeacherAssignment(data) {
  const existing = await prisma.teacherAssignment.findFirst({
    where: {
      schoolId: data.schoolId,
      teacherId: data.teacherId,
      classId: data.classId,
      subjectId: data.subjectId
    }
  });

  if (existing) {
    return prisma.teacherAssignment.update({
      where: { id: existing.id },
      data: { weeklyPeriods: data.weeklyPeriods }
    });
  }

  return prisma.teacherAssignment.create({ data });
}

async function saveTeacherSubject(data) {
  const existing = await prisma.teacherSubject.findFirst({
    where: {
      schoolId: data.schoolId,
      teacherId: data.teacherId,
      subjectId: data.subjectId,
      classId: data.classId
    }
  });

  if (existing) return existing;
  return prisma.teacherSubject.create({ data });
}

async function main() {
  if (process.env.DEMO_SEED_ALLOW_NONLOCAL !== "true") assertLocalDatabase();

  await prisma.school.upsert({
    where: { id: schoolId },
    create: {
      id: schoolId,
      name: "مدرسة التجربة - بوابة الطالب",
      address: "بيئة محلية للتجربة",
      managerName: "مدير التجربة",
      institutionCode: "DEMO-PORTAL",
      isActive: true
    },
    update: {
      name: "مدرسة التجربة - بوابة الطالب",
      address: "بيئة محلية للتجربة",
      managerName: "مدير التجربة",
      institutionCode: "DEMO-PORTAL",
      isActive: true
    }
  });

  await prisma.schoolSettings.upsert({
    where: { schoolId },
    create: {
      schoolId,
      workingDays: ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"],
      offDays: ["الجمعة"],
      periodsPerDay: 7,
      maxTeachers: 100
    },
    update: {
      workingDays: ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"],
      offDays: ["الجمعة"],
      periodsPerDay: 7
    }
  });

  await upsertPeriod(1, "الحصة 1", "08:10", "09:00");
  await upsertPeriod(2, "الحصة 2", "09:00", "09:50");
  await upsertPeriod(3, "الحصة 3", "09:50", "10:35");
  await upsertPeriod(4, "الحصة 4", "11:00", "11:45");

  const teacherUser = await upsertUser({
    id: "demo-portal-teacher-user",
    email: teacherUserEmail,
    name: "المعلم التجريبي أحمد",
    role: "TEACHER"
  });

  const teacher = await prisma.teacher.upsert({
    where: { schoolId_name: { schoolId, name: "المعلم التجريبي أحمد" } },
    create: {
      id: "demo-portal-teacher",
      schoolId,
      userId: teacherUser.id,
      name: "المعلم التجريبي أحمد",
      employeeNumber: "T-DEMO-001",
      specialty: "رياضيات",
      workDays: ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء"],
      preferredDays: ["السبت", "الاثنين"],
      preferredClasses: [classId],
      preferredPeriods: [1, 2, 3],
      targetLoad: 24,
      notes: "معلم تجريبي لفحص ظهور الدروس والتحضير والامتحانات عند الطالب"
    },
    update: {
      userId: teacherUser.id,
      employeeNumber: "T-DEMO-001",
      specialty: "رياضيات",
      status: "ACTIVE",
      workDays: ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء"],
      preferredDays: ["السبت", "الاثنين"],
      preferredClasses: [classId],
      preferredPeriods: [1, 2, 3],
      targetLoad: 24,
      notes: "معلم تجريبي لفحص ظهور الدروس والتحضير والامتحانات عند الطالب"
    }
  });

  const schoolClass = await prisma.schoolClass.upsert({
    where: { schoolId_name: { schoolId, name: "السابع أ - تجريبي" } },
    create: {
      id: classId,
      schoolId,
      name: "السابع أ - تجريبي",
      gradeLevel: "7",
      grade: "7",
      section: "أ",
      maxStudents: 32,
      homeroomTeacherId: teacher.id
    },
    update: {
      gradeLevel: "7",
      grade: "7",
      section: "أ",
      maxStudents: 32,
      homeroomTeacherId: teacher.id,
      status: "ACTIVE"
    }
  });

  const subject = await prisma.subject.upsert({
    where: { schoolId_name: { schoolId, name: "رياضيات - تجريبي" } },
    create: {
      id: subjectId,
      schoolId,
      name: "رياضيات - تجريبي",
      code: "MATH-DEMO",
      maxMark: 100,
      passMark: 55
    },
    update: {
      code: "MATH-DEMO",
      status: "ACTIVE",
      maxMark: 100,
      passMark: 55
    }
  });

  await saveTeacherAssignment({
    schoolId,
    teacherId: teacher.id,
    classId: schoolClass.id,
    subjectId: subject.id,
    weeklyPeriods: 5
  });

  await saveTeacherSubject({ schoolId, teacherId: teacher.id, subjectId: subject.id, classId: schoolClass.id });

  await prisma.baseScheduleSlot.upsert({
    where: { schoolId_day_period_classId: { schoolId, day: demoDay, period: 1, classId: schoolClass.id } },
    create: {
      schoolId,
      day: demoDay,
      period: 1,
      classId: schoolClass.id,
      subjectId: subject.id,
      teacherId: teacher.id,
      room: "غرفة 7أ"
    },
    update: { subjectId: subject.id, teacherId: teacher.id, room: "غرفة 7أ" }
  });

  const studentOne = await prisma.student.upsert({
    where: { id: "demo-portal-student-1" },
    create: {
      id: "demo-portal-student-1",
      schoolId,
      classId: schoolClass.id,
      name: "ليان أحمد - طالبة تجريبية",
      firstName: "ليان",
      lastName: "أحمد",
      internalStudentNumber: "S-DEMO-001",
      guardianPhone: "0500000001"
    },
    update: {
      schoolId,
      classId: schoolClass.id,
      name: "ليان أحمد - طالبة تجريبية",
      firstName: "ليان",
      lastName: "أحمد",
      internalStudentNumber: "S-DEMO-001",
      status: "ACTIVE"
    }
  });

  const studentTwo = await prisma.student.upsert({
    where: { id: "demo-portal-student-2" },
    create: {
      id: "demo-portal-student-2",
      schoolId,
      classId: schoolClass.id,
      name: "كريم سمير - طالب تجريبي",
      firstName: "كريم",
      lastName: "سمير",
      internalStudentNumber: "S-DEMO-002",
      guardianPhone: "0500000002"
    },
    update: {
      schoolId,
      classId: schoolClass.id,
      name: "كريم سمير - طالب تجريبي",
      firstName: "كريم",
      lastName: "سمير",
      internalStudentNumber: "S-DEMO-002",
      status: "ACTIVE"
    }
  });

  await upsertUser({
    id: "demo-portal-student-user-1",
    email: studentOneEmail,
    name: "ليان أحمد",
    role: "STUDENT",
    studentId: studentOne.id
  });

  await upsertUser({
    id: "demo-portal-student-user-2",
    email: studentTwoEmail,
    name: "كريم سمير",
    role: "STUDENT",
    studentId: studentTwo.id
  });

  await prisma.teacherLessonToday.upsert({
    where: {
      schoolId_teacherId_date_period_classId_subjectId: {
        schoolId,
        teacherId: teacher.id,
        date: demoDate,
        period: 1,
        classId: schoolClass.id,
        subjectId: subject.id
      }
    },
    create: {
      schoolId,
      teacherId: teacher.id,
      classId: schoolClass.id,
      subjectId: subject.id,
      date: demoDate,
      day: demoDay,
      period: 1,
      title: "حل معادلات من الدرجة الأولى",
      summary: "شرح خطوات حل المعادلات والتحقق من الناتج بأمثلة صفية.",
      status: "COMPLETED",
      note: "هذا درس تجريبي يجب أن يظهر للطالب في صفحة دروسي."
    },
    update: {
      day: demoDay,
      title: "حل معادلات من الدرجة الأولى",
      summary: "شرح خطوات حل المعادلات والتحقق من الناتج بأمثلة صفية.",
      status: "COMPLETED",
      note: "هذا درس تجريبي يجب أن يظهر للطالب في صفحة دروسي."
    }
  });

  const preparation = await prisma.teacherHomework.upsert({
    where: { id: "demo-portal-preparation" },
    create: {
      id: "demo-portal-preparation",
      schoolId,
      teacherId: teacher.id,
      classId: schoolClass.id,
      subjectId: subject.id,
      date: demoDate,
      day: demoDay,
      kind: "PREPARATION",
      title: "تحضير الدرس القادم: قراءة فقرة المعادلات",
      description: "اقرأوا الفقرة الأولى من الوحدة وجهزوا سؤالين حولها.",
      dueDate: "2026-08-23",
      notes: "هذا تحضير تجريبي يجب أن يظهر في تحضيري وواجباتي."
    },
    update: {
      teacherId: teacher.id,
      classId: schoolClass.id,
      subjectId: subject.id,
      date: demoDate,
      day: demoDay,
      kind: "PREPARATION",
      title: "تحضير الدرس القادم: قراءة فقرة المعادلات",
      description: "اقرأوا الفقرة الأولى من الوحدة وجهزوا سؤالين حولها.",
      dueDate: "2026-08-23",
      notes: "هذا تحضير تجريبي يجب أن يظهر في تحضيري وواجباتي."
    }
  });

  const homework = await prisma.teacherHomework.upsert({
    where: { id: "demo-portal-homework" },
    create: {
      id: "demo-portal-homework",
      schoolId,
      teacherId: teacher.id,
      classId: schoolClass.id,
      subjectId: subject.id,
      date: demoDate,
      day: demoDay,
      kind: "HOMEWORK",
      title: "واجب: حل التمارين 1-5",
      description: "حل التمارين من صفحة 18 وتسليمها في الحصة القادمة.",
      dueDate: "2026-08-24",
      notes: "هذا واجب تجريبي لنفس صف الطالب."
    },
    update: {
      teacherId: teacher.id,
      classId: schoolClass.id,
      subjectId: subject.id,
      date: demoDate,
      day: demoDay,
      kind: "HOMEWORK",
      title: "واجب: حل التمارين 1-5",
      description: "حل التمارين من صفحة 18 وتسليمها في الحصة القادمة.",
      dueDate: "2026-08-24",
      notes: "هذا واجب تجريبي لنفس صف الطالب."
    }
  });

  for (const [homeworkId, status, studentId] of [
    [preparation.id, "UNSOLVED", studentOne.id],
    [homework.id, "SOLVED", studentOne.id],
    [homework.id, "UNSOLVED", studentTwo.id]
  ]) {
    await prisma.teacherHomeworkSubmission.upsert({
      where: { schoolId_homeworkId_studentId: { schoolId, homeworkId, studentId } },
      create: { schoolId, homeworkId, studentId, status, note: "حالة تجريبية" },
      update: { status, note: "حالة تجريبية" }
    });
  }

  await prisma.teacherExam.upsert({
    where: { id: "demo-portal-exam" },
    create: {
      id: "demo-portal-exam",
      schoolId,
      teacherId: teacher.id,
      classId: schoolClass.id,
      subjectId: subject.id,
      date: demoDate,
      day: demoDay,
      title: "امتحان قصير في المعادلات",
      startTime: "10:00",
      endTime: "10:35",
      room: "غرفة 7أ",
      notes: "امتحان تجريبي يظهر للطالب في جدول امتحاناتي.",
      instructions: "إحضار قلم رصاص وآلة حاسبة بسيطة."
    },
    update: {
      teacherId: teacher.id,
      classId: schoolClass.id,
      subjectId: subject.id,
      date: demoDate,
      day: demoDay,
      title: "امتحان قصير في المعادلات",
      startTime: "10:00",
      endTime: "10:35",
      room: "غرفة 7أ",
      notes: "امتحان تجريبي يظهر للطالب في جدول امتحاناتي.",
      instructions: "إحضار قلم رصاص وآلة حاسبة بسيطة."
    }
  });

  console.log("Demo portal data is ready.");
  console.log(`Date to test: ${demoDate}`);
  console.log(`Teacher login: ${teacherUserEmail} / ${demoPassword}`);
  console.log(`Student login: ${studentOneEmail} / ${demoPassword}`);
  console.log(`Second student: ${studentTwoEmail} / ${demoPassword}`);
  console.log("Open student pages: دروسي، تحضيري وواجباتي، جدول امتحاناتي.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
