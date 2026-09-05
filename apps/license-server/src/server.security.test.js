const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

process.env.NODE_ENV = "test";
process.env.LICENSE_REQUEST_BACKING = "memory";
process.env.LICENSE_ADMIN_TOKEN = "test-admin-token-with-more-than-32-characters";
process.env.SOM_PRO_LICENSE_SECRET = "test-license-secret-with-more-than-32-characters";
process.env.LICENSE_REQUIRE_CLIENT_NONCE = "true";
process.env.LICENSE_RESET_TOKEN_TTL_MS = "900000";

const { prisma } = require("./db");
const { createLicenseServer, licenseCodeHash } = require("./server");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

async function post(baseUrl, pathName, body, headers = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

async function cleanupLicense(licenseId) {
  if (!licenseId) return;
  const activation = await prisma.licenseActivation
    .findUnique({ where: { id: licenseId }, select: { schoolId: true } })
    .catch(() => null);
  if (activation?.schoolId) {
    await prisma.school.delete({ where: { id: activation.schoolId } }).catch(() => null);
  } else {
    await prisma.licenseActivation.deleteMany({ where: { id: licenseId } }).catch(() => null);
  }
}

async function withServer(fn) {
  const server = createLicenseServer();
  const baseUrl = await listen(server);
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("admin recovery issues a one-time reset token and never returns a plaintext password", async () => {
  let licenseId = null;
  const tag = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  await withServer(async (baseUrl) => {
    const created = await post(
      baseUrl,
      "/api/admin/licenses",
      {
        schoolName: `Security School ${tag}`,
        institutionCode: `SEC-001-${tag}`,
        adminEmail: "admin-security@example.test",
        adminPassword: "Initial-Admin-123!",
        days: 30
      },
      { Authorization: `Bearer ${process.env.LICENSE_ADMIN_TOKEN}` }
    );
    assert.equal(created.status, 201);
    assert.ok(created.body.data.licenseCode);
    licenseId = created.body.data.id;

    const deniedRecovery = await post(
      baseUrl,
      "/api/client/recover-admin",
      { licenseCode: created.body.data.licenseCode, email: "attacker@example.test" },
      { "X-Request-Nonce": "recover-nonce-0000000" }
    );
    assert.equal(deniedRecovery.status, 403);
    assert.equal(deniedRecovery.body.error, "RECOVERY_NOT_AVAILABLE");
    assert.doesNotMatch(JSON.stringify(deniedRecovery.body), /Initial-Admin-123!/);

    const recovered = await post(
      baseUrl,
      "/api/client/recover-admin",
      { licenseCode: created.body.data.licenseCode },
      { "X-Request-Nonce": "recover-nonce-0000001" }
    );
    assert.equal(recovered.status, 200);
    assert.equal(recovered.body.data.adminAccount.email, "admin-security@example.test");
    assert.ok(recovered.body.data.resetToken.startsWith("SOM-RESET-"));
    assert.ok(recovered.body.data.resetTokenExpiresAt);
    assert.equal(recovered.body.data.adminAccount.password, undefined);
    assert.doesNotMatch(JSON.stringify(recovered.body), /Initial-Admin-123!/);

    const activation = await prisma.licenseActivation.findUnique({ where: { id: licenseId } });
    assert.ok(activation);
    const metadata = activation.metadata && typeof activation.metadata === "object" ? activation.metadata : {};
    assert.equal(Array.isArray(metadata.resetTokens), true);
    assert.equal(metadata.resetTokens.length, 1);
    assert.notEqual(metadata.resetTokens[0].tokenHash, recovered.body.data.resetToken);
    assert.equal(metadata.resetTokens[0].usedAt, null);

    const reset = await post(
      baseUrl,
      "/api/client/reset-admin-password",
      {
        resetToken: recovered.body.data.resetToken,
        newPassword: "Replacement-Admin-123!"
      },
      { "X-Request-Nonce": "reset-nonce-00000001" }
    );
    assert.equal(reset.status, 200);

    const replay = await post(
      baseUrl,
      "/api/client/reset-admin-password",
      {
        resetToken: recovered.body.data.resetToken,
        newPassword: "Replacement-Admin-456!"
      },
      { "X-Request-Nonce": "reset-nonce-00000002" }
    );
    assert.equal(replay.status, 400);
    assert.equal(replay.body.error, "INVALID_OR_EXPIRED_RESET_TOKEN");

    const events = await prisma.auditLog.findMany({
      where: { entityId: licenseId, entity: "LICENSE_SERVER" },
      orderBy: { createdAt: "asc" }
    });
    assert.ok(events.some((event) => event.action === "ADMIN_RESET_TOKEN_ISSUED"));
    assert.ok(events.some((event) => event.action === "ADMIN_RESET_TOKEN_CONSUME"));
  });
  await cleanupLicense(licenseId);
});

test("client nonce replay protection rejects repeated activation requests", async () => {
  let licenseId = null;
  const tag = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  await withServer(async (baseUrl) => {
    const created = await post(
      baseUrl,
      "/api/admin/licenses",
      {
        schoolName: `Replay School ${tag}`,
        institutionCode: `SEC-002-${tag}`,
        adminEmail: "admin-replay@example.test",
        adminPassword: "Initial-Admin-123!",
        days: 30,
        maxDevices: 2
      },
      { Authorization: `Bearer ${process.env.LICENSE_ADMIN_TOKEN}` }
    );
    assert.equal(created.status, 201);
    licenseId = created.body.data.id;
    const licenseCode = created.body.data.licenseCode;

    const activationBody = {
      licenseCode,
      deviceId: "device-a",
      deviceName: "Security test device"
    };
    const headers = { "X-Request-Nonce": "activate-nonce-00001" };
    const activated = await post(baseUrl, "/api/client/activate", activationBody, headers);
    assert.equal(activated.status, 200);
    assert.equal(activated.body.data.licenseCodeHash, undefined);
    assert.equal(activated.body.data.adminAccount.password, "Initial-Admin-123!");

    const replayed = await post(baseUrl, "/api/client/activate", activationBody, headers);
    assert.equal(replayed.status, 409);
    assert.equal(replayed.body.error, "REPLAYED_NONCE");

    const missingNonce = await post(baseUrl, "/api/client/activate", activationBody);
    assert.equal(missingNonce.status, 409);
    assert.equal(missingNonce.body.error, "MISSING_NONCE");

    const status = await post(
      baseUrl,
      "/api/client/status",
      { licenseKeyHash: licenseCodeHash(licenseCode), deviceId: "device-a" },
      { "X-Request-Nonce": "status-nonce-0000001" }
    );
    assert.equal(status.status, 200);
  });
  await cleanupLicense(licenseId);
});
