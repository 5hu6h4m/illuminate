import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const { resolveRegistrationDestination } = await import("../src/lib/payment-flow-service.ts");
const {
  destinationShortLabel,
  isClaimableDestination,
  paymentAccountLabel,
  paymentStageLabel,
  registrationTypeLabel,
} = await import("../src/components/admin/types.ts");

const src = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const client = () => src("../src/components/registration/PaymentStatusClient.tsx");

function draftPayment() {
  return {
    status: "payment_pending",
    snapshot: {
      expectedAmount: 699,
      currency: "INR",
      payeeName: "Yash Patil",
      upiId: "yashpatil76317@okicici",
      eventKey: "illuminate-2026",
      mode: "production",
      pricingTier: "regular",
      registrationAvailable: true,
      calculatedAt: new Date().toISOString(),
    },
    pendingQRGeneration: true,
    proofHistory: [],
  };
}

// --- §21.1 draft exposes no payment instructions ------------------------------
test("P1. draft resolves without destination or instructions state", () => {
  assert.equal(resolveRegistrationDestination({ payment: draftPayment() }).kind, "draft");
  const flow = src("../src/lib/payment-flow-service.ts");
  // Drafts resolve distinctly; the status builder maps them to null
  // destination/instructions (no QR data for unissued rows).
  assert.match(flow, /\| \{ kind: "draft" \}/);
});

// --- §21.2 draft presents Generate Payment QR ----------------------------------
test("P2. draft page presents Generate Payment QR with type + amount", () => {
  const code = client();
  assert.match(code, /Generate Payment QR/);
  assert.match(code, /Ready to make your payment\?/);
  assert.match(code, /Registration type/);
  assert.match(code, /Your payment account has not been assigned yet/);
  assert.match(code, /Generate your QR only when you are ready/);
  assert.match(code, /Once generated, that payment account is assigned/);
  assert.match(code, /canGeneratePaymentQr/);
});

