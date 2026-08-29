const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const manifestPath = path.join(root, "web-page", "assets", "showcase", "admin-gallery.json");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function main() {
  if (!fs.existsSync(manifestPath)) {
    fail(`Missing manifest: ${manifestPath}`);
    return;
  }

  let items;
  try {
    items = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`Invalid JSON in ${manifestPath}: ${error.message}`);
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    fail("admin-gallery.json must contain at least one showcase item");
    return;
  }

  const seenTitles = new Set();
  for (const [index, item] of items.entries()) {
    const prefix = `admin-gallery.json[${index}]`;
    if (!item || typeof item !== "object") {
      fail(`${prefix} must be an object`);
      continue;
    }

    for (const key of ["image", "alt", "title", "caption"]) {
      if (typeof item[key] !== "string" || !item[key].trim()) {
        fail(`${prefix}.${key} must be a non-empty string`);
      }
    }

    if (seenTitles.has(item.title)) {
      fail(`${prefix}.title must be unique: ${item.title}`);
    }
    seenTitles.add(item.title);

    const assetPath = path.join(root, "web-page", item.image);
    if (!fs.existsSync(assetPath)) {
      fail(`${prefix}.image does not exist: ${item.image}`);
    }
  }
}

main();
