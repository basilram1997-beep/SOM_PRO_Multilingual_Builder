require("dotenv").config();

const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { error, success } = require("./cli-output");

const prisma = new PrismaClient();

const schoolId = process.env.SOM_E2E_SCHOOL_ID || "som-e2e-school";
const schoolName = process.env.SOM_E2E_SCHOOL_NAME || "SOM E2E School";
const institutionCode = process.env.SOM_E2E_INSTITUTION_CODE || "E2E-4100";
const adminName = process.env.SOM_E2E_ADMIN_NAME || "SOM E2E Admin";
const adminEmail = process.env.SOM_E2E_ADMIN_EMAIL || "admin@som-e2e.local";
const adminPassword = process.env.SOM_E2E_ADMIN_PASSWORD || "SOM-E2E-Admin-123!";
const teacherName = process.env.SOM_E2E_TEACHER_NAME || "SOM E2E Teacher";
const className = process.env.SOM_E2E_CLASS_NAME || "SOM E2E Class A";
const subjectName = process.env.SOM_E2E_SUBJECT_NAME || "SOM E2E Subject";
const studentName = process.env.SOM_E2E_STUDENT_NAME || "SOM E2E Student";

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

function hashPassword(password) {
  const salt = "e2e-playwright-salt";
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:v1:${salt}:${hash}`;
}

async function upsertSchool() {
  await prisma.school.upsert({
    where: { id: schoolId },
    update: {
      name: schoolName,
      institutionCode
    },
    create: {
      id: schoolId,
      name: schoolName,
      address: "",
      managerName: adminName,
      institutionCode
    }
  });
}

async function upsertSettings() {
  await prisma.schoolSettings.upsert({
    where: { schoolId },
    update: {
      workingDays,
      offDays,
      periodsPerDay: 7,
      maxTeachers: 100
    },
    create: {
      schoolId,
      workingDays,
      offDays,
      periodsPerDay: 7,
      maxTeachers: 100
    }
  });
}

async function upsertPeriods() {
  for (const period of defaultPeriods) {
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

async function upsertTeacher() {
  return prisma.teacher.upsert({
    where: { schoolId_name: { schoolId, name: teacherName } },
    update: {
      specialty: subjectName,
      adminRole: "",
      employmentRatio: 100,
      releaseHours: 0,
      targetLoad: 25,
      notes: "تم إنشاؤه تلقائيًا لاختبارات Playwright",
      workDays: workingDays,
      preferredDays: ["السبت", "الاثنين"],
      preferredClasses: [className],
      preferredPeriods: [1, 2]
    },
    create: {
      schoolId,
      name: teacherName,
      specialty: subjectName,
      adminRole: "",
      employmentRatio: 100,
      releaseHours: 0,
      targetLoad: 25,
      notes: "تم إنشاؤه تلقائيًا لاختبارات Playwright",
      workDays: workingDays,
      preferredDays: ["السبت", "الاثنين"],
      preferredClasses: [className],
      preferredPeriods: [1, 2]
    }
  });
}

async function upsertClass() {
  return prisma.schoolClass.upsert({
    where: { schoolId_name: { schoolId, name: className } },
    update: {
      grade: "10",
      section: "أ"
    },
    create: {
      schoolId,
      name: className,
      grade: "10",
      section: "أ"
    }
  });
}

async function upsertSubject() {
  return prisma.subject.upsert({
    where: { schoolId_name: { schoolId, name: subjectName } },
    update: {
      isHomeroom: false
    },
    create: {
      schoolId,
      name: subjectName,
      isHomeroom: false
    }
  });
}

async function upsertAssignment(teacherId, classId, subjectId) {
  const existing = await prisma.teacherAssignment.findFirst({
    where: { schoolId, teacherId, classId, subjectId }
  });
  if (existing) {
    await prisma.teacherAssignment.update({
      where: { id: existing.id },
      data: { weeklyPeriods: 6 }
    });
    return;
  }

  await prisma.teacherAssignment.create({
    data: {
      schoolId,
      teacherId,
      classId,
      subjectId,
      weeklyPeriods: 6
    }
  });
}

async function upsertHomeroom(teacherId, classId) {
  await prisma.homeroomAssignment.upsert({
    where: { schoolId_classId: { schoolId, classId } },
    update: {
      teacherId,
      weeklyDay: "السبت",
      weeklyPeriod: 2,
      isActive: true,
      notes: "إعداد Playwright"
    },
    create: {
      schoolId,
      teacherId,
      classId,
      weeklyDay: "السبت",
      weeklyPeriod: 2,
      isActive: true,
      notes: "إعداد Playwright"
    }
  });
}

async function upsertBaseSlot(teacherId, classId, subjectId) {
  await prisma.baseScheduleSlot.upsert({
    where: { schoolId_day_period_classId: { schoolId, day: "السبت", period: 1, classId } },
    update: {
      teacherId,
      subjectId
    },
    create: {
      schoolId,
      day: "السبت",
      period: 1,
      classId,
      subjectId,
      teacherId
    }
  });
}

async function upsertAdminUser() {
  await prisma.user.upsert({
    where: { email: adminEmail.trim().toLowerCase() },
    update: {
      schoolId,
      name: adminName,
      password: hashPassword(adminPassword),
      role: "ADMIN"
    },
    create: {
      schoolId,
      name: adminName,
      email: adminEmail.trim().toLowerCase(),
      password: hashPassword(adminPassword),
      role: "ADMIN"
    }
  });
}

async function upsertStudent(classId) {
  const existing = await prisma.student.findFirst({
    where: {
      schoolId,
      classId,
      name: studentName
    }
  });

  if (existing) {
    await prisma.student.update({
      where: { id: existing.id },
      data: {
        nationalId: "318535679",
        fatherName: "باسل",
        motherName: "سوسو",
        residence: "صور باهر",
        fatherPhone: "000000000",
        motherPhone: "00000000000",
        guardianPhone: "00000000",
        healthFund: "كلاليت",
        studentPhone: "0500000000"
      }
    });
    return;
  }

  await prisma.student.create({
    data: {
      schoolId,
      classId,
      name: studentName,
      nationalId: "318535679",
      fatherName: "باسل",
      motherName: "سوسو",
      residence: "صور باهر",
      fatherPhone: "000000000",
      motherPhone: "00000000000",
      guardianPhone: "00000000",
      healthFund: "كلاليت",
      studentPhone: "0500000000"
    }
  });
}

async function main() {
  await upsertSchool();
  await upsertSettings();
  await upsertPeriods();
  const teacher = await upsertTeacher();
  const schoolClass = await upsertClass();
  const subject = await upsertSubject();
  await upsertAssignment(teacher.id, schoolClass.id, subject.id);
  await upsertHomeroom(teacher.id, schoolClass.id);
  await upsertBaseSlot(teacher.id, schoolClass.id, subject.id);
  await upsertStudent(schoolClass.id);
  await upsertAdminUser();

  success(`E2E bootstrap جاهز لـ ${adminEmail.trim().toLowerCase()} على ${schoolName} (${schoolId})`);
}

main()
  .catch((failure) => {
    error(failure instanceof Error ? failure.message : failure);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
