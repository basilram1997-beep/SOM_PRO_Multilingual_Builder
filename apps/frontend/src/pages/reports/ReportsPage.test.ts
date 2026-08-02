import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("reports page keeps classroom logs on the correct date state and hides developer security monitoring", () => {
  const source = readFileSync("src/pages/reports/ReportsPage.tsx", "utf8");
  const securityPageSource = readFileSync("src/pages/reports/SecurityMonitoringPage.tsx", "utf8");

  assert.match(source, /data-e2e="classroom-logs-from-filter"/, "classroom logs should expose a clear from filter");
  assert.match(source, /data-e2e="classroom-logs-to-filter"/, "classroom logs should expose a clear to filter");
  assert.match(source, /value=\{logsFrom\}/, "classroom logs from field should use logsFrom");
  assert.match(source, /value=\{logsTo\}/, "classroom logs to field should use logsTo");
  assert.match(source, /data-e2e="classroom-logs-show"/, "classroom logs should expose a stable show action");
  assert.doesNotMatch(source, /reports\.tabSecurity/, "security monitoring should not appear in the reports tabs");
  assert.doesNotMatch(source, /SecurityMonitoringPanel/, "developer security monitoring should not render in reports");
  assert.match(
    securityPageSource,
    /SecurityMonitoringPanel/,
    "developer security monitoring should remain available on its dedicated page"
  );
});
