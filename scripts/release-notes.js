const fs = require("fs");
const path = require("path");
const { error } = require("./cli-output");

const changelogPath = path.resolve(__dirname, "..", "CHANGELOG.md");
if (!fs.existsSync(changelogPath)) {
  error("CHANGELOG.md was not found.");
  process.exit(1);
}
process.stdout.write(fs.readFileSync(changelogPath, "utf8"));
