const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const { generateE2ELicenseCode } = require("./e2e-license");

const baseUrl = process.env.SOM_E2E_BASE_URL || "http://127.0.0.1:4188";
const apiUrl = process.env.SOM_E2E_API_BASE_URL || "http://127.0.0.1:4000";
const artifactDir = path.resolve("tests/e2e/artifacts");
const screenshotPath = path.join(artifactDir, "certificate-preview.png");
const sourceHtmlPath = path.join(artifactDir, "certificate-preview.html");

const e2eLicenseCode =
  process.env.SOM_E2E_LICENSE_CODE ||
  generateE2ELicenseCode({
    days: 365,
    schoolName: process.env.SOM_E2E_SCHOOL_NAME || "SOM E2E School",
    institutionCode: process.env.SOM_E2E_INSTITUTION_CODE || "E2E-4100",
    secret: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
  });

const e2eEnv = {
  ...process.env,
  SOM_PRO_LICENSE_SERVER_URL: "",
  SOM_LICENSE_SERVER_URL: "",
  SOM_PRO_REQUIRE_CENTRAL_LICENSE: "false",
  SOM_PRO_LICENSE_SECRET: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling",
  SOM_PRO_AUTH_SECRET: process.env.SOM_PRO_AUTH_SECRET || "change-this-auth-secret-before-selling",
  CORS_ORIGIN: "http://localhost:4188,http://127.0.0.1:4188",
  SOM_E2E_LICENSE_CODE: e2eLicenseCode,
  SOM_E2E_ADMIN_EMAIL: process.env.SOM_E2E_ADMIN_EMAIL || "admin@som-e2e.local",
  SOM_E2E_ADMIN_PASSWORD: process.env.SOM_E2E_ADMIN_PASSWORD || "SOM-E2E-Admin-123!",
  SOM_E2E_ADMIN_NAME: process.env.SOM_E2E_ADMIN_NAME || "SOM E2E Admin",
  SOM_E2E_SCHOOL_ID: process.env.SOM_E2E_SCHOOL_ID || "som-e2e-school",
  SOM_E2E_SCHOOL_NAME: process.env.SOM_E2E_SCHOOL_NAME || "SOM E2E School",
  SOM_E2E_INSTITUTION_CODE: process.env.SOM_E2E_INSTITUTION_CODE || "E2E-4100",
  SOM_E2E_CLASS_NAME: process.env.SOM_E2E_CLASS_NAME || "SOM E2E Class A",
  SOM_E2E_SUBJECT_NAME: process.env.SOM_E2E_SUBJECT_NAME || "SOM E2E Subject",
  SOM_E2E_TEACHER_NAME: process.env.SOM_E2E_TEACHER_NAME || "SOM E2E Teacher",
  SOM_E2E_STUDENT_NAME: process.env.SOM_E2E_STUDENT_NAME || "SOM E2E Student"
};

const browserExecutablePath =
  process.env.PLAYWRIGHT_E2E_BROWSER_EXECUTABLE_PATH ||
  [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].find((candidatePath) => require("node:fs").existsSync(candidatePath));

let serverProcess = null;

function trace(message, details) {
  if (details === undefined) {
    console.log(`[${new Date().toISOString()}] ${message}`);
    return;
  }
  console.log(`[${new Date().toISOString()}] ${message}`, details);
}

function withTimeout(promise, timeoutMs, label) {
  let timer;

  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      timer.unref?.();
    })
  ]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

function waitForExit(child, timeoutMs = 5000) {
  if (!child) {
    return Promise.resolve();
  }

  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return Promise.race([
    new Promise((resolve) => {
      child.once("exit", resolve);
      child.once("error", resolve);
    }),
    new Promise((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      timer.unref?.();
    })
  ]);
}

async function terminateProcessTree(child) {
  if (!child?.pid) {
    return;
  }

  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true
      });

      killer.once("exit", resolve);
      killer.once("error", resolve);
    });
    await waitForExit(child, 5000);
    return;
  }

  child.kill("SIGTERM");
  await waitForExit(child, 5000);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
}

