import { createHash } from "crypto";
import type { Filter } from "mongodb";
import { PendingRegistrationRequestSchema, type RegistrationV2 } from "@/lib/registration-v2";
import { ensurePaymentIndexes, getRegistrationsCollection, getPaymentDestinationsCollection, ensurePaymentDestinationIndexes, getDb, isDbConfigured } from "@/lib/mongodb";
import { apiError, clientIp, sensitiveJson } from "@/lib/http";
import { generateParticipantAccessToken, generatePublicRegistrationId, getConfirmedPaymentSnapshot, getDevelopmentPreviewSnapshot, hashParticipantAccessToken } from "@/lib/payment";
import { enforceRateLimit, enforceRegistrationCreationRateLimit, REGISTRATION_CREATE_IP_LIMIT, REGISTRATION_CREATE_IP_WINDOW_MS } from "@/lib/rate-limit";
import { decideExistingIdentityDuplicate, isIdempotentReplayForIdentity } from "@/lib/registration-duplicate-policy";
import { developmentTestRegistrationFilter, realRegistrationFilter } from "@/lib/registration-filters";
import {
  PAYMENT_CAPACITY_FULL_CODE,
  PAYMENT_CAPACITY_FULL_MESSAGE,
  EVENT_REGISTRATION_FULL_CODE,
  EVENT_REGISTRATION_FULL_MESSAGE,
  EVENT_VERIFIED_SEAT_LIMIT,
  buildDestinationSnapshot,
  claimNextDestinationSlot,
  releaseDestinationSlot,
  type PaymentDestination,
} from "@/lib/payment-destinations";

export const runtime = "nodejs";

function isTransactionsUnsupportedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /transaction numbers are only allowed|replica set|sessions are not supported|transaction.*not supported|no longer supports|illegal session/i.test(message);
}

async function recordDestinationAudit(events: Array<{ type: string; metadata?: Record<string, string | number | boolean | null> }>): Promise<void> {
  if (!events.length) return;
  try {
    const db = await getDb();
    const now = new Date();
    await db.collection("admin_audit").insertMany(
      events.map((e) => ({ type: e.type, actor: "system" as const, at: now, metadata: e.metadata ?? {} })),
      { ordered: false },
    );
  } catch {
    // Audit is best-effort; assignment already committed.
  }
}

