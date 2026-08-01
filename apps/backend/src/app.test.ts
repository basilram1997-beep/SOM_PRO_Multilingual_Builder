import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app";

test("license and audit middleware protect write routes", () => {
  const app = createApp() as unknown as {
    _router: { stack: Array<{ handle?: { name?: string }; regexp?: RegExp | string }> };
  };
  const stack = app._router.stack;
  const licenseGuardIndex = stack.findIndex((layer) => layer.handle?.name === "licenseGuard");
  const auditTrailIndex = stack.findIndex((layer) => layer.handle?.name === "auditTrail");
  const teachersIndex = stack.findIndex((layer) => String(layer.regexp).includes("api\\/teachers"));
  const studentsIndex = stack.findIndex((layer) => String(layer.regexp).includes("api\\/students"));

  assert.ok(licenseGuardIndex >= 0, "licenseGuard must be registered");
  assert.ok(auditTrailIndex > licenseGuardIndex, "auditTrail should run after licenseGuard");
  assert.ok(teachersIndex > licenseGuardIndex, "teacher writes must be behind licenseGuard");
  assert.ok(studentsIndex > licenseGuardIndex, "student writes must be behind licenseGuard");
});
