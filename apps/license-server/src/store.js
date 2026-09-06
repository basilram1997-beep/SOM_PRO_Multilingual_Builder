const crypto = require("crypto");
const { prisma } = require("./db");
const { hash, RESET_TOKEN_TTL_MS } = require("./runtime");
const {
  deviceFingerprintFromBody,
  effectiveStatus,
  generateUniqueLicenseCode,
  licenseCodeHash,
  makeDefaultAdminEmail,
  makeLicenseKey,
  normalizeLicenseCode,
  publicLicense,
  repairMojibakeText,
  deviceNameFromBody,
  machineFingerprintFromInstall
} = require("./policy");

function metadataObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeAdminAccount(account, fallbackEmail) {
  if (!account || typeof account !== "object") return null;
  const name = String(account.name || "مدير المدرسة").trim() || "مدير المدرسة";
  const email = String(account.email || fallbackEmail || "").trim().toLowerCase();
  const password = typeof account.password === "string" ? account.password : "";
  const role = String(account.role || "ADMIN").trim().toUpperCase() || "ADMIN";
  if (!email) return null;
  return { name, email, password, role };
}

function normalizeDevice(device) {
  if (!device || typeof device !== "object") return null;
  const fingerprint = String(device.fingerprint || device.deviceId || "").trim();
  if (!fingerprint) return null;
  return {
    fingerprint,
    deviceId: String(device.deviceId || fingerprint).trim(),
    deviceName: String(device.deviceName || "").trim(),
    appVersion: String(device.appVersion || "").trim(),
    platform: String(device.platform || "").trim(),
    activatedAt: String(device.activatedAt || new Date().toISOString()),
    lastCheckAt: String(device.lastCheckAt || new Date().toISOString()),
    status: String(device.status || "active"),
    disabled: Boolean(device.disabled)
  };
}

function normalizeInstallation(installation) {
  if (!installation || typeof installation !== "object") return null;
  return {
    fingerprint: String(installation.fingerprint || "").trim(),
    installedAt: String(installation.installedAt || new Date().toISOString()),
    computerName: String(installation.computerName || "").trim(),
    userName: String(installation.userName || "").trim()
  };
}

function normalizeResetToken(entry) {
  if (!entry || typeof entry !== "object") return null;
  return {
    tokenHash: String(entry.tokenHash || "").trim(),
    email: String(entry.email || "").trim().toLowerCase(),
    expiresAt: String(entry.expiresAt || "").trim(),
    usedAt: entry.usedAt ? String(entry.usedAt) : null,
    issuedAt: String(entry.issuedAt || new Date().toISOString()),
    ip: String(entry.ip || "").trim()
  };
}

function normalizeSecurityEvent(entry) {
  if (!entry || typeof entry !== "object") return null;
  return {
    type: String(entry.type || "LICENSE_EVENT").trim(),
    result: String(entry.result || "OK").trim(),
    createdAt: String(entry.createdAt || new Date().toISOString()),
    licenseId: String(entry.licenseId || "").trim(),
    email: String(entry.email || "").trim(),
    ip: String(entry.ip || "").trim(),
    reason: String(entry.reason || "").trim()
  };
}

function buildMetadata(license) {
  return {
    licenseKey: license.licenseKey || "",
    licenseCode: license.licenseCode || "",
    licenseCodeHash: license.licenseCodeHash || (license.licenseCode ? licenseCodeHash(license.licenseCode) : ""),
    adminAccount: license.adminAccount || null,
    devices: Array.isArray(license.devices) ? license.devices.map(normalizeDevice).filter(Boolean) : [],
    installations: Array.isArray(license.installations)
      ? license.installations.map(normalizeInstallation).filter(Boolean)
      : [],
    resetTokens: Array.isArray(license.resetTokens) ? license.resetTokens.map(normalizeResetToken).filter(Boolean) : [],
    securityEvents: Array.isArray(license.securityEvents)
      ? license.securityEvents.map(normalizeSecurityEvent).filter(Boolean)
      : [],
    allowedFeatures: Array.isArray(license.allowedFeatures) ? license.allowedFeatures : ["core"]
  };
}

