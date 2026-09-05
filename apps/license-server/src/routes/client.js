const { json, readBody, clientAddress } = require("../runtime");
const { deviceFingerprintFromBody, deviceNameFromBody, effectiveStatus, licenseStatusPayload } = require("../policy");
const {
  activateDevice,
  createResetToken,
  consumeResetToken,
  findLicenseByCredentialHash,
  getAdminAccount,
  publicLicenseFromRecord,
  recordSecurityEvent,
  registerInstall,
  resolveLicenseCredential,
  touchDeviceOnStatus,
  validateInstallBody
} = require("../store");

function licenseNotIssuedResponse() {
  return {
    error: "LICENSE_NOT_ISSUED",
    status: "SUSPENDED",
    message: "هذا الترخيص غير صادر من لوحة المالك"
  };
}

async function handleClientRoutes(req, res, url) {
  if (url.pathname === "/api/client/preinstall" && req.method === "POST") {
    const body = await readBody(req);
    try {
      const result = await validateInstallBody(body);
      if (result.errorStatus) return json(res, result.errorStatus, result.body);
      return json(res, 200, { data: publicLicenseFromRecord(result.license), ok: true });
    } catch {
      return json(res, 400, {
        error: "INVALID_LICENSE",
        message: "كود الترخيص غير صحيح أو قديم. أصدر ترخيصا جديدا من لوحة المالك."
      });
    }
  }

  if (url.pathname === "/api/client/register-install" && req.method === "POST") {
    const body = await readBody(req);
    try {
      const result = await validateInstallBody(body);
      if (result.errorStatus) return json(res, result.errorStatus, result.body);
      const license = await registerInstall(result.license.id, body);
      return json(res, 200, { data: publicLicenseFromRecord(license), ok: true });
    } catch {
      return json(res, 400, {
        error: "INVALID_LICENSE",
        message: "كود الترخيص غير صحيح أو قديم."
      });
    }
  }

  if (url.pathname === "/api/client/recover-admin" && req.method === "POST") {
    const body = await readBody(req);
    try {
      const license = await resolveLicenseCredential(body.licenseCode || body.licenseKey);
      if (!license) return json(res, 404, licenseNotIssuedResponse());
      const status = effectiveStatus(license);
      if (["SUSPENDED", "CANCELLED"].includes(status)) return json(res, 403, { error: "LICENSE_SUSPENDED", status });
      const account = await getAdminAccount(license);
      const requestedEmail = String(body.email || "")
        .trim()
        .toLowerCase();
      const accountEmail = String(account.email || "")
        .trim()
        .toLowerCase();
      if (requestedEmail && requestedEmail !== accountEmail) {
        await recordSecurityEvent({
          type: "ADMIN_RESET_TOKEN_ISSUED",
          result: "DENIED",
          licenseId: license.id,
          email: requestedEmail,
          ip: clientAddress(req),
          reason: "EMAIL_MISMATCH"
        });
        return json(res, 403, { error: "RECOVERY_NOT_AVAILABLE" });
      }
      const reset = await createResetToken(license, account, clientAddress(req));
      return json(res, 200, {
        data: {
          ...publicLicenseFromRecord(license),
          adminAccount: { name: account.name, email: account.email, role: account.role },
          resetToken: reset.token,
          resetTokenExpiresAt: reset.expiresAt
        },
        status,
        readOnly: false
      });
    } catch (error) {
      return json(res, 400, { error: "RECOVERY_FAILED", message: error.message });
    }
  }

  if (url.pathname === "/api/client/reset-admin-password" && req.method === "POST") {
    const body = await readBody(req);
    const token = String(body.resetToken || "").trim();
    const newPassword = String(body.newPassword || "").trim();
    if (!token || newPassword.length < 12) return json(res, 400, { error: "INVALID_RESET_REQUEST" });
    const result = await consumeResetToken(token, newPassword, clientAddress(req));
    if (!result) return json(res, 400, { error: "INVALID_OR_EXPIRED_RESET_TOKEN" });
    return json(res, 200, { data: { ok: true, email: result.email } });
  }

  if (url.pathname === "/api/client/activate" && req.method === "POST") {
    const body = await readBody(req);
    try {
      const license = await resolveLicenseCredential(body.licenseCode || body.licenseKey);
      if (!license) return json(res, 404, licenseNotIssuedResponse());
      const status = effectiveStatus(license);
      if (["SUSPENDED", "CANCELLED"].includes(status)) return json(res, 403, { error: "LICENSE_SUSPENDED", status });
      const activated = await activateDevice(license.id, {
        ...body,
        deviceId: deviceFingerprintFromBody(body),
        deviceName: deviceNameFromBody(body)
      });
      const payload = licenseStatusPayload(activated, "تم تفعيل هذا الجهاز بنجاح");
      payload.data.adminAccount = await getAdminAccount(activated);
      return json(res, 200, payload);
    } catch (error) {
      if (error.message === "MAX_DEVICES_REACHED") {
        return json(res, 403, { error: "MAX_DEVICES_REACHED", status: "SUSPENDED" });
      }
      if (error.message === "DEVICE_DISABLED") {
        return json(res, 403, {
          error: "DEVICE_DISABLED",
          status: "SUSPENDED",
          message: "هذا الجهاز غير مفعل أو تم تعطيله"
        });
      }
      return json(res, 400, { error: "INVALID_LICENSE", message: error.message });
    }
  }

  if (
    (url.pathname === "/api/client/check" || url.pathname === "/api/client/status" || url.pathname === "/api/license/status") &&
    req.method === "POST"
  ) {
    const body = await readBody(req);
    const license = await findLicenseByCredentialHash(body.licenseKeyHash);
    if (!license) return json(res, 404, { error: "LICENSE_NOT_FOUND", status: "SUSPENDED" });
    try {
      const updated = await touchDeviceOnStatus(license.id, body);
      return json(res, 200, licenseStatusPayload(updated));
    } catch {
      return json(res, 403, {
        error: "DEVICE_DISABLED",
        status: "SUSPENDED",
        message: "هذا الجهاز غير مفعل أو تم تعطيله"
      });
    }
  }

  return null;
}

module.exports = {
  handleClientRoutes
};
