import { createHash } from "crypto";
import type { Filter } from "mongodb";
import { PendingRegistrationRequestSchema, type RegistrationV2 } from "@/lib/registration-v2";
import { ensurePaymentIndexes, getRegistrationsCollection, getDb, isDbConfigured } from "@/lib/mongodb";
import { apiError, clientIp, sensitiveJson } from "@/lib/http";
import { generateParticipantAccessToken, generatePublicRegistrationId, getConfirmedPaymentSnapshot, getDevelopmentPreviewSnapshot, hashParticipantAccessToken } from "@/lib/payment";
import { isRegistrationManuallyClosed } from "@/lib/site-settings";
import { enforceRateLimit, enforceRegistrationCreationRateLimit, REGISTRATION_CREATE_IP_LIMIT, REGISTRATION_CREATE_IP_WINDOW_MS } from "@/lib/rate-limit";
import { decideExistingIdentityDuplicate, isIdempotentReplayForIdentity } from "@/lib/registration-duplicate-policy";
import { developmentTestRegistrationFilter, realRegistrationFilter } from "@/lib/registration-filters";
import {
  EVENT_REGISTRATION_FULL_CODE,
  EVENT_REGISTRATION_FULL_MESSAGE,
  EVENT_VERIFIED_SEAT_LIMIT,
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

    // Idempotent replay returns the existing draft without inserting again.
    // No seat or payment slot exists at creation, so replays are free.
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
    // Rejected duplicate attempts create nothing (no draft, no commitment).
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

    // ---- Production path: DRAFT registration (no QR commitment) ----
    // V3 draft: creation records identity + immutable price snapshot only.
    // It claims NO payment destination, consumes NO destination slot and NO
    // event seat, attaches NO payment.destination, and exposes NO QR. The
    // participant generates a QR explicitly on the status page
    // (POST /api/payment/qr/[token]), which performs the atomic seat +
    // destination commitment. Draft = payment_pending WITHOUT destination.
    // Event seat cap (soft close for UX): once 120 real seats are verified
    // or awaiting verification (proof submitted, decision pending), new
    // production drafts close with a thankful FULL response. Idempotent
    // replays and identity duplicates resolve above, so existing holders
    // never see this — only genuinely new seats. Awaiting proofs count
    // because they are effectively spoken for and usually verify. This is a
    // non-atomic precheck for UX only; the HARD authoritative 120 gate lives
    // in QR generation. A transient count failure (-1) fails open.
    // Admin manual close wins over the date window for genuinely new drafts.
    // It sits here — after idempotent replays and identity duplicates resolve
    // above — so existing holders never see it, exactly like the seat-cap
    // gate below. Dev E2E preview bypasses it so local workflow review never
    // depends on production state. Login, status, and proof routes are
    // intentionally never gated here.
    if (!developmentSnapshot && await isRegistrationManuallyClosed()) {
      return apiError(403, "REGISTRATION_CLOSED", "Registrations are closed. If you already registered, log in with your email or mobile to open your status.");
    }
    const claimedCount = await collection.countDocuments({ ...realRegistrationFilter, "payment.status": { $in: ["verified", "submitted_for_verification"] } }).catch(() => -1);
    if (claimedCount >= EVENT_VERIFIED_SEAT_LIMIT) {
      await recordDestinationAudit([{ type: "event_registration_full", metadata: { claimedCount, seatLimit: EVENT_VERIFIED_SEAT_LIMIT } }]);
      return apiError(503, EVENT_REGISTRATION_FULL_CODE, EVENT_REGISTRATION_FULL_MESSAGE);
    }

    // Prefer a MongoDB transaction so the idempotency/duplicate re-checks
    // and the draft insert commit atomically (no double-insert on races).
    // Fall back to a plain insert where transactions are unavailable
    // (standalone MongoDB) — unique indexes + replay/duplicate resolution
    // below keep that path safe. No destination slot is ever claimed here,
    // so no compensating release exists on this route.
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
          for (let attempt = 0; attempt < 4; attempt += 1) {
            const publicId = generatePublicRegistrationId();
            const token = generateParticipantAccessToken(publicId)!;
            const now = new Date();
            // Price snapshot stays immutable and destination-free: no payee
            // mirroring happens at creation (there is no assignment yet).
            // pendingQRGeneration marks this V3 draft as eligible for
            // explicit first-QR issuance; legacy rows without a destination
            // keep their pre-V3 handling exactly.
            const registration: RegistrationV2 = {
              schemaVersion: 2,
              eventKey: snapshot.eventKey,
              publicId,
              environment: "production",
              isTest: false,
              participantAccessTokenHash: hashParticipantAccessToken(token),
              participant: { fullName: details.fullName, email: details.email, normalizedEmail: details.email, phone: details.phone, normalizedPhone: details.phone, ...(details.college ? { college: details.college } : {}), ...(details.branch ? { branch: details.branch } : {}), ...(details.year ? { year: details.year } : {}) },
              payment: { snapshot, pendingQRGeneration: true, status: "payment_pending", proofHistory: [] },
              idempotencyKeyHash,
              audit: [
                { type: "registration_created", actor: "participant", at: now },
              ],
              createdAt: now,
              updatedAt: now,
            };
            try {
              await collection.insertOne(registration as RegistrationV2, { session: clientSession });
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
      // Fallback: plain draft insert (standalone MongoDB). No destination
      // slot exists to leak, so failures never consume capacity.
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const publicId = generatePublicRegistrationId();
        const token = generateParticipantAccessToken(publicId)!;
        const now = new Date();
        // Price snapshot stays immutable and destination-free (see above).
        const registration: RegistrationV2 = {
          schemaVersion: 2,
          eventKey: snapshot.eventKey,
          publicId,
          environment: "production",
          isTest: false,
          participantAccessTokenHash: hashParticipantAccessToken(token),
          participant: { fullName: details.fullName, email: details.email, normalizedEmail: details.email, phone: details.phone, normalizedPhone: details.phone, ...(details.college ? { college: details.college } : {}), ...(details.branch ? { branch: details.branch } : {}), ...(details.year ? { year: details.year } : {}) },
          payment: { snapshot, pendingQRGeneration: true, status: "payment_pending", proofHistory: [] },
          idempotencyKeyHash,
          audit: [
            { type: "registration_created", actor: "participant", at: now },
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
            throw error;
          }
          const replay = await collection.findOne({ schemaVersion: 2, eventKey: snapshot.eventKey, idempotencyKeyHash });
          if (replay) {
            if (!isIdempotentReplayForIdentity(replay.participant, { normalizedEmail: details.email, normalizedPhone: details.phone })) {
              return apiError(409, "IDEMPOTENCY_KEY_REUSED", "Please refresh the registration form and try again.");
            }
            return sensitiveJson({ publicId: replay.publicId, statusUrl: `/registration/status/${generateParticipantAccessToken(replay.publicId)!}`, created: false });
          }
          // A concurrent request may have won the unique email/phone index after
          // our first lookup. Resolve safely without consuming capacity.
          const concurrentDuplicate = await findIdentityDuplicate();
          if (concurrentDuplicate) {
            return respondToIdentityDuplicate(concurrentDuplicate);
          }
          if (attempt === 3) {
            return apiError(503, "REGISTRATION_WRITE_FAILED", "Could not create your registration (code DB-WRITE). Please retry.");
          }
        }
      }
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
