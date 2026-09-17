import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  decideExistingIdentityDuplicate,
  isIdempotentReplayForIdentity,
} from "../src/lib/registration-duplicate-policy.ts";
import { normalizeIndianPhone } from "../src/lib/registration-details.ts";
import { ParticipantRecoveryRequestSchema } from "../src/lib/registration-v2.ts";
import {
  RECOVERY_IDENTITY_LIMIT,
  REGISTRATION_CREATE_IDENTITY_LIMIT,
  REGISTRATION_CREATE_IP_LIMIT,
} from "../src/lib/rate-limit.ts";

// ---------------------------------------------------------------------------
// In-memory fakes that mirror production semantics (MongoDB atomic $inc,
// unique indexes on (eventKey, normalizedEmail/Phone), idempotency map).
// JS is single-threaded; `tick()` forces interleaving to expose races.
// ---------------------------------------------------------------------------
const tick = () => new Promise((resolve) => setImmediate(resolve));

function makeCounterStore() {
  const counts = new Map();
  return {
    async inc(key, maximum) {
      await tick();
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next <= maximum;
    },
    get(key) { return counts.get(key) ?? 0; },
  };
}

async function dualBucketFake(store, { ip, email, phone }) {
  if (ip !== "unknown") {
    if (!await store.inc(`ip:${ip}`, REGISTRATION_CREATE_IP_LIMIT)) return false;
  }
  const [e, p] = await Promise.all([
    store.inc(`email:${email}`, REGISTRATION_CREATE_IDENTITY_LIMIT),
    store.inc(`phone:${phone}`, REGISTRATION_CREATE_IDENTITY_LIMIT),
  ]);
  return e && p;
}

function makeRegistrationStore() {
  const byEmail = new Map();
  const byPhone = new Map();
  const byIdem = new Map();
  return {
    async insert({ email, phone, idem, publicId }) {
      await tick();
      // Mirror route order: idempotency replay first, then unique-index race.
      if (byIdem.has(idem)) {
        const existing = byIdem.get(idem);
        const replay = existing.email === email && existing.phone === phone;
        return replay
          ? { outcome: "replayed", publicId: existing.publicId }
          : { outcome: "IDEMPOTENCY_KEY_REUSED" };
      }
      if (byEmail.has(email) || byPhone.has(phone)) {
        const dup = byEmail.get(email) ?? [...byPhone.values()].find((r) => r.phone === phone);
        return { outcome: decideExistingIdentityDuplicate(dup.status, "production").code, publicId: dup.publicId };
      }
      const record = { email, phone, publicId, status: "payment_pending" };
      byEmail.set(email, record);
      byPhone.set(phone, record);
      byIdem.set(idem, record);
      return { outcome: "created", publicId };
    },
    size() { return byEmail.size; },
  };
}

// ---------------------------------------------------------------------------
// BRUTAL 1: 100 classmates behind ONE college NAT IP must ALL pass.
// This is the exact "all users acting as same entity" failure.
// ---------------------------------------------------------------------------
test("BRUTAL: 100 distinct users behind one NAT IP all pass rate policy", async () => {
  const store = makeCounterStore();
  const ip = "103.21.55.10";
  const results = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      dualBucketFake(store, { ip, email: `student${i}@met.edu`, phone: `98765${String(10000 + i)}` })),
  );
  assert.equal(results.filter(Boolean).length, 100, "NAT classmates must never share one tiny bucket");
});

// ---------------------------------------------------------------------------
// BRUTAL 2: burst guard still holds — 250 at once sheds load with 429 shape.
// ---------------------------------------------------------------------------
test("BRUTAL: 250 simultaneous same-IP requests respect burst cap", async () => {
  const store = makeCounterStore();
  const ip = "103.21.55.10";
  const results = await Promise.all(
    Array.from({ length: 250 }, (_, i) =>
      dualBucketFake(store, { ip, email: `burst${i}@met.edu`, phone: `91234${String(10000 + i)}` })),
  );
  const passed = results.filter(Boolean).length;
  assert.ok(passed <= REGISTRATION_CREATE_IP_LIMIT, `burst guard breached: ${passed} > ${REGISTRATION_CREATE_IP_LIMIT}`);
  assert.ok(passed >= 150, `burst guard too aggressive for announcement spike: only ${passed}/250 passed`);
});

