import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTEMPT_STORAGE_KEY,
  clearAttempt,
  clearSavedRegistration,
  loadPersistedAttempt,
  loadSavedRegistration,
  SAVED_STORAGE_KEY,
  saveRegistration,
  storeAttempt,
} from "../src/lib/registration-continuation.ts";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
    _data: data,
  };
}

test("attempt round-trips and replays for an identical fingerprint", () => {
  const storage = memoryStorage();
  storeAttempt(storage, { key: "key-1", fingerprint: '{"email":"a@x.com"}' });
  assert.deepEqual(loadPersistedAttempt(storage), { key: "key-1", fingerprint: '{"email":"a@x.com"}' });
});

test("attempt load rejects malformed, wrong-shape, and oversized payloads", () => {
  assert.equal(loadPersistedAttempt(memoryStorage({ [ATTEMPT_STORAGE_KEY]: "not-json{" })), null);
  assert.equal(loadPersistedAttempt(memoryStorage({ [ATTEMPT_STORAGE_KEY]: JSON.stringify({ key: "", fingerprint: "f" }) })), null);
  assert.equal(loadPersistedAttempt(memoryStorage({ [ATTEMPT_STORAGE_KEY]: JSON.stringify({ key: "k" }) })), null);
  assert.equal(loadPersistedAttempt(memoryStorage({ [ATTEMPT_STORAGE_KEY]: JSON.stringify({ key: "k".repeat(201), fingerprint: "f" }) })), null);
  assert.equal(loadPersistedAttempt(memoryStorage()), null);
});

test("attempt store/clear tolerate throwing storage (private mode, quota)", () => {
  const throwing = { getItem: () => null, setItem: () => { throw new Error("denied"); }, removeItem: () => { throw new Error("denied"); } };
  assert.doesNotThrow(() => storeAttempt(throwing, { key: "k", fingerprint: "f" }));
  assert.doesNotThrow(() => clearAttempt(throwing));
});

test("clearAttempt removes the persisted key so the next mount starts fresh", () => {
  const storage = memoryStorage();
  storeAttempt(storage, { key: "k", fingerprint: "f" });
  clearAttempt(storage);
  assert.equal(loadPersistedAttempt(storage), null);
});

test("saved registration round-trips and rejects foreign URLs and shapes", () => {
  const storage = memoryStorage();
  saveRegistration(storage, { publicId: "ILL26-ABCDEF", statusUrl: "/registration/status/ILL26-ABCDEF.sig", savedAt: "2026-01-01T00:00:00.000Z" });
  assert.deepEqual(loadSavedRegistration(storage), { publicId: "ILL26-ABCDEF", statusUrl: "/registration/status/ILL26-ABCDEF.sig", savedAt: "2026-01-01T00:00:00.000Z" });
  // Attacker-planted or foreign values must never render as a resume link.
  assert.equal(loadSavedRegistration(memoryStorage({ [SAVED_STORAGE_KEY]: JSON.stringify({ publicId: "x", statusUrl: "https://evil.example/phish" }) })), null);
  assert.equal(loadSavedRegistration(memoryStorage({ [SAVED_STORAGE_KEY]: JSON.stringify({ publicId: "x", statusUrl: "/admin" }) })), null);
  assert.equal(loadSavedRegistration(memoryStorage({ [SAVED_STORAGE_KEY]: "broken{" })), null);
});

test("clearSavedRegistration forgets the link (start-fresh path)", () => {
  const storage = memoryStorage();
  saveRegistration(storage, { publicId: "ILL26-ABCDEF", statusUrl: "/registration/status/ILL26-ABCDEF.sig", savedAt: "" });
  clearSavedRegistration(storage);
  assert.equal(loadSavedRegistration(storage), null);
});