function licenseFromActivation(activation) {
  const metadata = metadataObject(activation.metadata);
  const adminAccount = normalizeAdminAccount(metadata.adminAccount, makeDefaultAdminEmail(activation.institutionCode));
  const license = {
    id: activation.id,
    schoolId: activation.schoolId,
    licenseKeyHash: activation.licenseKeyHash,
    licenseCodeHash: String(activation.licenseCodeHash || metadata.licenseCodeHash || "").trim(),
    licenseKey: String(metadata.licenseKey || "").trim(),
    licenseCode: String(metadata.licenseCode || "").trim(),
    schoolName: repairMojibakeText(activation.schoolName || ""),
    institutionCode: repairMojibakeText(activation.institutionCode || ""),
    plan: String(activation.plan || "PAID"),
    status: String(activation.status || "ACTIVE"),
    expiresAt: activation.expiresAt instanceof Date ? activation.expiresAt.toISOString() : String(activation.expiresAt || ""),
    maxDevices: Number(activation.maxDevices || 1),
    deviceFingerprint: String(activation.deviceFingerprint || ""),
    devices: Array.isArray(metadata.devices) ? metadata.devices.map(normalizeDevice).filter(Boolean) : [],
    installations: Array.isArray(metadata.installations) ? metadata.installations.map(normalizeInstallation).filter(Boolean) : [],
    resetTokens: Array.isArray(metadata.resetTokens) ? metadata.resetTokens.map(normalizeResetToken).filter(Boolean) : [],
    securityEvents: Array.isArray(metadata.securityEvents)
      ? metadata.securityEvents.map(normalizeSecurityEvent).filter(Boolean)
      : [],
    adminAccount,
    createdAt: activation.createdAt instanceof Date ? activation.createdAt.toISOString() : String(activation.createdAt || ""),
    updatedAt: activation.updatedAt instanceof Date ? activation.updatedAt.toISOString() : String(activation.updatedAt || ""),
    activatedAt: activation.activatedAt instanceof Date ? activation.activatedAt.toISOString() : String(activation.activatedAt || ""),
    lastCheckAt: activation.lastCheckAt instanceof Date ? activation.lastCheckAt.toISOString() : String(activation.lastCheckAt || ""),
    readOnlyReason: activation.readOnlyReason || null,
    allowedFeatures: Array.isArray(metadata.allowedFeatures) ? metadata.allowedFeatures : ["core"]
  };
  return license;
}

function publicLicenseFromRecord(license) {
  const safe = { ...license };
  delete safe.metadata;
  delete safe.resetTokens;
  delete safe.securityEvents;
  delete safe.licenseKey;
  return publicLicense(safe);
}

function credentialHashes(value) {
  const clean = String(value || "").trim();
  const normalized = normalizeLicenseCode(clean);
  return new Set([hash(clean), normalized ? hash(normalized) : "", hash(clean.toUpperCase())].filter(Boolean));
}

function licenseMatchesCredential(license, credential) {
  if (!credential) return false;
  const hashes = credentialHashes(credential);
  return (
    hashes.has(String(license.licenseKeyHash || "")) ||
    hashes.has(String(license.licenseCodeHash || "")) ||
    hashes.has(hash(String(license.licenseKey || ""))) ||
    hashes.has(hash(String(license.licenseCode || "")))
  );
}

async function listLicenses() {
  const rows = await prisma.licenseActivation.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  return rows.map(licenseFromActivation);
}

async function findLicenseById(id) {
  if (!id) return null;
  const activation = await prisma.licenseActivation.findUnique({ where: { id } });
  return activation ? licenseFromActivation(activation) : null;
}

async function findLicenseByCredential(credential) {
  const clean = String(credential || "").trim();
  if (!clean) return null;
  const hashes = [...credentialHashes(clean)];
  const activation = await prisma.licenseActivation.findFirst({
    where: {
      OR: [{ licenseKeyHash: { in: hashes } }, { licenseCodeHash: { in: hashes } }]
    },
    orderBy: { createdAt: "desc" }
  });
  if (activation) return licenseFromActivation(activation);

  return findLegacyLicenseByCredential(clean);
}

