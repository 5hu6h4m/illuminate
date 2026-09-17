import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../src/app/api/admin/registrations/[publicId]/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");

test("admin DELETE endpoint requires auth, validates ID, and audits", () => {
  assert.match(route, /export async function DELETE/);
  assert.match(route, /isSameOrigin/);
  assert.match(route, /isAdminAuthenticated/);
  assert.match(route, /\^ILL26-\[A-Z0-9\]\{6\}\$/);
  assert.match(route, /admin_registration_deleted/);
  assert.match(route, /admin_audit/);
});

test("admin DELETE protects money-involved records but always allows TEST", () => {
  assert.match(route, /existing\.isTest && existing\.payment\.status !== "payment_pending"|!existing\.isTest && existing\.payment\.status !== "payment_pending"/);
  assert.match(route, /DELETE_NOT_ALLOWED/);
  assert.match(route, /preserved for audit/);
});

test("admin DELETE removes uploaded proofs and the record atomically-guarded", () => {
  assert.match(route, /getPaymentProofBucket/);
  assert.match(route, /proofHistory/);
  assert.match(route, /currentProofId/);
  assert.match(route, /deleteOne\(\{ _id: existing\._id, schemaVersion: 2 \}\)/);
});

test("admin review modal has a confirm-guarded danger zone wired to DELETE", () => {
  assert.match(page, /Trash2/);
  assert.match(page, /Danger zone/);
  assert.match(page, /window\.confirm\(/);
  assert.match(page, /method: "DELETE"/);
  assert.match(page, /onDelete=\{\(\) => void removeSelected\(\)\}/);
  assert.match(page, /Delete \{row\.isTest \? "TEST record" : "registration"\}/);
});
