import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "../db/prisma";
import { hashPassword } from "./authService";

async function login(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200, await response.text());
  const payload = await response.json();
  return String(payload?.data?.token || "");
}

function withMockClamAv(fn: (url: string) => Promise<void>) {
  const server = net.createServer((socket) => {
    socket.on("data", () => {
      // consume the stream and answer when the client closes the payload
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

test("upload route scans files before accepting them", async () => {
  await withMockClamAv(async (scannerUrl) => {
    const runId = `${Date.now().toString(36)}-${process.pid}-upload`;
    const schoolId = `upload-school-${runId}`;
    const email = `upload-admin-${runId}@example.com`;
    const password = "Upload-Admin-123!";
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
          name: `Upload School ${runId}`,
          address: "",
          managerName: "Upload Manager",
          institutionCode: `UP${runId.toUpperCase()}`,
          isActive: true
        }
      });

      await prisma.user.create({
        data: {
          id: `upload-user-${runId}`,
          schoolId,
          name: "Upload Manager",
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
        const token = await login(baseUrl, email, password);

        const response = await fetch(`${baseUrl}/api/uploads`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/pdf",
            "x-file-name": "report.pdf",
            "x-mime-type": "application/pdf"
          },
          body: Buffer.from("%PDF-1.4 upload test")
        });

        assert.equal(response.status, 201, await response.text());
        const payload = await response.json();
        assert.equal(payload?.data?.ok, true);
        assert.match(String(payload?.data?.filePath || ""), /^uploads\//);
        const storedPath = path.join(process.cwd(), "tmp", String(payload?.data?.filePath || ""));
        await fs.access(storedPath);
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
      await prisma.user.deleteMany({ where: { schoolId } }).catch(() => null);
      await prisma.school.delete({ where: { id: schoolId } }).catch(() => null);
    }
  });
});
