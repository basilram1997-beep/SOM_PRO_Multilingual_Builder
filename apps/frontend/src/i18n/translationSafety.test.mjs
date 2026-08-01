import assert from "node:assert/strict";
import test from "node:test";
import { createSafeDictionary, getBackupStorageKey, isBrokenLocalizedText } from "./translationSafety.ts";

test("isBrokenLocalizedText flags empty and question-mark heavy strings", () => {
  assert.equal(isBrokenLocalizedText(""), true);
  assert.equal(isBrokenLocalizedText("?????"), true);
  assert.equal(isBrokenLocalizedText("English text"), false);
});

test("createSafeDictionary prefers the healthy fallback when the current value is broken", () => {
  const storage = new Map();
  const fakeStorage = {
    getItem(key) {
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      storage.set(key, value);
    }
  };

  const previousWindow = globalThis.window;
  globalThis.window = { localStorage: fakeStorage };

  try {
    storage.set(getBackupStorageKey("ar"), JSON.stringify({ greeting: "Ù…Ø±Ø­Ø¨Ø§", welcome: "Ø£Ù‡Ù„Ø§" }));

    const safe = createSafeDictionary(
      "ar",
      { greeting: "????", welcome: "ØŸØŸØŸØŸ" },
      { greeting: "Hello", welcome: "Welcome" }
    );

    assert.equal(safe.greeting, "Hello");
    assert.equal(safe.welcome, "Welcome");
    assert.equal(storage.has(getBackupStorageKey("ar")), true);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("createSafeDictionary falls back to English when both localized values are broken", () => {
  const storage = new Map();
  const fakeStorage = {
    getItem(key) {
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      storage.set(key, value);
    }
  };

  const previousWindow = globalThis.window;
  globalThis.window = { localStorage: fakeStorage };

  try {
    storage.set(getBackupStorageKey("he"), JSON.stringify({ greeting: "????" }));

    const safe = createSafeDictionary("he", { greeting: "????" }, { greeting: "Hello" });

    assert.equal(safe.greeting, "Hello");
  } finally {
    globalThis.window = previousWindow;
  }
});