async function findLicenseByCredentialHash(credentialHash) {
  const clean = String(credentialHash || "").trim();
  if (!clean) return null;
  const activation = await prisma.licenseActivation.findFirst({
    where: {
      OR: [{ licenseKeyHash: clean }, { licenseCodeHash: clean }]
    },
    orderBy: { createdAt: "desc" }
  });
  if (activation) return licenseFromActivation(activation);

  return findLegacyLicenseByCredentialHash(clean);
}

async function findLegacyLicenseByCredential(credential) {
  const clean = String(credential || "").trim();
  const hashes = credentialHashes(clean);
  const rows = await prisma.licenseActivation.findMany({
    where: { licenseCodeHash: null },
    orderBy: { createdAt: "desc" }
  });
  for (const activation of rows) {
    const license = licenseFromActivation(activation);
    if (licenseMatchesCredential(license, clean) || hashes.has(String(license.licenseCodeHash || ""))) return license;
  }
  return null;
}

async function findLegacyLicenseByCredentialHash(credentialHash) {
  const clean = String(credentialHash || "").trim();
  const rows = await prisma.licenseActivation.findMany({
    where: { licenseCodeHash: null },
    orderBy: { createdAt: "desc" }
  });
  for (const activation of rows) {
    const license = licenseFromActivation(activation);
    if (
      String(license.licenseCodeHash || "") === clean ||
      hash(String(license.licenseKey || "")) === clean ||
      hash(String(license.licenseCode || "")) === clean
    ) {
      return license;
    }
  }
  return null;
}

async function mutateLicenseById(id, mutator) {
  const activation = await prisma.licenseActivation.findUnique({ where: { id } });
  if (!activation) return null;
  const current = licenseFromActivation(activation);
  const next = await mutator(current);
  if (!next) return null;
  const merged = {
    ...current,
    ...next,
    adminAccount: next.adminAccount === undefined ? current.adminAccount : next.adminAccount,
    devices: next.devices === undefined ? current.devices : next.devices,
    installations: next.installations === undefined ? current.installations : next.installations,
    resetTokens: next.resetTokens === undefined ? current.resetTokens : next.resetTokens,
    securityEvents: next.securityEvents === undefined ? current.securityEvents : next.securityEvents,
    licenseKey: next.licenseKey === undefined ? current.licenseKey : next.licenseKey,
    licenseCode: next.licenseCode === undefined ? current.licenseCode : next.licenseCode,
    licenseCodeHash: next.licenseCodeHash === undefined ? current.licenseCodeHash : next.licenseCodeHash
  };
  const updated = await prisma.licenseActivation.update({
    where: { id },
    data: {
      schoolName: merged.schoolName || null,
      institutionCode: merged.institutionCode || null,
      plan: merged.plan || "PAID",
      status: merged.status || "ACTIVE",
      licenseCodeHash: merged.licenseCodeHash || null,
      expiresAt: new Date(merged.expiresAt || current.expiresAt),
      maxDevices: Number(merged.maxDevices || 1),
      deviceFingerprint: String(merged.deviceFingerprint || current.deviceFingerprint || ""),
      lastCheckAt: new Date(merged.lastCheckAt || new Date().toISOString()),
      readOnlyReason: merged.readOnlyReason || null,
      metadata: buildMetadata(merged)
    }
  });
  return licenseFromActivation(updated);
}

