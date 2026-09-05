import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app";

test("license and audit middleware protect write routes", () => {
  const app = createApp() as unknown as {
    _router?: { stack: Array<RouteLayer> };
    router?: { stack: Array<RouteLayer> };
    get(name: string): unknown;
  };

  type RouteLayer = {
    handle?: { name?: string };
    regexp?: RegExp | string;
    matchers?: Array<(path: string) => false | unknown>;
  };

  const stack = (app._router || app.router)?.stack || [];
  const matchesRoute = (layer: RouteLayer, route: string) => {
    const candidates = [route, route.endsWith("/") ? route : `${route}/`];
    if (layer.regexp && candidates.some((candidate) => String(layer.regexp).includes(candidate.replace(/^\//, "").replace(/\//g, "\\/")))) {
      return true;
    }
    return Boolean(layer.matchers?.some((matcher) => candidates.some((candidate) => matcher(candidate))));
  };

  const licenseGuardIndex = stack.findIndex((layer) => layer.handle?.name === "licenseGuard");
  const auditTrailIndex = stack.findIndex((layer) => layer.handle?.name === "auditTrail");
  const teachersIndex = stack.findIndex((layer) => matchesRoute(layer, "/api/teachers"));
  const studentsIndex = stack.findIndex((layer) => matchesRoute(layer, "/api/students"));

  assert.equal(app.get("trust proxy"), false, "trust proxy should stay off unless explicitly enabled");
  assert.ok(licenseGuardIndex >= 0, "licenseGuard must be registered");
  assert.ok(auditTrailIndex > licenseGuardIndex, "auditTrail should run after licenseGuard");
  assert.ok(teachersIndex > licenseGuardIndex, "teacher writes must be behind licenseGuard");
  assert.ok(studentsIndex > licenseGuardIndex, "student writes must be behind licenseGuard");
});
