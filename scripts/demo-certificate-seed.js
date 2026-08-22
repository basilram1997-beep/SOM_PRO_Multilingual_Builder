const crypto = require("node:crypto");
const path = require("node:path");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");

dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "backend", ".env"), override: false });

const prisma = new PrismaClient();

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://som_user:som_password@127.0.0.1:5432/som?schema=public";
const schoolId = process.env.DEMO_CERTIFICATE_SCHOOL_ID || "demo-certificate-school";
const schoolName = process.env.DEMO_CERTIFICATE_SCHOOL_NAME || "مدرسة الشهادة التجريبية";
const institutionCode = process.env.DEMO_CERTIFICATE_INSTITUTION_CODE || "CERT-DEMO";
const adminEmail = process.env.DEMO_CERTIFICATE_ADMIN_EMAIL || "certificate.admin@som.local";
const adminPassword = process.env.DEMO_CERTIFICATE_ADMIN_PASSWORD || "Certificate123!";
const adminName = process.env.DEMO_CERTIFICATE_ADMIN_NAME || "مدير الشهادة التجريبية";
const teacherEmail = process.env.DEMO_CERTIFICATE_TEACHER_EMAIL || "certificate.teacher@som.local";
const teacherPassword = process.env.DEMO_CERTIFICATE_TEACHER_PASSWORD || "Teacher123!";
const teacherName = process.env.DEMO_CERTIFICATE_TEACHER_NAME || "أستاذ الشهادة التجريبية";
const classId = process.env.DEMO_CERTIFICATE_CLASS_ID || "demo-certificate-class";
const className = process.env.DEMO_CERTIFICATE_CLASS_NAME || "السادس أ - شهادة تجريبية";
const studentId = process.env.DEMO_CERTIFICATE_STUDENT_ID || "demo-certificate-student-01";
const studentName = process.env.DEMO_CERTIFICATE_STUDENT_NAME || "سارة محمود علي";
const studentNationalId = process.env.DEMO_CERTIFICATE_STUDENT_NATIONAL_ID || "390123456";
const academicYear = process.env.DEMO_CERTIFICATE_ACADEMIC_YEAR || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
const certificateType = process.env.DEMO_CERTIFICATE_TYPE || "TERM1_BIMONTHLY";
const issueDate = process.env.DEMO_CERTIFICATE_ISSUE_DATE || new Date().toISOString().slice(0, 10);
const workingDays = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const offDays = ["الجمعة"];

const subjects = [
  {
    id: process.env.DEMO_CERTIFICATE_ARABIC_SUBJECT_ID || "demo-certificate-subject-arabic",
    name: process.env.DEMO_CERTIFICATE_ARABIC_SUBJECT_NAME || "اللغة العربية",
    code: "AR-DEMO",
    maxMark: 100,
    passMark: 50,
    mark: "96",
    note: "قراءة سليمة ومشاركة ممتازة"
  },
  {
    id: process.env.DEMO_CERTIFICATE_MATH_SUBJECT_ID || "demo-certificate-subject-math",
    name: process.env.DEMO_CERTIFICATE_MATH_SUBJECT_NAME || "الرياضيات",
    code: "MA-DEMO",
    maxMark: 100,
    passMark: 50,
    mark: "87",
    note: "حل الخطوات الحسابية بثقة"
  },
  {
    id: process.env.DEMO_CERTIFICATE_SCIENCE_SUBJECT_ID || "demo-certificate-subject-science",
    name: process.env.DEMO_CERTIFICATE_SCIENCE_SUBJECT_NAME || "العلوم",
    code: "SC-DEMO",
    maxMark: 100,
    passMark: 50,
    mark: "81",
    note: "فهم جيد للتجربة والمفهوم"
  },
  {
    id: process.env.DEMO_CERTIFICATE_ENGLISH_SUBJECT_ID || "demo-certificate-subject-english",
    name: process.env.DEMO_CERTIFICATE_ENGLISH_SUBJECT_NAME || "اللغة الإنجليزية",
    code: "EN-DEMO",
    maxMark: 100,
    passMark: 50,
    mark: "90",
    note: "قراءة ومفردات واضحة"
  },
  {
    id: process.env.DEMO_CERTIFICATE_ISLAMIC_SUBJECT_ID || "demo-certificate-subject-islamic",
    name: process.env.DEMO_CERTIFICATE_ISLAMIC_SUBJECT_NAME || "التربية الإسلامية",
    code: "IS-DEMO",
    maxMark: 100,
    passMark: 50,
    mark: "85",
    note: "التزام وفهم جيد"
  },
  {
    id: process.env.DEMO_CERTIFICATE_QURAN_SUBJECT_ID || "demo-certificate-subject-quran",
    name: process.env.DEMO_CERTIFICATE_QURAN_SUBJECT_NAME || "القرآن الكريم",
    code: "QR-DEMO",
    maxMark: 100,
    passMark: 50,
    mark: "94",
    note: "تلاوة متقنة"
  },
  {
    id: process.env.DEMO_CERTIFICATE_COMPUTER_SUBJECT_ID || "demo-certificate-subject-computer",
    name: process.env.DEMO_CERTIFICATE_COMPUTER_SUBJECT_NAME || "الحاسوب",
    code: "IT-DEMO",
    maxMark: 100,
    passMark: 50,
    mark: "89",
    note: "مهارة جيدة في المهام الرقمية"
  },
  {
    id: process.env.DEMO_CERTIFICATE_ART_SUBJECT_ID || "demo-certificate-subject-art",
    name: process.env.DEMO_CERTIFICATE_ART_SUBJECT_NAME || "الفنون",
    code: "ART-DEMO",
    maxMark: 100,
    passMark: 50,
    mark: "92",
    note: "إبداع واضح في الأنشطة الفنية"
  }
];

