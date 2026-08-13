import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const requireScript = createRequire(__filename);
const { buildApiRouteInventory, renderApiRouteInventoryMarkdown } = requireScript(
  "../../../../scripts/runtime/api-route-inventory.js"
);

const publicRoutes = new Set([
  "GET /health",
  "GET /api/version",
  "POST /api/auth/login",
  "POST /api/auth/register",
  "POST /api/auth/bootstrap-license",
  "POST /api/auth/recover",
  "POST /api/auth/password-reset/request",
  "GET /api/auth/sso/oidc/config",
  "POST /api/auth/sso/oidc/callback",
  "GET /api/license/status",
  "POST /api/license/status"
]);

const intentionallyUnauditedProtectedRoutes = new Set(["GET /api/stats"]);
const intentionallyUnauditedSelfServiceReads = new Set(["GET /api/auth/me", "GET /api/auth/mfa/readiness"]);

function routeKey(route: { method: string; path: string }) {
  return `${route.method} ${route.path}`;
}

test("API route inventory classifies every backend route with security controls", () => {
  const inventory = buildApiRouteInventory();
  const routes = inventory.routes as Array<{
    method: string;
    path: string;
    public: boolean;
    authRequired: boolean;
    licenseGuard: boolean;
    rbac: boolean;
    tenantIsolation: boolean;
    rateLimited: boolean;
    audited: boolean;
    acceptsSensitiveIds: boolean;
    acceptsUpload: boolean;
  }>;
  const keys = routes.map(routeKey);

  assert.ok(routes.length > 80, `expected broad route inventory, got ${routes.length}`);
  assert.equal(new Set(keys).size, keys.length, "route inventory must not contain duplicate method/path entries");

  for (const expectedPublicRoute of publicRoutes) {
    assert.ok(keys.includes(expectedPublicRoute), `missing expected public route: ${expectedPublicRoute}`);
  }

  for (const route of routes) {
    const key = routeKey(route);
    if (publicRoutes.has(key)) {
      assert.equal(route.public, true, `${key} should be explicitly classified as public`);
      continue;
    }

    assert.equal(route.public, false, `${key} must not be implicitly public`);
    assert.equal(route.authRequired, true, `${key} must require authentication`);
    assert.equal(route.rbac, true, `${key} must have inherited or route-level RBAC`);

    if (!route.path.startsWith("/api/auth/") && route.path !== "/api/license/activate") {
      assert.equal(route.licenseGuard, true, `${key} must be behind licenseGuard`);
    }

    if (route.acceptsSensitiveIds || route.method !== "GET") {
      assert.equal(route.tenantIsolation, true, `${key} must have tenant-isolation evidence`);
    }

    if (route.method !== "GET" || route.acceptsUpload || route.path.includes("export")) {
      assert.equal(route.rateLimited, true, `${key} must have rate-limit evidence`);
    }

    if (!intentionallyUnauditedProtectedRoutes.has(key) && !intentionallyUnauditedSelfServiceReads.has(key)) {
      assert.equal(route.audited, true, `${key} must have audit evidence`);
    }
  }
});

test("API route inventory renderer produces a Ministry-reviewable evidence table", () => {
  const inventory = buildApiRouteInventory();
  const markdown = renderApiRouteInventoryMarkdown(inventory);
  assert.match(markdown, /# API Route Inventory/);
  assert.match(markdown, /\| Method \| Path \| Auth \| RBAC \| Permission \| Tenant \| Rate limit \| Audit/);
  assert.match(markdown, /`\/api\/students/);
  assert.match(markdown, /`\/api\/audit-logs/);
  assert.match(markdown, /`\/api\/uploads`/);
  assert.match(markdown, /generated from source and verified/);
});
