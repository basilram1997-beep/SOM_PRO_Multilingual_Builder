import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createAttendanceNotification, saveNotificationRecord } from "./studentNotifications";

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

async function withMockWebhookServer(
  statusCode: number,
  fn: (url: string, received: { headers: http.IncomingHttpHeaders; body: unknown }) => Promise<void>
) {
  const received = { headers: {} as http.IncomingHttpHeaders, body: null as unknown };
  const server = http.createServer((req, res) => {
    received.headers = req.headers;
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        received.body = raw ? JSON.parse(raw) : null;
      } catch {
        received.body = raw;
      }
      res.writeHead(statusCode, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: statusCode >= 200 && statusCode < 300 }));
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start mock webhook server");
  }

  try {
    await fn(`http://127.0.0.1:${address.port}`, received);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
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

test("attendance notifications send payloads to an external webhook and persist sent status", async () => {
  const originalWebhook = process.env.SOM_NOTIFICATION_WEBHOOK_URL;
  const originalToken = process.env.SOM_NOTIFICATION_WEBHOOK_TOKEN;

  try {
    await withMockWebhookServer(200, async (url, received) => {
      process.env.SOM_NOTIFICATION_WEBHOOK_URL = url;
      process.env.SOM_NOTIFICATION_WEBHOOK_TOKEN = "webhook-token";

      const fake = createFakePrisma();
      const created = await createAttendanceNotification(fake.db as never, {
        schoolId: "school-a",
        student: {
          id: "student-a",
          name: "Ø£Ø­Ù…Ø¯",
          fatherName: "Ø¨Ø§Ø³Ù„",
          motherName: "Ø§ÙŠÙ…Ø§Ù†",
          guardianPhone: "+972500000000",
          fatherPhone: "+972500000001",
          motherPhone: "+972500000002",
          studentPhone: null
        },
        className: "10A",
        attendance: {
          date: "2026-08-09",
          day: "Ø§Ù„Ø£Ø­Ø¯",
          status: "LATE",
          lateAt: "08:10",
          leftAt: null
        }
      });

      assert.ok(created);
      assert.equal(fake.calls.map((call) => call.kind).join(","), "findFirst,create");
      assert.equal((created as { status: string }).status, "SENT");
      assert.notEqual((created as { sentAt: Date | null }).sentAt, null);
      assert.equal(
        (received.headers.authorization || received.headers.Authorization) as string,
        "Bearer webhook-token"
      );
      const body = received.body as {
        eventType?: string;
        title?: string;
        message?: string;
        recipientPhones?: Array<{ label: string; phone: string }>;
      };
      assert.equal(body?.eventType, "ATTENDANCE");
      assert.equal(body?.title, "تنبيه متأخر");
      assert.match(String(body?.message || ""), /2026-08-09/);
      assert.equal(body?.recipientPhones?.length, 3);
    });
  } finally {
    process.env.SOM_NOTIFICATION_WEBHOOK_URL = originalWebhook;
    process.env.SOM_NOTIFICATION_WEBHOOK_TOKEN = originalToken;
  }
});

test("attendance notifications record failures when the external webhook responds with an error", async () => {
  const originalWebhook = process.env.SOM_NOTIFICATION_WEBHOOK_URL;

  try {
    await withMockWebhookServer(500, async (url) => {
      process.env.SOM_NOTIFICATION_WEBHOOK_URL = url;
      const fake = createFakePrisma();
      const created = await createAttendanceNotification(fake.db as never, {
        schoolId: "school-b",
        student: {
          id: "student-b",
          name: "ÙØ§Ø·Ù…Ø©",
          fatherName: "ÙÙˆØ²ÙŠ",
          motherName: null,
          guardianPhone: "+972500000010",
          fatherPhone: null,
          motherPhone: null,
          studentPhone: null
        },
        className: "11B",
        attendance: {
          date: "2026-08-09",
          day: "Ø§Ù„Ø£Ø­Ø¯",
          status: "PRESENT",
          lateAt: null,
          leftAt: null
        }
      });

      assert.ok(created);
      assert.equal((created as { status: string }).status, "FAILED");
      const createPayload = fake.calls.find((call) => call.kind === "create")?.payload as
        { errorMessage?: string | null; status?: string } | undefined;
      assert.equal(createPayload?.status, "FAILED");
      assert.equal(createPayload?.errorMessage, "HTTP_500");
    });
  } finally {
    process.env.SOM_NOTIFICATION_WEBHOOK_URL = originalWebhook;
  }
});
