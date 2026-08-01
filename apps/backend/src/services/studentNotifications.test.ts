import test from "node:test";
import assert from "node:assert/strict";
import { saveNotificationRecord } from "./studentNotifications";

type StoredNotification = {
  id: string;
  sentAt: Date | null;
  status: string;
  title: string;
  message: string;
};

function createFakePrisma(existing: StoredNotification | null = null) {
  const calls: { kind: "findFirst" | "create" | "update"; payload?: unknown }[] = [];
  const db = {
    studentNotification: {
      async findFirst() {
        calls.push({ kind: "findFirst" });
        return existing;
      },
      async create({ data }: { data: StoredNotification }) {
        calls.push({ kind: "create", payload: data });
        existing = {
          id: "created",
          sentAt: data.sentAt,
          status: data.status,
          title: data.title,
          message: data.message
        };
        return existing;
      },
      async update({ data }: { where: { id: string }; data: StoredNotification }) {
        calls.push({ kind: "update", payload: data });
        existing = {
          id: "updated",
          sentAt: data.sentAt,
          status: data.status,
          title: data.title,
          message: data.message
        };
        return existing;
      }
    }
  };

  return { db, calls };
}

const payload = {
  schoolId: "school-a",
  studentId: "student-a",
  eventType: "INVITATION",
  channel: "SMS",
  recipientType: "PARENT",
  title: "استدعاء الطالب",
  message: "نص الاستدعاء",
  recipientPhones: [{ label: "father", phone: "+972500000000" }],
  recipientNames: [{ label: "father", name: "ولي الأمر" }],
  payload: { classId: "class-a" }
};

test("student notification records are created first and then updated on re-save", async () => {
  const firstRun = createFakePrisma(null);
  const created = await saveNotificationRecord(firstRun.db as never, payload, "QUEUED", null);

  assert.equal(firstRun.calls.map((call) => call.kind).join(","), "findFirst,create");
  assert.equal(created.status, "QUEUED");
  assert.equal(created.sentAt, null);

  const oldSentAt = new Date("2026-07-19T10:00:00.000Z");
  const secondRun = createFakePrisma({
    id: "existing",
    sentAt: oldSentAt,
    status: "QUEUED",
    title: payload.title,
    message: payload.message
  });
  const updated = await saveNotificationRecord(secondRun.db as never, payload, "SENT", null);

  assert.equal(secondRun.calls.map((call) => call.kind).join(","), "findFirst,update");
  assert.equal(updated.status, "SENT");
  assert.notEqual(updated.sentAt, null);
  assert.notEqual(updated.sentAt?.getTime(), oldSentAt.getTime());
});