async function createLicenseRecord(body = {}) {
  const days = Number(body.days || 30);
  const schoolId = String(body.schoolId || "").trim() || crypto.randomUUID();
  const payload = {
    schoolName: repairMojibakeText(body.schoolName || "مدرسة جديدة"),
    institutionCode: repairMojibakeText(body.institutionCode || ""),
    plan: String(body.plan || (days <= 45 ? "TRIAL" : "PAID")),
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
    maxDevices: Number(body.maxDevices || 1),
    allowedFeatures: Array.isArray(body.allowedFeatures) ? body.allowedFeatures : ["core"]
  };
  const licenseKey = makeLicenseKey(payload);
  const licenseCode = await generateUnusedLicenseCode();
  const licenseKeyHash = hash(licenseKey);
  const generatedLicenseCodeHash = licenseCodeHash(licenseCode);
  const adminPassword = String(body.adminPassword || "").trim() || crypto.randomBytes(12).toString("hex");
  const adminAccount = normalizeAdminAccount(
    {
      name: body.adminName || body.managerName || "مدير المدرسة",
      email: body.adminEmail || makeDefaultAdminEmail(payload.institutionCode),
      password: adminPassword,
      role: "ADMIN"
    },
    makeDefaultAdminEmail(payload.institutionCode)
  );

  await prisma.school.upsert({
    where: { id: schoolId },
    update: {
      name: payload.schoolName,
      institutionCode: payload.institutionCode || null,
      managerName: adminAccount?.name || null,
      isActive: true,
      status: "ACTIVE"
    },
    create: {
      id: schoolId,
      name: payload.schoolName,
      institutionCode: payload.institutionCode || null,
      managerName: adminAccount?.name || null,
      isActive: true,
      status: "ACTIVE"
    }
  });

  const activation = await prisma.licenseActivation.create({
    data: {
      schoolId,
      licenseKeyHash,
      licenseCodeHash: generatedLicenseCodeHash,
      schoolName: payload.schoolName,
      institutionCode: payload.institutionCode,
      plan: payload.plan,
      status: "ACTIVE",
      expiresAt: new Date(payload.expiresAt),
      maxDevices: payload.maxDevices,
      deviceFingerprint: String(body.deviceFingerprint || body.deviceId || "pending"),
      metadata: {
        ...buildMetadata({
          licenseKey,
          licenseCode,
          licenseCodeHash: generatedLicenseCodeHash,
          adminAccount,
          devices: [],
          installations: [],
          resetTokens: [],
          securityEvents: [],
          allowedFeatures: payload.allowedFeatures
        })
      }
    }
  });

  return licenseFromActivation(activation);
}

async function generateUnusedLicenseCode() {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const code = generateUniqueLicenseCode([]);
    const existing = await prisma.licenseActivation.findFirst({
      where: { licenseCodeHash: licenseCodeHash(code) },
      select: { id: true }
    });
    if (!existing) return code;
  }
  throw new Error("LICENSE_CODE_GENERATION_FAILED");
}

async function deleteLicenseById(id) {
  if (!id) return false;
  const existing = await prisma.licenseActivation.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return false;
  await prisma.licenseActivation.delete({ where: { id } });
  return true;
}

async function upsertAdminAccount(licenseId, account = {}) {
  return mutateLicenseById(licenseId, (license) => {
    const currentPassword = license.adminAccount?.password || "";
    const nextAccount = normalizeAdminAccount(
      {
        name: account.name || license.adminAccount?.name || "مدير المدرسة",
        email: account.email || license.adminAccount?.email || makeDefaultAdminEmail(license.institutionCode),
        password: account.password || currentPassword || "",
        role: account.role || license.adminAccount?.role || "ADMIN"
      },
      makeDefaultAdminEmail(license.institutionCode)
    );
    if (!nextAccount) return license;
    if (!nextAccount.password) {
      nextAccount.password = crypto.randomBytes(12).toString("hex");
    }
    return { ...license, adminAccount: nextAccount };
  });
}

async function removeAdminAccount(licenseId) {
  return mutateLicenseById(licenseId, (license) => ({ ...license, adminAccount: null }));
}

async function getAdminAccount(licenseOrId) {
  const license =
    typeof licenseOrId === "string"
      ? await findLicenseById(licenseOrId)
      : licenseOrId && licenseOrId.adminAccount
        ? licenseOrId
        : licenseOrId
          ? licenseFromActivation(licenseOrId)
          : null;
  if (!license?.adminAccount) return { name: "مدير المدرسة", email: "", password: "", role: "ADMIN" };
  return license.adminAccount;
}

