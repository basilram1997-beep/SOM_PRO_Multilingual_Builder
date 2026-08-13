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
  assert.match(doc, /npm run staging:tunnel:check/);
  assert.match(doc, /npm run staging:tunnel:write-config/);
  assert.match(doc, /npm run staging:tunnel:evidence/);
  assert.match(doc, /cloudflare-quick-tunnel-trial\.json/);
  assert.match(doc, /deploy\/cloudflare\/sompro-staging\.tunnel\.example\.yml/);
});

test("local Cloudflare proxy preserves same-origin /api routing without hard-coded public domains", () => {
  const proxy = read("../../scripts/runtime/local-cloudflare-proxy.js");

  assert.match(proxy, /SOM_TUNNEL_PROXY_PORT/);
  assert.match(proxy, /SOM_TUNNEL_FRONTEND_ORIGIN/);
  assert.match(proxy, /SOM_TUNNEL_BACKEND_ORIGIN/);
  assert.match(proxy, /url === "\/api" \|\| url\.startsWith\("\/api\/"\)/);
  assert.doesNotMatch(proxy, /sompro\.duckdns\.org|trycloudflare\.com|app\.sompro\.co\.il/);
});

test("Cloudflare tunnel operator scripts avoid committed secrets and reject unstable hostnames", () => {
  const packageJson = read("../../package.json");
  const gitignore = read("../../.gitignore");
  const example = read("../../deploy/cloudflare/sompro-staging.tunnel.example.yml");
  const operator = read("../../scripts/runtime/cloudflare-tunnel-operator.js");

  assert.match(packageJson, /"staging:tunnel:check": "node scripts\/runtime\/cloudflare-tunnel-operator\.js --check"/);
  assert.match(packageJson, /"staging:tunnel:write-config": "node scripts\/runtime\/cloudflare-tunnel-operator\.js --write-config"/);
  assert.match(packageJson, /"staging:tunnel:evidence": "node scripts\/runtime\/cloudflare-quick-tunnel-evidence\.js"/);
  assert.match(gitignore, /deploy\/cloudflare\/\*\.yml/);
  assert.match(gitignore, /!deploy\/cloudflare\/\*\.example\.yml/);
  assert.match(example, /staging\.example\.com/);
  assert.match(example, /http:\/\/127\.0\.0\.1:8080/);
  assert.match(operator, /SOM_CLOUDFLARE_TUNNEL_HOSTNAME/);
  assert.match(operator, /trycloudflare\\\.com/);
  assert.match(operator, /writeFileSync\(localConfigPath, config, \{ encoding: "utf8", flag: "wx" \}\)/);
  assert.doesNotMatch(example, /(token|secret|password)\s*[:=]\s*['"]?[A-Za-z0-9_-]{12,}/i);
});

test("Quick Tunnel evidence is classified as demo-only and strict staging rejects trycloudflare", () => {
  const evidenceScript = read("../../scripts/runtime/cloudflare-quick-tunnel-evidence.js");
  const stagingEvidence = read("../../scripts/runtime/staging-evidence-pack.js");
  const closure = read("../../docs/LIVE_STAGING_EVIDENCE_CLOSURE.md");
  const evidenceIndex = read("../../docs/MINISTRY_EVIDENCE_INDEX.md");
  const testPlan = read("../../docs/MINISTRY_TEST_PLAN.md");

  assert.match(evidenceScript, /SOM_QUICK_TUNNEL_URL/);
  assert.match(evidenceScript, /\.trycloudflare\\\.com/);
  assert.match(evidenceScript, /ministrySubmissionEvidence: false/);
  assert.match(evidenceScript, /\/api\/version/);
  assert.match(evidenceScript, /cloudflare-quick-tunnel-trial\.json/);
  assert.match(stagingEvidence, /strict && \/\\\.trycloudflare\\\.com\$/i);
  assert.match(closure, /LSE-TMP-001/);
  assert.match(evidenceIndex, /Cloudflare Quick Tunnel trial evidence/);
  assert.match(testPlan, /Cloudflare Quick Tunnel trial evidence/);
});

test("Ministry and environment docs link the Cloudflare tunnel staging option", () => {
  const architecture = read("../../docs/ENVIRONMENT_ARCHITECTURE.md");
  const evidence = read("../../docs/MINISTRY_EVIDENCE_INDEX.md");
  const testPlan = read("../../docs/MINISTRY_TEST_PLAN.md");

  for (const doc of [architecture, evidence, testPlan]) {
    assert.match(doc, /CLOUDFLARE_TUNNEL_STAGING\.md/);
  }
});
