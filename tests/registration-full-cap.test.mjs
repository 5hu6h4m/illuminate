import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EVENT_REGISTRATION_FULL_CODE,
  EVENT_REGISTRATION_FULL_MESSAGE,
  EVENT_VERIFIED_SEAT_LIMIT,
} from "../src/lib/payment-destinations.ts";

const route = readFileSync(new URL("../src/app/api/payment/registrations/route.ts", import.meta.url), "utf8");
const wizard = readFileSync(new URL("../src/components/registration/RegistrationWizard.tsx", import.meta.url), "utf8");

test("event seat cap is 90 verified with a thankful closed message", () => {
  assert.equal(EVENT_VERIFIED_SEAT_LIMIT, 90);
  assert.equal(EVENT_REGISTRATION_FULL_CODE, "EVENT_REGISTRATION_FULL");
  assert.match(EVENT_REGISTRATION_FULL_MESSAGE, /Thank you/i);
  assert.match(EVENT_REGISTRATION_FULL_MESSAGE, /90 seats/);
  assert.match(EVENT_REGISTRATION_FULL_MESSAGE, /registrations are closed/i);
});

test("registration route gates new production seats on claimed count", () => {
  assert.match(route, /EVENT_VERIFIED_SEAT_LIMIT/);
  assert.match(route, /EVENT_REGISTRATION_FULL_CODE/);
  assert.match(route, /\$in: \["verified", "submitted_for_verification"\]/);
  // Existing holders resolve before the gate: idempotent replay and identity
  // duplicates come first, the claimed-count check just before slot claim.
  const replayIndex = route.indexOf("existingRequest");
  const dupIndex = route.indexOf("const duplicate = await findIdentityDuplicate()");
  const gateIndex = route.indexOf("claimedCount >= EVENT_VERIFIED_SEAT_LIMIT");
  const claimIndex = route.indexOf("await claimNextDestinationSlot");
  assert.ok(replayIndex !== -1 && dupIndex !== -1 && gateIndex !== -1 && claimIndex !== -1);
  assert.ok(replayIndex < gateIndex, "replay must resolve before the seat-cap gate");
  assert.ok(dupIndex < gateIndex, "duplicates must resolve before the seat-cap gate");
  assert.ok(gateIndex < claimIndex, "seat-cap gate must run before consuming a slot");
  assert.match(route, /event_registration_full/);
});

test("wizard maps the full code to a thankful message and a popup dialog", () => {
  assert.match(wizard, /EVENT_REGISTRATION_FULL/);
  assert.match(wizard, /Thank you so much for your interest in Illuminate 2026/);
  assert.match(wizard, /RegistrationClosedDialog/);
  assert.match(wizard, /variant="full"/);
  const dialog = readFileSync(new URL("../src/components/landing/RegistrationClosedDialog.tsx", import.meta.url), "utf8");
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /Registrations are full/);
  assert.match(dialog, /Log in to your registration/);
  assert.match(dialog, /Escape/);
});