async function registerInstall(licenseId, body) {
  return mutateLicenseById(licenseId, (license) => {
    const fingerprint = machineFingerprintFromInstall(body);
    const installations = Array.isArray(license.installations) ? [...license.installations] : [];
    installations.push({
      fingerprint,
      installedAt: new Date().toISOString(),
      computerName: String(body.computerName || ""),
      userName: String(body.userName || "")
    });
    return { ...license, installations };
  });
}

async function activateDevice(licenseId, body) {
  return mutateLicenseById(licenseId, (license) => {
    const fingerprint = deviceFingerprintFromBody(body);
    const devices = Array.isArray(license.devices) ? [...license.devices] : [];
    let device = devices.find((item) => item.fingerprint === fingerprint || item.deviceId === fingerprint);
    if (!device) {
      if (devices.filter((item) => !item.disabled).length >= Number(license.maxDevices || 1)) {
        throw new Error("MAX_DEVICES_REACHED");
      }
      device = {
        fingerprint,
        deviceId: fingerprint,
        deviceName: deviceNameFromBody(body),
        appVersion: String(body.appVersion || ""),
        platform: String(body.platform || ""),
        activatedAt: new Date().toISOString(),
        lastCheckAt: new Date().toISOString(),
        status: "active",
        disabled: false
      };
      devices.push(device);
    }
    if (device.disabled || device.status === "revoked") {
      throw new Error("DEVICE_DISABLED");
    }
    device.lastCheckAt = new Date().toISOString();
    device.deviceName = deviceNameFromBody(body);
    device.appVersion = String(body.appVersion || device.appVersion || "");
    device.platform = String(body.platform || device.platform || "");
    return {
      ...license,
      devices,
      deviceFingerprint: fingerprint,
      lastCheckAt: new Date().toISOString()
    };
  });
}

async function touchDeviceOnStatus(licenseId, body) {
  return mutateLicenseById(licenseId, (license) => {
    const fingerprint = deviceFingerprintFromBody(body);
    const devices = Array.isArray(license.devices) ? [...license.devices] : [];
    const device = devices.find((item) => item.fingerprint === fingerprint || item.deviceId === fingerprint);
    if (!device) {
      throw new Error("DEVICE_DISABLED");
    }
    if (device.disabled || device.status === "revoked") {
      throw new Error("DEVICE_DISABLED");
    }
    device.lastCheckAt = new Date().toISOString();
    return { ...license, devices, lastCheckAt: new Date().toISOString() };
  });
}

