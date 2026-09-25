import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migrate = () => src("../scripts/migrate-v3-production.mts");
const rollback = () => src("../scripts/rollback-v3-migration.mts");
const verifier = () => src("../scripts/verify-v3-production-readiness.mts");
const eventReconcile = () => src("../scripts/reconcile-event-capacity.mts");

test("migration defaults to read-only dry run", () => {
  const code = migrate();
  assert.match(code, /DEFAULTS TO READ-ONLY DRY RUN|defaults to read-only dry run/i);
  assert.match(code, /DRY RUN ONLY — ZERO WRITES/);
  // Writes are gated behind ALL of --confirm + --reason (+ --production on illuminate).
  assert.match(code, /--confirm/);
  assert.match(code, /--reason/);
  assert.match(code, /--production/);
  assert.match(code, /writes to production illuminate require explicit --production/);
});

test("migration prints database name and host only, never credentials", () => {
  const code = migrate();
  assert.match(code, /database name/);
  assert.match(code, /cluster host/);
  assert.match(code, /safeHost\(uri\)/);
  assert.doesNotMatch(code, /console\.log\(.*MONGODB_URI/);
});

test("migration validates exact baseline before any write", () => {
  const code = migrate();
  assert.match(code, /manualClose/);
  assert.match(code, /census mismatch/);
  assert.match(code, /committed ground truth/);
  assert.match(code, /counter drift/);
  assert.match(code, /unknown destination/);
  assert.match(code, /Priyanka destination already exists/);
  assert.match(code, /capacity is .* expected pre-migration/);
  assert.match(code, /sequence is .* expected pre-migration/);
  assert.match(code, /Priyanka UPI .* already present/);
});

test("migration computes ground truth, never hardcodes the write source", () => {
  const code = migrate();
  assert.match(code, /computeCommittedGroundTruth/);
  assert.doesNotMatch(code, /committedCount: 90[^0-9]/);
  assert.match(code, /ground truth changed inside transaction/);
});

test("migration uses one transaction and verifies after commit", () => {
  const code = migrate();
  assert.match(code, /withTransaction/);
  assert.match(code, /Sneha 4 → 5 FIRST/);
  assert.match(code, /MIGRATION COMPLETE/);
  assert.match(code, /POST-COMMIT VERIFICATION FAILED/);
});

test("migration detects completed runs without writing", () => {
  const code = migrate();
  assert.match(code, /ALREADY MIGRATED — NO WRITES/);
});

test("migration backs up operational docs only, zero participant PII", () => {
  const code = migrate();
  assert.match(code, /backupPath: /);
  assert.match(code, /siteSettings/);
  assert.match(code, /paymentDestinations/);
  assert.doesNotMatch(code, /participant\.email/);
  assert.doesNotMatch(code, /participantAccessTokenHash/);
  assert.doesNotMatch(code, /currentProofId/);
  assert.doesNotMatch(code, /transactionReference/);
});

test("rollback refuses after V3 traffic and restores from backup", () => {
  const code = rollback();
  assert.match(code, /V3 traffic occurred/);
  assert.match(code, /--backup/);
  assert.match(code, /never guessed/);
  assert.match(code, /deleteOne\(\{ destinationId: F_ID/);
  assert.match(code, /ROLLBACK COMPLETE/);
  assert.match(code, /withTransaction/);
});

test("verifier is read-only and covers the readiness contract", () => {
  const code = verifier();
  assert.match(code, /READ-ONLY ONLY/);
  assert.doesNotMatch(code, /insertOne/);
  assert.doesNotMatch(code, /updateOne/);
  assert.doesNotMatch(code, /deleteOne/);
  assert.match(code, /RESULT PASS/);
  assert.match(code, /claimableRemaining 49/);
  assert.match(code, /historical 599\/early_bird snapshots unchanged/);
});

test("event reconciler is dry-run first with strict guards", () => {
  const code = eventReconcile();
  assert.match(code, /DRY RUN — no writes performed/);
  assert.match(code, /--confirm.*--reason/);
  assert.match(code, /exceeds seat limit/);
  assert.match(code, /NO DRIFT/);
  assert.match(code, /--initialize/);
});
