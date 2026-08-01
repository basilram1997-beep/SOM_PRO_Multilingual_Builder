import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { StudentAttendanceSchema } from "@som/shared";
import { buildCertificatePersistenceData, normalizeCertificateRows, serializeCertificate } from "./studentCertificates";
import { createAttendanceNotification } from "./studentNotifications";

type AttendanceRow = {
  studentId: string;
  date: string;
  day: string;
  status: "PRESENT" | "LATE" | "ABSENT_EXCUSED" | "ABSENT_UNEXCUSED" | "LEFT_EARLY";
  lateAt: string | null;
  leftAt: string | null;
};

function saveAttendance(store: AttendanceRow[], row: AttendanceRow) {
  const existingIndex = store.findIndex((item) => item.studentId === row.studentId && item.date === row.date);
  if (existingIndex >= 0) {
    store[existingIndex] = row;
    return { action: "update" as const, row: store[existingIndex] };
  }

  store.push(row);
  return { action: "create" as const, row };
}

function buildAttendanceReport(
  store: AttendanceRow[],
  students: Array<{ id: string; classId: string }>,
  classId: string,
  date: string
) {
  const relevantStudents = students.filter((student) => student.classId === classId);
  const rows = store.filter(
    (row) => row.date === date && relevantStudents.some((student) => student.id === row.studentId)
  );
  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.status === "PRESENT") acc.present += 1;
      if (row.status === "LATE") acc.late += 1;
      if (row.status === "ABSENT_EXCUSED") acc.absentExcused += 1;
      if (row.status === "ABSENT_UNEXCUSED") acc.absentUnexcused += 1;
      if (row.status === "LEFT_EARLY") acc.earlyExit += 1;
      return acc;
    },
    { total: 0, present: 0, late: 0, absentExcused: 0, absentUnexcused: 0, earlyExit: 0 }
  );

  return {
    totalStudents: relevantStudents.length,
    recordedStudents: rows.length,
    absent: summary.absentExcused + summary.absentUnexcused,
    ...summary
  };
}

function createAttendanceNotificationFakePrisma(
  existingNotification: {
    id: string;
    sentAt: Date | null;
    status: string;
    title: string;
    message: string;
  } | null = null
) {
  const calls: Array<{ kind: "findFirst" | "create" | "update"; payload?: unknown }> = [];
  return {
    calls,
    prisma: {
      studentNotification: {
        async findFirst() {
          calls.push({ kind: "findFirst" });
          return existingNotification;
        },
        async create({ data }: { data: { status: string; title: string; message: string; sentAt: Date | null } }) {
          calls.push({ kind: "create", payload: data });
          existingNotification = {
            id: "created",
            sentAt: data.sentAt,
            status: data.status,
            title: data.title,
            message: data.message
          };
          return existingNotification;
        },
        async update({
          data
        }: {
          where: { id: string };
          data: { status: string; title: string; message: string; sentAt: Date | null };
        }) {
          calls.push({ kind: "update", payload: data });
          existingNotification = {
            id: "updated",
            sentAt: data.sentAt,
            status: data.status,
            title: data.title,
            message: data.message
          };
          return existingNotification;
        }
      }
    }
  };
}

test("attendance save updates the same daily row and the report counts the final saved state", () => {
  const students = [
    { id: "student-a", classId: "class-10a" },
    { id: "student-b", classId: "class-10a" },
    { id: "student-c", classId: "class-11a" }
  ];
  const store: AttendanceRow[] = [];

  assert.equal(
    saveAttendance(store, {
      studentId: "student-a",
      date: "2026-07-20",
      day: "الاثنين",
      status: "ABSENT_UNEXCUSED",
      lateAt: null,
      leftAt: null
    }).action,
    "create"
  );

  assert.equal(
    saveAttendance(store, {
      studentId: "student-a",
      date: "2026-07-20",
      day: "الاثنين",
      status: "PRESENT",
      lateAt: null,
      leftAt: null
    }).action,
    "update"
  );

  assert.equal(
    saveAttendance(store, {
      studentId: "student-b",
      date: "2026-07-20",
      day: "الاثنين",
      status: "LATE",
      lateAt: "08:15",
      leftAt: null
    }).action,
    "create"
  );

  const report = buildAttendanceReport(store, students, "class-10a", "2026-07-20");

  assert.equal(store.length, 2);
  assert.equal(report.totalStudents, 2);
  assert.equal(report.recordedStudents, 2);
  assert.equal(report.present, 1);
  assert.equal(report.late, 1);
  assert.equal(report.absent, 0);
  assert.equal(report.absentExcused, 0);
  assert.equal(report.absentUnexcused, 0);
  assert.equal(report.earlyExit, 0);
  assert.equal(report.total, 2);
});

