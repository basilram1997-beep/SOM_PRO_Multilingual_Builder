const { spawnSync } = require("child_process");
const { log, section, warn } = require("../cli-output");

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false });
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

section("DuckDNS staging local port diagnostics");

const excluded = run("netsh", ["interface", "ipv4", "show", "excludedportrange", "protocol=tcp"]);
if (excluded.stdout) {
  log("Windows TCP excluded port ranges:");
  console.log(excluded.stdout.trim());
}

if (/^\s*80\s+80\s*$/m.test(excluded.stdout)) {
  warn("Port 80 is excluded by Windows. Certbot/Nginx cannot bind it until the reservation is removed or bypassed.");
}

const services = run("powershell", [
  "-NoProfile",
  "-Command",
  "Get-Service W3SVC,hns,vmcompute -ErrorAction SilentlyContinue | Select-Object Name,Status,DisplayName | Format-Table -AutoSize"
]);
if (services.stdout) {
  log("Relevant Windows services:");
  console.log(services.stdout.trim());
}

const listeners = run("powershell", [
  "-NoProfile",
  "-Command",
  "Get-NetTCPConnection -LocalPort 80,443 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess | Format-Table -AutoSize"
]);
if (listeners.stdout.trim()) {
  log("Current listeners on 80/443:");
  console.log(listeners.stdout.trim());
} else {
  log("No visible listeners on 80/443, but Windows may still reserve port 80.");
}

log("If W3SVC is running, open PowerShell as Administrator and run: Stop-Service W3SVC -Force");
log("Then retry: docker compose --env-file .env.production -f docker-compose.production.yml --profile certbot run --rm --service-ports certbot");