function startServer() {
  serverProcess = spawn(process.execPath, ["scripts/e2e-server.js"], {
    stdio: "inherit",
    windowsHide: true,
    env: e2eEnv,
    shell: false
  });
  return serverProcess;
}

async function stopServer() {
  if (!serverProcess) {
    return;
  }

  if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
    return;
  }

  await terminateProcessTree(serverProcess);
  await waitForExit(serverProcess, 5000);

  if (serverProcess.exitCode === null && serverProcess.signalCode === null) {
    serverProcess.removeAllListeners();
    serverProcess.unref?.();
  }
}

async function waitForUrl(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      timer.unref?.();

      const response = await fetch(url, { method: "GET", signal: controller.signal });
      clearTimeout(timer);
      if (response.ok || response.status === 304) {
        return;
      }
    } catch {
      // Keep waiting until the local service is ready.
    }

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1500);
      timer.unref?.();
    });
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function bootstrapLicense() {
  const response = await fetch(`${apiUrl}/api/auth/bootstrap-license`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ licenseCode: e2eLicenseCode, licenseKey: e2eLicenseCode })
  });

  if (!response.ok && response.status !== 429) {
    throw new Error(`Bootstrap failed with status ${response.status}`);
  }
}

async function apiLogin(email, password) {
  await bootstrapLicense();
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, licenseCode: e2eLicenseCode, licenseKey: e2eLicenseCode })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Login failed with status ${response.status}`);
  }
  return payload.data;
}

async function ensurePreviewStudent(headers, classId) {
  const response = await fetch(`${apiUrl}/api/students?classId=${encodeURIComponent(classId)}`, {
    headers
  });
  const payload = await response.json();
  const students = Array.isArray(payload?.data) ? payload.data : [];
  if (students.length > 0) {
    return students[0];
  }

  const suffix = Date.now().toString(36);
  const createResponse = await fetch(`${apiUrl}/api/students`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: `طالب اللقطة ${suffix}`,
      nationalId: `39${String(Date.now()).slice(-7)}`,
      classId
    })
  });
  const createPayload = await createResponse.json();
  if (!createResponse.ok) {
    throw new Error(
      createPayload?.message || `Could not create a certificate preview student (${createResponse.status})`
    );
  }
  return createPayload.data;
}

function pickFirstClass(classesPayload) {
  const classes = Array.isArray(classesPayload?.data) ? classesPayload.data : [];
  if (classes.length === 0) {
    throw new Error("No classes were available for the certificate preview visual capture.");
  }
  return classes[0];
}

async function main() {
  const adminEmail = e2eEnv.SOM_E2E_ADMIN_EMAIL;
  const adminPassword = e2eEnv.SOM_E2E_ADMIN_PASSWORD;

  let browser;
  let context;
  let page;

  try {
    trace("capture started");

    startServer();
    await withTimeout(
      Promise.all([waitForUrl(`${baseUrl}/`, 30_000), waitForUrl(`${apiUrl}/health`, 30_000)]),
      45_000,
      "local server startup"
    );

    const auth = await withTimeout(apiLogin(adminEmail, adminPassword), 20_000, "admin login");

    const headers = {
      Authorization: `Bearer ${auth.token}`
    };

    const classesResponse = await fetch(`${apiUrl}/api/classes`, {
      headers,
      signal: AbortSignal.timeout(15_000)
    });

    if (!classesResponse.ok) {
      const body = await classesResponse.text().catch(() => "");

      throw new Error(`Classes request failed with status ${classesResponse.status}; body=${body.slice(0, 300)}`);
    }

    const classesPayload = await classesResponse.json();
    const previewClass = pickFirstClass(classesPayload);

    if (!previewClass?.id) {
      throw new Error("No valid class was available for the certificate preview.");
    }

    await withTimeout(ensurePreviewStudent(headers, previewClass.id), 20_000, "preview student preparation");

    browser = await withTimeout(
      chromium.launch({
        headless: true,
        executablePath: browserExecutablePath || undefined
      }),
      30_000,
      "browser launch"
    );

    context = await withTimeout(
      browser.newContext({
        baseURL: baseUrl,
        locale: "ar",
        viewport: {
          width: 1440,
          height: 900
        },
        acceptDownloads: true
      }),
      15_000,
      "browser context creation"
    );

    page = await withTimeout(context.newPage(), 10_000, "page creation");

    await page.goto("/", {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });

    await page.evaluate(
      ({ token, user }) => {
        window.__somSetAuthToken?.(token);
        window.__somSetCurrentUser?.(user);
      },
      {
        token: auth.token,
        user: auth.user
      }
    );

    await page.locator('[data-e2e="app-shell"]').waitFor({
      state: "visible",
      timeout: 10_000
    });

    await page.locator('[data-e2e="nav-group-toggle-students-management"]').click({
      timeout: 10_000
    });

    await page.locator('[data-e2e="nav-student-certificates"]').click({
      timeout: 10_000
    });

    await page.locator('[data-e2e="student-certificates-page"]').waitFor({
      state: "visible",
      timeout: 15_000
    });

    const classSelect = page.locator('[data-e2e="certificate-class-select"]');

    await classSelect.waitFor({
      state: "visible",
      timeout: 10_000
    });

    await classSelect.selectOption(previewClass.id, {
      timeout: 10_000
    });

    const firstStudentRow = page.locator('[data-e2e^="certificate-student-row-"]').first();

    await firstStudentRow.waitFor({
      state: "visible",
      timeout: 15_000
    });

    await firstStudentRow.click({
      timeout: 10_000
    });

    const [saveResponse] = await Promise.all([
      page.waitForResponse(
        (response) => {
          const url = new URL(response.url());

          return response.request().method() === "POST" && url.pathname === "/api/students/certificates";
        },
        {
          timeout: 20_000
        }
      ),

      page.locator('[data-e2e="certificate-save"]').click({
        force: true,
        timeout: 10_000
      })
    ]);

    const saveBodyText = await saveResponse.text().catch(() => "");

    if (!saveResponse.ok()) {
      throw new Error(
        `Certificate save failed with status ${saveResponse.status()}; body=${saveBodyText.slice(0, 300)}`
      );
    }

    const [download] = await Promise.all([
      page.waitForEvent("download", {
        timeout: 15_000
      }),
      page.locator('[data-e2e="certificate-export"]').click({
        force: true,
        timeout: 10_000
      })
    ]);

    await fs.mkdir(path.dirname(sourceHtmlPath), {
      recursive: true
    });

    await withTimeout(download.saveAs(sourceHtmlPath), 15_000, "certificate download save");

    await page.goto(pathToFileURL(sourceHtmlPath).href, {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });

    const previewSheet = page.locator(".certificate-print-sheet");

    await previewSheet.waitFor({
      state: "visible",
      timeout: 15_000
    });

    await previewSheet.screenshot({
      path: screenshotPath,
      animations: "disabled",
      timeout: 30_000
    });
    console.log(`Certificate preview screenshot saved to ${screenshotPath}`);
  } finally {
    if (page) {
      await withTimeout(
        page.close({
          runBeforeUnload: false
        }),
        5_000,
        "page close"
      ).catch((error) => {
        trace("page close failed", {
          message: error instanceof Error ? error.message : String(error)
        });
      });
    }

    if (context) {
      await withTimeout(context.close(), 5_000, "context close").catch((error) => {
        trace("context close failed", {
          message: error instanceof Error ? error.message : String(error)
        });
      });
    }

    if (browser) {
      await withTimeout(browser.close(), 5_000, "browser close").catch((error) => {
        trace("browser close failed", {
          message: error instanceof Error ? error.message : String(error)
        });
      });
    }

    await stopServer().catch((error) => {
      trace("server cleanup failed", {
        message: error instanceof Error ? error.message : String(error)
      });
    });
  }
}

main().catch((failure) => {
  console.error(failure instanceof Error ? failure.stack || failure.message : failure);

  process.exitCode = 1;
});
