import test from "node:test";
import assert from "node:assert/strict";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function createStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    }
  };
}

function setupWindow() {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  globalThis.window = { localStorage, sessionStorage } as never;
  return { localStorage, sessionStorage };
}

test("auth token storage migrates legacy local tokens into session storage only", async () => {
  const { localStorage, sessionStorage } = setupWindow();
  localStorage.setItem("som-pro-auth-token", "legacy-token-123");

  const storage = await import("./authTokenStorage.ts");

  assert.equal(storage.getAuthToken(), "legacy-token-123");
  assert.equal(localStorage.getItem("som-pro-auth-token"), null);
  assert.equal(sessionStorage.getItem("som-pro-session-auth-token-v3"), "legacy-token-123");

  storage.setAuthToken("fresh-token-456");
  assert.equal(storage.getAuthToken(), "fresh-token-456");
  assert.equal(localStorage.getItem("som-pro-session-auth-token-v3"), null);
  assert.equal(sessionStorage.getItem("som-pro-session-auth-token-v3"), "fresh-token-456");

  storage.clearAuthToken();
  assert.equal(storage.getAuthToken(), "");
  assert.equal(sessionStorage.getItem("som-pro-session-auth-token-v3"), null);
});
