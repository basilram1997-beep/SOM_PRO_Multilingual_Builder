import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("certificate printing keeps the layout RTL, A4, and scoped to the selected student", () => {
  const source = readFileSync(new URL("./StudentCertificatesPage.tsx", import.meta.url), "utf8");

  assert.match(source, /@page \{ size: A4 portrait; margin: 10mm; \}/, "certificate print should target A4 portrait");
  assert.match(
    source,
    /dir="\$\{language === "en" \? "ltr" : "rtl"\}"/,
    "certificate print should switch direction by language"
  );
  assert.match(source, /class="certificate-print-sheet"/, "certificate print sheet should exist");
  assert.match(source, /class="certificate-print-header"/, "certificate print header should exist");
  assert.match(source, /class="certificate-print-table"/, "certificate subject table should exist");
  assert.match(source, /class="certificate-print-attendance"/, "certificate attendance table should exist");
  assert.match(source, /class="certificate-print-signatures"/, "certificate signature block should exist");
  assert.match(source, /className="[^"]*no-print[^"]*"/, "certificate UI controls should be hidden from printing");
  assert.match(source, /selectedStudentName/, "certificate print should use the selected student name");
  assert.match(source, /selectedClassName/, "certificate print should use the selected class name");
  assert.match(source, /selectedClassSection/, "certificate print should use the selected class section");
  assert.match(
    source,
    /subjects\.find\(\(?item\)? => item\.id === row\.subjectId\)/,
    "certificate print should resolve subjects from the saved grade rows only"
  );
  assert.match(
    source,
    /escapeHtml\(row\.subjectName \|\| subjects\.find/,
    "certificate print should escape subject text"
  );
  assert.match(
    source,
    /t\("certificates\.subjectPlaceholder"\)/,
    "certificate print should fall back to the subject placeholder when needed"
  );
  assert.match(
    source,
    /teacherSignature \|\| t\("common\.notSet"\)/,
    "certificate signatures should render a clear fallback"
  );
  assert.match(
    source,
    /principalSignature \|\| schoolInfo\?\.managerName \|\| t\("common\.notSet"\)/,
    "principal signature should fall back to the school manager when needed"
  );
});

test("report exports keep print-only controls hidden and preserve RTL-aware export markup", () => {
  const dailyHelpers = readFileSync(new URL("../../features/daily/dailyHelpers.ts", import.meta.url), "utf8");
  const reportsPage = readFileSync(new URL("../reports/ReportsPage.tsx", import.meta.url), "utf8");

  assert.match(dailyHelpers, /@page\{size:A4 portrait;margin:10mm\}/, "attendance export should use portrait A4");
  assert.match(dailyHelpers, /document\.documentElement\.dir/, "export should preserve document direction");
  assert.match(dailyHelpers, /document\.documentElement\.lang/, "export should preserve document language");
  assert.match(
    dailyHelpers,
    /attendance-report-print \.attendance-button\{display:none !important\}/,
    "attendance print should hide action buttons"
  );
  assert.match(
    dailyHelpers,
    /attendance-report-print \.student-attendance-table button\{display:none !important\}/,
    "attendance print should hide row actions"
  );
  assert.match(
    dailyHelpers,
    /attendance-report-print \.student-attendance-table th\{background:#eef4ff!important\}/,
    "attendance print should keep table headers visible"
  );
  assert.match(
    dailyHelpers,
    /teacher-program-card\{page-break-inside:avoid/,
    "daily exports should avoid splitting schedule cards"
  );
  assert.match(
    dailyHelpers,
    /old-teacher\{text-decoration:line-through\}/,
    "daily export should show the previous teacher state clearly"
  );
  assert.match(dailyHelpers, /new-teacher\{font-weight:700\}/, "daily export should emphasize updated teachers");

  assert.match(
    reportsPage,
    /exportWithAudit\(\{\s*reportType: "attendance"/,
    "attendance report should be exported through the audited wrapper"
  );
  assert.match(
    reportsPage,
    /exportWithAudit\(\{\s*reportType: "grades"/,
    "grades report should be exported through the audited wrapper"
  );
  assert.match(
    reportsPage,
    /exportWithAudit\(\{\s*reportType: "classroom-logs"/,
    "classroom logs should be exported through the audited wrapper"
  );
  assert.match(
    reportsPage,
    /exportWithAudit\(\{\s*reportType: "security"[\s\S]{0,160}?sectionId: "security-report-print"/,
    "security report should be exported through the audited wrapper"
  );
  assert.match(reportsPage, /exportSectionPdf\("daily-report-print"/, "daily report should be exportable directly");
  assert.match(reportsPage, /className="report-tabs no-print"/, "report tabs should stay out of print output");
  assert.match(reportsPage, /className="form-row no-print"/, "report filters should stay out of print output");
});
