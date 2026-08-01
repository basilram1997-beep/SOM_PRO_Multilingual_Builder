import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import net from "node:net";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "../db/prisma";
import { hashPassword } from "./authService";

function base64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function generateE2ELicenseCode({
  days = 365,
  schoolName = "SOM E2E School",
  institutionCode = "E2E-4100",
  secret = process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
} = {}) {
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const payload = {
    schoolName,
    institutionCode,
    plan: days <= 45 ? "TRIAL" : "PAID",
    expiresAt,
    maxDevices: 1,
    allowedFeatures: ["browser-e2e"]
  };
  const payloadPart = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(payloadPart).digest("hex");
  return `SOM-${payloadPart}.${signature}`;
}

async function login(baseUrl: string, email: string, password: string, licenseCode: string) {
  const bootstrapResponse = await fetch(`${baseUrl}/api/auth/bootstrap-license`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ licenseCode, licenseKey: licenseCode })
  });
  assert.ok(bootstrapResponse.ok || bootstrapResponse.status === 429, await bootstrapResponse.text());

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, licenseCode, licenseKey: licenseCode })
  });

  const payloadText = await response.text();
  assert.equal(response.status, 200, payloadText);
  const payload = JSON.parse(payloadText);
  assert.ok(payload?.data?.token, "login should return a token");
  return String(payload.data.token);
}

function withMockScanner(fn: (url: string) => Promise<void>) {
  const server = net.createServer((socket) => {
    socket.on("data", () => {
      // Drain incoming chunks and reply once the payload is complete.
    });
    socket.on("end", () => {
      if (!socket.destroyed) {
        socket.write("stream: OK\n");
        socket.end();
      }
    });
  });

  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", async () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to start mock scanner"));
        return;
      }

      try {
        await fn(`clamav://127.0.0.1:${address.port}`);
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        server.close(() => null);
      }
    });
  });
}

test("uploaded spreadsheet is scanned before acceptance and imported through the students endpoint", async () => {
  await withMockScanner(async (scannerUrl) => {
    const runId = `${Date.now().toString(36)}-${process.pid}-upload-import`;
    const schoolId = `upload-import-school-${runId}`;
    const classId = `upload-import-class-${runId}`;
    const email = `upload-import-admin-${runId}@example.com`;
    const password = "Upload-Import-Admin-123!";
    const licenseCode = generateE2ELicenseCode({
      days: 365,
      schoolName: `Upload Import School ${runId}`,
      institutionCode: `UI${runId.toUpperCase()}`,
      secret: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
    });

    const originalScannerEnabled = process.env.SOM_FILE_UPLOAD_SCANNING_ENABLED;
    const originalScannerUrl = process.env.SOM_FILE_UPLOAD_SCANNER_URL;
    const originalRuntimeMode = process.env.SOM_RUNTIME_MODE;
    const originalRequireCentral = process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE;
    const originalLegacyCentral = process.env.SOM_LICENSE_SERVER_URL;
    const originalCentralUrl = process.env.SOM_PRO_LICENSE_SERVER_URL;

    process.env.SOM_FILE_UPLOAD_SCANNING_ENABLED = "true";
    process.env.SOM_FILE_UPLOAD_SCANNER_URL = scannerUrl;
    process.env.SOM_RUNTIME_MODE = "development";
    process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = "false";
    process.env.SOM_LICENSE_SERVER_URL = "";
    process.env.SOM_PRO_LICENSE_SERVER_URL = "";

    try {
      await prisma.school.create({
        data: {
          id: schoolId,
          name: `Upload Import School ${runId}`,
          address: "",
          managerName: "Upload Import Manager",
          institutionCode: `UI${runId.toUpperCase()}`,
          isActive: true
        }
      });

      await prisma.schoolClass.create({
        data: {
          id: classId,
          schoolId,
          name: "Upload Import Class",
          status: "ACTIVE"
        }
      });

      await prisma.user.create({
        data: {
          id: `upload-import-user-${runId}`,
          schoolId,
          name: "Upload Import Manager",
          email,
          password: hashPassword(password),
          role: "MANAGER"
        }
      });

      const { createApp } = await import("../app");
      const app = createApp();
      const server = app.listen(0);

      try {
        await new Promise<void>((resolve) => server.once("listening", resolve));
        const address = server.address();
        if (!address || typeof address === "string") {
          throw new Error("Failed to determine runtime test port");
        }

        const baseUrl = `http://127.0.0.1:${address.port}`;
        const token = await login(baseUrl, email, password, licenseCode);

        const workbookModule = await import("xlsx");
        const workbook = workbookModule.utils.book_new();
        const importRow = {
          name: `Upload Import Student ${runId}`,
          nationalId: `998${runId}`,
          fatherName: "Father Upload",
          motherName: "Mother Upload",
          residence: "Address Upload",
          fatherPhone: "0599000001",
          motherPhone: "0599000002",
          guardianPhone: "0599000003",
          healthFund: "Health Upload",
          studentPhone: "0599000004"
        };
        const sheet = workbookModule.utils.aoa_to_sheet([
          [
            "name",
            "national id",
            "father name",
            "mother name",
            "residence",
            "father phone",
            "mother phone",
            "guardian phone",
            "health fund",
            "student phone"
          ],
          Object.values(importRow)
        ]);
        workbookModule.utils.book_append_sheet(workbook, sheet, "Students");
        const fileArray = workbookModule.write(workbook, { bookType: "xlsx", type: "array" });
        const uploadBuffer = Buffer.from(fileArray);

        const uploadResponse = await fetch(`${baseUrl}/api/uploads`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "x-file-name": "students.xlsx",
            "x-mime-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          },
          body: uploadBuffer
        });

        const uploadBodyText = await uploadResponse.text();
        assert.equal(uploadResponse.status, 201, uploadBodyText);
        const uploadPayload = JSON.parse(uploadBodyText);
        assert.equal(uploadPayload?.data?.ok, true);
        assert.equal(uploadPayload?.data?.scanner, "clamav-tcp");
        assert.match(String(uploadPayload?.data?.filePath || ""), /^uploads\//);

        const importResponse = await fetch(`${baseUrl}/api/students/import`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            classId,
            students: [importRow]
          })
        });

        const importBodyText = await importResponse.text();
        assert.equal(importResponse.status, 201, importBodyText);
        const importPayload = JSON.parse(importBodyText);
        assert.equal(importPayload?.data?.created, 1);
        assert.equal(importPayload?.data?.updated, 0);

        const importedStudent = await prisma.student.findFirst({
          where: {
            schoolId,
            classId,
            nationalId: importRow.nationalId
          }
        });
        assert.ok(importedStudent, "student import should persist the uploaded spreadsheet row");

        await fs.rm(path.join(process.cwd(), "tmp", "uploads"), { recursive: true, force: true });
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      process.env.SOM_FILE_UPLOAD_SCANNING_ENABLED = originalScannerEnabled;
      process.env.SOM_FILE_UPLOAD_SCANNER_URL = originalScannerUrl;
      process.env.SOM_RUNTIME_MODE = originalRuntimeMode;
      process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = originalRequireCentral;
      process.env.SOM_LICENSE_SERVER_URL = originalLegacyCentral;
      process.env.SOM_PRO_LICENSE_SERVER_URL = originalCentralUrl;
      await prisma.student.deleteMany({ where: { schoolId } }).catch(() => null);
      await prisma.user.deleteMany({ where: { schoolId } }).catch(() => null);
      await prisma.schoolClass.delete({ where: { id: classId } }).catch(() => null);
      await prisma.school.delete({ where: { id: schoolId } }).catch(() => null);
    }
  });
});
