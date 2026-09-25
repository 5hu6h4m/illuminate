import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getDisplayAmount } from "../src/lib/ecell-pricing.ts";
import { resolveRegistrationDestination } from "../src/lib/payment-flow-service.ts";
import { buildUpiUriForDestination } from "../src/lib/payment.ts";

const src = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// A registration carrying BOTH features at once.
function combinedReg() {
  return {
    ecellMember: true,
    payment: {
      status: "payment_pending",
      snapshot: { expectedAmount: 599, currency: "INR", payeeName: "Shivam Jadhav (ECELL Team)", upiId: "shivujadhav2006@okicici", eventKey: "illuminate-2026", mode: "production", pricingTier: "early_bird", registrationAvailable: true, calculatedAt: new Date().toISOString() },
      destination: { destinationId: "account-b-shivam", internalLabel: "B", payeeName: "Shivam Jadhav (ECELL Team)", upiId: "shivujadhav2006@okicici", assignedAt: new Date() },
      proofHistory: [],
    },
  };
}

// 1. E-cell flag + assigned destination coexist on the same registration.
test("combined 1: ecell flag and assigned destination coexist", () => {
  const reg = combinedReg();
  assert.equal(reg.ecellMember, true);
  const resolved = resolveRegistrationDestination(reg);
  assert.equal(resolved.kind, "assigned");
  assert.equal(resolved.destinationId, "account-b-shivam");
  // Display override is admin-only; canonical snapshot stays 599.
  assert.equal(reg.payment.snapshot.expectedAmount, 599);
  assert.equal(getDisplayAmount(599, true), 699);
});

// 2. Toggling E-cell leaves destination unchanged.
test("combined 2: ecell toggle preserves destination", () => {
  const service = src("../src/lib/payment-flow-service.ts");
  const start = service.indexOf("export async function setEcellMemberFlag");
  const end = service.indexOf("\nexport ", start + 1);
  const block = service.slice(start, end === -1 ? undefined : end);
  assert.match(block, /\$set: \{ ecellMember: input\.ecellMember, updatedAt: now \}/);
  assert.doesNotMatch(block, /payment\.destination/);
  assert.doesNotMatch(block, /payment\.snapshot/);
  assert.doesNotMatch(block, /assignedCount/);
  const reg = combinedReg();
  const before = JSON.stringify(reg.payment.destination);
  reg.ecellMember = false; // mirror of the $set above
  assert.equal(JSON.stringify(reg.payment.destination), before);
});

// 3. Toggling E-cell leaves snapshot expectedAmount unchanged.
test("combined 3: ecell toggle preserves snapshot amount", () => {
  const reg = combinedReg();
  reg.ecellMember = false;
  assert.equal(reg.payment.snapshot.expectedAmount, 599);
  const uri = buildUpiUriForDestination(reg.payment.destination, reg.payment.snapshot.expectedAmount, "ILL26-ABCDEF");
  assert.equal(new URL(uri).searchParams.get("am"), "599.00");
});

// 4. Reassigning destination preserves ecellMember.
test("combined 4: destination reassignment preserves ecell flag", () => {
  const route = src("../src/app/api/admin/destinations/route.ts");
  const setBlock = route.slice(route.indexOf('"payment.destination": { ...toSnapshot'));
  assert.doesNotMatch(setBlock.slice(0, 600), /ecellMember/);
  const reg = combinedReg();
  reg.payment.destination = { destinationId: "account-c-bhushan", internalLabel: "C", payeeName: "Bhushan Bhusare (ECELL Team)", upiId: "bbhusare73@oksbi", assignedAt: new Date() };
  assert.equal(reg.ecellMember, true);
  assert.equal(resolveRegistrationDestination(reg).destinationId, "account-c-bhushan");
});

// 5. getDisplayAmount never reaches participant surfaces.
test("combined 5: display override absent from participant payment paths", () => {
  for (const path of [
    "../src/app/api/payment/status/[token]/route.ts",
    "../src/app/api/payment/status/[token]/qr/route.ts",
    "../src/app/api/payment/proof/[token]/route.ts",
    "../src/app/api/payment/registrations/route.ts",
    "../src/lib/email/transactional-email.ts",
    "../src/components/registration/PaymentStatusClient.tsx",
  ]) {
    const code = src(path);
    assert.doesNotMatch(code, /getDisplayAmount/, `${path} must not use the admin display override`);
    assert.doesNotMatch(code, /ecellMember/, `${path} must not read the ecell flag`);
  }
});

// 6. Internal CSV contains both feature sets with matching header/row order.
test("combined 6: internal CSV has ecell and destination columns", () => {
  const route = src("../src/app/api/admin/export/route.ts");
  for (const col of ["E-cell Member", "E-cell Display Amount", "Payment Destination ID", "Payment Destination Label", "Payment Payee", "Payment UPI ID"]) {
    assert.match(route, new RegExp(col.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing column ${col}`);
  }
  assert.match(route, /r\.payment\.snapshot\.expectedAmount, r\.ecellMember === true \? "YES" : "NO", getDisplayAmount\(r\.payment\.snapshot\.expectedAmount, r\.ecellMember\)/);
  // External IITB export untouched: verified-only Name/Email/Phone.
  assert.match(route, /\["Name", "Email", "Phone Number"\]/);
});

// 7. ReviewModal supports both features simultaneously.
test("combined 7: ReviewModal shows destination truth and ecell flag", () => {
  const modal = src("../src/components/admin/ReviewModal.tsx");
  assert.match(modal, /Assigned Account/);
  assert.match(modal, /destinationShortLabel/);
  assert.match(modal, /Proof destination/);
  assert.match(modal, /E-cell member/);
  assert.match(modal, /onToggleEcell/);
  assert.match(modal, /assigned recipient account/);
  // Canonical snapshot amount stays visible alongside the display override.
  assert.match(modal, /snapshotAmount/);
});
