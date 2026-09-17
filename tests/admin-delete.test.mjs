import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../src/app/api/admin/registrations/[publicId]/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");
const schemas = readFileSync(new URL("../src/lib/registration-v2.ts", import.meta.url), "utf8");

// The verified-delete dialog lives in src/components/admin/* once extracted;
// fall back to the admin page source while it is still inline there.
let dialog = "";
try {
  const dir = new URL("../src/components/admin/", import.meta.url);
  for (const entry of readdirSync(dir)) {
    if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      dialog += readFileSync(new URL(`../src/components/admin/${entry}`, import.meta.url), "utf8") + "\n";
    }
  }
} catch {
  // Dialog not extracted yet — the page source carries the delete UI.
}
const frontend = `${page}\n${dialog}\n${(() => {
  try {
    return readFileSync(new URL("../src/hooks/admin/useDashboard.ts", import.meta.url), "utf8");
  } catch {
    return "";
  }
})()}`;

test("admin DELETE endpoint requires auth, validates ID, and audits", () => {
  assert.match(route, /export async function DELETE/);
  assert.match(route, /isSameOrigin/);
  assert.match(route, /isAdminAuthenticated/);
  assert.match(route, /enforceAdminDeleteRateLimit/);
  assert.match(route, /429/);
  assert.match(route, /\^ILL26-\[A-Z0-9\]\{6\}\$/);
  assert.match(route, /admin_registration_deleted_verified/);
  assert.match(route, /admin_audit/);
});

test("admin verified hard-delete requires type-to-confirm ID, reason 10..500, and password re-entry", () => {
  assert.match(route, /confirmPublicId/);
  assert.match(route, /AdminDeleteSchema/);
  assert.match(schemas, /confirmPublicId/);
  assert.match(schemas, /reason: z\.string\(\)\.trim\(\)\.min\(10\)\.max\(500\)/);
  assert.match(route, /10-500/);
  assert.match(route, /verifyAdminPassword/);
  assert.match(route, /parsed\.data\.password/);
  assert.match(route, /Confirmation ID does not match/);
});

test("admin verified hard-delete no longer blocks money-involved records", () => {
  assert.doesNotMatch(route, /DELETE_NOT_ALLOWED/);
  assert.doesNotMatch(route, /preserved for audit/);
});

test("admin DELETE removes uploaded proofs and the record with an atomic guard", () => {
  assert.match(route, /getPaymentProofBucket/);
  assert.match(route, /proofHistory/);
  assert.match(route, /currentProofId/);
  assert.match(route, /findOneAndDelete\(\{ _id: existing\._id, schemaVersion: 2, publicId \}\)/);
  assert.match(route, /snapshot/);
  assert.match(route, /reason: parsed\.data\.reason/);
});

test("admin review modal has a verified-delete dialog (type ID + reason + password + export)", () => {
  assert.match(frontend, /DeleteVerifiedDialog/);
  assert.match(frontend, /Danger zone/);
  assert.match(frontend, /confirmPublicId/);
  assert.match(frontend, /<textarea/);
  assert.match(frontend, /maxLength/);
  assert.match(frontend, /type="password"/);
  assert.match(frontend, /export/i);
  assert.match(frontend, /method: "DELETE"/);
  assert.match(frontend, /JSON\.stringify/);
});
