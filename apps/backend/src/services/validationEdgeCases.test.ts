import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  PeriodSchema,
  SchoolSettingsSchema,
  StudentCertificateTypeSchema,
  StudentAttendanceSchema,
  StudentCertificateSchema,
  StudentGradeEntrySchema,
  StudentSchema,
  TeacherSchema
} from "@som/shared";
import { validateBody } from "../middleware/validate";

function createMockResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    }
  };
}

function expectInvalid(result: { success: boolean }) {
  assert.equal(result.success, false);
}

function emptyStringToUndefined(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

const optionalNonEmptyString = () => z.preprocess(emptyStringToUndefined, z.string().trim().min(1).optional());

const AuthLoginSchema = z.object({
  email: z.string().trim().min(1, "USERNAME_REQUIRED"),
  password: z.string().min(1, "PASSWORD_REQUIRED"),
  licenseCode: optionalNonEmptyString(),
  licenseKey: optionalNonEmptyString()
});

const AuthLicenseSchema = z
  .object({
    licenseCode: optionalNonEmptyString(),
    licenseKey: optionalNonEmptyString()
  })
  .refine((value) => Boolean(value.licenseCode || value.licenseKey), {
    message: "LICENSE_REQUIRED",
    path: ["licenseCode"]
  });

const AuthRegisterSchema = z.object({
  name: z.string().trim().min(1, "NAME_REQUIRED"),
  email: z.string().trim().min(1, "USERNAME_REQUIRED"),
  password: z.string().min(6, "PASSWORD_TOO_SHORT"),
  role: z.enum(["STUDENT", "PARENT", "TEACHER"]).default("PARENT")
});

const AuthRecoverSchema = z
  .object({
    licenseCode: optionalNonEmptyString(),
    licenseKey: optionalNonEmptyString(),
    email: z.string().trim().email("INVALID_EMAIL").optional()
  })
  .refine((value) => Boolean(value.licenseCode || value.licenseKey), {
    message: "LICENSE_REQUIRED",
    path: ["licenseCode"]
  });

const AuthPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, "PASSWORD_REQUIRED"),
  newPassword: z.string().min(6, "PASSWORD_TOO_SHORT")
});

const UserRoleSchema = z.enum(["ADMIN", "SCHEDULER", "TEACHER", "STUDENT", "PARENT"]);
const LinkedStudentIdSchema = z.string().trim().min(1).optional().nullable();
const UserIdentifierSchema = z.string().trim().min(3);
const UserCreateSchema = z
  .object({
    name: z.string().min(1),
    email: UserIdentifierSchema,
    password: z.string().min(6, "PASSWORD_TOO_SHORT"),
    role: UserRoleSchema,
    studentId: LinkedStudentIdSchema
  })
  .superRefine((value, context) => {
    if ((value.role === "STUDENT" || value.role === "PARENT") && !value.studentId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentId"],
        message: "STUDENT_LINK_REQUIRED"
      });
    }
    if (value.role !== "STUDENT" && value.role !== "PARENT" && value.studentId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentId"],
        message: "STUDENT_LINK_NOT_ALLOWED"
      });
    }
  });

const UserUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: UserIdentifierSchema.optional(),
    password: z.string().min(6, "PASSWORD_TOO_SHORT").optional(),
    role: UserRoleSchema.optional(),
    studentId: LinkedStudentIdSchema
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "USER_UPDATE_REQUIRED"
  })
  .superRefine((value, context) => {
    if ((value.role === "STUDENT" || value.role === "PARENT") && !value.studentId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentId"],
        message: "STUDENT_LINK_REQUIRED"
      });
    }
    if (value.role !== "STUDENT" && value.role !== "PARENT" && value.studentId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentId"],
        message: "STUDENT_LINK_NOT_ALLOWED"
      });
    }
  });

const UserRoleUpdateSchema = z
  .object({
    role: UserRoleSchema,
    studentId: LinkedStudentIdSchema
  })
  .superRefine((value, context) => {
    if ((value.role === "STUDENT" || value.role === "PARENT") && !value.studentId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentId"],
        message: "STUDENT_LINK_REQUIRED"
      });
    }
    if (value.role !== "STUDENT" && value.role !== "PARENT" && value.studentId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentId"],
        message: "STUDENT_LINK_NOT_ALLOWED"
      });
    }
  });

const TeacherPermissionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.string().min(1),
  status: z.enum(["ABSENT", "LATE", "LEFT", "UNAVAILABLE"]),
  fromPeriod: z.coerce.number().int().min(1).max(12),
  toPeriod: z.coerce.number().int().min(1).max(12).optional().nullable(),
  reason: z.string().trim().min(1).max(300),
  note: z.string().trim().max(500).optional().nullable()
});