export async function POST(request: Request) {
  // An explicitly enabled non-production E2E run always uses the isolated,
  // non-payable snapshot. This must win even if a developer temporarily has
  // confirmed payment facts in a local configuration.
  const developmentSnapshot = getDevelopmentPreviewSnapshot();
  const snapshot = developmentSnapshot ?? getConfirmedPaymentSnapshot();
  if (!snapshot) {
    console.error("[registration_diagnostic] PAYMENT_SNAPSHOT_UNAVAILABLE");
    return apiError(503, "PAYMENT_NOT_AVAILABLE", "Payment registration is not available yet.");
  }
  if (!isDbConfigured()) {
    console.error("[registration_diagnostic] REGISTRATION_DB_NOT_CONFIGURED");
    return apiError(503, "REGISTRATION_DB_NOT_CONFIGURED", "Registration is unavailable: server database is not configured. Please contact the organizer (code DB-CONFIG).");
  }
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 200) return apiError(400, "INVALID_IDEMPOTENCY_KEY", "Please retry from the registration form.");
  try {
    const ip = clientIp(request);
    // Shared-IP burst guard runs before parsing so a flooded NAT gateway is
    // shed early. Per-identity quotas run after parsing (see below) so 500+
    // classmates behind one egress IP are never treated as one entity.
    if (ip !== "unknown" && !await enforceRateLimit("pending-registration-ip", ip, REGISTRATION_CREATE_IP_LIMIT, REGISTRATION_CREATE_IP_WINDOW_MS)) {
      console.warn("[registration_diagnostic] REGISTRATION_RATE_LIMITED ip_burst");
      return apiError(429, "RATE_LIMITED", "Too many registration attempts from this network. Please wait a minute and try again.", { retryAfterSeconds: Math.ceil(REGISTRATION_CREATE_IP_WINDOW_MS / 1000) });
    }
    const parsed = PendingRegistrationRequestSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(422, "INVALID_DETAILS", "Please review your registration details.");
    const identityLimit = await enforceRegistrationCreationRateLimit({ ip: "unknown", email: parsed.data.details.email, phone: parsed.data.details.phone });
    if (!identityLimit.ok) {
      console.warn("[registration_diagnostic] REGISTRATION_RATE_LIMITED identity_quota");
      return apiError(429, "RATE_LIMITED", "Too many attempts for these contact details. Please try again later.", { retryAfterSeconds: identityLimit.retryAfterSeconds });
    }

    const tokenSecretCheck = generateParticipantAccessToken("ILL26-ABCDEF");
    if (!tokenSecretCheck) {
      console.error("[registration_diagnostic] PARTICIPANT_TOKEN_SECRET_MISSING");
      return apiError(503, "REGISTRATION_AUTH_NOT_CONFIGURED", "Registration is unavailable: server sign-in secret is missing. Please contact the organizer (code AUTH-CONFIG).");
    }

    try {
      await ensurePaymentIndexes();
      // Destination indexes are required for production assignment only;
      // development-preview registrations never touch destinations.
      if (snapshot.mode === "production") await ensurePaymentDestinationIndexes();
    } catch (error) {
      console.error("[registration_diagnostic] REGISTRATION_INDEX_INIT_FAILED", error);
      return apiError(503, "REGISTRATION_INDEX_INIT_FAILED", "Registration is temporarily unavailable (database setup failed). Please retry in a minute; if it persists contact the organizer (code DB-INDEX).");
    }

    let collection;
    try {
      collection = await getRegistrationsCollection();
    } catch (error) {
      console.error("[registration_diagnostic] REGISTRATION_DB_CONNECTION_FAILED", error);
      return apiError(503, "REGISTRATION_DB_CONNECTION_FAILED", "Registration is temporarily unavailable (cannot reach database). Please retry in a minute (code DB-CONN).");
    }

    const idempotencyKeyHash = createHash("sha256").update(idempotencyKey).digest("hex");
    const details = parsed.data.details;

    // Idempotent replay must NOT consume another payment slot.
    const existingRequest = await collection.findOne({ schemaVersion: 2, eventKey: snapshot.eventKey, idempotencyKeyHash });
    if (existingRequest) {
      // The idempotency key is a high-entropy, client-held capability. Do not
      // let an accidental reuse with different details become a token lookup.
      if (!isIdempotentReplayForIdentity(existingRequest.participant, { normalizedEmail: details.email, normalizedPhone: details.phone })) {
        return apiError(409, "IDEMPOTENCY_KEY_REUSED", "Please refresh the registration form and try again.");
      }
      const token = generateParticipantAccessToken(existingRequest.publicId)!;
      return sensitiveJson({ publicId: existingRequest.publicId, statusUrl: `/registration/status/${token}`, created: false });
    }
    const duplicateFilter: Filter<RegistrationV2> = snapshot.mode === "development_preview"
      ? { ...developmentTestRegistrationFilter, eventKey: snapshot.eventKey }
      : { ...realRegistrationFilter, eventKey: snapshot.eventKey };
    const findIdentityDuplicate = () => collection.findOne(
      { ...duplicateFilter, $or: [{ "participant.normalizedEmail": details.email }, { "participant.normalizedPhone": details.phone }] },
      { projection: { _id: 1, publicId: 1, isTest: 1, environment: 1, "payment.status": 1 } },
    );
    const respondToIdentityDuplicate = (duplicate: RegistrationV2) => {
      const decision = decideExistingIdentityDuplicate(duplicate.payment.status, snapshot.mode);
      if (decision.kind === "resume_test") {
        const token = generateParticipantAccessToken(duplicate.publicId)!;
        return sensitiveJson({ publicId: duplicate.publicId, statusUrl: `/registration/status/${token}`, created: false, resumedTest: true });
      }
      return apiError(409, decision.code, decision.message);
    };
    // Rejected duplicate attempts must NOT consume capacity.
    const duplicate = await findIdentityDuplicate();
    if (duplicate) return respondToIdentityDuplicate(duplicate);

    // Development-preview registrations bypass the destination capacity
    // system entirely and never consume a real payment slot.
    if (snapshot.mode === "development_preview") {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const publicId = generatePublicRegistrationId();
        const token = generateParticipantAccessToken(publicId)!;
        const now = new Date();
        const registration: RegistrationV2 = {
          schemaVersion: 2,
          eventKey: snapshot.eventKey,
          publicId,
          environment: "development",
          isTest: true,
          participantAccessTokenHash: hashParticipantAccessToken(token),
          participant: { fullName: details.fullName, email: details.email, normalizedEmail: details.email, phone: details.phone, normalizedPhone: details.phone, ...(details.college ? { college: details.college } : {}), ...(details.branch ? { branch: details.branch } : {}), ...(details.year ? { year: details.year } : {}) },
          payment: { snapshot, status: "payment_pending", proofHistory: [] },
          idempotencyKeyHash,
          audit: [{ type: "registration_created", actor: "participant", at: now }],
          createdAt: now,
          updatedAt: now,
        };
        try {
          await collection.insertOne(registration);
          return sensitiveJson({ publicId, statusUrl: `/registration/status/${token}`, created: true }, { status: 201 });
        } catch (error: unknown) {
          if ((error as { code?: number }).code !== 11000) {
            console.error("[registration_diagnostic] REGISTRATION_INSERT_FAILED", error);
            throw error;
          }
          const replay = await collection.findOne({ schemaVersion: 2, eventKey: snapshot.eventKey, idempotencyKeyHash });
          if (replay) {
            if (!isIdempotentReplayForIdentity(replay.participant, { normalizedEmail: details.email, normalizedPhone: details.phone })) {
              return apiError(409, "IDEMPOTENCY_KEY_REUSED", "Please refresh the registration form and try again.");
            }
            return sensitiveJson({ publicId: replay.publicId, statusUrl: `/registration/status/${generateParticipantAccessToken(replay.publicId)!}`, created: false });
          }
          const concurrentDuplicate = await findIdentityDuplicate();
          if (concurrentDuplicate) return respondToIdentityDuplicate(concurrentDuplicate);
          if (attempt === 3) return apiError(503, "REGISTRATION_WRITE_FAILED", "Could not create your registration (code DB-WRITE). Please retry.");
        }
      }
      return apiError(500, "SERVER_ERROR", "Could not create your registration. Please retry.");
    }

    // ---- Production path: atomic destination slot reservation ----
    // Event seat cap (soft close): once 90 real seats are verified or
    // awaiting verification (proof submitted, decision pending), new
    // production registrations close with a thankful FULL response.
    // Idempotent replays and identity duplicates resolve above, so existing
    // holders never see this — only genuinely new seats. Awaiting proofs
    // count because they are effectively spoken for and usually verify.
    // Counts move solely via proof submission + human admin review, so no
    // burst race can meaningfully overshoot between this check and the slot
    // claim below. A transient count failure (-1) fails open: the slot
    // system remains the hard cap.
    const claimedCount = await collection.countDocuments({ ...realRegistrationFilter, "payment.status": { $in: ["verified", "submitted_for_verification"] } }).catch(() => -1);
    if (claimedCount >= EVENT_VERIFIED_SEAT_LIMIT) {
      await recordDestinationAudit([{ type: "event_registration_full", metadata: { claimedCount, seatLimit: EVENT_VERIFIED_SEAT_LIMIT } }]);
      return apiError(503, EVENT_REGISTRATION_FULL_CODE, EVENT_REGISTRATION_FULL_MESSAGE);
    }
    let destinations;
    try {
      destinations = await getPaymentDestinationsCollection();
    } catch (error) {
      console.error("[registration_diagnostic] REGISTRATION_DB_CONNECTION_FAILED destinations", error);
      return apiError(503, "REGISTRATION_DB_CONNECTION_FAILED", "Registration is temporarily unavailable (cannot reach database). Please retry in a minute (code DB-CONN).");
    }
    const destinationCount = await destinations.countDocuments({}).catch(() => -1);
    if (destinationCount === 0) {
      console.error("[registration_diagnostic] PAYMENT_DESTINATIONS_NOT_SEEDED");
      return apiError(503, "PAYMENT_NOT_AVAILABLE", "Payment registration is not available yet.");
    }

    // Prefer a MongoDB transaction so the slot reservation and the
    // participant record commit atomically (no leaked slot on write
    // failure, no double-claim on idempotent/duplicate races). Fall back
    // to atomic claim + compensating release where transactions are
    // unavailable (standalone MongoDB).
    const tryTransactionalCreate = async (): Promise<Response | null | "unsupported"> => {
      let clientSession: import("mongodb").ClientSession | null = null;
      try {
        const { getMongoClient } = await import("@/lib/mongodb");
        const client = await getMongoClient();
        clientSession = client.startSession();
      } catch {
        return "unsupported";
      }
      try {
        let outcome: Response | null = null;
        await clientSession.withTransaction(async () => {
          // Re-check idempotency + duplicate inside the transaction.
          const replay = await collection.findOne({ schemaVersion: 2, eventKey: snapshot.eventKey, idempotencyKeyHash }, { session: clientSession });
          if (replay) {
            if (!isIdempotentReplayForIdentity(replay.participant, { normalizedEmail: details.email, normalizedPhone: details.phone })) {
              outcome = apiError(409, "IDEMPOTENCY_KEY_REUSED", "Please refresh the registration form and try again.");
              return;
            }
            const token = generateParticipantAccessToken(replay.publicId)!;
            outcome = sensitiveJson({ publicId: replay.publicId, statusUrl: `/registration/status/${token}`, created: false });
            return;
          }
          const dup = await collection.findOne(
            { ...duplicateFilter, $or: [{ "participant.normalizedEmail": details.email }, { "participant.normalizedPhone": details.phone }] } as Filter<RegistrationV2>,
            { session: clientSession, projection: { _id: 1, publicId: 1, isTest: 1, environment: 1, "payment.status": 1 } },
          );
          if (dup) {
            outcome = respondToIdentityDuplicate(dup as RegistrationV2);
            // Abort the transaction: read-only path, nothing to commit.
            await clientSession!.abortTransaction().catch(() => undefined);
            return;
          }
          const claim = await claimNextDestinationSlot(destinations, { session: clientSession, now: new Date() });
          if (!claim.ok) {
            outcome = apiError(503, PAYMENT_CAPACITY_FULL_CODE, PAYMENT_CAPACITY_FULL_MESSAGE);
            await clientSession!.abortTransaction().catch(() => undefined);
            try {
              const db = await getDb();
              await db.collection("admin_audit").insertOne({ type: "payment_capacity_full", actor: "system", at: new Date(), metadata: {} });
            } catch { /* best-effort */ }
            return;
          }
          for (let attempt = 0; attempt < 4; attempt += 1) {
            const publicId = generatePublicRegistrationId();
            const token = generateParticipantAccessToken(publicId)!;
            const now = new Date();
            // Price snapshot stays immutable; payee fields mirror the
            // assigned destination for legacy readers while the authoritative
            // destination snapshot lives in payment.destination.
            const boundSnapshot = { ...snapshot, payeeName: claim.destination.payeeName, upiId: claim.destination.upiId };
            const destinationSnapshot = buildDestinationSnapshot(claim.destination, now);
            const registration: RegistrationV2 = {
              schemaVersion: 2,
              eventKey: snapshot.eventKey,
              publicId,
              environment: "production",
              isTest: false,
              participantAccessTokenHash: hashParticipantAccessToken(token),
              participant: { fullName: details.fullName, email: details.email, normalizedEmail: details.email, phone: details.phone, normalizedPhone: details.phone, ...(details.college ? { college: details.college } : {}), ...(details.branch ? { branch: details.branch } : {}), ...(details.year ? { year: details.year } : {}) },
              payment: { snapshot: boundSnapshot, destination: destinationSnapshot, status: "payment_pending", proofHistory: [] },
              idempotencyKeyHash,
              audit: [
                { type: "registration_created", actor: "participant", at: now },
                { type: "payment_destination_assigned", actor: "system", at: now, metadata: { destinationId: claim.destination.destinationId, sequence: claim.destination.sequence, capacity: claim.destination.capacity } },
              ],
              createdAt: now,
              updatedAt: now,
            };
            try {
              await collection.insertOne(registration as RegistrationV2, { session: clientSession });
              const audits: Array<{ type: string; metadata?: Record<string, string | number | boolean | null> }> = [];
              if (claim.exhausted) audits.push({ type: "payment_destination_exhausted", metadata: { destinationId: claim.exhausted.destinationId, sequence: claim.exhausted.sequence, capacity: claim.exhausted.capacity } });
              if (claim.activated) audits.push({ type: "payment_destination_activated", metadata: { destinationId: claim.activated.destinationId, sequence: claim.activated.sequence, capacity: claim.activated.capacity } });
              if (audits.length) {
                try {
                  const db = await getDb();
                  await db.collection("admin_audit").insertMany(audits.map((a) => ({ ...a, actor: "system" as const, at: now })), { session: clientSession });
                } catch { /* best-effort */ }
              }
              outcome = sensitiveJson({ publicId, statusUrl: `/registration/status/${token}`, created: true }, { status: 201 });
              return;
            } catch (error: unknown) {
              if ((error as { code?: number }).code !== 11000) throw error;
              // Unique-index race inside txn: abort and resolve via replay/duplicate.
              await clientSession!.abortTransaction().catch(() => undefined);
              const replayAfter = await collection.findOne({ schemaVersion: 2, eventKey: snapshot.eventKey, idempotencyKeyHash });
              if (replayAfter) {
                if (!isIdempotentReplayForIdentity(replayAfter.participant, { normalizedEmail: details.email, normalizedPhone: details.phone })) {
                  outcome = apiError(409, "IDEMPOTENCY_KEY_REUSED", "Please refresh the registration form and try again.");
                } else {
                  outcome = sensitiveJson({ publicId: replayAfter.publicId, statusUrl: `/registration/status/${generateParticipantAccessToken(replayAfter.publicId)!}`, created: false });
                }
                return;
              }
              const concurrentDuplicate = await collection.findOne(
                { ...duplicateFilter, $or: [{ "participant.normalizedEmail": details.email }, { "participant.normalizedPhone": details.phone }] } as Filter<RegistrationV2>,
                { projection: { _id: 1, publicId: 1, isTest: 1, environment: 1, "payment.status": 1 } },
              );
              if (concurrentDuplicate) {
                outcome = respondToIdentityDuplicate(concurrentDuplicate as RegistrationV2);
                return;
              }
              outcome = apiError(503, "REGISTRATION_WRITE_FAILED", "Could not create your registration (code DB-WRITE). Please retry.");
              return;
            }
          }
          outcome = apiError(500, "SERVER_ERROR", "Could not create your registration. Please retry.");
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
        return outcome;
      } catch (error: unknown) {
        if (isTransactionsUnsupportedError(error)) return "unsupported";
        // withTransaction may throw a duplicate-key error surfaced from the
        // aborted inner insert when the driver retries; resolve safely.
        if ((error as { code?: number }).code === 11000) {
          const replay = await collection.findOne({ schemaVersion: 2, eventKey: snapshot.eventKey, idempotencyKeyHash });
          if (replay) {
            if (!isIdempotentReplayForIdentity(replay.participant, { normalizedEmail: details.email, normalizedPhone: details.phone })) {
              return apiError(409, "IDEMPOTENCY_KEY_REUSED", "Please refresh the registration form and try again.");
            }
            return sensitiveJson({ publicId: replay.publicId, statusUrl: `/registration/status/${generateParticipantAccessToken(replay.publicId)!}`, created: false });
          }
          const concurrentDuplicate = await findIdentityDuplicate();
          if (concurrentDuplicate) return respondToIdentityDuplicate(concurrentDuplicate);
          return apiError(503, "REGISTRATION_WRITE_FAILED", "Could not create your registration (code DB-WRITE). Please retry.");
        }
        throw error;
      } finally {
        await clientSession?.endSession().catch(() => undefined);
      }
    };

    try {
      const transactionalOutcome = await tryTransactionalCreate();
      if (transactionalOutcome !== null && transactionalOutcome !== "unsupported") return transactionalOutcome;
      if (transactionalOutcome === null) {
        // Transaction aborted without outcome (should not happen) — fall through.
      }
      // Fallback: atomic claim + compensating release (standalone MongoDB).
      const claim = await claimNextDestinationSlot(destinations, { now: new Date() });
      if (!claim.ok) {
        await recordDestinationAudit([{ type: "payment_capacity_full" }]);
        return apiError(503, PAYMENT_CAPACITY_FULL_CODE, PAYMENT_CAPACITY_FULL_MESSAGE);
      }
      const destinationSnapshot = buildDestinationSnapshot(claim.destination, new Date());
      await recordDestinationAudit([
        ...(claim.exhausted ? [{ type: "payment_destination_exhausted", metadata: { destinationId: claim.exhausted.destinationId, sequence: claim.exhausted.sequence, capacity: claim.exhausted.capacity } }] : []),
        ...(claim.activated ? [{ type: "payment_destination_activated", metadata: { destinationId: claim.activated.destinationId, sequence: claim.activated.sequence, capacity: claim.activated.capacity } }] : []),
      ]);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const publicId = generatePublicRegistrationId();
        const token = generateParticipantAccessToken(publicId)!;
        const now = new Date();
        const boundSnapshot = { ...snapshot, payeeName: claim.destination.payeeName, upiId: claim.destination.upiId };
        const assignedAtSnapshot = { ...destinationSnapshot, assignedAt: now };
        const registration: RegistrationV2 = {
          schemaVersion: 2,
          eventKey: snapshot.eventKey,
          publicId,
          environment: "production",
          isTest: false,
          participantAccessTokenHash: hashParticipantAccessToken(token),
          participant: { fullName: details.fullName, email: details.email, normalizedEmail: details.email, phone: details.phone, normalizedPhone: details.phone, ...(details.college ? { college: details.college } : {}), ...(details.branch ? { branch: details.branch } : {}), ...(details.year ? { year: details.year } : {}) },
          payment: { snapshot: boundSnapshot, destination: assignedAtSnapshot, status: "payment_pending", proofHistory: [] },
          idempotencyKeyHash,
          audit: [
            { type: "registration_created", actor: "participant", at: now },
            { type: "payment_destination_assigned", actor: "system", at: now, metadata: { destinationId: claim.destination.destinationId, sequence: claim.destination.sequence, capacity: claim.destination.capacity } },
          ],
          createdAt: now,
          updatedAt: now,
        };
        try {
          await collection.insertOne(registration);
          return sensitiveJson({ publicId, statusUrl: `/registration/status/${token}`, created: true }, { status: 201 });
        } catch (error: unknown) {
          if ((error as { code?: number }).code !== 11000) {
            console.error("[registration_diagnostic] REGISTRATION_INSERT_FAILED", error);
            // DB failure must not leak capacity — release this claim.
            await releaseDestinationSlot(destinations, claim.destination.destinationId).catch(() => undefined);
            throw error;
          }
          const replay = await collection.findOne({ schemaVersion: 2, eventKey: snapshot.eventKey, idempotencyKeyHash });
          if (replay) {
            // Idempotent replay or key-reuse race: release the unused claim.
            await releaseDestinationSlot(destinations, claim.destination.destinationId).catch(() => undefined);
            if (!isIdempotentReplayForIdentity(replay.participant, { normalizedEmail: details.email, normalizedPhone: details.phone })) {
              return apiError(409, "IDEMPOTENCY_KEY_REUSED", "Please refresh the registration form and try again.");
            }
            return sensitiveJson({ publicId: replay.publicId, statusUrl: `/registration/status/${generateParticipantAccessToken(replay.publicId)!}`, created: false });
          }
          // A concurrent request may have won the unique email/phone index after
          // our first lookup. Release the unused claim, then resolve safely.
          const concurrentDuplicate = await findIdentityDuplicate();
          if (concurrentDuplicate) {
            await releaseDestinationSlot(destinations, claim.destination.destinationId).catch(() => undefined);
            return respondToIdentityDuplicate(concurrentDuplicate);
          }
          if (attempt === 3) {
            await releaseDestinationSlot(destinations, claim.destination.destinationId).catch(() => undefined);
            return apiError(503, "REGISTRATION_WRITE_FAILED", "Could not create your registration (code DB-WRITE). Please retry.");
          }
        }
      }
      // Public-ID collision retries exhausted without commit — release claim.
      await releaseDestinationSlot(destinations, claim.destination.destinationId).catch(() => undefined);
      return apiError(500, "SERVER_ERROR", "Could not create your registration. Please retry.");
    } catch (error) {
      console.error("[registration_diagnostic] UNHANDLED_REGISTRATION_ERROR", error);
      return apiError(503, "REGISTRATION_UNAVAILABLE", "Registration is temporarily unavailable (high demand or server issue). Your details are still on this form — please retry in a minute. If you already have an Illuminate ID, log in instead. (code SERVER)");
    }
  } catch (error) {
    console.error("[registration_diagnostic] UNHANDLED_REGISTRATION_ERROR", error);
    return apiError(503, "REGISTRATION_UNAVAILABLE", "Registration is temporarily unavailable (high demand or server issue). Your details are still on this form — please retry in a minute. If you already have an Illuminate ID, log in instead. (code SERVER)");
  }
}

void (null as unknown as PaymentDestination | null); // keep PaymentDestination import referenced for docs
