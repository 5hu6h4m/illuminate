import { createHash, randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { ensurePaymentIndexes, getDb, getRegistrationsCollection } from "@/lib/mongodb";
import { getDevelopmentPreviewSnapshot, generateParticipantAccessToken, generatePublicRegistrationId, hashParticipantAccessToken, isDevE2EPreviewEnabled } from "@/lib/payment";
import { getPublicStatusForParticipantToken, PaymentFlowError, rejectPaymentForReview, submitPaymentProofForParticipant, verifyPaymentForReview } from "@/lib/payment-flow-service";
import { realRegistrationFilter } from "@/lib/registration-filters";
import type { RegistrationV2 } from "@/lib/registration-v2";

const publicReason = "Screenshot unclear — please upload a clearer proof.";
const privateNote = "Development QA private note — never participant-visible.";
const fixturePng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlKt0sAAAAASUVORK5CYII=", "base64");
const createdPublicIds: string[] = [];
let activeStep = "development safety";

function pass(message: string) { console.log(`[PASS] ${message}`); }
function requireCondition(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function uniquePhone() { return `9${randomBytes(6).readUIntBE(0, 6).toString().slice(-9).padStart(9, "0")}`; }
function auditIncludes(registration: RegistrationV2, type: string) { return registration.audit.some((event) => event.type === type); }

async function createSyntheticRegistration(runId: string, suffix: string) {
  const snapshot = getDevelopmentPreviewSnapshot();
  requireCondition(snapshot?.mode === "development_preview", "Development payment snapshot is unavailable.");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const publicId = generatePublicRegistrationId();
    const token = generateParticipantAccessToken(publicId);
    requireCondition(token, "Participant token secret is unavailable.");
    const now = new Date();
    const phone = uniquePhone();
    const registration: RegistrationV2 = {
    schemaVersion: 2,
    eventKey: snapshot.eventKey,
      publicId,
    environment: "development",
    isTest: true,
    participantAccessTokenHash: hashParticipantAccessToken(token),
    participant: {
      fullName: "Illuminate E2E Test",
      email: `e2e-${runId}-${suffix}@example.invalid`,
      normalizedEmail: `e2e-${runId}-${suffix}@example.invalid`,
      phone,
      normalizedPhone: phone,
    },
    payment: { snapshot, status: "payment_pending", proofHistory: [] },
    idempotencyKeyHash: createHash("sha256").update(`${runId}:${suffix}:${randomBytes(16).toString("base64url")}`).digest("hex"),
    audit: [{ type: "registration_created", actor: "system", at: now, metadata: { qaRun: true } }],
    createdAt: now,
    updatedAt: now,
    };
    try {
      await (await getRegistrationsCollection()).insertOne(registration);
      createdPublicIds.push(publicId);
      return { registration, token };
    } catch (error) {
      if ((error as { code?: number }).code !== 11000 || attempt === 3) throw error;
    }
  }
  throw new Error("Could not create a unique synthetic registration.");
}

async function cleanup() {
  if (!createdPublicIds.length) return;
  const registrations = await getRegistrationsCollection();
  const records = await registrations.find({ schemaVersion: 2, isTest: true, environment: "development", publicId: { $in: createdPublicIds } }, { projection: { "payment.proofHistory.fileId": 1 } }).toArray();
  const proofIds = records.flatMap((record) => record.payment.proofHistory.map((proof) => proof.fileId)).filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  const db = await getDb();
  if (proofIds.length) {
    await db.collection("payment_proofs.chunks").deleteMany({ files_id: { $in: proofIds } });
    await db.collection("payment_proofs.files").deleteMany({ _id: { $in: proofIds } });
  }
  const deleted = await registrations.deleteMany({ schemaVersion: 2, isTest: true, environment: "development", publicId: { $in: createdPublicIds } });
  requireCondition(deleted.deletedCount === createdPublicIds.length, "Cleanup ownership check failed.");
  pass("Test data cleaned up");
}

async function run() {
  requireCondition(process.env.NODE_ENV !== "production" && isDevE2EPreviewEnabled(), "This QA command requires non-production development E2E preview mode.");
  requireCondition(fixturePng.length > 8, "QA image fixture is unavailable.");
  await ensurePaymentIndexes();
  pass("Database connected");

  const runId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  activeStep = "test registration creation";
  const first = await createSyntheticRegistration(runId, "primary");
  requireCondition(first.registration.schemaVersion === 2 && first.registration.isTest && first.registration.environment === "development", "Synthetic record was not development test data.");
  requireCondition(first.registration.payment.status === "payment_pending" && first.registration.payment.snapshot.expectedAmount === null && first.registration.payment.snapshot.mode === "development_preview", "Pending test snapshot is not non-payable.");
  requireCondition(Boolean(first.registration.publicId && first.registration.participantAccessTokenHash), "Secure registration identity is missing.");
  pass("Test registration created");

  const firstReference = `DEV-E2E-${runId.replace(/[^A-Z0-9]/gi, "").slice(-24)}`;
  const normalizedFirstReference = firstReference.toUpperCase();
  activeStep = "proof submission";
  const submitted = await submitPaymentProofForParticipant({ token: first.token, transactionReference: firstReference.toLowerCase(), proof: { bytes: fixturePng, contentType: "image/png" } });
  activeStep = "proof submission response";
  requireCondition(submitted.payment.status === "submitted_for_verification", "Proof submission state was not persisted.");
  activeStep = "transaction reference normalization";
  requireCondition(submitted.payment.transactionReference === normalizedFirstReference, "Transaction reference was not normalized.");
  activeStep = "proof reference persistence";
  requireCondition(Boolean(submitted.payment.currentProofId), "Proof reference was not persisted.");
  activeStep = "proof submission audit";
  requireCondition(auditIncludes(submitted, "payment_proof_submitted"), "Proof-submitted audit event is missing.");
  activeStep = "private proof storage check";
  requireCondition(await (await getDb()).collection("payment_proofs.files").findOne({ _id: new ObjectId(submitted.payment.currentProofId) }), "Proof was not stored privately in GridFS.");
  pass("Proof submitted");

  activeStep = "rejection";
  const rejected = await rejectPaymentForReview({ publicId: submitted.publicId, publicReason, privateNote });
  requireCondition(rejected?.payment.status === "rejected" && rejected.payment.rejectedAt && rejected.payment.publicRejectionReason === publicReason, "Rejection was not persisted.");
  requireCondition(rejected.payment.privateAdminNote === privateNote && auditIncludes(rejected, "payment_rejected"), "Rejection fields or audit event are incorrect.");
  pass("Rejection persisted");

  activeStep = "participant rejection status";
  const rejectedStatus = await getPublicStatusForParticipantToken(first.token);
  requireCondition(rejectedStatus?.paymentStatus === "rejected" && rejectedStatus.rejectionReason === publicReason, "Participant rejection state is incorrect.");
  requireCondition(!("privateAdminNote" in rejectedStatus) && !("_id" in rejectedStatus) && !("currentProofId" in rejectedStatus) && !("participantAccessTokenHash" in rejectedStatus), "Participant status leaked private data.");
  pass("Participant rejection state safe");

  const originalProofId = rejected.payment.currentProofId;
  activeStep = "resubmission";
  const resubmitted = await submitPaymentProofForParticipant({ token: first.token, transactionReference: `${firstReference}-R`, proof: { bytes: fixturePng, contentType: "image/png" } });
  requireCondition(resubmitted.payment.status === "submitted_for_verification" && resubmitted.payment.currentProofId !== originalProofId && resubmitted.payment.proofHistory.length === 2, "Resubmission did not preserve proof history.");
  requireCondition(auditIncludes(resubmitted, "payment_proof_resubmitted"), "Resubmission audit event is missing.");
  pass("Resubmission persisted");

  activeStep = "simulated verification";
  const verified = await verifyPaymentForReview({ publicId: resubmitted.publicId, simulatedDevelopmentPayment: true });
  requireCondition(verified?.payment.status === "verified" && verified.payment.verifiedAt && auditIncludes(verified, "payment_verified"), "Simulated verification was not persisted.");
  const verifiedStatus = await getPublicStatusForParticipantToken(first.token);
  requireCondition(verifiedStatus?.isTest && verifiedStatus.paymentStatus === "verified", "Participant status did not reflect simulated verification.");
  pass("Simulated verification persisted");

  activeStep = "real/test isolation";
  const realMatch = { ...realRegistrationFilter, publicId: verified.publicId };
  requireCondition(await (await getRegistrationsCollection()).countDocuments(realMatch) === 0, "Test registration entered real metrics scope.");
  requireCondition(await (await getRegistrationsCollection()).countDocuments({ ...realRegistrationFilter, "payment.status": "verified", publicId: verified.publicId }) === 0, "Test registration entered verified export scope.");
  pass("Test record excluded from real metrics and exports");

  activeStep = "duplicate transaction test registration creation";
  const second = await createSyntheticRegistration(runId, "duplicate-reference");
  activeStep = "duplicate transaction reference proof submission";
  let duplicateBlocked = false;
  try {
    await submitPaymentProofForParticipant({ token: second.token, transactionReference: `${firstReference}-R`, proof: { bytes: fixturePng, contentType: "image/png" } });
  } catch (error) {
    duplicateBlocked = error instanceof PaymentFlowError && error.code === "TRANSACTION_REFERENCE_ALREADY_USED";
  }
  requireCondition(duplicateBlocked, "Duplicate transaction reference was accepted.");
  pass("Duplicate transaction reference blocked");

  activeStep = "invalid transitions";
  let verifiedResubmitBlocked = false;
  try { await submitPaymentProofForParticipant({ token: first.token, transactionReference: `${firstReference}-FINAL`, proof: { bytes: fixturePng, contentType: "image/png" } }); } catch (error) { verifiedResubmitBlocked = error instanceof PaymentFlowError && error.code === "INVALID_STATE_TRANSITION"; }
  requireCondition(verifiedResubmitBlocked, "Verified registration accepted a new proof.");
  requireCondition(await rejectPaymentForReview({ publicId: verified.publicId, publicReason }) === null, "Verified registration was rejected through normal flow.");
  requireCondition(await verifyPaymentForReview({ publicId: second.registration.publicId, simulatedDevelopmentPayment: true }) === null, "Pending registration was verified without proof.");
  pass("Invalid state transitions blocked");
}

console.log("Illuminate Payment E2E QA\n");
let failed = false;
let failureCategory = "unexpected failure";
try {
  await run();
} catch (error) {
  failed = true;
  const errorCode = (error as { code?: unknown } | null)?.code;
  failureCategory = error instanceof PaymentFlowError ? error.code : error instanceof Error ? `${error.name}${typeof errorCode === "number" ? `:${errorCode}` : ""}` : "unknown failure";
  console.error(`\n[FAIL] ${activeStep} (${failureCategory})`);
} finally {
  try {
    await cleanup();
  } catch {
    failed = true;
    console.error("[FAIL] test data cleanup");
  }
}
console.log(`\nRESULT: ${failed ? "FAIL" : "PASS"}`);
// This is a standalone development CLI. Explicitly exit only after the
// awaited cleanup above so the shared Mongo client cannot keep QA runners open.
process.exit(failed ? 1 : 0);
