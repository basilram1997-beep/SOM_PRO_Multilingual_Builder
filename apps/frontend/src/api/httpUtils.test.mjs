import assert from "node:assert/strict";
import test from "node:test";
import { apiErrorMessage, isLocalApiUrl, readResponseBody } from "./httpUtils.ts";

test("readResponseBody accepts successful responses without content", async () => {
  const response = new globalThis.Response(null, { status: 204 });
  assert.equal(await readResponseBody(response), undefined);
});

test("readResponseBody parses JSON and preserves plain text", async () => {
  const jsonResponse = new globalThis.Response(JSON.stringify({ data: { ok: true } }));
  const textResponse = new globalThis.Response("temporarily unavailable");

  assert.deepEqual(await readResponseBody(jsonResponse), { data: { ok: true } });
  assert.equal(await readResponseBody(textResponse), "temporarily unavailable");
});

test("apiErrorMessage uses the public API message before the error code", () => {
  assert.equal(apiErrorMessage({ message: "Invalid input", error: "INVALID_INPUT" }, "Fallback"), "Invalid input");
  assert.equal(apiErrorMessage({ error: "INVALID_INPUT" }, "Fallback"), "INVALID_INPUT");
  assert.equal(apiErrorMessage({}, "Fallback"), "Fallback");
});

test("apiErrorMessage hides technical error-looking payloads", () => {
  assert.equal(
    apiErrorMessage({ message: "PrismaClientKnownRequestError: Something went wrong" }, "Fallback"),
    "Fallback"
  );
  assert.equal(apiErrorMessage({ error: "TypeError: Cannot read properties of undefined" }, "Fallback"), "Fallback");
});

test("isLocalApiUrl identifies only local API hosts", () => {
  assert.equal(isLocalApiUrl("http://localhost:4000"), true);
  assert.equal(isLocalApiUrl("http://127.0.0.1:4000"), true);
  assert.equal(isLocalApiUrl("https://api.example.com"), false);
  assert.equal(isLocalApiUrl("not-a-url"), false);
});
