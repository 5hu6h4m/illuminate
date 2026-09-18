import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ParticipantLoginRequestSchema,
  ParticipantRecoveryRequestSchema,
  parseLoginIdentifier,
} from "../src/lib/registration-v2.ts";
import { normalizeIndianPhone } from "../src/lib/registration-details.ts";
import {
  RECOVERY_IDENTITY_LIMIT,
  RECOVERY_IP_LIMIT,
} from "../src/lib/rate-limit.ts";

// ---------------------------------------------------------------------------
// Contract constants — must stay identical to src/app/api/payment/recover/route.ts
// ---------------------------------------------------------------------------
const LOGIN_NOT_FOUND_MESSAGE =
  "No registration matches those details. Check your registered email or mobile number.";
const INVALID_MESSAGE = "Enter your registered email or mobile number.";

const RECORDS = [
  { publicId: "ILL26-AAAAAA", normalizedEmail: "ava@met.edu", normalizedPhone: "9876500001" },
  { publicId: "ILL26-BBBBBB", normalizedEmail: "ben@met.edu", normalizedPhone: "9876500002" },
];

// Mirrors the lookup phase of POST /api/payment/recover (post-validation):
// contact-first lookup by normalized contact; optional illuminateId must equal
// the SAME record; ID-first lookup requires a contact match on the same record.
function lookup({ contactEmail, contactPhone, illuminateId, lookupPublicId }) {
  if (lookupPublicId) {
    const reg = RECORDS.find((r) => r.publicId === lookupPublicId);
    const matches = Boolean(
      reg &&
        ((contactEmail && reg.normalizedEmail === contactEmail) ||
          (contactPhone && reg.normalizedPhone === contactPhone)),
    );
    if (!reg || !matches)
      return { ok: false, code: "LOGIN_NOT_FOUND", message: LOGIN_NOT_FOUND_MESSAGE };
    return { ok: true, publicId: reg.publicId, statusUrl: `/registration/status/${reg.publicId}.sig` };
  }
  if (contactEmail) {
    const reg = RECORDS.find((r) => r.normalizedEmail === contactEmail);
    if (!reg || (illuminateId && reg.publicId !== illuminateId))
      return { ok: false, code: "LOGIN_NOT_FOUND", message: LOGIN_NOT_FOUND_MESSAGE };
    return { ok: true, publicId: reg.publicId, statusUrl: `/registration/status/${reg.publicId}.sig` };
  }
  if (contactPhone) {
    const reg = RECORDS.find((r) => r.normalizedPhone === contactPhone);
    if (!reg || (illuminateId && reg.publicId !== illuminateId))
      return { ok: false, code: "LOGIN_NOT_FOUND", message: LOGIN_NOT_FOUND_MESSAGE };
    return { ok: true, publicId: reg.publicId, statusUrl: `/registration/status/${reg.publicId}.sig` };
  }
  return { ok: false, code: "INVALID_LOGIN_DETAILS", message: INVALID_MESSAGE };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

// ---------------------------------------------------------------------------
// BRUTAL 1: parser accepts every valid disguise, rejects every near-miss.
// ---------------------------------------------------------------------------
test("BRUTAL: identifier parser accepts every valid disguise, rejects every near-miss", () => {
  // Valid emails — case, whitespace, plus-tags, subdomains all collapse.
  for (const [raw, normalized] of [
    ["ava@met.edu", "ava@met.edu"],
    ["  AVA@MET.EDU  ", "ava@met.edu"],
    ["Ava+Illuminate@Met.Edu", "ava+illuminate@met.edu"],
    ["first.last@dept.met.edu", "first.last@dept.met.edu"],
  ]) {
    const parsed = parseLoginIdentifier(raw);
    assert.equal(parsed.kind, "email", `expected email for ${JSON.stringify(raw)}`);
    assert.equal(parsed.email, normalized);
  }

  // Valid phones — every formatting disguise collapses to 10 digits.
  for (const raw of [
    "9876500001",
    "+91 98765 00001",
    "+91-98765-00001",
    "91 9876543210".replace("43210", "00001"),
    "(98765) 00001",
    "  98765 00001  ",
  ]) {
    const parsed = parseLoginIdentifier(raw);
    assert.equal(parsed.kind, "phone", `expected phone for ${JSON.stringify(raw)}`);
  }
  assert.equal(parseLoginIdentifier("+91 98765 00001").phone, "9876500001");

  // Valid IDs — case-insensitive, padded, always normalized to upper.
  for (const raw of ["ILL26-AAAAAA", "ill26-aaaaaa", "  Ill26-AaAaAa  "]) {
    const parsed = parseLoginIdentifier(raw);
    assert.equal(parsed.kind, "publicId", `expected publicId for ${JSON.stringify(raw)}`);
    assert.equal(parsed.publicId, "ILL26-AAAAAA");
  }

  // Near-misses — every one must be invalid, never misclassified.
  for (const raw of [
    "",
    "   ",
    "ab",
    "@",
    "@example.com",
    "user@",
    "user@.com",
    "us er@example.com",
    "12345",
    "09876543210", // 0-prefix is NOT coerced (registration policy parity)
    "+1 4155552671", // foreign numbers rejected
    "98765", // too short
    "1234567890", // starts with 1 — not an Indian mobile
    "ILL25-AAAAAA", // wrong edition year
    "ILL26-AAAAA", // 5 chars
    "ILL26-AAAAAAA", // 7 chars
    "ILL26-ABCDE!", // special char
    "ILL26 ABCDEF", // space instead of dash
    "not-an-email-or-phone",
  ]) {
    assert.equal(parseLoginIdentifier(raw).kind, "invalid", `expected invalid for ${JSON.stringify(raw)}`);
  }

  // Non-string inputs never throw, always invalid.
  for (const raw of [null, undefined, 12345, {}, [], true]) {
    assert.equal(parseLoginIdentifier(raw).kind, "invalid");
  }
});

// ---------------------------------------------------------------------------
// BRUTAL 2: schema is strict — junk shapes die at the gate.
// ---------------------------------------------------------------------------
test("BRUTAL: login schema rejects extra keys, overlong, non-string, bad optional ID", () => {
  assert.equal(
    ParticipantLoginRequestSchema.safeParse({ identifier: "ava@met.edu", hacker: "1" }).success,
    false,
    "strict schema must reject unknown keys (hybrid branch owns mixed shapes)",
  );
  assert.equal(
    ParticipantLoginRequestSchema.safeParse({ identifier: "a".repeat(255) }).success,
    false,
    "overlong identifier must fail",
  );
  assert.equal(ParticipantLoginRequestSchema.safeParse({}).success, false);
  assert.equal(ParticipantLoginRequestSchema.safeParse({ identifier: 12345 }).success, false);
  assert.equal(ParticipantLoginRequestSchema.safeParse({ identifier: "ab" }).success, false);
  assert.equal(
    ParticipantLoginRequestSchema.safeParse({ identifier: "ava@met.edu", illuminateId: "WRONG-123" }).success,
    false,
  );
  assert.equal(
    ParticipantLoginRequestSchema.safeParse({ identifier: "ava@met.edu", illuminateId: "" }).success,
    false,
    "empty optional ID must fail, not silently pass",
  );

  // Lowercase optional ID normalizes to upper — no case-sensitivity lockout.
  const lower = ParticipantLoginRequestSchema.safeParse({
    identifier: "ava@met.edu",
    illuminateId: "ill26-aaaaaa",
  });
  assert.equal(lower.success, true);
  assert.equal(lower.data?.illuminateId, "ILL26-AAAAAA");

  // Pure ID identifier passes the SHAPE gate but must die in routing (see BRUTAL 3).
  assert.equal(ParticipantLoginRequestSchema.safeParse({ identifier: "ILL26-AAAAAA" }).success, true);
});

// ---------------------------------------------------------------------------
// BRUTAL 3: contact-alone resolves, ID-alone never does.
// ---------------------------------------------------------------------------
test("BRUTAL: contact-alone resolves to the right record, ID-alone never resolves", () => {
  // Email alone (with case/whitespace disguise) → Ava.
  let parsed = parseLoginIdentifier("  AVA@MET.EDU ");
  assert.equal(parsed.kind, "email");
  let result = lookup({ contactEmail: parsed.email });
  assert.equal(result.ok, true);
  assert.equal(result.publicId, "ILL26-AAAAAA");

  // Phone alone (with +91/spaces disguise) → Ben.
  parsed = parseLoginIdentifier("+91 98765 00002");
  assert.equal(parsed.kind, "phone");
  result = lookup({ contactPhone: parsed.phone });
  assert.equal(result.ok, true);
  assert.equal(result.publicId, "ILL26-BBBBBB");

  // Bare 10-digit phone → Ava.
  parsed = parseLoginIdentifier("9876500001");
  assert.equal(parsed.kind, "phone");
  result = lookup({ contactPhone: parsed.phone });
  assert.equal(result.ok, true);
  assert.equal(result.publicId, "ILL26-AAAAAA");

  // Email + correct optional ID → still Ava.
  result = lookup({ contactEmail: "ava@met.edu", illuminateId: "ILL26-AAAAAA" });
  assert.equal(result.ok, true);

  // Email + WRONG optional ID → fail (ID must match the SAME record).
  result = lookup({ contactEmail: "ava@met.edu", illuminateId: "ILL26-BBBBBB" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "LOGIN_NOT_FOUND");

  // Unknown contact → fail with the SAME code/message (no oracle).
  result = lookup({ contactEmail: "ghost@met.edu" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "LOGIN_NOT_FOUND");
  assert.equal(result.message, LOGIN_NOT_FOUND_MESSAGE);

  // ID-first with contact second factor (frontend ID-mode payload) → Ava.
  parsed = parseLoginIdentifier("ILL26-AAAAAA");
  assert.equal(parsed.kind, "publicId");
  result = lookup({ lookupPublicId: parsed.publicId, contactEmail: "ava@met.edu" });
  assert.equal(result.ok, true);

  // ID-first with the OTHER person's contact → fail (no cross-record match).
  result = lookup({ lookupPublicId: "ILL26-AAAAAA", contactEmail: "ben@met.edu" });
  assert.equal(result.ok, false);

  // No intent at all → 422, never 404 (nothing to look up).
  result = lookup({});
  assert.equal(result.ok, false);
  assert.equal(result.code, "INVALID_LOGIN_DETAILS");
});

// ---------------------------------------------------------------------------
// BRUTAL 4: failures are indistinguishable — no enumeration oracle.
// ---------------------------------------------------------------------------
test("BRUTAL: every login failure is indistinguishable (no enumeration oracle)", () => {
  const failures = [
    lookup({ contactEmail: "ghost@met.edu" }),
    lookup({ contactPhone: "9000000000" }),
    lookup({ contactEmail: "ava@met.edu", illuminateId: "ILL26-BBBBBB" }),
    lookup({ contactPhone: "9876500001", illuminateId: "ILL26-BBBBBB" }),
    lookup({ lookupPublicId: "ILL26-ZZZZZZ", contactEmail: "ava@met.edu" }),
    lookup({ lookupPublicId: "ILL26-AAAAAA", contactEmail: "ben@met.edu" }),
  ];
  assert.ok(failures.every((f) => f.ok === false));
  assert.ok(failures.every((f) => f.code === "LOGIN_NOT_FOUND"));
  const messages = new Set(failures.map((f) => f.message));
  assert.equal(messages.size, 1, "failure messages must be byte-identical");
  assert.equal([...messages][0], LOGIN_NOT_FOUND_MESSAGE);
  // Failure payloads carry no link, no ID, no hint about which field was wrong.
  for (const f of failures) {
    assert.ok(!("statusUrl" in f));
    assert.ok(!("publicId" in f));
  }

  // Success payloads carry ONLY the link + ID — never contacts.
  const good = lookup({ contactEmail: "ava@met.edu" });
  assert.deepEqual(Object.keys(good).sort(), ["ok", "publicId", "statusUrl"]);
});

// ---------------------------------------------------------------------------
// BRUTAL 5: every payload shape the client can send classifies correctly.
// ---------------------------------------------------------------------------
test("BRUTAL: new, legacy, and hybrid payload shapes all classify into the intended branch", () => {
  // Pure new shapes pass strict parsing.
  assert.equal(ParticipantLoginRequestSchema.safeParse({ identifier: "ava@met.edu" }).success, true);
  assert.equal(
    ParticipantLoginRequestSchema.safeParse({ identifier: "ava@met.edu", illuminateId: "ILL26-AAAAAA" }).success,
    true,
  );

  // Mixed shapes (what the form actually sends) fail strict — the route's
  // hybrid branch owns them, and the embedded IDs must still validate.
  const mixed = { identifier: "ava@met.edu", email: "ava@met.edu", illuminateId: "ILL26-AAAAAA", publicId: "ILL26-AAAAAA" };
  assert.equal(ParticipantLoginRequestSchema.safeParse(mixed).success, false);
  assert.equal(ParticipantRecoveryRequestSchema.safeParse(mixed).success, false);
  assert.equal(parseLoginIdentifier(mixed.identifier).kind, "email");
  assert.equal(
    ParticipantLoginRequestSchema.shape.illuminateId.safeParse(mixed.illuminateId).success,
    true,
  );

  // Mixed shape with a forged optional ID dies at classification.
  const forged = { identifier: "ava@met.edu", illuminateId: "WRONG-123" };
  assert.equal(
    ParticipantLoginRequestSchema.shape.illuminateId.safeParse(forged.illuminateId).success,
    false,
  );

  // Frontend ID-mode payload: identifier is the ID, contact rides legacy keys.
  const idMode = { identifier: "ILL26-AAAAAA", publicId: "ILL26-AAAAAA", email: "ava@met.edu" };
  assert.equal(parseLoginIdentifier(idMode.identifier).kind, "publicId");
  assert.equal(parseLoginIdentifier(idMode.email).kind, "email");

  // Legacy shapes still parse and normalize exactly like before.
  const legacyEmail = ParticipantRecoveryRequestSchema.safeParse({
    publicId: "ill26-bbbbbb",
    email: "Ben@Met.Edu",
  });
  assert.equal(legacyEmail.success, true);
  assert.equal(legacyEmail.data?.publicId, "ILL26-BBBBBB");
  assert.equal(legacyEmail.data?.email, "ben@met.edu");
  const legacyPhone = ParticipantRecoveryRequestSchema.safeParse({
    publicId: "ILL26-AAAAAA",
    phone: "+91 98765 00001",
  });
  assert.equal(legacyPhone.success, true);
  assert.equal(legacyPhone.data?.phone, "9876500001");

  // Legacy ID-alone and legacy garbage still fail — no backdoor opened.
  assert.equal(ParticipantRecoveryRequestSchema.safeParse({ publicId: "ILL26-AAAAAA" }).success, false);
  assert.equal(
    ParticipantRecoveryRequestSchema.safeParse({ publicId: "WRONG-123", email: "a@b.com" }).success,
    false,
  );
});

// ---------------------------------------------------------------------------
// BRUTAL 6: route source keeps every guard — ID-alone block, contact lookup,
// generic errors, identity-scoped rate limit.
// ---------------------------------------------------------------------------
test("BRUTAL: recover route keeps ID-alone guard, contact lookup, and identity rate-limit", () => {
  const route = readFileSync(new URL("../src/app/api/payment/recover/route.ts", import.meta.url), "utf8");
  // ID-alone can never succeed.
  assert.match(route, /ID-alone/);
  assert.match(route, /INVALID_LOGIN_DETAILS/);
  // Contact-first lookup uses the indexed normalized fields.
  assert.match(route, /participant\.normalizedEmail/);
  assert.match(route, /participant\.normalizedPhone/);
  // Optional ID must equal the same record — both branches.
  assert.ok((route.match(/registration\.publicId !== illuminateId/g) ?? []).length >= 2);
  // Generic 404 on every miss.
  assert.match(route, /LOGIN_NOT_FOUND/);
  // Rate limit is keyed on the normalized identifier, with Retry-After.
  assert.match(route, /enforceRecoveryRateLimit\(\{\s*ip,\s*identity:\s*identifierValue\s*\}\)/);
  assert.match(route, /retryAfterSeconds/);
  // One shared success exit re-issues the holder's own bearer link.
  assert.match(route, /function issueStatusLink\(publicId: string\)/);
  assert.ok((route.match(/return issueStatusLink\(registration\.publicId\)/g) ?? []).length >= 3);
  assert.match(route, /generateParticipantAccessToken\(publicId\)/);
});

// ---------------------------------------------------------------------------
// BRUTAL 7: errors never echo user input, success never leaks PII.
// ---------------------------------------------------------------------------
test("BRUTAL: error paths never echo input, success payload never carries PII", () => {
  const route = readFileSync(new URL("../src/app/api/payment/recover/route.ts", import.meta.url), "utf8");
  // All INVALID_LOGIN_DETAILS messages byte-identical.
  const invalidMessages = [...route.matchAll(/INVALID_LOGIN_DETAILS",\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(invalidMessages.length >= 5);
  assert.equal(new Set(invalidMessages).size, 1);
  // All LOGIN_NOT_FOUND messages byte-identical.
  const notFoundMessages = [...route.matchAll(/LOGIN_NOT_FOUND",\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(notFoundMessages.length >= 4);
  assert.equal(new Set(notFoundMessages).size, 1);
  // No apiError message interpolates user-controlled values.
  for (const line of route.split("\n")) {
    if (line.includes("apiError(")) assert.doesNotMatch(line, /\$\{(contactEmail|contactPhone|identifierValue|illuminateId|lookupPublicId)/);
  }
  // Success payloads contain only the link + ID.
  for (const match of route.matchAll(/sensitiveJson\(\{([^}]+)\}\)/g)) {
    assert.doesNotMatch(match[1], /participant|normalizedEmail|normalizedPhone/);
    assert.match(match[1], /publicId/);
    assert.match(match[1], /statusUrl/);
  }
});

// ---------------------------------------------------------------------------
// BRUTAL 8: login phone normalization matches registration — no lockout gap.
// ---------------------------------------------------------------------------
test("BRUTAL: login and registration normalize phones identically (no lockout gap)", () => {
  const variants = [
    "9876500001",
    "+91 98765 00001",
    "+91-98765-00001",
    "919876500001",
    "91 9876500001",
    "(98765) 00001",
  ];
  for (const raw of variants) {
    const viaLogin = parseLoginIdentifier(raw);
    assert.equal(viaLogin.kind, "phone", `login must accept ${JSON.stringify(raw)}`);
    assert.equal(viaLogin.phone, normalizeIndianPhone(raw), `login/registration split for ${JSON.stringify(raw)}`);
  }
  assert.equal(normalizeIndianPhone("+91 98765 00001"), "9876500001");
  // Rejected by registration policy stays rejected at login — identical wall.
  assert.notEqual(normalizeIndianPhone("09876543210"), "9876500001");
  assert.equal(parseLoginIdentifier("09876543210").kind, "invalid");
  assert.equal(parseLoginIdentifier("+1 4155552671").kind, "invalid");
});

// ---------------------------------------------------------------------------
// BRUTAL 9: rate-limit policy stays NAT-safe and brute-force resistant.
// ---------------------------------------------------------------------------
test("BRUTAL: recovery rate-limit is NAT-safe, identity-scoped, and hashed", () => {
  assert.ok(RECOVERY_IP_LIMIT >= 15, "IP burst guard must tolerate classroom NAT");
  assert.ok(RECOVERY_IDENTITY_LIMIT <= 10, "per-identity quota must stay brute-force resistant");
  assert.ok(RECOVERY_IP_LIMIT > RECOVERY_IDENTITY_LIMIT, "IP guard must exceed identity quota");
  const limits = readFileSync(new URL("../src/lib/rate-limit.ts", import.meta.url), "utf8");
  assert.match(limits, /login:\$\{normalizedIdentity\}/);
  assert.match(limits, /createHash\("sha256"\)/);
  assert.match(limits, /recovery-per-id/);
});

// ---------------------------------------------------------------------------
// BRUTAL 10: contact lookup is indexed — no collection scan under burst.
// ---------------------------------------------------------------------------
test("BRUTAL: contact lookup rides unique indexed fields", () => {
  const mongo = readFileSync(new URL("../src/lib/mongodb.ts", import.meta.url), "utf8");
  assert.match(mongo, /v2_event_email_unique/);
  assert.match(mongo, /v2_event_phone_unique/);
  assert.match(mongo, /participant\.normalizedEmail/);
  assert.match(mongo, /participant\.normalizedPhone/);
});

// ---------------------------------------------------------------------------
// BRUTAL 11: form contract — one identifier, optional ID, ID-mode contact gate.
// ---------------------------------------------------------------------------
test("BRUTAL: login form keeps single-identifier contract with ID-mode contact gate", () => {
  const component = readFileSync(
    new URL("../src/components/registration/ParticipantLogin.tsx", import.meta.url),
    "utf8",
  );
  assert.match(component, /login-identifier/);
  assert.match(component, /name="identifier"/);
  assert.match(component, /login-illuminateId/);
  assert.match(component, /Illuminate ID \(optional\)/);
  assert.match(component, /login-contact/);
  assert.match(component, /Enter the email or mobile you registered with\./);
  assert.match(component, /\/api\/payment\/recover/);
  // Dual payload: new identifier shape + legacy keys for backward compat.
  assert.match(component, /identifier: primary/);
  assert.match(component, /body\.illuminateId/);
  assert.match(component, /body\.publicId/);
  // Error + loading + a11y contract intact — errors point at the field at fault.
  assert.match(component, /role="alert"/);
  assert.match(component, /login-error/);
  assert.match(component, /autoComplete="username"/);
  assert.match(component, /inputMode=\{primaryInputMode\}/);
  assert.match(component, /errorTarget === "primary"/);
  assert.match(component, /errorTarget === "secondary"/);
  assert.match(component, /Finding…/);
  // No credential-shaped inputs, no token persistence beyond the status link.
  assert.doesNotMatch(component, /type="password"/);
  assert.match(component, /saveRegistration\(window\.localStorage/);
  assert.match(component, /statusUrl/);
});

// ---------------------------------------------------------------------------
// BRUTAL 12: login is highlighted on every surface that matters.
// ---------------------------------------------------------------------------
test("BRUTAL: login link is highlighted on header, mobile nav, hero, final CTA, and recovery surfaces", () => {
  const header = readFileSync(new URL("../src/components/landing/LandingHeader.tsx", import.meta.url), "utf8");
  const hero = readFileSync(new URL("../src/components/landing/CinematicHero.tsx", import.meta.url), "utf8");
  const final = readFileSync(new URL("../src/components/landing/FinalCta.tsx", import.meta.url), "utf8");
  const wizard = readFileSync(
    new URL("../src/components/registration/RegistrationWizard.tsx", import.meta.url),
    "utf8",
  );
  const success = readFileSync(new URL("../src/app/success/page.tsx", import.meta.url), "utf8");
  const login = readFileSync(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
  const recover = readFileSync(new URL("../src/app/registration/recover/page.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(header, /href="\/login"/);
  assert.match(header, /landing-header__login/);
  assert.match(header, /landing-mobile-login/);
  assert.match(hero, /href="\/login"/);
  assert.match(hero, /Log in with email or mobile/);
  assert.match(final, /href="\/login"/);
  assert.match(wizard, /href="\/login"/);
  assert.match(wizard, /Log in with email or mobile/);
  assert.match(success, /href="\/login"/);
  assert.match(login, /ParticipantLogin/);
  assert.match(recover, /ParticipantLogin/);

  // Touch targets meet the 44px bar (2.75rem) on header, mobile, and final CTA.
  assert.match(css, /\.landing-header__login\{[^}]*min-height:2\.75rem/);
  assert.match(css, /\.landing-mobile-login\{[^}]*min-height:2\.75rem/);
  assert.match(css, /\.landing-final__login \{[^}]*min-height:2\.75rem/);
});

// ---------------------------------------------------------------------------
// BRUTAL 12b: even error-path copy promises the contact-only model.
// ---------------------------------------------------------------------------
test("BRUTAL: wizard rate-limit/unavailable copy promises email-or-mobile login", () => {
  const wizard = readFileSync(
    new URL("../src/components/registration/RegistrationWizard.tsx", import.meta.url),
    "utf8",
  );
  assert.match(wizard, /RATE_LIMITED: "Too many registration attempts[^"]*log in with your email or mobile instead\./);
  assert.match(wizard, /REGISTRATION_UNAVAILABLE: "[^"]*log in with your email or mobile instead\./);
  assert.doesNotMatch(wizard, /log in with your Illuminate ID instead/);
});

// ---------------------------------------------------------------------------
// BRUTAL 12c: normalization has one source of truth; server stays the strict one.
// ---------------------------------------------------------------------------
test("BRUTAL: login normalization is shared, server stays source of truth", () => {
  const shared = readFileSync(new URL("../src/lib/login-identifier.ts", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../src/lib/registration-v2.ts", import.meta.url), "utf8");
  const component = readFileSync(
    new URL("../src/components/registration/ParticipantLogin.tsx", import.meta.url),
    "utf8",
  );
  // One definition each — no driftable copies.
  assert.match(shared, /export function normalizeLoginPhone/);
  assert.match(shared, /export function isIlluminateId/);
  assert.match(schema, /from "@\/lib\/login-identifier"/);
  assert.match(component, /from "@\/lib\/login-identifier"/);
  assert.doesNotMatch(schema, /replace\(\/\\D\/g, ""\)\.replace\(\/\^91/);
  assert.doesNotMatch(component, /replace\(\/\\D\/g, ""\)\.replace\(\/\^91/);
  // Server is deliberately lenient (digit-embedded junk normalizes); the form
  // is deliberately stricter (shows the unknown-hint). Documented, tested.
  assert.equal(parseLoginIdentifier("98765abc43210").kind, "phone");
  assert.equal(parseLoginIdentifier("98765abc43210").phone, "9876543210");
});

// ---------------------------------------------------------------------------
// BRUTAL 13: 100x concurrent contact-only logins — good resolve, guesses fail shut.
// ---------------------------------------------------------------------------
test("BRUTAL: 100x concurrent contact-only logins resolve together, 100x guesses fail shut", async () => {
  const attempt = async (intent) => {
    await tick();
    return lookup(intent);
  };
  const goodEmails = await Promise.all(
    Array.from({ length: 100 }, () => attempt({ contactEmail: "ava@met.edu" })),
  );
  assert.ok(goodEmails.every((r) => r.ok && r.publicId === "ILL26-AAAAAA"));
  assert.ok(goodEmails.every((r) => r.statusUrl === goodEmails[0].statusUrl));

  const goodPhones = await Promise.all(
    Array.from({ length: 100 }, () => attempt({ contactPhone: "9876500002" })),
  );
  assert.ok(goodPhones.every((r) => r.ok && r.publicId === "ILL26-BBBBBB"));

  const bad = await Promise.all(
    Array.from({ length: 100 }, (_, i) => attempt({ contactEmail: `guess${i}@evil.com` })),
  );
  assert.ok(bad.every((r) => !r.ok && r.code === "LOGIN_NOT_FOUND" && !("statusUrl" in r)));
  assert.equal(new Set(bad.map((r) => r.message)).size, 1);

  // Forged optional IDs under burst still fail shut with the same message.
  const forged = await Promise.all(
    Array.from({ length: 20 }, () => attempt({ contactEmail: "ava@met.edu", illuminateId: "ILL26-BBBBBB" })),
  );
  assert.ok(forged.every((r) => !r.ok && r.message === LOGIN_NOT_FOUND_MESSAGE));
});

// ---------------------------------------------------------------------------
// BRUTAL 14: validation throughput holds under burst login traffic.
// ---------------------------------------------------------------------------
test("BRUTAL: 500 mixed login validations complete quickly", () => {
  const start = Date.now();
  for (let i = 0; i < 500; i += 1) {
    const shape =
      i % 3 === 0
        ? { identifier: `user${i}@met.edu` }
        : i % 3 === 1
          ? { identifier: "+91 98765 00001" }
          : { identifier: "ava@met.edu", illuminateId: "ILL26-AAAAAA" };
    assert.equal(ParticipantLoginRequestSchema.safeParse(shape).success, true);
    assert.notEqual(parseLoginIdentifier(shape.identifier).kind, "invalid");
  }
  assert.ok(Date.now() - start < 2000, "validation too slow for burst login traffic");
});