// --- §21.3 + §6 no QR render/fetch for drafts ------------------------------------
test("P3. QR image sits strictly behind the assigned gate; no auto-Generate", () => {
  const code = client();
  const gateIndex = code.indexOf("data.hasPaymentDestination && instructions && <div");
  const qrImageIndex = code.indexOf("/qr`}");
  assert.ok(gateIndex !== -1 && qrImageIndex !== -1 && gateIndex < qrImageIndex, "qr image reference must follow the assigned gate");
  // Exactly one Generate-QR request site: the explicit click handler.
  assert.equal((code.match(/\/api\/payment\/qr\//g) ?? []).length, 1);
  assert.equal((code.match(/void generate\(\)/g) ?? []).length, 1);
  assert.match(code, /method: "POST"/);
});

// --- §21.4 Generate only after explicit action ------------------------------------
test("P4. Generate POSTs explicitly, then reloads canonical status", () => {
  const code = client();
  assert.match(code, /onClick=\{\(\) => void generate\(\)\}/);
  assert.match(code, /await load\(\);/);
  assert.doesNotMatch(code, /\/api\/payment\/registrations/);
});

// --- §21.5 success transitions to assigned state -----------------------------------
test("P5. assigned payment state keeps amount/payee/UPI/QR/proof UI", () => {
  const code = client();
  assert.match(code, /UPI QR for/);
  assert.match(code, /Copy UPI ID/);
  assert.match(code, /Submit for verification/);
  assert.match(code, /displayPricingTier\(data\.pricingTier\)/);
  assert.doesNotMatch(code, /tierLabel/);
});

// --- §21.6 double-click guard (backend authoritative) -------------------------------
test("P6. button disables while generating", () => {
  const code = client();
  assert.match(code, /if \(generating\) return;/);
  assert.match(code, /disabled=\{generating\}/);
  assert.match(code, /Generating your payment QR/);
  assert.match(code, /aria-live="polite"/);
});

// --- §21.7 backend idempotency authoritative ------------------------------------------
test("P7. backend owns idempotency; endpoint returns the flag", () => {
  const route = src("../src/app/api/payment/qr/[token]/route.ts");
  assert.match(route, /generateFirstPaymentQR/);
  assert.match(route, /idempotent/);
  const flow = src("../src/lib/payment-flow-service.ts");
  assert.match(flow, /QR_ATTACH_CONFLICT/);
});

// --- §21.8/9 refresh consumes nothing ---------------------------------------------------
test("P8. status and QR reads never claim capacity", () => {
  const statusRoute = src("../src/app/api/payment/status/[token]/route.ts");
  assert.doesNotMatch(statusRoute, /claimNextDestinationSlot/);
  assert.doesNotMatch(statusRoute, /claimEventSeat/);
  assert.doesNotMatch(statusRoute, /generateFirstPaymentQR/);
  const qrRoute = src("../src/app/api/payment/status/[token]/qr/route.ts");
  assert.doesNotMatch(qrRoute, /claimNextDestinationSlot/);
  assert.doesNotMatch(qrRoute, /claimEventSeat/);
  assert.match(qrRoute, /PAYMENT_QR_NOT_GENERATED/);
});

// --- §21.10 proof guard copy ---------------------------------------------------------------
test("P9. proof-without-QR maps to actionable copy", () => {
  const flow = src("../src/lib/payment-flow-service.ts");
  assert.match(flow, /Generate your payment QR before submitting payment proof/);
  // The participant submit path surfaces server messages verbatim.
  assert.match(client(), /json\?\.error\?\.message/);
});

// --- §21.11/12/13 error copy -------------------------------------------------------------------
test("P10. full/closed/capacity errors map to participant copy", () => {
  const code = client();
  assert.match(code, /Illuminate registrations are full\. No new payment QR can be issued\./);
  assert.match(code, /New payment QR generation is currently closed\. If you already generated a QR, you can continue using it\./);
  assert.match(code, /Payment capacity is currently full\. Please contact the E-Cell MET team\./);
});

// --- §21.14 temporary-unavailable copy --------------------------------------------------------------
test("P11. uninitialized/transaction failures map to retry copy", () => {
  const code = client();
  assert.match(code, /EVENT_CAPACITY_NOT_INITIALIZED/);
  assert.match(code, /TRANSACTION_UNSUPPORTED/);
  assert.match(code, /Payment QR generation is temporarily unavailable\. Please try again shortly\./);
  assert.match(code, /Too many attempts\. Please wait a moment and try again\./);
});

// --- §22.1/2 tier display -----------------------------------------------------------------------
test("A1. raw tiers display correctly", () => {
  assert.equal(registrationTypeLabel("regular"), "Late Registration");
  assert.equal(registrationTypeLabel("early_bird"), "Early Bird");
  assert.equal(registrationTypeLabel("development_preview"), "Development preview");
  assert.equal(registrationTypeLabel(undefined), "—");
});

// --- §22.3/4 CSV tiers ----------------------------------------------------------------------------
test("A2. internal CSV keeps raw tier and adds display Registration Type", () => {
  const route = src("../src/app/api/admin/export/route.ts");
  assert.match(route, /"Pricing Tier"/);
  assert.match(route, /r\.payment\.snapshot\.pricingTier/);
  assert.match(route, /"Registration Type"/);
  assert.match(route, /registrationTypeCell\(r\.payment\.snapshot\.pricingTier\)/);
  const headerIndex = route.indexOf('"Pricing Tier"');
  const displayIndex = route.indexOf('"Registration Type"');
  assert.ok(headerIndex !== -1 && displayIndex !== -1 && headerIndex < displayIndex, "raw column precedes display column");
});

// --- §22.5/6 stage + account labels ------------------------------------------------------------------
test("A3. drafts are staged distinctly and never Legacy", () => {
  const draft = { payment: { status: "payment_pending" } };
  assert.equal(paymentStageLabel(draft), "Draft — QR not generated");
  assert.equal(paymentAccountLabel(draft), "Not assigned");
  const issued = { payment: { status: "payment_pending", destination: { destinationId: "account-f-priyanka" } } };
  assert.equal(paymentStageLabel(issued), "Payment pending — QR generated");
  assert.equal(paymentAccountLabel(issued), "Account F");
  assert.equal(paymentStageLabel({ payment: { status: "submitted_for_verification" } }), "Awaiting verification");
  assert.equal(paymentStageLabel({ payment: { status: "verified" } }), "Verified");
  assert.equal(paymentStageLabel({ payment: { status: "rejected" } }), "Rejected");
});

// --- §22.7 historical verified without destination ------------------------------------------------------
test("A4. review modal labels historical verified rows as legacy records", () => {
  const modal = src("../src/components/admin/ReviewModal.tsx");
  assert.match(modal, /Registration type/);
  assert.match(modal, /Payment stage/);
  assert.match(modal, /registrationTypeLabel/);
  assert.match(modal, /paymentStageLabel/);
  assert.match(modal, /Not assigned yet/);
  assert.match(modal, /Legacy payment record/);
});

// --- §22.8/9 event capacity API + missing state -----------------------------------------------------------
test("A5. event capacity API reports committed vs reporting counts", () => {
  const route = src("../src/app/api/admin/destinations/route.ts");
  for (const key of ["reportingClaimedCount", "verifiedCount", "awaitingVerificationCount", "qrIssuedPendingCount", "draftWithoutQrCount", "committedCount"]) {
    assert.match(route, new RegExp(key), `missing event-capacity key ${key}`);
  }
  assert.match(route, /payment\.destination\.destinationId": \{ \$exists: true \}/);
  assert.match(route, /payment\.destination\.destinationId": \{ \$exists: false \}/);
  const card = src("../src/components/admin/EventCapacityCard.tsx");
  assert.match(card, /Event capacity not initialized/);
  assert.match(card, /Committed:/);
  assert.match(card, /QR issued \/ payment pending/);
  assert.match(card, /Drafts without QR/);
});

// --- §22.10/11 claimable math -----------------------------------------------------------------------
test("A6. claimable math excludes disabled D and ignores TOTAL-assigned", () => {
  assert.equal(isClaimableDestination({ status: "active", ownerApproved: true, allowNewAssignments: true }), true);
  assert.equal(isClaimableDestination({ status: "available", ownerApproved: true, allowNewAssignments: true }), true);
  assert.equal(isClaimableDestination({ status: "disabled", ownerApproved: true, allowNewAssignments: false }), false);
  assert.equal(isClaimableDestination({ status: "exhausted", ownerApproved: true, allowNewAssignments: false }), false);
  assert.equal(isClaimableDestination({ status: "available", ownerApproved: false, allowNewAssignments: true }), false);
  const route = src("../src/app/api/admin/destinations/route.ts");
  assert.match(route, /claimableRemaining/);
  assert.match(route, /capacityFull: claimableRemaining <= 0/);
  const panel = src("../src/components/admin/CapacityPanel.tsx");
  assert.match(panel, /Claimable:/);
  assert.match(panel, /DISABLED FOR NEW PAYMENTS/);
  assert.match(panel, /Historical D payments remain valid/);
});

// --- §22.12 Priyanka label ------------------------------------------------------------------------------
test("A7. Priyanka labels resolve across admin surfaces", () => {
  assert.equal(destinationShortLabel("account-f-priyanka"), "Account F");
  const types = src("../src/components/admin/types.ts");
  assert.match(types, /account-f-priyanka/);
});

// --- queue + filter wiring ---------------------------------------------------------------------------------
test("A8. queue exposes type/stage/account; filters support QR state", () => {
  const queue = src("../src/components/admin/QueueTable.tsx");
  assert.match(queue, /Registration Type/);
  assert.match(queue, /Payment Stage/);
  assert.match(queue, /Payment Account/);
  assert.match(queue, /registrationTypeLabel/);
  assert.match(queue, /paymentStageLabel/);
  assert.match(queue, /paymentAccountLabel/);
  const filterBar = src("../src/components/admin/FilterBar.tsx");
  assert.match(filterBar, /Draft — QR not generated/);
  const registrationsRoute = src("../src/app/api/admin/registrations/route.ts");
  assert.match(registrationsRoute, /qr === "issued"/);
  assert.match(registrationsRoute, /qr === "draft"/);
  const hook = src("../src/hooks/admin/useDashboard.ts");
  assert.match(hook, /setQr/);
  const page = src("../src/app/admin/page.tsx");
  assert.match(page, /EventCapacityCard/);
  assert.match(page, /onQrChange/);
});

// --- toggle copy ----------------------------------------------------------------------------------------------
test("A9. toggle clarifies drafts/first-QR blocking without touching policy", () => {
  const panel = src("../src/components/admin/RegistrationTogglePanel.tsx");
  assert.match(panel, /first QR generation/);
  assert.match(panel, /existing QR display/);
  const settings = src("../src/app/api/admin/settings/route.ts");
  assert.doesNotMatch(settings, /pendingQRGeneration/);
});

// --- fresh-DB index bootstrap -----------------------------------------------------------------------------------
test("A10. index bootstrap tolerates a missing registrations namespace", () => {
  const mongo = src("../src/lib/mongodb.ts");
  assert.match(mongo, /NamespaceNotFound/);
});
