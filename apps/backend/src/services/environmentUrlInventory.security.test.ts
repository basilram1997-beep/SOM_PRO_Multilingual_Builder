import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

test("environment URL inventory classifies deployment assumptions before config changes", () => {
  const inventory = read("../../docs/ENVIRONMENT_URL_INVENTORY.md");

  assert.match(inventory, /Legitimate local default/);
  assert.match(inventory, /Environment configuration/);
  assert.match(inventory, /Hard-coded URL to remove/);
  assert.match(inventory, /Documentation\/example only/);
  assert.match(inventory, /apps\/frontend\/src\/api\/http\.ts/);
  assert.match(inventory, /apps\/backend\/src\/config\/env\.ts/);
  assert.match(inventory, /apps\/desktop\/src\/runtimeConfig\.js/);
  assert.match(inventory, /apps\/license-server\/src\/server\.js/);
  assert.match(inventory, /deploy\/nginx\/sompro\.conf/);
  assert.match(inventory, /WebSocket\/SSE/);
  assert.match(inventory, /VITE_API_URL=\/api/);
  assert.match(inventory, /https:\/\/sompro\.duckdns\.org/);
  assert.match(inventory, /https:\/\/app\.example\.com/);
});

test("environment URL inventory does not treat staging or production domains as source logic", () => {
  const inventory = read("../../docs/ENVIRONMENT_URL_INVENTORY.md");

  assert.match(inventory, /sompro\.duckdns\.org` is a staging configuration value only/);
  assert.match(inventory, /Future production domains must stay in configuration\/DNS\/reverse proxy only/);
  assert.match(inventory, /same-origin `\/api`/i);
  assert.match(inventory, /No database schema changes/);
  assert.match(inventory, /No secrets are added to Git/);
});
