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

test("event seat cap is 120 verified with a thankful closed message", () => {
  assert.equal(EVENT_VERIFIED_SEAT_LIMIT, 120);
  assert.equal(EVENT_REGISTRATION_FULL_CODE, "EVENT_REGISTRATION_FULL");
  assert.match(EVENT_REGISTRATION_FULL_MESSAGE, /Thank you/i);
  assert.match(EVENT_REGISTRATION_FULL_MESSAGE, /120 seats/);
  assert.match(EVENT_REGISTRATION_FULL_MESSAGE, /registrations are closed/i);
});

test("registration route gates new production drafts on claimed count", () => {
  assert.match(route, /EVENT_VERIFIED_SEAT_LIMIT/);
  assert.match(route, /EVENT_REGISTRATION_FULL_CODE/);
  assert.match(route, /\$in: \["verified", "submitted_for_verification"\]/);
  // Existing holders resolve before the gate: idempotent replay and identity
  // duplicates come first, the claimed-count precheck just before the draft
  // insert. Creation claims nothing — the hard gate lives in Generate QR.
  const replayIndex = route.indexOf("existingRequest");
  const dupIndex = route.indexOf("const duplicate = await findIdentityDuplicate()");
  const gateIndex = route.indexOf("claimedCount >= EVENT_VERIFIED_SEAT_LIMIT");
  // First insert at/after the gate: the dev-preview branch above inserts
  // earlier and bypasses production gates by design.
  const insertIndex = route.indexOf("await collection.insertOne", gateIndex);
  assert.ok(replayIndex !== -1 && dupIndex !== -1 && gateIndex !== -1 && insertIndex !== -1);
  assert.ok(replayIndex < gateIndex, "replay must resolve before the seat-cap gate");
  assert.ok(dupIndex < gateIndex, "duplicates must resolve before the seat-cap gate");
  assert.ok(gateIndex < insertIndex, "seat-cap precheck must run before the draft insert");
  assert.doesNotMatch(route, /claimNextDestinationSlot/);
  assert.match(route, /event_registration_full/);
});

test("generate service claims slot outside, seat+attach inside one transaction", () => {
  const service = readFileSync(new URL("../src/lib/payment-flow-service.ts", import.meta.url), "utf8");
  assert.match(service, /generateFirstPaymentQR/);
  assert.match(service, /runTransaction/);
  assert.match(service, /await claimEventSeat/);
  assert.match(service, /await claimNextDestinationSlot/);
  const slotIndex = service.indexOf("const slot = await claimNextDestinationSlot");
  const txnIndex = service.indexOf("input.runTransaction(async");
  const seatIndex = service.indexOf("await claimEventSeat");
  assert.ok(slotIndex !== -1 && txnIndex !== -1 && seatIndex !== -1);
  assert.ok(slotIndex < txnIndex, "destination slot claimed outside the transaction (burst-correct real-time write)");
  assert.ok(txnIndex < seatIndex, "seat claimed inside the transaction");
  // Same-token losers resolve idempotently via the conditional attach.
  assert.match(service, /payment\.destination": \{ \$exists: false \}/);
  assert.match(service, /QR_ATTACH_CONFLICT/);
  // Unused outside claims are compensated on every abort path.
  assert.match(service, /releaseDestinationSlot\(input\.store\.destinations/);
  // No weak fallback: transactions are required for the seat+attach step.
  assert.match(service, /No read-then-write/);
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