const studentRoster = [
  { id: studentId, name: studentName, nationalId: studentNationalId },
  {
    id: process.env.DEMO_CERTIFICATE_STUDENT_02_ID || "demo-certificate-student-02",
    name: process.env.DEMO_CERTIFICATE_STUDENT_02_NAME || "ليان أحمد خالد",
    nationalId: process.env.DEMO_CERTIFICATE_STUDENT_02_NATIONAL_ID || "390123457"
  },
  {
    id: process.env.DEMO_CERTIFICATE_STUDENT_03_ID || "demo-certificate-student-03",
    name: process.env.DEMO_CERTIFICATE_STUDENT_03_NAME || "ريم سامر حسن",
    nationalId: process.env.DEMO_CERTIFICATE_STUDENT_03_NATIONAL_ID || "390123458"
  },
  {
    id: process.env.DEMO_CERTIFICATE_STUDENT_04_ID || "demo-certificate-student-04",
    name: process.env.DEMO_CERTIFICATE_STUDENT_04_NAME || "مريم يوسف فهد",
    nationalId: process.env.DEMO_CERTIFICATE_STUDENT_04_NATIONAL_ID || "390123459"
  },
  {
    id: process.env.DEMO_CERTIFICATE_STUDENT_05_ID || "demo-certificate-student-05",
    name: process.env.DEMO_CERTIFICATE_STUDENT_05_NAME || "نور خالد عيسى",
    nationalId: process.env.DEMO_CERTIFICATE_STUDENT_05_NATIONAL_ID || "390123460"
  },
  {
    id: process.env.DEMO_CERTIFICATE_STUDENT_06_ID || "demo-certificate-student-06",
    name: process.env.DEMO_CERTIFICATE_STUDENT_06_NAME || "جنى ناصر طه",
    nationalId: process.env.DEMO_CERTIFICATE_STUDENT_06_NATIONAL_ID || "390123461"
  },
  {
    id: process.env.DEMO_CERTIFICATE_STUDENT_07_ID || "demo-certificate-student-07",
    name: process.env.DEMO_CERTIFICATE_STUDENT_07_NAME || "هبة رامي عادل",
    nationalId: process.env.DEMO_CERTIFICATE_STUDENT_07_NATIONAL_ID || "390123462"
  },
  {
    id: process.env.DEMO_CERTIFICATE_STUDENT_08_ID || "demo-certificate-student-08",
    name: process.env.DEMO_CERTIFICATE_STUDENT_08_NAME || "لارا باسم عمر",
    nationalId: process.env.DEMO_CERTIFICATE_STUDENT_08_NATIONAL_ID || "390123463"
  },
  {
    id: process.env.DEMO_CERTIFICATE_STUDENT_09_ID || "demo-certificate-student-09",
    name: process.env.DEMO_CERTIFICATE_STUDENT_09_NAME || "تالا ماهر جميل",
    nationalId: process.env.DEMO_CERTIFICATE_STUDENT_09_NATIONAL_ID || "390123464"
  },
  {
    id: process.env.DEMO_CERTIFICATE_STUDENT_10_ID || "demo-certificate-student-10",
    name: process.env.DEMO_CERTIFICATE_STUDENT_10_NAME || "رنا كمال نور",
    nationalId: process.env.DEMO_CERTIFICATE_STUDENT_10_NATIONAL_ID || "390123465"
  }
];