test("attendance keeps day keys separate around midnight and accepts the expanded status contract", () => {
  const attendanceA = StudentAttendanceSchema.parse({
    studentId: "student-a",
    date: "2026-07-20",
    day: "الإثنين",
    status: "PRESENT",
    note: null
  });
  const attendanceB = StudentAttendanceSchema.parse({
    studentId: "student-a",
    date: "2026-07-21",
    day: "الثلاثاء",
    status: "LATE",
    lateAt: "00:05",
    note: null
  });

  assert.equal(attendanceA.date, "2026-07-20");
  assert.equal(attendanceB.date, "2026-07-21");
  assert.doesNotThrow(() =>
    StudentAttendanceSchema.parse({
      studentId: "student-b",
      date: "2026-07-21",
      day: "الثلاثاء",
      status: "ABSENT_EXCUSED",
      note: "مرض"
    })
  );
  assert.doesNotThrow(() =>
    StudentAttendanceSchema.parse({
      studentId: "student-b",
      date: "2026-07-21",
      day: "الثلاثاء",
      status: "ABSENT_UNEXCUSED"
    })
  );
  assert.doesNotThrow(() =>
    StudentAttendanceSchema.parse({
      studentId: "student-b",
      date: "2026-07-21",
      day: "الثلاثاء",
      status: "LEFT_EARLY",
      leftAt: "11:30"
    })
  );
  assert.throws(() =>
    StudentAttendanceSchema.parse({
      studentId: "student-b",
      date: "2026-07-21",
      day: "الثلاثاء",
      status: "EXCUSED"
    })
  );
});

test("attendance notifications deduplicate parent recipients and keep late time in the message", async () => {
  const previousWebhook = process.env.SOM_NOTIFICATION_WEBHOOK_URL;
  delete process.env.SOM_NOTIFICATION_WEBHOOK_URL;

  try {
    const fake = createAttendanceNotificationFakePrisma();
    const notification = await createAttendanceNotification(fake.prisma as never, {
      schoolId: "school-a",
      student: {
        id: "student-a",
        name: "حمزة",
        fatherName: "باسل",
        motherName: "أمينة",
        guardianPhone: "+972500000000",
        fatherPhone: "+972500000000",
        motherPhone: "+972599999999",
        studentPhone: null
      },
      className: "العاشر أ",
      attendance: {
        date: "2026-07-20",
        day: "الإثنين",
        status: "LATE",
        lateAt: "08:15",
        leftAt: null
      }
    });

    assert.ok(notification);
    assert.equal(fake.calls.map((call) => call.kind).join(","), "findFirst,create");

    const createdPayload = fake.calls.find((call) => call.kind === "create")?.payload as
      | {
          recipientPhones?: Array<{ label: string; phone: string }>;
          message?: string;
          status?: string;
          sentAt?: Date | null;
        }
      | undefined;
    assert.ok(createdPayload);
    assert.equal(createdPayload?.status, "QUEUED");
    assert.equal(createdPayload?.sentAt, null);
    assert.equal(createdPayload?.recipientPhones?.length, 2);
    assert.match(createdPayload?.message || "", /متأخر/);
    assert.match(createdPayload?.message || "", /08:15/);
  } finally {
    if (previousWebhook === undefined) {
      delete process.env.SOM_NOTIFICATION_WEBHOOK_URL;
    } else {
      process.env.SOM_NOTIFICATION_WEBHOOK_URL = previousWebhook;
    }
  }
});

