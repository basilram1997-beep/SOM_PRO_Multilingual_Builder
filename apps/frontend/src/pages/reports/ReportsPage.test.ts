import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("reports page keeps classroom logs on the correct date state and exports security through audited flow", () => {
  const source = readFileSync("src/pages/reports/ReportsPage.tsx", "utf8");

  assert.match(source, /data-e2e="classroom-logs-from-filter"/, "classroom logs should expose a clear from filter");
  assert.match(source, /data-e2e="classroom-logs-to-filter"/, "classroom logs should expose a clear to filter");
  assert.match(source, /value=\{logsFrom\}/, "classroom logs from field should use logsFrom");
  assert.match(source, /value=\{logsTo\}/, "classroom logs to field should use logsTo");
  assert.match(source, /data-e2e="classroom-logs-show"/, "classroom logs should expose a stable show action");
  assert.match(source, /reportType: "security"/, "security export should flow through the audited export wrapper");
  assert.match(
    source,
    /sectionId: "security-report-print"/,
    "security export should target the printable security section"
  );
  assert.match(source, /fileName: "security-report\.pdf"/, "security export should use a clear file name");
});