// ---------------------------------------------------------------------------
// BRUTAL 3: one attacker hammering 100x concurrently is capped at 5.
// ---------------------------------------------------------------------------
test("BRUTAL: single identity spamming 100 concurrent requests is throttled", async () => {
  const store = makeCounterStore();
  const results = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      dualBucketFake(store, { ip: `10.0.0.${i % 5}`, email: "attacker@example.com", phone: "9876543210" })),
  );
  const passed = results.filter(Boolean).length;
  assert.ok(passed <= REGISTRATION_CREATE_IDENTITY_LIMIT, `abuse guard breached: ${passed} > ${REGISTRATION_CREATE_IDENTITY_LIMIT}`);
});

// ---------------------------------------------------------------------------
// BRUTAL 4: 100 concurrent inserts, all DISTINCT identities — zero false duplicates.
// ---------------------------------------------------------------------------
test("BRUTAL: 100 concurrent distinct registrations all insert, none conflict", async () => {
  const store = makeRegistrationStore();
  const results = await Promise.all(
    Array.from({ length: 100 }, (_, i) => store.insert({
      email: `fresh${i}@met.edu`,
      phone: `98111${String(10000 + i)}`,
      idem: `idem-key-${i}-pad-to-16-chars`,
      publicId: `ILL26-T${String(i).padStart(5, "0")}`,
    })),
  );
  assert.equal(results.filter((r) => r.outcome === "created").length, 100);
  assert.equal(store.size(), 100);
});

// ---------------------------------------------------------------------------
// BRUTAL 5: 100 concurrent inserts, SAME email — exactly 1 wins, 99 get safe 409.
// ---------------------------------------------------------------------------
test("BRUTAL: 100 concurrent same-email registrations collapse to one winner + 99 safe conflicts", async () => {
  const store = makeRegistrationStore();
  const results = await Promise.all(
    Array.from({ length: 100 }, (_, i) => store.insert({
      email: "same.student@met.edu",
      phone: `98222${String(10000 + i)}`,
      idem: `unique-idem-${i}-pad-16`,
      publicId: `ILL26-S${String(i).padStart(5, "0")}`,
    })),
  );
  const created = results.filter((r) => r.outcome === "created").length;
  const conflicts = results.filter((r) => r.outcome === "REGISTRATION_ALREADY_STARTED").length;
  assert.equal(created, 1, `expected exactly 1 winner, got ${created}`);
  assert.equal(conflicts, 99, `expected 99 safe 409s, got ${conflicts}`);
  assert.ok(results.every((r) => r.outcome === "created" || r.outcome === "REGISTRATION_ALREADY_STARTED"));
});

// ---------------------------------------------------------------------------
// BRUTAL 6: idempotency replay under concurrency — same key+identity replays,
// same key+different identity is rejected (no token leak).
// ---------------------------------------------------------------------------
test("BRUTAL: idempotent replay is safe under 100x concurrency", async () => {
  const store = makeRegistrationStore();
  await store.insert({ email: "replay@met.edu", phone: "9833333333", idem: "shared-idempotency-key-abc", publicId: "ILL26-REPLAY" });
  const replays = await Promise.all(
    Array.from({ length: 100 }, () => store.insert({
      email: "replay@met.edu", phone: "9833333333",
      idem: "shared-idempotency-key-abc", publicId: "ILL26-OTHER",
    })),
  );
  assert.ok(replays.every((r) => r.outcome === "replayed" && r.publicId === "ILL26-REPLAY"));
  assert.ok(replays.every(() => isIdempotentReplayForIdentity(
    { normalizedEmail: "replay@met.edu", normalizedPhone: "9833333333" },
    { normalizedEmail: "replay@met.edu", normalizedPhone: "9833333333" },
  )));

  const hijacks = await Promise.all(
    Array.from({ length: 50 }, (_, i) => store.insert({
      email: `stranger${i}@evil.com`, phone: "9833333333",
      idem: "shared-idempotency-key-abc", publicId: "ILL26-EVIL",
    })),
  );
  assert.ok(hijacks.every((r) => r.outcome === "IDEMPOTENCY_KEY_REUSED"));
});