const TeacherAssignSubjectSchema = z.object({
  classId: z.string().trim().min(1),
  subjectId: z.string().trim().min(1),
  weeklyPeriods: z.coerce.number().int().min(0).max(40).optional()
});

const WeeklyPeriodsSchema = z.object({
  weeklyPeriods: z.number().int().min(0).max(40)
});

const NotificationListSchema = z.object({
  classId: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
  eventType: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const AttendanceQuerySchema = z.object({
  classId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const StudentImportItemSchema = StudentSchema.omit({ id: true, classId: true });
const StudentImportSchema = z.object({
  classId: z.string().min(1),
  students: z.array(StudentImportItemSchema).min(1).max(500)
});

const GradeSchemeSectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  percentage: z.coerce.number().min(0).max(100),
  outOf: z.coerce.number().min(1).max(100)
});

const GradeSchemeSchema = z.object({
  id: z.string().optional(),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  certificateType: StudentCertificateTypeSchema,
  title: z.string().trim().optional().nullable(),
  maxScore: z.coerce.number().int().min(1).max(200).default(40),
  sections: z.array(GradeSchemeSectionSchema).min(1).max(8)
});

test("period schema accepts boundaries and rejects out-of-range or wrong data types", () => {
  assert.equal(PeriodSchema.safeParse(1).success, true);
  assert.equal(PeriodSchema.safeParse(12).success, true);
  expectInvalid(PeriodSchema.safeParse(0));
  expectInvalid(PeriodSchema.safeParse(13));
  expectInvalid(PeriodSchema.safeParse(1.5));
  expectInvalid(PeriodSchema.safeParse("3" as never));
});

test("school settings schema rejects empty and oversized values", () => {
  expectInvalid(
    SchoolSettingsSchema.safeParse({
      workingDays: [],
      offDays: [],
      periodsPerDay: 0,
      maxTeachers: 100,
      adminMfaRequired: false
    })
  );
  expectInvalid(
    SchoolSettingsSchema.safeParse({
      workingDays: ["الأحد"],
      offDays: ["1", "2", "3", "4", "5", "6", "7", "8"],
      periodsPerDay: 12,
      maxTeachers: 100,
      adminMfaRequired: false
    })
  );
  expectInvalid(
    SchoolSettingsSchema.safeParse({
      workingDays: ["الأحد"],
      offDays: [],
      periodsPerDay: "6" as never,
      maxTeachers: 100,
      adminMfaRequired: false
    })
  );
});

test("teacher and student schemas reject empty strings, negatives, and wrong types", () => {
  expectInvalid(
    TeacherSchema.safeParse({
      name: "",
      employmentRatio: -1,
      preferredPeriods: [1],
      workDays: [],
      preferredDays: [],
      preferredClasses: [],
      releaseHours: 0,
      targetLoad: 25
    })
  );
  expectInvalid(
    TeacherSchema.safeParse({
      name: "Teacher",
      employmentRatio: 101,
      preferredPeriods: [1],
      workDays: [],
      preferredDays: [],
      preferredClasses: [],
      releaseHours: 0,
      targetLoad: 25
    })
  );
  expectInvalid(
    TeacherSchema.safeParse({
      name: "Teacher",
      employmentRatio: 100,
      preferredPeriods: [0],
      workDays: [],
      preferredDays: [],
      preferredClasses: [],
      releaseHours: 0,
      targetLoad: 25
    })
  );
  expectInvalid(
    StudentSchema.safeParse({
      name: "",
      classId: "",
      fatherName: null
    })
  );
  expectInvalid(
    StudentSchema.safeParse({
      name: "Student",
      classId: 123 as never
    })
  );
});

test("auth schemas reject missing licenses, weak passwords, and invalid roles", () => {
  expectInvalid(
    AuthLoginSchema.safeParse({
      email: " ",
      password: ""
    })
  );
  expectInvalid(
    AuthRegisterSchema.safeParse({
      name: "",
      email: "user@example.com",
      password: "12345",
      role: "GUEST" as never
    })
  );
  expectInvalid(
    AuthLicenseSchema.safeParse({
      licenseCode: "   ",
      licenseKey: "   "
    })
  );
  expectInvalid(
    AuthRecoverSchema.safeParse({
      email: "not-an-email",
      licenseCode: "ABC-123"
    })
  );
  expectInvalid(
    AuthPasswordChangeSchema.safeParse({
      currentPassword: "",
      newPassword: "123"
    })
  );
});

test("settings user schemas enforce role linkage and update presence", () => {
  expectInvalid(
    UserCreateSchema.safeParse({
      name: "Admin",
      email: "adm",
      password: "123456",
      role: "STUDENT"
    })
  );
  expectInvalid(
    UserCreateSchema.safeParse({
      name: "Admin",
      email: "adm",
      password: "123456",
      role: "ADMIN",
      studentId: "student-1"
    })
  );
  expectInvalid(UserUpdateSchema.safeParse({}));
  expectInvalid(
    UserRoleUpdateSchema.safeParse({
      role: "PARENT"
    })
  );
});

test("teacher schemas reject invalid periods, status, and assignment bounds", () => {
  expectInvalid(
    TeacherPermissionSchema.safeParse({
      date: "2026-08-09",
      day: "",
      status: "ON_LEAVE" as never,
      fromPeriod: 0,
      toPeriod: 13,
      reason: "",
      note: "x"
    })
  );
  expectInvalid(
    TeacherAssignSubjectSchema.safeParse({
      classId: "",
      subjectId: "subject-a",
      weeklyPeriods: 41
    })
  );
  expectInvalid(
    WeeklyPeriodsSchema.safeParse({
      weeklyPeriods: -1
    })
  );
});

test("student route schemas reject query and bulk-import boundaries", () => {
  expectInvalid(
    AttendanceQuerySchema.safeParse({
      classId: "",
      date: "2026/08/09"
    })
  );
  expectInvalid(
    NotificationListSchema.safeParse({
      limit: 0
    })
  );
  expectInvalid(
    StudentImportSchema.safeParse({
      classId: "class-a",
      students: []
    })
  );
  expectInvalid(
    StudentImportSchema.safeParse({
      classId: "class-a",
      students: Array.from({ length: 501 }, (_, index) => ({
        name: `Student ${index + 1}`,
        classId: "ignored",
        fatherName: null
      })) as never
    })
  );
  expectInvalid(
    GradeSchemeSchema.safeParse({
      classId: "class-a",
      subjectId: "subject-a",
      certificateType: "TERM1_FINAL",
      maxScore: 201,
      sections: [
        {
          id: "section-1",
          name: "Main",
          percentage: 101,
          outOf: 0
        }
      ]
    })
  );
});

test("attendance, grade, and certificate schemas reject boundary violations", () => {
  expectInvalid(
    StudentAttendanceSchema.safeParse({
      studentId: "",
      date: "2026/08/09",
      day: "",
      status: "UNKNOWN"
    })
  );
  expectInvalid(
    StudentGradeEntrySchema.safeParse({
      classId: "",
      subjectId: "subject-a",
      certificateType: "TERM3_FINAL",
      rows: {}
    })
  );
  expectInvalid(
    StudentGradeEntrySchema.safeParse({
      classId: "class-a",
      subjectId: "subject-a",
      certificateType: "TERM1_FINAL",
      rows: {
        student1: {
          mark: 12 as never
        }
      }
    })
  );
  expectInvalid(
    StudentCertificateSchema.safeParse({
      studentId: "student-a",
      certificateType: "TERM1_FINAL",
      academicYear: "",
      issueDate: "09-08-2026",
      presentDays: -1,
      absentDays: 0,
      lateDays: 0,
      earlyExitDays: 0,
      subjectRows: []
    })
  );
});

test("student certificate schema keeps approved as a stable legacy input for saved", () => {
  const result = StudentCertificateSchema.safeParse({
    studentId: "student-a",
    certificateType: "TERM1_FINAL",
    academicYear: "2026/2027",
    issueDate: "2026-08-15",
    approved: true,
    subjectRows: []
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.saved, true);
  assert.equal("approved" in result.data, false);
});

test("validateBody returns a validation error for bad data and coerces valid boundary input", () => {
  const schema = z.object({
    count: z.coerce.number().int().min(1).max(3),
    label: z.string().trim().min(1)
  });

  const badReq = { body: { count: 0, label: "" } } as never;
  const badRes = createMockResponse();
  let badNextCalled = false;

  validateBody(schema)(badReq, badRes as never, () => {
    badNextCalled = true;
  });

  assert.equal(badNextCalled, false);
  assert.equal(badRes.statusCode, 400);
  assert.equal((badRes.body as { error?: string })?.error, "VALIDATION_ERROR");

  const goodReq = { body: { count: "3", label: "  boundary  " } } as never;
  const goodRes = createMockResponse();
  let goodNextCalled = false;

  validateBody(schema)(goodReq, goodRes as never, () => {
    goodNextCalled = true;
  });

  assert.equal(goodNextCalled, true);
  assert.equal(goodRes.statusCode, 200);
  assert.deepEqual((goodReq as { body: { count: number; label: string } }).body, {
    count: 3,
    label: "boundary"
  });
});
