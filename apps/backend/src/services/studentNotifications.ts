import type { Prisma, PrismaClient, Student, StudentAttendance } from "@prisma/client";
import { env } from "../config/env";

type NotificationStatus = "QUEUED" | "SENT" | "FAILED";

type NotificationDeliveryPayload = {
  schoolId: string;
  studentId: string | null;
  eventType: string;
  channel: string;
  recipientType: string;
  title: string;
  message: string;
  recipientPhones: Array<{ label: string; phone: string }>;
  recipientNames: Array<{ label: string; name: string | null }>;
  payload: Record<string, unknown>;
};

type ComposeAttendanceNotificationInput = {
  schoolId: string;
  student: Pick<
    Student,
    "id" | "name" | "fatherName" | "motherName" | "guardianPhone" | "fatherPhone" | "motherPhone" | "studentPhone"
  >;
  className: string;
  attendance: Pick<StudentAttendance, "date" | "day" | "status" | "lateAt" | "leftAt">;
};

type TeacherPermissionStatus = "ABSENT" | "LATE" | "LEFT" | "UNAVAILABLE";

type StudentNotificationRecord = Awaited<ReturnType<PrismaClient["studentNotification"]["create"]>>;

function normalizePhone(value: string | null | undefined) {
  const phone = String(value || "").trim();
  if (!phone) return "";
  return phone.replace(/[^\d+]/g, "");
}

function uniqueRecipients(
  items: Array<{ label: string; phone: string | null | undefined; name: string | null | undefined }>
) {
  const seen = new Set<string>();
  return items
    .map((item) => ({
      label: item.label,
      phone: normalizePhone(item.phone),
      name: item.name?.trim() || null
    }))
    .filter((item) => {
      if (!item.phone || seen.has(item.phone)) return false;
      seen.add(item.phone);
      return true;
    });
}

function statusText(status: string) {
  if (status === "PRESENT") return "حاضر";
  if (status === "LATE") return "متأخر";
  if (status === "ABSENT_EXCUSED") return "غائب بعذر";
  if (status === "ABSENT_UNEXCUSED") return "غائب بدون عذر";
  if (status === "LEFT_EARLY") return "غادر مبكرًا";
  return "غير معروف";
}

function composeAttendanceMessage(input: ComposeAttendanceNotificationInput) {
  const status = statusText(input.attendance.status);
  const statusTime =
    input.attendance.status === "LATE"
      ? input.attendance.lateAt
      : input.attendance.status === "LEFT_EARLY"
        ? input.attendance.leftAt
        : null;
  const timePart = statusTime ? ` عند ${statusTime}` : "";
  return `تنبيه من المدرسة: تم تسجيل ${status} للطالب ${input.student.name} في الصف ${input.className} يوم ${input.attendance.day} بتاريخ ${input.attendance.date}${timePart}.`;
}

function notificationWebhookUrl() {
  if (env.disableThirdPartyIntegrations) return "";
  return process.env.SOM_NOTIFICATION_WEBHOOK_URL || process.env.SOM_SMS_WEBHOOK_URL || "";
}

