const http = require("http");
const { PORT, ADMIN_TOKEN, DEFAULT_LICENSE_SECRET, IS_PRODUCTION, hash } = require("./runtime");
const { handleLicenseRequest } = require("./routes");
const { disconnectLicenseServerDb } = require("./db");
const {
  licenseCodeHash,
  makeLicenseKey,
  normalizeLicenseCode,
  parseLicenseKey
} = require("./policy");

if (IS_PRODUCTION && process.env.SOM_PRO_LICENSE_SECRET === DEFAULT_LICENSE_SECRET) {
  console.error("SOM_PRO_LICENSE_SECRET must be changed before selling or production use.");
  process.exit(1);
}

if (IS_PRODUCTION && !process.env.LICENSE_ADMIN_TOKEN) {
  console.error("LICENSE_ADMIN_TOKEN is required in production. Do not use a generated local owner token.");
  process.exit(1);
}

if (IS_PRODUCTION && String(ADMIN_TOKEN || "").length < 32) {
  console.error("LICENSE_ADMIN_TOKEN must be at least 32 characters in production.");
  process.exit(1);
}

function handle(req, res) {
  return handleLicenseRequest(req, res);
}

function createLicenseServer() {
  const server = http.createServer((req, res) =>
    handle(req, res).catch((error) => {
      if (error?.message === "BODY_TOO_LARGE") {
        res.writeHead(413, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "BODY_TOO_LARGE" }));
        return;
      }
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "INTERNAL_ERROR" }));
    })
  );
  server.on("close", () => {
    void disconnectLicenseServerDb();
  });
  return server;
}

const server = createLicenseServer();

if (require.main === module) {
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.log("License server is already running on http://localhost:" + PORT);
      process.exit(0);
    }
    console.error(error);
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log("SOM License Server running on http://localhost:" + PORT);
    console.log("Owner login: http://localhost:" + PORT);
    if (!process.env.LICENSE_ADMIN_TOKEN) {
      console.log("Owner token for this process: " + ADMIN_TOKEN);
    }
  });
}

module.exports = {
  createLicenseServer,
  handle,
  hash,
  licenseCodeHash,
  makeLicenseKey,
  normalizeLicenseCode,
  parseLicenseKey
};
