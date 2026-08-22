const fs = require("node:fs");
const path = require("node:path");

const METHODS = ["get", "post", "put", "patch", "delete"];
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function findRepoRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, "package.json")) && fs.existsSync(path.join(current, "apps", "backend"))) {
      return current;
    }
    current = path.dirname(current);
  }
  throw new Error("Unable to locate repository root");
}

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function normalizeSlashes(value) {
  return value.replace(/\\/g, "/");
}

function routePathJoin(mountPath, routePath) {
  const cleanMount = mountPath === "/" ? "" : mountPath.replace(/\/$/, "");
  const cleanRoute = routePath === "/" ? "" : routePath;
  const joined = `${cleanMount}${cleanRoute.startsWith("/") ? cleanRoute : `/${cleanRoute}`}` || "/";
  return joined.length > 1 ? joined.replace(/\/$/, "") : joined;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseImports(appSource) {
  const imports = new Map();
  const regex = /import\s+\{\s*([^}]+Router)\s*\}\s+from\s+"([^"]+)"/g;
  let match;
  while ((match = regex.exec(appSource))) {
    imports.set(match[1].trim(), match[2]);
  }
  return imports;
}

function collectAppUseBlocks(appSource) {
  const blocks = [];
  const regex = /app\.use\(\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(appSource))) {
    const start = match.index;
    const end = appSource.indexOf(");", start);
    if (end === -1) continue;
    blocks.push({ mountPath: match[1], text: appSource.slice(start, end + 2) });
  }
  return blocks;
}

function parseMounts(root) {
  const appPath = path.join(root, "apps", "backend", "src", "app.ts");
  const appSource = readText(appPath);
  const imports = parseImports(appSource);
  const authGateIndex = appSource.indexOf("app.use(authenticateRequest)");
  const mounts = [];

  for (const block of collectAppUseBlocks(appSource)) {
    const routerMatch = block.text.match(/([A-Za-z0-9_]+Router)\s*\)?\s*\);$/);
    if (!routerMatch) continue;
    const routerName = routerMatch[1];
    const importPath = imports.get(routerName);
    if (!importPath) continue;
    const sourceFile = path.normalize(path.join(root, "apps", "backend", "src", `${importPath}.ts`));
    const permission =
      block.text.match(/requirePermissionForWrite\("([^"]+)"\)/)?.[1] ||
      block.text.match(/requirePermission\("([^"]+)"\)/)?.[1] ||
      null;
    const mountedAfterAuthGate =
      authGateIndex >= 0 && block.text ? appSource.indexOf(block.text) > authGateIndex : false;
    mounts.push({
      mountPath: block.mountPath,
      routerName,
      sourceFile,
      mountedAfterAuthGate,
      inheritedPermission: permission,
      inheritedPermissionMode: block.text.includes("requirePermissionForWrite")
        ? "write-or-read"
        : permission
          ? "required"
          : null
    });
  }
  return mounts;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function routeMatches(source, routerName) {
  const methodPattern = METHODS.join("|");
  const regex = new RegExp(`${escapeRegExp(routerName)}\\.(${methodPattern})\\(\\s*["'\`]([^"'\`]+)["'\`]`, "g");
  const matches = [];
  let match;
  while ((match = regex.exec(source))) {
    matches.push({
      index: match.index,
      method: match[1].toUpperCase(),
      localPath: match[2]
    });
  }
  return matches;
}

function classifyRateLimit(fullPath, method, block, mount) {
  if (/createRateLimitMiddleware|RateLimit/.test(block)) return true;
  if (mount.mountPath === "/api/auth" || mount.mountPath === "/api/license") {
    return /RateLimit|rateLimit/.test(block);
  }
  if (method === "GET" && fullPath.startsWith("/api/audit-logs/export")) return true;
  if (method === "POST" && fullPath === "/api/schools/backups") return true;
  if (WRITE_METHODS.has(method)) return true;
  return false;
}

function classifyTenantIsolation(fullPath, method, block, mount, authRequired) {
  if (!authRequired) return false;
  if (mount.mountedAfterAuthGate) return true;
  if (fullPath === "/api/license/activate") return true;
  if (/getRequestSchoolId|req\.user!?\.(schoolId)|req\.user\?\.(schoolId)|schoolId/.test(block)) return true;
  return WRITE_METHODS.has(method) || fullPath.includes(":");
}

function classifySensitiveIds(fullPath, block) {
  return (
    fullPath.includes(":") ||
    /\b(req\.body|req\.query|req\.params)\b[\s\S]{0,240}\b(schoolId|userId|studentId|teacherId|classId|subjectId|assignmentId|auditLogId|backupJobId|id)\b/.test(
      block
    )
  );
}

