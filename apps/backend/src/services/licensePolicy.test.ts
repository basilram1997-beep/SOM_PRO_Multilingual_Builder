import test from "node:test";
import assert from "node:assert/strict";
import { evaluateLicensePolicy, canWriteWithLicense } from "./licensePolicy";

test("expired license becomes read only", () => {
  const state = evaluateLicensePolicy({
    status: "TRIAL",
    expiresAt: new Date("2026-01-01T00:00:00Z"),
    now: new Date("2026-02-01T00:00:00Z"),
    deviceFingerprint: "device-a",
    currentDeviceFingerprint: "device-a"
  });

  assert.equal(state.status, "EXPIRED");
  assert.equal(state.readOnly, true);
  assert.equal(canWriteWithLicense(state), false);
});

test("license on another device is suspended", () => {
  const state = evaluateLicensePolicy({
    status: "ACTIVE",
    expiresAt: new Date("2027-01-01T00:00:00Z"),
    now: new Date("2026-02-01T00:00:00Z"),
    deviceFingerprint: "device-a",
    currentDeviceFingerprint: "device-b"
  });

  assert.equal(state.status, "SUSPENDED");
  assert.equal(state.readOnly, true);
});

test("active valid license allows writing", () => {
  const state = evaluateLicensePolicy({
    status: "ACTIVE",
    expiresAt: new Date("2027-01-01T00:00:00Z"),
    now: new Date("2026-02-01T00:00:00Z"),
    deviceFingerprint: "device-a",
    currentDeviceFingerprint: "device-a"
  });

  assert.equal(state.readOnly, false);
  assert.equal(canWriteWithLicense(state), true);
});

test("cancelled license is read only", () => {
  const state = evaluateLicensePolicy({
    status: "CANCELLED",
    expiresAt: new Date("2027-01-01T00:00:00Z"),
    now: new Date("2026-02-01T00:00:00Z"),
    deviceFingerprint: "device-a",
    currentDeviceFingerprint: "device-a"
  });

  assert.equal(state.status, "CANCELLED");
  assert.equal(state.readOnly, true);
  assert.equal(canWriteWithLicense(state), false);
});

test("central outage uses grace period when there was a recent check", () => {
  const state = evaluateLicensePolicy({
    status: "ACTIVE",
    expiresAt: new Date("2027-01-01T00:00:00Z"),
    now: new Date("2026-02-03T00:00:00Z"),
    deviceFingerprint: "device-a",
    currentDeviceFingerprint: "device-a",
    centralUnavailable: true,
    lastSuccessfulCheckAt: new Date("2026-02-01T00:00:00Z"),
    gracePeriodDays: 3
  });

  assert.equal(state.status, "ACTIVE");
  assert.equal(state.readOnly, false);
  assert.ok(state.gracePeriodUntil);
});

test("central outage locks after grace period expires", () => {
  const state = evaluateLicensePolicy({
    status: "ACTIVE",
    expiresAt: new Date("2027-01-01T00:00:00Z"),
    now: new Date("2026-02-06T00:00:00Z"),
    deviceFingerprint: "device-a",
    currentDeviceFingerprint: "device-a",
    centralUnavailable: true,
    lastSuccessfulCheckAt: new Date("2026-02-01T00:00:00Z"),
    gracePeriodDays: 3
  });

  assert.equal(state.status, "SUSPENDED");
  assert.equal(state.readOnly, true);
});
