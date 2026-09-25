import { getConfirmedPaymentSnapshot, buildUpiUriForDestination, isValidParticipantAccessToken } from "@/lib/payment";
import { isRegistrationManuallyClosed } from "@/lib/site-settings";
import { apiError, sensitiveJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getDb, getEventCapacityCollection, getPaymentDestinationsCollection, getRegistrationsCollection, isDbConfigured } from "@/lib/mongodb";
import { PaymentFlowError, generateFirstPaymentQR } from "@/lib/payment-flow-service";

export const runtime = "nodejs";

function isTransactionsUnsupportedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /transaction numbers are only allowed|replica set|sessions are not supported|transaction.*not supported|no longer supports|illegal session/i.test(message);
}

async function recordGenerateQRAudit(events: Array<{ type: string; metadata?: Record<string, string | number | boolean | null> }>): Promise<void> {
  if (!events.length) return;
  try {
    const db = await getDb();
    const now = new Date();
    await db.collection("admin_audit").insertMany(
      events.map((e) => ({ type: e.type, actor: "system" as const, at: now, metadata: e.metadata ?? {} })),
      { ordered: false },
    );
  } catch {
    // Audit is best-effort; the QR commitment already committed-or-aborted.
  }
}

export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isDbConfigured() || !isValidParticipantAccessToken(token)) return apiError(404, "INVALID_STATUS_TOKEN", "Not found.");
  try {
    // Per-token bucket stops one client hammering Generate; the backend
    // (not button disabling) is authoritative for idempotency.
    if (!await enforceRateLimit("qr-generate", `token:${token.slice(0, 32)}`, 30, 15 * 60_000)) {
      return apiError(429, "RATE_LIMITED", "Too many attempts. Please try again shortly.", { retryAfterSeconds: 900 });
    }
  } catch { /* fail-open for the guard: continue to token validation below */ }
  try {
    const [manuallyClosed, snapshot] = await Promise.all([
      isRegistrationManuallyClosed(),
      Promise.resolve(getConfirmedPaymentSnapshot()),
    ]);
    const store = {
      registrations: await getRegistrationsCollection(),
      destinations: await getPaymentDestinationsCollection(),
      eventCapacity: await getEventCapacityCollection(),
    };
    const runTransaction = async <T>(fn: (session: unknown) => Promise<T>): Promise<T> => {
      const { getMongoClient } = await import("@/lib/mongodb");
      const session = (await getMongoClient()).startSession();
      try {
        return await session.withTransaction(() => fn(session), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally {
        await session.endSession().catch(() => undefined);
      }
    };
    const result = await generateFirstPaymentQR({ token, store, runTransaction, availability: { manuallyClosed, snapshot } });
    const registration = result.registration;
    const expectedAmount = registration.payment.snapshot.expectedAmount;
    const instructions = expectedAmount === null
      ? { payeeName: result.destination.payeeName, upiId: result.destination.upiId }
      : {
        payeeName: result.destination.payeeName,
        upiId: result.destination.upiId,
        upiUri: buildUpiUriForDestination(result.destination, expectedAmount, registration.publicId),
      };
    if (!result.idempotent) {
      await recordGenerateQRAudit([
        { type: "event_seat_committed", metadata: { publicId: registration.publicId, destinationId: result.destination.destinationId, committedCount: result.seatNumber, seatLimit: 120 } },
        ...(result.exhaustedDestinationId ? [{ type: "payment_destination_exhausted", metadata: { destinationId: result.exhaustedDestinationId } }] : []),
        ...(result.activatedDestinationId ? [{ type: "payment_destination_activated", metadata: { destinationId: result.activatedDestinationId } }] : []),
      ]);
    }
    return sensitiveJson({
      publicId: registration.publicId,
      paymentDestination: {
        destinationId: result.destination.destinationId,
        internalLabel: result.destination.internalLabel,
        payeeName: result.destination.payeeName,
        upiId: result.destination.upiId,
      },
      paymentInstructions: instructions,
      expectedAmount,
      pricingTier: registration.payment.snapshot.pricingTier,
      qrClaimedAt: result.qrClaimedAt?.toISOString() ?? null,
      idempotent: result.idempotent,
    });
  } catch (error) {
    if (isTransactionsUnsupportedError(error)) {
      console.error("[qr-generate] TRANSACTIONS_UNSUPPORTED — refusing weak fallback for seat+slot commitment");
      return apiError(503, "TRANSACTION_UNSUPPORTED", "QR generation is temporarily unavailable (server issue). Please retry in a minute. (code QR-TXN)");
    }
    if (error instanceof PaymentFlowError) {
      const status =
        error.code === "INVALID_STATUS_TOKEN" ? 404
        : error.code === "REGISTRATION_CLOSED" ? 403
        : error.code === "PAYMENT_NOT_AVAILABLE" || error.code === "EVENT_CAPACITY_NOT_INITIALIZED" ? 503
        : error.code === "EVENT_REGISTRATION_FULL" || error.code === "PAYMENT_CAPACITY_FULL" ? 503
        : error.code === "INVALID_TRANSACTION_REFERENCE" || error.code === "INVALID_PROOF_FILE" ? 422
        : 409;
      if (error.code === "EVENT_REGISTRATION_FULL") {
        await recordGenerateQRAudit([{ type: "event_capacity_full" }]);
      } else if (error.code === "PAYMENT_CAPACITY_FULL") {
        await recordGenerateQRAudit([{ type: "payment_capacity_full" }]);
      }
      return apiError(status, error.code, error.message);
    }
    console.error("[qr-generate] UNHANDLED_QR_ERROR", error instanceof Error ? error.message : error);
    return apiError(503, "QR_UNAVAILABLE", "QR generation is temporarily unavailable. Please retry in a minute.");
  }
}