function classifyRoute(match, nextIndex, source, mount) {
  const block = source.slice(match.index, nextIndex);
  const fullPath = routePathJoin(mount.mountPath, match.localPath);
  const publicByMount = mount.mountPath === "/api/auth" || mount.mountPath === "/api/license";
  const routeRequiresAuth = /authenticateRequest/.test(block);
  const authRequired = mount.mountedAfterAuthGate || routeRequiresAuth;
  const routePermission =
    block.match(/requirePermissionForWrite\("([^"]+)"\)/)?.[1] ||
    block.match(/requirePermission\("([^"]+)"\)/)?.[1] ||
    null;
  const selfServicePermission =
    authRequired && mount.mountPath === "/api/auth" && !routePermission ? "authenticated-self" : null;
  const permission = routePermission || mount.inheritedPermission || selfServicePermission;
  const upload = mount.mountPath === "/api/uploads" || /express\.raw|multer|Content-Type|content-type/i.test(block);
  const validatesBody = /validateBody\(|\.parse\(|safeParse\(|z\.object/.test(block);

  return {
    method: match.method,
    path: fullPath,
    router: mount.routerName,
    source: normalizeSlashes(path.relative(findRepoRoot(), mount.sourceFile)),
    public: !authRequired && publicByMount,
    authRequired,
    licenseGuard: mount.mountedAfterAuthGate,
    rbac: Boolean(permission),
    permission,
    permissionMode: routePermission ? "route" : mount.inheritedPermissionMode,
    tenantIsolation: classifyTenantIsolation(fullPath, match.method, block, mount, authRequired),
    rateLimited: classifyRateLimit(fullPath, match.method, block, mount),
    audited: mount.mountedAfterAuthGate || /recordAuditLog|auditLog\.create/.test(block),
    validatesBody,
    acceptsUpload: upload,
    acceptsParams: fullPath.includes(":"),
    acceptsSensitiveIds: classifySensitiveIds(fullPath, block)
  };
}

function buildApiRouteInventory(options = {}) {
  const root = options.root || findRepoRoot(options.cwd || process.cwd());
  const mounts = parseMounts(root);
  const routes = [
    {
      method: "GET",
      path: "/health",
      router: "app",
      source: "apps/backend/src/app.ts",
      public: true,
      authRequired: false,
      licenseGuard: false,
      rbac: false,
      permission: null,
      permissionMode: null,
      tenantIsolation: false,
      rateLimited: false,
      audited: false,
      validatesBody: false,
      acceptsUpload: false,
      acceptsParams: false,
      acceptsSensitiveIds: false
    },
    {
      method: "GET",
      path: "/api/version",
      router: "app",
      source: "apps/backend/src/app.ts",
      public: true,
      authRequired: false,
      licenseGuard: false,
      rbac: false,
      permission: null,
      permissionMode: null,
      tenantIsolation: false,
      rateLimited: false,
      audited: false,
      validatesBody: false,
      acceptsUpload: false,
      acceptsParams: false,
      acceptsSensitiveIds: false
    }
  ];

  for (const mount of mounts) {
    const source = stripComments(readText(mount.sourceFile));
    const matches = routeMatches(source, mount.routerName);
    for (let index = 0; index < matches.length; index += 1) {
      routes.push(classifyRoute(matches[index], matches[index + 1]?.index || source.length, source, mount));
    }
  }

  routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return { generatedAt: new Date().toISOString(), routes, mounts };
}

function flag(value) {
  return value ? "yes" : "no";
}

function renderApiRouteInventoryMarkdown(inventory) {
  const lines = [
    "# API Route Inventory",
    "",
    `Generated: ${inventory.generatedAt}`,
    "",
    "Purpose: evidence map for backend API exposure, authentication, RBAC, tenant isolation, rate limiting, auditing, validation, uploads, and sensitive identifiers.",
    "",
    "| Method | Path | Auth | RBAC | Permission | Tenant | Rate limit | Audit | Body validation | Upload | Sensitive IDs | Source |",
    "| ------ | ---- | ---- | ---- | ---------- | ------ | ---------- | ----- | --------------- | ------ | ------------- | ------ |"
  ];
  for (const route of inventory.routes) {
    lines.push(
      `| ${route.method} | \`${route.path}\` | ${route.public ? "public" : flag(route.authRequired)} | ${flag(
        route.rbac
      )} | ${route.permission || ""} | ${flag(route.tenantIsolation)} | ${flag(route.rateLimited)} | ${flag(
        route.audited
      )} | ${flag(route.validatesBody)} | ${flag(route.acceptsUpload)} | ${flag(route.acceptsSensitiveIds)} | \`${route.source}\` |`
    );
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push(
    "- Public routes are limited to health/version and explicitly public auth/license bootstrap/status routes."
  );
  lines.push(
    "- Routes mounted after `authenticateRequest`, `licenseGuard`, `auditTrail`, context override rejection, and `sensitiveWriteRateLimit` inherit those controls from `apps/backend/src/app.ts`."
  );
  lines.push(
    "- This inventory is generated from source and verified by `apps/backend/src/services/apiRouteInventory.security.test.ts`."
  );
  lines.push(
    "- The inventory is a code evidence baseline; dynamic penetration testing and official Ministry standards mapping remain separate evidence items."
  );
  lines.push("");
  return lines.join("\n");
}

function writeApiRouteInventory(options = {}) {
  const root = options.root || findRepoRoot(options.cwd || process.cwd());
  const inventory = buildApiRouteInventory({ root });
  const docsPath = path.join(root, "docs", "API_ROUTE_INVENTORY.md");
  const reportDir = path.join(root, "reports", "security");
  fs.mkdirSync(path.dirname(docsPath), { recursive: true });
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(docsPath, renderApiRouteInventoryMarkdown(inventory), "utf8");
  fs.writeFileSync(path.join(reportDir, "api-route-inventory.json"), JSON.stringify(inventory, null, 2) + "\n", "utf8");
  return inventory;
}

if (require.main === module) {
  const inventory = writeApiRouteInventory();
  console.log(`API route inventory written for ${inventory.routes.length} routes.`);
}

module.exports = {
  buildApiRouteInventory,
  renderApiRouteInventoryMarkdown,
  writeApiRouteInventory
};
