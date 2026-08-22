const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const prettierBin = require.resolve("prettier/bin/prettier.cjs");
const supportedExtensions = new Set([
  ".js",
  ".cjs",
  ".mjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".json",
  ".md",
  ".css",
  ".html",
  ".yml",
  ".yaml",
  ".sh",
  ".cmd",
  ".ps1"
]);

function runGit(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim().split(/\r?\n/).filter(Boolean);
}

function isSupported(file) {
  return supportedExtensions.has(path.extname(file).toLowerCase());
}

const changedFiles = new Set([
  ...runGit(["diff", "--name-only", "--cached", "--diff-filter=ACMR"]),
  ...runGit(["diff", "--name-only", "--diff-filter=ACMR"]),
  ...runGit(["ls-files", "--others", "--exclude-standard"])
]);

const files = [...changedFiles]
  .filter(isSupported)
  .filter((file) => fs.existsSync(path.join(root, file)))
  .sort((left, right) => left.localeCompare(right));

if (!files.length) {
  console.log("No changed files to check.");
  process.exit(0);
}

const result = spawnSync(process.execPath, [prettierBin, "--check", ...files], {
  cwd: root,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