test("attendance notifications describe early exit with the recorded leave time", async () => {
  const previousWebhook = process.env.SOM_NOTIFICATION_WEBHOOK_URL;
  delete process.env.SOM_NOTIFICATION_WEBHOOK_URL;

  try {
    const fake = createAttendanceNotificationFakePrisma();
    const notification = await createAttendanceNotification(fake.prisma as never, {
      schoolId: "school-a",
      student: {
        id: "student-b",
        name: "أحمد",
        fatherName: "باسل",
        motherName: "أمينة",
        guardianPhone: "+972500000001",
        fatherPhone: "+972500000001",
        motherPhone: null,
        studentPhone: null
      },
      className: "العاشر أ",
      attendance: {
        date: "2026-07-20",
        day: "الإثنين",
        status: "LEFT_EARLY",
        lateAt: null,
        leftAt: "12:10"
      }
    });

    assert.ok(notification);
    const createdPayload = fake.calls.find((call) => call.kind === "create")?.payload as
      { message?: string } | undefined;
    assert.ok(createdPayload);
    assert.match(createdPayload?.message || "", /غادر/);
    assert.match(createdPayload?.message || "", /12:10/);
  } finally {
    if (previousWebhook === undefined) {
      delete process.env.SOM_NOTIFICATION_WEBHOOK_URL;
    } else {
      process.env.SOM_NOTIFICATION_WEBHOOK_URL = previousWebhook;
    }
  }
});

test("attendance reports keep different days separate even when the clock crosses midnight", () => {
  const students = [
    { id: "student-a", classId: "class-10a" },
    { id: "student-b", classId: "class-10a" },
    { id: "student-c", classId: "class-10a" },
    { id: "student-d", classId: "class-11a" }
  ];
  const store: AttendanceRow[] = [
    { studentId: "student-a", date: "2026-07-20", day: "الإثنين", status: "PRESENT", lateAt: null, leftAt: null },
    { studentId: "student-b", date: "2026-07-20", day: "الإثنين", status: "LATE", lateAt: "23:58", leftAt: null },
    {
      studentId: "student-a",
      date: "2026-07-21",
      day: "الثلاثاء",
      status: "ABSENT_EXCUSED",
      lateAt: null,
      leftAt: null
    },
    { studentId: "student-c", date: "2026-07-21", day: "الثلاثاء", status: "LEFT_EARLY", lateAt: null, leftAt: "11:45" }
  ];

  const firstDay = buildAttendanceReport(store, students, "class-10a", "2026-07-20");
  const secondDay = buildAttendanceReport(store, students, "class-10a", "2026-07-21");

  assert.equal(firstDay.recordedStudents, 2);
  assert.equal(firstDay.present, 1);
  assert.equal(firstDay.late, 1);
  assert.equal(firstDay.absent, 0);
  assert.equal(firstDay.absentExcused, 0);
  assert.equal(firstDay.absentUnexcused, 0);
  assert.equal(firstDay.earlyExit, 0);
  assert.equal(secondDay.recordedStudents, 2);
  assert.equal(secondDay.present, 0);
  assert.equal(secondDay.late, 0);
  assert.equal(secondDay.absent, 1);
  assert.equal(secondDay.absentExcused, 1);
  assert.equal(secondDay.absentUnexcused, 0);
  assert.equal(secondDay.earlyExit, 1);
});

test("attendance report ignores students moved to another class or withdrawn from the selected class roster", () => {
  const students = [
    { id: "student-active", classId: "class-10a" },
    { id: "student-moved", classId: "class-11a" },
    // withdrawn student is omitted from the active roster snapshot
    { id: "student-new", classId: "class-10a" }
  ];
  const store: AttendanceRow[] = [
    { studentId: "student-active", date: "2026-07-20", day: "الإثنين", status: "PRESENT", lateAt: null, leftAt: null },
    {
      studentId: "student-new",
      date: "2026-07-20",
      day: "الإثنين",
      status: "ABSENT_UNEXCUSED",
      lateAt: null,
      leftAt: null
    }
  ];

  const report = buildAttendanceReport(store, students, "class-10a", "2026-07-20");

  assert.equal(report.totalStudents, 2);
  assert.equal(report.recordedStudents, 2);
  assert.equal(report.present, 1);
  assert.equal(report.absent, 1);
});

