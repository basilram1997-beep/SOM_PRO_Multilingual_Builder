const { spawnSync } = require("child_process");
const { error, section, success } = require("./cli-output");

const commands = [
  ["npm.cmd run build:backend", "فحص الخادم"],
  ["npm.cmd run build:frontend", "فحص الواجهة"],
  ["npm.cmd test -w apps/backend", "اختبارات قواعد الخادم"]
];

for (const [command, label] of commands) {
  section(label);
  const result = spawnSync(command, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    error("فشل الفحص:", label);
    process.exit(result.status || 1);
  }
}

success("كل الفحوصات نجحت.");
