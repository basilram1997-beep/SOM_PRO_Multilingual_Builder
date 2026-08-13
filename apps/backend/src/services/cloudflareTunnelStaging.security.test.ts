import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

test("Cloudflare tunnel staging document separates quick demo from named evidence tunnel", () => {
  const doc = read("../../docs/CLOUDFLARE_TUNNEL_STAGING.md");

  assert.match(doc, /Quick Tunnel/);
  assert.match(doc, /Named Tunnel/);
  assert.match(doc, /trycloudflare\.com/);
  assert.match(doc, /not be used for formal DAST/i);
  assert.match(doc, /STAGING_URL=https:\/\/staging\.example\.com ZAP_USE_DOCKER=true npm run security:dast/);
  assert.match(doc, /STAGING_EVIDENCE_STRICT=true npm run security:staging-evidence/);
  assert.match(doc, /MINISTRY_REVIEW_PACK_STRICT=true npm run ministry:review-pack/);
  assert.match(doc, /Never commit them/i);
  assert.match(doc, /VITE_API_URL.*\/api/);
  assert.match(doc, /CORS_ORIGIN/);
  assert.match(doc, /Cloudflare Access/);
});

test("local Cloudflare proxy preserves same-origin /api routing without hard-coded public domains", () => {
  const proxy = read("../../scripts/runtime/local-cloudflare-proxy.js");

  assert.match(proxy, /SOM_TUNNEL_PROXY_PORT/);
  assert.match(proxy, /SOM_TUNNEL_FRONTEND_ORIGIN/);
  assert.match(proxy, /SOM_TUNNEL_BACKEND_ORIGIN/);
  assert.match(proxy, /url === "\/api" \|\| url\.startsWith\("\/api\/"\)/);
  assert.doesNotMatch(proxy, /sompro\.duckdns\.org|trycloudflare\.com|app\.sompro\.co\.il/);
});

test("Ministry and environment docs link the Cloudflare tunnel staging option", () => {
  const architecture = read("../../docs/ENVIRONMENT_ARCHITECTURE.md");
  const evidence = read("../../docs/MINISTRY_EVIDENCE_INDEX.md");
  const testPlan = read("../../docs/MINISTRY_TEST_PLAN.md");

  for (const doc of [architecture, evidence, testPlan]) {
    assert.match(doc, /CLOUDFLARE_TUNNEL_STAGING\.md/);
  }
});