function assertLocalDatabase() {
  const url = new URL(DATABASE_URL);
  const localHosts = new Set(["localhost", "127.0.0.1", "postgres", "sompro_postgres"]);
  if (!localHosts.has(url.hostname)) {
    throw new Error(
      `Refusing to seed demo certificate data into non-local database host "${url.hostname}". Set DEMO_CERTIFICATE_ALLOW_NONLOCAL=true to override.`
    );
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:v1:${salt}:${hash}`;
}

function gradeKeyFromAverage(average) {
  if (average >= 90) return "certificates.grades.excellent";
  if (average >= 80) return "certificates.grades.veryGood";
  if (average >= 70) return "certificates.grades.good";
  if (average >= 50) return "certificates.grades.pass";
  return "certificates.grades.needsWork";
}

function resultFromAverage(average) {
  if (average >= 90) return "PASS";
  if (average >= 50) return "PASS_WITH_WARNING";
  if (average >= 45) return "REVIEW";
  return "INCOMPLETE";
}

function rowGradeFromAverage(average) {
  return gradeKeyFromAverage(average);
}

function dayOffset(daysBack) {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

function academicDays() {
  return [
    { date: dayOffset(6), day: "السبت", status: "PRESENT" },
    { date: dayOffset(5), day: "الأحد", status: "PRESENT" },
    { date: dayOffset(4), day: "الاثنين", status: "PRESENT" },
    { date: dayOffset(3), day: "الثلاثاء", status: "LATE", lateAt: "08:15" },
    { date: dayOffset(2), day: "الأربعاء", status: "LEFT_EARLY", leftAt: "10:40" },
    { date: dayOffset(1), day: "الخميس", status: "ABSENT_EXCUSED" }
  ];
}

async function upsertUser({ id, email, name, role, studentId: linkedStudentId = null, password }) {
  return prisma.user.upsert({
    where: { email },
    create: {
      id,
      schoolId,
      name,
      fullName: name,
      email,
      password: hashPassword(password),
      role,
      studentId: linkedStudentId,
      status: "ACTIVE"
    },
    update: {
      schoolId,
      name,
      fullName: name,
      password: hashPassword(password),
      role,
      studentId: linkedStudentId,
      status: "ACTIVE",
      tokenVersion: { increment: 1 }
    }
  });
}

async function main() {
  if (process.env.DEMO_CERTIFICATE_ALLOW_NONLOCAL !== "true") {
    assertLocalDatabase();
  }

  await prisma.school.upsert({
    where: { id: schoolId },
    create: {
      id: schoolId,
      name: schoolName,
      address: "بيئة محلية مخصصة لتجربة الشهادة",
      managerName: adminName,
      institutionCode,
      isActive: true
    },
    update: {
      name: schoolName,
      address: "بيئة محلية مخصصة لتجربة الشهادة",
      managerName: adminName,
      institutionCode,
      isActive: true
    }
  });

  await upsertUser({
    id: "demo-certificate-admin-user",
    email: adminEmail,
    name: adminName,
    role: "ADMIN",
    password: adminPassword
  });

  const teacherUser = await upsertUser({
    id: "demo-certificate-teacher-user",
    email: teacherEmail,
    name: teacherName,
    role: "TEACHER",
    password: teacherPassword
  });

  await prisma.schoolSettings.upsert({
    where: { schoolId },
    create: {
      schoolId,
      workingDays,
      offDays,
      periodsPerDay: 7,
      maxTeachers: 100
    },
    update: {
      workingDays,
      offDays,
      periodsPerDay: 7,
      maxTeachers: 100
    }
  });

  const teacher = await prisma.teacher.upsert({
    where: { schoolId_name: { schoolId, name: teacherName } },
    create: {
      id: "demo-certificate-teacher",
      schoolId,
      userId: teacherUser.id,
      name: teacherName,
      employeeNumber: "T-CERT-001",
      specialty: "الصفوف الأساسية",
      workDays: workingDays,
      preferredDays: ["السبت", "الاثنين"],
      preferredClasses: [classId],
      preferredPeriods: [1, 2, 3],
      targetLoad: 18,
      notes: "معلم تجريبي لعرض الشهادة النهائية"
    },
    update: {
      userId: teacherUser.id,
      employeeNumber: "T-CERT-001",
      specialty: "الصفوف الأساسية",
      status: "ACTIVE",
      workDays: workingDays,
      preferredDays: ["السبت", "الاثنين"],
      preferredClasses: [classId],
      preferredPeriods: [1, 2, 3],
      targetLoad: 18,
      notes: "معلم تجريبي لعرض الشهادة النهائية"
    }
  });

  const schoolClass = await prisma.schoolClass.upsert({
    where: { schoolId_name: { schoolId, name: className } },
    create: {
      id: classId,
      schoolId,
      name: className,
      gradeLevel: "6",
      grade: "6",
      section: "أ",
      maxStudents: 28,
      homeroomTeacherId: teacher.id
    },
    update: {
      gradeLevel: "6",
      grade: "6",
      section: "أ",
      maxStudents: 28,
      homeroomTeacherId: teacher.id,
      status: "ACTIVE"
    }
  });

  const createdSubjects = [];
  for (const subject of subjects) {
    const record = await prisma.subject.upsert({
      where: { schoolId_name: { schoolId, name: subject.name } },
      create: {
        id: subject.id,
        schoolId,
        name: subject.name,
        code: subject.code,
        maxMark: subject.maxMark,
        passMark: subject.passMark
      },
      update: {
        code: subject.code,
        status: "ACTIVE",
        maxMark: subject.maxMark,
        passMark: subject.passMark
      }
    });
    createdSubjects.push(record);

    const existingAssignment = await prisma.teacherAssignment.findFirst({
      where: {
        schoolId,
        teacherId: teacher.id,
        classId: schoolClass.id,
        subjectId: record.id
      }
    });

    if (existingAssignment) {
      await prisma.teacherAssignment.update({
        where: { id: existingAssignment.id },
        data: { weeklyPeriods: 4 }
      });
    } else {
      await prisma.teacherAssignment.create({
        data: {
          schoolId,
          teacherId: teacher.id,
          classId: schoolClass.id,
          subjectId: record.id,
          weeklyPeriods: 4
        }
      });
    }
  }

  const schemeSections = [
    { id: "exam", name: "الاختبار", percentage: 100, outOf: 100 }
  ];

  const rosterStudents = [];
  for (const [index, studentInfo] of studentRoster.entries()) {
    const names = studentInfo.name.split(" ").filter(Boolean);
    const firstName = names[0] || "طالب";
    const lastName = names.slice(1).join(" ") || "تجريبي";
    const student = await prisma.student.upsert({
      where: { id: studentInfo.id },
      create: {
        id: studentInfo.id,
        schoolId,
        classId: schoolClass.id,
        name: studentInfo.name,
        firstName,
        lastName,
        internalStudentNumber: `S-CERT-${String(index + 1).padStart(3, "0")}`,
        nationalId: studentInfo.nationalId,
        guardianPhone: `05000000${String(index + 7).padStart(2, "0")}`
      },
      update: {
        schoolId,
        classId: schoolClass.id,
        name: studentInfo.name,
        firstName,
        lastName,
        internalStudentNumber: `S-CERT-${String(index + 1).padStart(3, "0")}`,
        nationalId: studentInfo.nationalId,
        status: "ACTIVE",
        guardianPhone: `05000000${String(index + 7).padStart(2, "0")}`
      }
    });
    rosterStudents.push(student);
  }

  const markMatrix = new Map(
    rosterStudents.map((student, index) => {
      const baseOffset = Math.min(index * 2, 12);
      return [
        student.id,
        subjects.map((subject, subjectIndex) => {
          const baseMark = Number(subject.mark) || 0;
          const variation = Math.min(subjectIndex, 2);
          return String(Math.max(baseMark - baseOffset + variation, 60));
        })
      ];
    })
  );

  for (const [subjectIndex, subject] of createdSubjects.entries()) {
    await prisma.studentGradeScheme.upsert({
      where: {
        schoolId_classId_subjectId_certificateType: {
          schoolId,
          classId: schoolClass.id,
          subjectId: subject.id,
          certificateType
        }
      },
      create: {
        schoolId,
        classId: schoolClass.id,
        subjectId: subject.id,
        certificateType,
        title: `${subject.name} - ${certificateType}`,
        maxScore: 100,
        sections: schemeSections
      },
      update: {
        title: `${subject.name} - ${certificateType}`,
        maxScore: 100,
        sections: schemeSections
      }
    });

    await prisma.studentGradeEntry.upsert({
      where: {
        schoolId_classId_subjectId_certificateType: {
          schoolId,
          classId: schoolClass.id,
          subjectId: subject.id,
          certificateType
        }
      },
      create: {
        schoolId,
        classId: schoolClass.id,
        subjectId: subject.id,
        certificateType,
        rows: Object.fromEntries(
          rosterStudents.map((student) => [
            student.id,
            {
              exam: markMatrix.get(student.id)?.[subjectIndex] || "0"
            }
          ])
        )
      },
      update: {
        rows: Object.fromEntries(
          rosterStudents.map((student) => [
            student.id,
            {
              exam: markMatrix.get(student.id)?.[subjectIndex] || "0"
            }
          ])
        )
      }
    });
  }

  let savedCertificate = null;
  const behaviorNoteVariants = [
    "سلوك منضبط ومشاركة إيجابية.",
    "تفاعل ثابت مع حفظ مستوى جيد.",
    "تحتاج إلى التركيز في بداية الحصة."
  ];
  const teacherNoteVariants = [
    "طالبة مجتهدة وهادئة، وتظهر تحسنًا ثابتًا في الأداء.",
    "حضور جيد ومشاركة لطيفة في النقاشات الصفية.",
    "تقرأ بثقة وتحتاج إلى دعم بسيط في السرعة."
  ];

  for (const [index, student] of rosterStudents.entries()) {
    for (const entry of academicDays()) {
      await prisma.studentAttendance.upsert({
        where: {
          schoolId_studentId_date: {
            schoolId,
            studentId: student.id,
            date: entry.date
          }
        },
        create: {
          schoolId,
          studentId: student.id,
          date: entry.date,
          day: entry.day,
          status: entry.status,
          lateAt: entry.lateAt || null,
          leftAt: entry.leftAt || null,
          note: entry.status === "ABSENT_EXCUSED" ? "غياب بعذر للتجربة" : null
        },
        update: {
          day: entry.day,
          status: entry.status,
          lateAt: entry.lateAt || null,
          leftAt: entry.leftAt || null,
          note: entry.status === "ABSENT_EXCUSED" ? "غياب بعذر للتجربة" : null
        }
      });
    }

    const behaviorRows = [
      {
        date: dayOffset(4),
        day: "الاثنين",
        category: "discipline",
        tone: "POSITIVE",
        template: "يحافظ على النظام داخل الصف",
        note: behaviorNoteVariants[index % behaviorNoteVariants.length]
      },
      {
        date: dayOffset(3),
        day: "الثلاثاء",
        category: "participation",
        tone: "POSITIVE",
        template: "يشارك بإيجابية في الأنشطة",
        note: "أداء لافت في حل التمارين"
      },
      {
        date: dayOffset(1),
        day: "الخميس",
        category: "punctuality",
        tone: "NEGATIVE",
        template: "تأخر بسيط في الحضور",
        note: "ينبغي الانتباه إلى الموعد"
      }
    ];

    for (const record of behaviorRows) {
      await prisma.studentBehaviorRecord.upsert({
        where: {
          schoolId_studentId_date_category_tone: {
            schoolId,
            studentId: student.id,
            date: record.date,
            category: record.category,
            tone: record.tone
          }
        },
        create: {
          schoolId,
          studentId: student.id,
          date: record.date,
          day: record.day,
          category: record.category,
          tone: record.tone,
          template: record.template,
          note: record.note
        },
        update: {
          day: record.day,
          template: record.template,
          note: record.note
        }
      });
    }

    const subjectRows = createdSubjects.map((subject, subjectIndex) => {
      const mark = markMatrix.get(student.id)?.[subjectIndex] || "0";
      const averageValue = Number.parseFloat(mark);
      return {
        id: `${subject.id}-${student.id}`,
        subjectId: subject.id,
        subjectName: subject.name,
        mark,
        maxScore: 100,
        grade: rowGradeFromAverage(averageValue),
        note: subjects[subjectIndex].note
      };
    });

    const average =
      Math.round(
        (subjectRows.reduce((sum, row) => sum + Number.parseFloat(row.mark || "0"), 0) / subjectRows.length) * 10
      ) / 10;

    savedCertificate = await prisma.studentCertificate.upsert({
      where: {
        schoolId_studentId_certificateType_academicYear: {
          schoolId,
          studentId: student.id,
          certificateType,
          academicYear
        }
      },
      create: {
        schoolId,
        studentId: student.id,
        certificateType,
        academicYear,
        issueDate,
        schoolNumber: student.nationalId || studentNationalId,
        presentDays: 3 + (index % 2),
        absentDays: 1,
        lateDays: index % 3 === 0 ? 1 : 0,
        earlyExitDays: index % 4 === 0 ? 1 : 0,
        behaviorLevel: index % 3 === 0 ? "VERY_GOOD" : "GOOD",
        behaviorNote:
          index % 2 === 0
            ? "سلوك منضبط ومشاركة إيجابية مع التزام واضح."
            : "تحتاج إلى مواصلة التركيز والحضور في بداية الحصة.",
        teacherNotes:
          teacherNoteVariants[index % teacherNoteVariants.length] +
          (index % 2 === 0 ? " وتستفيد بوضوح من الملاحظات المكتوبة." : " وتظهر استجابة جيدة عند التوجيه."),
        adminNotes: "ملف الشهادة التجريبية جاهز للعرض.",
        teacherSignature: teacherName,
        principalSignature: adminName,
        average,
        grade: gradeKeyFromAverage(average),
        result: resultFromAverage(average),
        saved: true,
        published: true,
        subjectRows
      },
      update: {
        issueDate,
        schoolNumber: student.nationalId || studentNationalId,
        presentDays: 3 + (index % 2),
        absentDays: 1,
        lateDays: index % 3 === 0 ? 1 : 0,
        earlyExitDays: index % 4 === 0 ? 1 : 0,
        behaviorLevel: index % 3 === 0 ? "VERY_GOOD" : "GOOD",
        behaviorNote:
          index % 2 === 0
            ? "سلوك منضبط ومشاركة إيجابية مع التزام واضح."
            : "تحتاج إلى مواصلة التركيز والحضور في بداية الحصة.",
        teacherNotes:
          teacherNoteVariants[index % teacherNoteVariants.length] +
          (index % 2 === 0 ? " وتستفيد بوضوح من الملاحظات المكتوبة." : " وتظهر استجابة جيدة عند التوجيه."),
        adminNotes: "ملف الشهادة التجريبية جاهز للعرض.",
        teacherSignature: teacherName,
        principalSignature: adminName,
        average,
        grade: gradeKeyFromAverage(average),
        result: resultFromAverage(average),
        saved: true,
        published: true,
        subjectRows
      }
    });
  }

  console.log("[SOM PRO] Certificate demo data ready");
  console.log(
    JSON.stringify(
      {
        schoolId,
        schoolName,
        classId: schoolClass.id,
        className: schoolClass.name,
        studentCount: rosterStudents.length,
        studentId: rosterStudents[0].id,
        studentName: rosterStudents[0].name,
        certificateType,
        academicYear,
        issueDate,
        average: savedCertificate?.average,
        result: savedCertificate?.result,
        adminEmail,
        teacherEmail
      },
      null,
      2
    )
  );
}

main()
  .catch((failure) => {
    console.error(failure instanceof Error ? failure.stack || failure.message : failure);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => null));