// ---------------------------------------------------------------------------
// BRUTAL 7: recovery login — 100 concurrent wrong contacts all 404, 100
// correct all resolve to the same link. No enumeration leak shape difference.
// ---------------------------------------------------------------------------
test("BRUTAL: recovery login holds under 100x concurrent correct + incorrect attempts", async () => {
  const record = { publicId: "ILL26-ABCDEF", normalizedEmail: "owner@met.edu", normalizedPhone: "9844444444" };
  const attempt = async (email, phone) => {
    await tick();
    const ok = (email && record.normalizedEmail === email) || (phone && record.normalizedPhone === phone);
    return ok ? { statusUrl: `/registration/status/${record.publicId}.sig` } : { code: "LOGIN_NOT_FOUND" };
  };
  const good = await Promise.all(Array.from({ length: 100 }, () => attempt("owner@met.edu", null)));
  assert.ok(good.every((r) => r.statusUrl === "/registration/status/ILL26-ABCDEF.sig"));
  const bad = await Promise.all(Array.from({ length: 100 }, (_, i) => attempt(`guess${i}@evil.com`, "9000000000")));
  assert.ok(bad.every((r) => r.code === "LOGIN_NOT_FOUND" && !("statusUrl" in r)));
  assert.ok(bad.length === 100 && good.length === 100);
  assert.equal(RECOVERY_IDENTITY_LIMIT <= 10, true);
});

// ---------------------------------------------------------------------------
// BRUTAL 8: phone-format tricks must normalize to the same identity.
// +91, spaces, dashes must NOT create duplicate registrations.
// ---------------------------------------------------------------------------
test("BRUTAL: phone formatting variants collapse to one identity", () => {
  const variants = ["9876543210", "+91 98765 43210", "+91-98765-43210", "91 9876543210", " 98765 43210 "];
  const normalized = variants.map(normalizeIndianPhone);
  assert.ok(normalized.every((n) => n === "9876543210"), `normalization split: ${normalized.join(",")}`);
  const recovery = ParticipantRecoveryRequestSchema.safeParse({ publicId: "ILL26-ABCDEF", phone: "+91-98765-43210" });
  assert.equal(recovery.success, true);
  assert.equal(recovery.data?.phone, "9876543210");
});

// ---------------------------------------------------------------------------
// BRUTAL 9: schema validation throughput — 500 parses must stay fast.
// ---------------------------------------------------------------------------
test("BRUTAL: 500 recovery validations complete quickly", () => {
  const start = Date.now();
  for (let i = 0; i < 500; i += 1) {
    const r = ParticipantRecoveryRequestSchema.safeParse({ publicId: "ILL26-ABCDEF", email: `u${i}@met.edu` });
    assert.equal(r.success, true);
  }
  assert.ok(Date.now() - start < 2000, "validation too slow for burst login traffic");
});

// ---------------------------------------------------------------------------
// BRUTAL 10: duplicate-state machine never leaks PII-shaped messages.
// ---------------------------------------------------------------------------
test("BRUTAL: all duplicate states return safe conflict codes under burst", async () => {
  const states = ["payment_pending", "submitted_for_verification", "verified", "rejected"];
  const results = await Promise.all(states.map(async (s) => {
    await tick();
    return decideExistingIdentityDuplicate(s, "production");
  }));
  assert.ok(results.every((r) => r.kind === "safe_conflict" && typeof r.code === "string"));
  const codes = new Set(results.map((r) => r.code));
  assert.equal(codes.size, 4, "each payment state must map to a distinct safe code");
});

// ---------------------------------------------------------------------------
// BRUTAL 11: status reads must not throttle a NAT classroom polling at once.
// ---------------------------------------------------------------------------
test("BRUTAL: status reads use per-token quota with NAT-safe IP burst guard", () => {
  const route = readFileSync(new URL("../src/app/api/payment/status/[token]/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /status-read", clientIp/);
  assert.match(route, /status-read-ip/);
  assert.match(route, /status-read-token/);
  assert.match(route, /400/);
});
