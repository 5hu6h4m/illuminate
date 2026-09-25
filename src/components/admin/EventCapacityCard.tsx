"use client";

import { useCallback, useEffect, useState } from "react";
import type { CapacityOverview } from "./types";

/**
 * Read-only event-seat observability. Committed seats (event_capacity
 * document) and reporting counts (verified + awaiting verification) are
 * related but different V3 metrics — this card shows both without conflating
 * them. Never writes: a missing document renders "Not initialized".
 */
export function EventCapacityCard() {
  const [data, setData] = useState<CapacityOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/destinations", { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error?.message || "Could not load event capacity.");
      setData(json.data as CapacityOverview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load event capacity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading && !data) return <section aria-label="Event seats" className="mt-6 rounded-2xl border border-white/10 p-5 text-sm text-text-secondary">Loading event seats…</section>;

  const seats = data?.eventCapacity;

  return (
    <section aria-label="Event seats" className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Event seats</h2>
        <button type="button" className="registration-back px-3" onClick={() => void load()} disabled={loading}>Refresh</button>
      </div>
      {error && <p role="alert" className="registration-field__error mt-3">{error}</p>}
      {seats && !seats.initialized && (
        <p role="status" className="mt-2 text-sm text-amber-200">Event capacity not initialized — Generate QR will fail closed until migration initializes the counter. Reporting counts below are still accurate.</p>
      )}
      {seats && seats.initialized && (
        <p className="mt-2 text-sm text-text-secondary">
          Committed: {seats.committedCount} / {seats.seatLimit} · Remaining: {seats.remaining}
        </p>
      )}
      {seats && (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 p-4 text-sm">
            <dt className="text-xs text-text-secondary">Verified</dt>
            <dd className="mt-1 text-2xl font-semibold">{seats.verifiedCount}</dd>
          </div>
          <div className="rounded-xl border border-white/10 p-4 text-sm">
            <dt className="text-xs text-text-secondary">Awaiting verification</dt>
            <dd className="mt-1 text-2xl font-semibold">{seats.awaitingVerificationCount}</dd>
          </div>
          <div className="rounded-xl border border-white/10 p-4 text-sm">
            <dt className="text-xs text-text-secondary">QR issued / payment pending</dt>
            <dd className="mt-1 text-2xl font-semibold">{seats.qrIssuedPendingCount}</dd>
          </div>
          <div className="rounded-xl border border-white/10 p-4 text-sm">
            <dt className="text-xs text-text-secondary">Drafts without QR</dt>
            <dd className="mt-1 text-2xl font-semibold">{seats.draftWithoutQrCount}</dd>
          </div>
        </dl>
      )}
      {seats && (
        <p className="mt-3 text-xs text-text-secondary">
          Reporting claimed (verified + awaiting): {seats.reportingClaimedCount}. Committed seats additionally include QR-issued pendings and historical destination-backed rows.
        </p>
      )}
    </section>
  );
}