async function deliverNotification(payload: NotificationDeliveryPayload) {
  const webhookUrl = notificationWebhookUrl();
  if (!webhookUrl) {
    return { status: "QUEUED" as NotificationStatus, errorMessage: null };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.SOM_NOTIFICATION_WEBHOOK_TOKEN
          ? { authorization: `Bearer ${process.env.SOM_NOTIFICATION_WEBHOOK_TOKEN}` }
          : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        status: "FAILED" as NotificationStatus,
        errorMessage: `HTTP_${response.status}`
      };
    }

    return { status: "SENT" as NotificationStatus, errorMessage: null };
  } catch {
    const hasWebhook = Boolean(webhookUrl);
    return {
      status: hasWebhook ? ("FAILED" as NotificationStatus) : ("QUEUED" as NotificationStatus),
      errorMessage: hasWebhook ? "NOTIFICATION_DELIVERY_FAILED" : null
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function saveNotificationRecord(
  prisma: PrismaClient,
  payload: NotificationDeliveryPayload,
  status: NotificationStatus,
  errorMessage: string | null
) {
  const existing = await prisma.studentNotification.findFirst({
    where: {
      schoolId: payload.schoolId,
      studentId: payload.studentId,
      eventType: payload.eventType,
      channel: payload.channel,
      recipientType: payload.recipientType,
      title: payload.title,
      message: payload.message
    }
  });

  const data = {
    schoolId: payload.schoolId,
    studentId: payload.studentId,
    eventType: payload.eventType,
    channel: payload.channel,
    recipientType: payload.recipientType,
    status,
    title: payload.title,
    message: payload.message,
    recipientPhones: payload.recipientPhones,
    recipientNames: payload.recipientNames,
    payload: payload.payload as Prisma.InputJsonValue,
    errorMessage,
    sentAt: status === "SENT" ? new Date() : existing?.sentAt || null
  };

  if (existing) {
    return prisma.studentNotification.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.studentNotification.create({ data });
}

export async function createAttendanceNotification(prisma: PrismaClient, input: ComposeAttendanceNotificationInput) {
  const student = input.student;
  const recipients = uniqueRecipients([
    { label: "father", phone: student.fatherPhone, name: student.fatherName },
    { label: "mother", phone: student.motherPhone, name: student.motherName },
    { label: "guardian", phone: student.guardianPhone, name: null }
  ]);

  if (recipients.length === 0) return null;

  const payload: NotificationDeliveryPayload = {
    schoolId: input.schoolId,
    studentId: student.id,
    eventType: "ATTENDANCE",
    channel: "SMS",
    recipientType: "PARENT",
    title: `تنبيه ${statusText(input.attendance.status)}`,
    message: composeAttendanceMessage(input),
    recipientPhones: recipients.map((item) => ({ label: item.label, phone: item.phone })),
    recipientNames: recipients.map((item) => ({ label: item.label, name: item.name })),
    payload: {
      className: input.className,
      studentName: student.name,
      attendance: input.attendance
    }
  };

  const delivery = await deliverNotification(payload);
  return saveNotificationRecord(prisma, payload, delivery.status, delivery.errorMessage);
}

export async function createSchoolMessageNotification(
  prisma: PrismaClient,
  input: {
    schoolId: string;
    student: Pick<
      Student,
      "id" | "name" | "fatherName" | "motherName" | "guardianPhone" | "fatherPhone" | "motherPhone" | "studentPhone"
    >;
    title: string;
    message: string;
    payload?: Record<string, unknown>;
  }
) {
  const recipients = uniqueRecipients([
    { label: "father", phone: input.student.fatherPhone, name: input.student.fatherName },
    { label: "mother", phone: input.student.motherPhone, name: input.student.motherName },
    { label: "guardian", phone: input.student.guardianPhone, name: null }
  ]);

  if (recipients.length === 0) return null;

  const payload: NotificationDeliveryPayload = {
    schoolId: input.schoolId,
    studentId: input.student.id,
    eventType: "SCHOOL_MESSAGE",
    channel: "SMS",
    recipientType: "PARENT",
    title: input.title,
    message: input.message,
    recipientPhones: recipients.map((item) => ({ label: item.label, phone: item.phone })),
    recipientNames: recipients.map((item) => ({ label: item.label, name: item.name })),
    payload: input.payload || {}
  };

  const delivery = await deliverNotification(payload);
  return saveNotificationRecord(prisma, payload, delivery.status, delivery.errorMessage);
}

export async function createClassMessageNotifications(
  prisma: PrismaClient,
  input: {
    schoolId: string;
    classId: string;
    title: string;
    message: string;
    payload?: Record<string, unknown>;
  }
) {
  const students = await prisma.student.findMany({
    where: { schoolId: input.schoolId, classId: input.classId },
    select: {
      id: true,
      name: true,
      fatherName: true,
      motherName: true,
      guardianPhone: true,
      fatherPhone: true,
      motherPhone: true,
      studentPhone: true
    }
  });

  const created: StudentNotificationRecord[] = [];
  for (const student of students) {
    const notification = await createSchoolMessageNotification(prisma, {
      schoolId: input.schoolId,
      student,
      title: input.title,
      message: input.message,
      payload: {
        ...(input.payload || {}),
        classId: input.classId
      }
    });
    if (notification) created.push(notification);
  }

  return created;
}

export async function listStudentNotifications(
  prisma: PrismaClient,
  schoolId: string,
  options: {
    classId?: string;
    studentId?: string;
    eventType?: string;
    limit?: number;
  }
) {
  const limit = Math.min(Math.max(options.limit || 20, 1), 100);
  const classStudents = options.classId
    ? await prisma.student.findMany({
        where: { schoolId, classId: options.classId },
        select: { id: true, name: true, classId: true }
      })
    : [];
  if (options.classId && classStudents.length === 0) return [];
  const studentIds = options.studentId ? [options.studentId] : classStudents.map((student) => student.id);

  const notifications = await prisma.studentNotification.findMany({
    where: {
      schoolId,
      ...(options.eventType ? { eventType: options.eventType } : {}),
      ...(studentIds.length ? { studentId: { in: studentIds } } : {})
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });

  const fallbackStudentIds = Array.from(
    new Set(
      notifications
        .map((notification) => notification.studentId)
        .filter((studentId): studentId is string => Boolean(studentId))
    )
  );
  const fallbackStudents =
    !options.classId && fallbackStudentIds.length > 0
      ? await prisma.student.findMany({
          where: { schoolId, id: { in: fallbackStudentIds } },
          select: { id: true, name: true, classId: true }
        })
      : [];
  const studentMap = new Map([...classStudents, ...fallbackStudents].map((student) => [student.id, student]));
  return notifications.map((notification) => ({
    ...notification,
    studentName: notification.studentId ? studentMap.get(notification.studentId)?.name || null : null
  }));
}

export async function createInvitationNotification(
  prisma: PrismaClient,
  input: {
    schoolId: string;
    classId: string;
    student: Pick<
      Student,
      "id" | "name" | "fatherName" | "motherName" | "guardianPhone" | "fatherPhone" | "motherPhone" | "studentPhone"
    >;
    studentName: string;
    className: string;
    invitationType: "INVITATION" | "PERMISSION";
    date: string;
    time: string;
    reason: string;
    note?: string;
    homeroomTeacherName?: string;
    principalName?: string;
  }
) {
  const recipients = uniqueRecipients([
    { label: "father", phone: input.student.fatherPhone, name: input.student.fatherName },
    { label: "mother", phone: input.student.motherPhone, name: input.student.motherName },
    { label: "guardian", phone: input.student.guardianPhone, name: null },
    { label: "student", phone: input.student.studentPhone, name: input.student.name }
  ]);

  const title =
    input.invitationType === "PERMISSION"
      ? `??????? ?????? ${input.studentName}`
      : `??????? ??? ??? ?????? ${input.studentName}`;
  const message =
    input.invitationType === "PERMISSION"
      ? `???? ?????? ?????? ${input.studentName} ?? ???? ${input.className} ?????????? ?????? ${input.date} ??? ?????? ${input.time}. ?????: ${input.reason}${input.note ? `? ??????: ${input.note}` : ""}.`
      : `???? ???? ??? ??? ?????? ${input.studentName} ?? ???? ${input.className} ??? ??????? ?????? ${input.date} ??? ?????? ${input.time}. ?????: ${input.reason}${input.note ? `? ??????: ${input.note}` : ""}.`;

  const payload: NotificationDeliveryPayload = {
    schoolId: input.schoolId,
    studentId: input.student.id,
    eventType: "INVITATION",
    channel: "SMS",
    recipientType: "PARENT",
    title,
    message,
    recipientPhones: recipients.map((item) => ({ label: item.label, phone: item.phone })),
    recipientNames: recipients.map((item) => ({ label: item.label, name: item.name })),
    payload: {
      classId: input.classId,
      className: input.className,
      studentName: input.studentName,
      invitationType: input.invitationType,
      date: input.date,
      time: input.time,
      reason: input.reason,
      note: input.note || "",
      homeroomTeacherName: input.homeroomTeacherName || "",
      principalName: input.principalName || ""
    }
  };

  if (recipients.length === 0) {
    return saveNotificationRecord(prisma, payload, "QUEUED", null);
  }

  const delivery = await deliverNotification(payload);
  return saveNotificationRecord(prisma, payload, delivery.status, delivery.errorMessage);
}

export async function createPledgeNotification(
  prisma: PrismaClient,
  input: {
    schoolId: string;
    classId: string;
    student: Pick<
      Student,
      "id" | "name" | "fatherName" | "motherName" | "guardianPhone" | "fatherPhone" | "motherPhone" | "studentPhone"
    >;
    studentName: string;
    className: string;
    date: string;
    title: string;
    pledgeText: string;
    note?: string;
    homeroomTeacherName?: string;
    principalName?: string;
  }
) {
  const recipients = uniqueRecipients([
    { label: "father", phone: input.student.fatherPhone, name: input.student.fatherName },
    { label: "mother", phone: input.student.motherPhone, name: input.student.motherName },
    { label: "guardian", phone: input.student.guardianPhone, name: null },
    { label: "student", phone: input.student.studentPhone, name: input.student.name }
  ]);

  const title = input.title.trim() || `تعهد الطالب ${input.studentName}`;
  const pledgeText = input.pledgeText.trim();
  const message = `${title} - ${input.studentName} - ${input.className} - ${input.date}\n${pledgeText}${input.note ? `\nملاحظة: ${input.note}` : ""}`;

  const payload: NotificationDeliveryPayload = {
    schoolId: input.schoolId,
    studentId: input.student.id,
    eventType: "PLEDGE",
    channel: "SMS",
    recipientType: "PARENT",
    title,
    message,
    recipientPhones: recipients.map((item) => ({ label: item.label, phone: item.phone })),
    recipientNames: recipients.map((item) => ({ label: item.label, name: item.name })),
    payload: {
      classId: input.classId,
      className: input.className,
      studentName: input.studentName,
      date: input.date,
      title,
      pledgeText,
      note: input.note || "",
      homeroomTeacherName: input.homeroomTeacherName || "",
      principalName: input.principalName || ""
    }
  };

  if (recipients.length === 0) {
    return saveNotificationRecord(prisma, payload, "QUEUED", null);
  }

  const delivery = await deliverNotification(payload);
  return saveNotificationRecord(prisma, payload, delivery.status, delivery.errorMessage);
}

export async function createTeacherPermissionNotification(
  prisma: PrismaClient,
  input: {
    schoolId: string;
    teacherId: string;
    teacherName: string;
    date: string;
    day: string;
    status: TeacherPermissionStatus;
    fromPeriod: number;
    toPeriod?: number;
    reason: string;
    note?: string;
  }
) {
  const statusLabel =
    input.status === "ABSENT"
      ? "غائب"
      : input.status === "LATE"
        ? "متأخر"
        : input.status === "LEFT"
          ? "مغادر"
          : "في مهمة";
  const range =
    input.toPeriod && input.toPeriod !== input.fromPeriod
      ? `من الحصة ${input.fromPeriod} إلى الحصة ${input.toPeriod}`
      : `الحصة ${input.fromPeriod}`;
  const notePart = input.note ? `\nملاحظة: ${input.note}` : "";

  const payload: NotificationDeliveryPayload = {
    schoolId: input.schoolId,
    studentId: null,
    eventType: "TEACHER_PERMISSION",
    channel: "INTERNAL",
    recipientType: "ADMIN",
    title: `استئذان المعلم ${input.teacherName}`,
    message: `تم تسجيل استئذان للمعلم ${input.teacherName} يوم ${input.day} بتاريخ ${input.date}. الحالة: ${statusLabel}. ${range}. السبب: ${input.reason}${notePart}`,
    recipientPhones: [],
    recipientNames: [],
    payload: {
      teacherId: input.teacherId,
      teacherName: input.teacherName,
      date: input.date,
      day: input.day,
      status: input.status,
      fromPeriod: input.fromPeriod,
      toPeriod: input.toPeriod || input.fromPeriod,
      reason: input.reason,
      note: input.note || ""
    }
  };

  return saveNotificationRecord(prisma, payload, "QUEUED", null);
}

export async function listTeacherPermissionNotifications(
  prisma: PrismaClient,
  schoolId: string,
  options: {
    teacherId?: string;
    limit?: number;
  }
) {
  const limit = Math.min(Math.max(options.limit || 20, 1), 100);
  const notifications = await prisma.studentNotification.findMany({
    where: {
      schoolId,
      eventType: "TEACHER_PERMISSION"
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });

  const filtered = options.teacherId
    ? notifications.filter((notification) => {
        const payload = notification.payload as { teacherId?: string } | null | undefined;
        return payload?.teacherId === options.teacherId;
      })
    : notifications;

  return filtered.map((notification) => ({
    ...notification,
    teacherName: (notification.payload as { teacherName?: string } | null | undefined)?.teacherName || null
  }));
}