test("attendance and certificate routes keep the same saved data visible to later reports", () => {
  const studentsSource = readFileSync("src/modules/students/students.routes.ts", "utf8");
  const reportsSource = readFileSync("src/modules/reports/reports.routes.ts", "utf8");

  assert.match(studentsSource, /studentsRouter\.get\("\/attendance"/, "attendance listing route should exist");
  assert.match(studentsSource, /studentsRouter\.put\("\/attendance"/, "attendance save route should exist");
  assert.match(studentsSource, /studentAttendance\.upsert\(/, "attendance should be saved through upsert");
  assert.match(
    studentsSource,
    /studentsRouter\.post\("\/attendance\/archive"/,
    "attendance archive route should exist"
  );
  assert.match(
    studentsSource,
    /buildAttendanceArchiveReport/,
    "attendance archive should build a report from saved rows"
  );
  assert.match(reportsSource, /reportsRouter\.get\("\/attendance"/, "attendance report route should exist");
  assert.match(
    reportsSource,
    /studentAttendance\.findMany\(\{/,
    "attendance report should read from saved attendance rows"
  );
});

test("grade rows can be converted into certificate data and preserved when serialized", () => {
  const rows = normalizeCertificateRows([
    { id: "grade-1", subjectId: "math", subjectName: "Math", mark: "40", maxScore: 40, grade: "", note: "" },
    { id: "grade-2", subjectId: "science", subjectName: "Science", mark: "36", maxScore: 40, grade: "", note: "" }
  ]);

  const payload = buildCertificatePersistenceData({
    studentId: "student-a",
    certificateType: "TERM2_FINAL",
    academicYear: "2025/2026",
    issueDate: "2026-07-20",
    schoolNumber: "662452",
    presentDays: 25,
    absentDays: 1,
    lateDays: 2,
    behaviorLevel: "VERY_GOOD",
    behaviorNote: "Stable",
    teacherNotes: "Keeps progress",
    adminNotes: "Approved",
    teacherSignature: "Homeroom",
    principalSignature: "Principal",
    average: null,
    grade: "",
    result: "PASS",
    approved: true,
    published: false,
    subjectRows: rows
  } as never);

  const serialized = serializeCertificate({
    id: "certificate-a",
    studentId: "student-a",
    certificateType: payload.certificateType,
    academicYear: payload.academicYear,
    issueDate: payload.issueDate,
    schoolNumber: payload.schoolNumber,
    presentDays: payload.presentDays,
    absentDays: payload.absentDays,
    lateDays: payload.lateDays,
    earlyExitDays: payload.earlyExitDays,
    behaviorLevel: payload.behaviorLevel,
    behaviorNote: payload.behaviorNote,
    teacherNotes: payload.teacherNotes,
    adminNotes: payload.adminNotes,
    teacherSignature: payload.teacherSignature,
    principalSignature: payload.principalSignature,
    average: payload.average,
    grade: payload.grade,
    result: payload.result,
    approved: payload.approved,
    published: payload.published,
    subjectRows: payload.subjectRows,
    createdAt: new Date("2026-07-20T00:00:00.000Z"),
    updatedAt: new Date("2026-07-20T00:00:00.000Z")
  });

  const certificatesSource = readFileSync("src/modules/students/students.routes.ts", "utf8");
  const gradeReportsSource = readFileSync("src/modules/reports/reports.routes.ts", "utf8");

  assert.equal(payload.average, 95);
  assert.equal(payload.grade, "certificates.grades.excellent");
  assert.equal(payload.result, "PASS");
  assert.equal(serialized.average, 95);
  assert.equal(serialized.grade, "certificates.grades.excellent");
  assert.equal(serialized.result, "PASS");
  assert.equal(serialized.subjectRows.length, 2);
  assert.equal(serialized.subjectRows[0].subjectName, "Math");
  assert.equal(serialized.subjectRows[1].subjectName, "Science");
  assert.match(certificatesSource, /studentsRouter\.post\("\/grades"/, "grade entry save route should still exist");
  assert.match(certificatesSource, /studentGradeEntry\.upsert\(/, "grades should update the same saved row");
  assert.match(
    certificatesSource,
    /studentsRouter\.post\("\/certificates"/,
    "certificate save route should still exist"
  );
  assert.match(certificatesSource, /studentCertificate\.upsert\(/, "certificates should update the same saved row");
  assert.match(gradeReportsSource, /reportsRouter\.get\("\/grades"/, "grades report route should exist");
  assert.match(gradeReportsSource, /studentGradeEntry\.findMany\(\{/, "grades report should read stored grade entries");
});