async function createResetToken(license, account, ip) {
  const token = "SOM-RESET-" + crypto.randomBytes(24).toString("hex").toUpperCase();
  const tokenHash = hash(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
  const next = await mutateLicenseById(license.id, (current) => {
    const resetTokens = Array.isArray(current.resetTokens) ? [...current.resetTokens] : [];
    resetTokens.push({
      tokenHash,
      email: String(account.email || "").trim().toLowerCase(),
      expiresAt,
      usedAt: null,
      issuedAt: new Date().toISOString(),
      ip: String(ip || "")
    });
    return { ...current, resetTokens };
  });
  if (next) {
    await prisma.licenseResetToken.create({
      data: {
        licenseId: license.id,
        tokenHash,
        email: String(account.email || "").trim().toLowerCase(),
        expiresAt: new Date(expiresAt),
        ip: String(ip || "")
      }
    });
    await recordSecurityEvent({
      type: "ADMIN_RESET_TOKEN_ISSUED",
      result: "OK",
      licenseId: license.id,
      email: account.email,
      ip
    });
  }
  return { token, expiresAt };
}

async function consumeResetToken(token, newPassword, ip) {
  const tokenHash = hash(String(token || "").trim());
  const resetToken = await prisma.licenseResetToken.findUnique({
    where: { tokenHash },
    include: { license: true }
  });
  if (resetToken) {
    if (resetToken.usedAt || resetToken.expiresAt.getTime() < Date.now()) return null;
    const license = licenseFromActivation(resetToken.license);
    const updated = await consumeResetTokenForLicense(license, tokenHash, newPassword);
    if (!updated) return null;
    await prisma.licenseResetToken.update({ where: { tokenHash }, data: { usedAt: new Date() } });
    await recordResetTokenConsumeEvent(license, ip);
    return { email: license.adminAccount?.email || "", licenseId: license.id };
  }

  return consumeLegacyResetToken(tokenHash, newPassword, ip);
}

async function consumeResetTokenForLicense(license, tokenHash, newPassword) {
  return mutateLicenseById(license.id, (current) => {
    const currentTokens = Array.isArray(current.resetTokens) ? [...current.resetTokens] : [];
    const tokenEntry = currentTokens.find((item) => item.tokenHash === tokenHash && !item.usedAt);
    if (tokenEntry) tokenEntry.usedAt = new Date().toISOString();
    const adminAccount = normalizeAdminAccount(
      {
        name: current.adminAccount?.name || "مدير المدرسة",
        email: current.adminAccount?.email || "",
        password: newPassword,
        role: current.adminAccount?.role || "ADMIN"
      },
      makeDefaultAdminEmail(current.institutionCode)
    );
    return {
      ...current,
      adminAccount,
      resetTokens: currentTokens
    };
  });
}

async function consumeLegacyResetToken(tokenHash, newPassword, ip) {
  const rows = await prisma.licenseActivation.findMany({
    where: { licenseCodeHash: null },
    orderBy: { createdAt: "desc" }
  });
  for (const activation of rows) {
    const license = licenseFromActivation(activation);
    const resetTokens = Array.isArray(license.resetTokens) ? license.resetTokens : [];
    const tokenEntry = resetTokens.find(
      (item) => item.tokenHash === tokenHash && !item.usedAt && new Date(item.expiresAt).getTime() >= Date.now()
    );
    if (!tokenEntry) continue;
    const updated = await consumeResetTokenForLicense(license, tokenHash, newPassword);
    if (!updated) return null;
    await recordResetTokenConsumeEvent(license, ip);
    return { email: license.adminAccount?.email || "", licenseId: license.id };
  }
  return null;
}

async function recordResetTokenConsumeEvent(license, ip) {
  await recordSecurityEvent({
    type: "ADMIN_RESET_TOKEN_CONSUME",
    result: "OK",
    licenseId: license.id,
    email: license.adminAccount?.email || "",
    ip
  });
}

async function recordSecurityEvent(event) {
  await prisma.auditLog
    .create({
      data: {
        schoolId: event.schoolId || null,
        userId: event.userId || null,
        action: event.type,
        entity: "LICENSE_SERVER",
        entityId: event.licenseId || null,
        before: event.before || null,
        after: {
          result: event.result || "OK",
          email: event.email || "",
          ip: event.ip || "",
          reason: event.reason || ""
        }
      }
    })
    .catch(() => null);
}

async function resolveLicenseCredential(credential) {
  return findLicenseByCredential(credential);
}

async function validateInstallBody(body) {
  const license = await resolveLicenseCredential(body.licenseCode || body.licenseKey);
  if (!license) {
    return {
      errorStatus: 404,
      body: {
        error: "LICENSE_NOT_FOUND",
        status: "SUSPENDED",
        message: "هذا الترخيص غير صادر من لوحة المالك"
      }
    };
  }

  const status = effectiveStatus(license);
  if (["SUSPENDED", "CANCELLED"].includes(status)) {
    return {
      errorStatus: 403,
      body: { error: "LICENSE_SUSPENDED", status }
    };
  }

  return { license, status };
}

module.exports = {
  activateDevice,
  createLicenseRecord,
  createResetToken,
  deleteLicenseById,
  consumeResetToken,
  findLicenseByCredential,
  findLicenseByCredentialHash,
  findLicenseById,
  getAdminAccount,
  licenseFromActivation,
  listLicenses,
  metadataObject,
  mutateLicenseById,
  publicLicenseFromRecord,
  recordSecurityEvent,
  registerInstall,
  removeAdminAccount,
  resolveLicenseCredential,
  touchDeviceOnStatus,
  upsertAdminAccount,
  validateInstallBody
};
