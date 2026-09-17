import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ParticipantRecoveryRequestSchema } from "../src/lib/registration-v2.ts";
import {
  RECOVERY_IDENTITY_LIMIT,
  RECOVERY_IP_LIMIT,
  REGISTRATION_CREATE_IDENTITY_LIMIT,
  REGISTRATION_CREATE_IP_LIMIT,
} from "../src/lib/rate-limit.ts";

test("recovery login requires Illuminate ID plus email or phone", () => {
  const withEmail = ParticipantRecoveryRequestSchema.safeParse({ publicId: "ILL26-ABCDEF", email: "Student@Example.com" });
  assert.equal(withEmail.success, true);
  assert.equal(withEmail.data?.publicId, "ILL26-ABCDEF");
  assert.equal(withEmail.data?.email, "student@example.com");

  const withPhone = ParticipantRecoveryRequestSchema.safeParse({ publicId: "ill26-abcdef", phone: "+91 98765 43210" });
  assert.equal(withPhone.success, true);
  assert.equal(withPhone.data?.publicId, "ILL26-ABCDEF");
  assert.equal(withPhone.data?.phone, "9876543210");

  assert.equal(ParticipantRecoveryRequestSchema.safeParse({ publicId: "ILL26-ABCDEF" }).success, false);
  assert.equal(ParticipantRecoveryRequestSchema.safeParse({ publicId: "WRONG-123", email: "a@b.com" }).success, false);
  assert.equal(ParticipantRecoveryRequestSchema.safeParse({ publicId: "ILL26-ABCDEF", email: "not-an-email" }).success, false);
});

test("rate policy separates shared-IP burst guard from per-participant quota", () => {
  // 500+ classmates behind college NAT must not share a tiny bucket.
  assert.ok(REGISTRATION_CREATE_IP_LIMIT >= 100, `IP burst ${REGISTRATION_CREATE_IP_LIMIT} too low for NAT scale`);
  assert.ok(REGISTRATION_CREATE_IDENTITY_LIMIT <= 10, "identity quota must stay strict");
  assert.ok(REGISTRATION_CREATE_IP_LIMIT > REGISTRATION_CREATE_IDENTITY_LIMIT * 10, "IP guard must be an order of magnitude above identity quota");
  assert.ok(RECOVERY_IP_LIMIT >= 15 && RECOVERY_IDENTITY_LIMIT <= 10, "recovery must be brute-force resistant but usable");
});

test("registration route uses dual-bucket limits with Retry-After, not a single shared bucket", () => {
  const route = readFileSync(new URL("../src/app/api/payment/registrations/route.ts", import.meta.url), "utf8");
  const limits = readFileSync(new URL("../src/lib/rate-limit.ts", import.meta.url), "utf8");
  const http = readFileSync(new URL("../src/lib/http.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /pending-registration", clientIp/);
  assert.match(route, /pending-registration-ip/);
  assert.match(route, /enforceRegistrationCreationRateLimit/);
  assert.match(limits, /pending-registration-per-email/);
  assert.match(limits, /pending-registration-per-phone/);
  assert.match(route, /retryAfterSeconds/);
  assert.match(http, /Retry-After/);
});

test("recovery endpoint re-issues only on ID + contact match with generic 404", () => {
  const route = readFileSync(new URL("../src/app/api/payment/recover/route.ts", import.meta.url), "utf8");
  assert.match(route, /enforceRecoveryRateLimit/);
  assert.match(route, /LOGIN_NOT_FOUND/);
  assert.match(route, /generateParticipantAccessToken\(registration\.publicId\)/);
  assert.match(route, /normalizedEmail === email/);
  assert.match(route, /normalizedPhone === phone/);
});

test("login UI exists on both /login and /registration/recover", () => {
  const login = readFileSync(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
  const recover = readFileSync(new URL("../src/app/registration/recover/page.tsx", import.meta.url), "utf8");
  const component = readFileSync(new URL("../src/components/registration/ParticipantLogin.tsx", import.meta.url), "utf8");
  assert.match(login, /ParticipantLogin/);
  assert.match(recover, /ParticipantLogin/);
  assert.match(component, /\/api\/payment\/recover/);
  assert.match(component, /ILL26-ABCDEF/);
});
