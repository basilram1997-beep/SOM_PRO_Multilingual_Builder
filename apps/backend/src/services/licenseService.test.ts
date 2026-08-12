import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getLocalFallbackLicenseStatus,
  shouldFallbackToLocalLicense,
  shouldUseCentralLicenseServer
} from "./licenseService";

test("central license server is required only for SaaS or explicit enforcement", () => {
  assert.equal(shouldUseCentralLicenseServer("development", false), false);
  assert.equal(shouldUseCentralLicenseServer("local-trial", false), false);
  assert.equal(shouldUseCentralLicenseServer("saas", false), true);
  assert.equal(shouldUseCentralLicenseServer("development", true), true);
});

test("local fallback recovers suspended non-expired licenses", () => {
  assert.equal(getLocalFallbackLicenseStatus("SUSPENDED"), "ACTIVE");
  assert.equal(getLocalFallbackLicenseStatus("TRIAL"), "ACTIVE");
  assert.equal(getLocalFallbackLicenseStatus("EXPIRED"), "EXPIRED");
  assert.equal(getLocalFallbackLicenseStatus("CANCELLED"), "CANCELLED");
});

test("local runtime falls back from missing central license", () => {
  assert.equal(shouldFallbackToLocalLicense({ error: "LICENSE_NOT_FOUND" }, "local-trial"), true);
  assert.equal(shouldFallbackToLocalLicense({ error: "LICENSE_NOT_FOUND" }, "development"), true);
  assert.equal(shouldFallbackToLocalLicense({ error: "LICENSE_NOT_FOUND" }, "saas"), false);
  assert.equal(shouldFallbackToLocalLicense({ error: "CENTRAL_LICENSE_UNAVAILABLE" }, "local-trial"), false);
});

test("central license calls include a replay nonce header", () => {
  const source = readFileSync("src/services/licenseService.ts", "utf8");
  assert.match(source, /"X-Request-Nonce": crypto\.randomBytes\(24\)\.toString\("hex"\)/);
});
