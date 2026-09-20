"use client";

import { useCallback, useEffect, useState } from "react";
import type { CapacityOverview } from "./types";
import { destinationShortLabel } from "./types";

export function CapacityPanel() {
  const [data, setData] = useState<CapacityOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("account-a-yash");
  const [to, setTo] = useState("account-b-shivam");
  const [preview, setPreview] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/destinations", { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error?.message || "Could not load payment capacity.");
      setData(json.data as CapacityOverview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load payment capacity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    // Admin deletes release a destination slot server-side; refresh here so
    // the per-account counts update without a manual Refresh click.
    const onCapacityChanged = () => void load();
    window.addEventListener("illuminate:capacity-changed", onCapacityChanged);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("illuminate:capacity-changed", onCapacityChanged);
    };
  }, [load]);

  const checkCount = async () => {
    setWorking(true);
    setPreview("");
    try {
      const response = await fetch("/api/admin/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reassign", fromDestinationId: from, toDestinationId: to, confirm: true, dryRun: true, partial: true }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error?.message || "Count check failed.");
      const eligible = Number(json.data.eligibleCount ?? 0);
      const remaining = Number(json.data.remaining ?? 0);
      const willMove = Number(json.data.willMove ?? Math.min(eligible, remaining));
      const willRemain = Number(json.data.willRemain ?? eligible - willMove);
      setPreview(`Eligible: ${eligible} · Target remaining: ${remaining} · Will move: ${willMove} · Will remain: ${willRemain}. Oldest unpaid registrations will be reassigned first.`);
    } catch (cause) {
      setPreview(cause instanceof Error ? cause.message : "Count check failed.");
    } finally {
      setWorking(false);
    }
  };

  const executeReassign = async (allowPartial: boolean) => {
    // Fetch a fresh preview so the confirmation states exact numbers.
    let eligible = 0;
    let remaining = 0;
    let willMove = 0;
    let willRemain = 0;
    try {
      const previewResponse = await fetch("/api/admin/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reassign", fromDestinationId: from, toDestinationId: to, confirm: true, dryRun: true, partial: true }),
      });
      const previewJson = await previewResponse.json().catch(() => null);
      if (previewResponse.ok && previewJson?.data) {
        eligible = Number(previewJson.data.eligibleCount ?? 0);
        remaining = Number(previewJson.data.remaining ?? 0);
        willMove = Number(previewJson.data.willMove ?? Math.min(eligible, remaining));
        willRemain = Number(previewJson.data.willRemain ?? eligible - willMove);
      }
    } catch { /* fall through to server-enforced confirmation */ }
    const confirmText = allowPartial && eligible > remaining
      ? `Move ${willMove} of ${eligible} eligible unpaid registrations from ${from} to ${to}?\n\n${willRemain} will remain unchanged.\n\nOldest unpaid registrations will be reassigned first. Only payment_pending records move.`
      : `REASSIGN UNPAID REGISTRATIONS from ${from} to ${to}? Only payment_pending records move. This consumes target capacity and cannot be undone automatically.`;
    if (!window.confirm(confirmText)) return;
    setWorking(true);
    setPreview("");
    try {
      const response = await fetch("/api/admin/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reassign", fromDestinationId: from, toDestinationId: to, confirm: true, ...(allowPartial ? { partial: true } : {}) }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error?.message || "Reassignment failed.");
      setPreview(json.data.notice || `Moved ${json.data.movedCount}.`);
      await load();
    } catch (cause) {
      setPreview(cause instanceof Error ? cause.message : "Reassignment failed.");
    } finally {
      setWorking(false);
    }
  };

  const disableDestination = async (destinationId: string) => {
    if (!window.confirm(`Disable ${destinationId}? It will be skipped and never reactivated automatically.`)) return;
    setWorking(true);
    try {
      const response = await fetch("/api/admin/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", destinationId }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error?.message || "Disable failed.");
      await load();
    } catch (cause) {
      setPreview(cause instanceof Error ? cause.message : "Disable failed.");
    } finally {
      setWorking(false);
    }
  };

  if (loading && !data) return <section aria-label="Payment capacity" className="mt-6 rounded-2xl border border-white/10 p-5 text-sm text-text-secondary">Loading payment capacity…</section>;

  return (
    <section aria-label="Payment capacity" className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Payment capacity</h2>
        <button type="button" className="registration-back px-3" onClick={() => void load()} disabled={loading}>Refresh</button>
      </div>
      {error && <p role="alert" className="registration-field__error mt-3">{error}</p>}
      {data && (
        <>
          <p className="mt-2 text-sm text-text-secondary">
            Total capacity: {data.totalCapacity} · Assigned: {data.assigned} / {data.totalCapacity} · Remaining: {data.remaining}
            {data.capacityFull && <strong className="ml-2 text-red-200">FULL — new registrations return PAYMENT_CAPACITY_FULL</strong>}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {data.destinations.map((d) => (
              <div key={d.destinationId} className="rounded-xl border border-white/10 p-4 text-sm">
                <p className="font-semibold">{destinationShortLabel(d.destinationId)}</p>
                <p className="mt-1 text-xs text-text-secondary">{d.payeeName}</p>
                <p className="mt-2 font-mono text-xs">{d.assignedCount} / {d.capacity} assigned</p>
                <p className="mt-1 text-xs font-semibold">
                  {d.status === "active" && "ACTIVE"}
                  {d.status === "available" && (d.sequence === Math.min(...data.destinations.filter((x) => x.status === "available").map((x) => x.sequence)) ? "NEXT" : "QUEUED")}
                  {d.status === "exhausted" && "EXHAUSTED"}
                  {d.status === "disabled" && "DISABLED / LEGACY"}
                </p>
                {(d.status === "active" || d.status === "available") && d.destinationId !== "account-a-yash" && (
                  <button type="button" className="mt-2 text-xs underline" disabled={working} onClick={() => void disableDestination(d.destinationId)}>Disable</button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-text-secondary">Account A pending reassignment: {data.accountAPendingCount} payment_pending record(s).</p>
          <div className="mt-4 rounded-xl border border-white/10 p-4">
            <h3 className="text-sm font-semibold">Reassign unpaid registrations</h3>
            <p className="mt-1 text-xs text-text-secondary">Only payment_pending moves. Submitted / verified / rejected are locked. Target capacity is enforced.</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <label>From <select value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 rounded border border-white/15 bg-black px-2 py-1">{data.destinations.map((d) => <option key={d.destinationId} value={d.destinationId}>{destinationShortLabel(d.destinationId)}</option>)}<option value="account-a-yash">Account A (DISABLED)</option></select></label>
              <label>To <select value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 rounded border border-white/15 bg-black px-2 py-1">{data.destinations.filter((d) => d.destinationId !== "account-a-yash").map((d) => <option key={d.destinationId} value={d.destinationId}>{destinationShortLabel(d.destinationId)}</option>)}</select></label>
              <button type="button" className="registration-back px-3" disabled={working} onClick={() => void checkCount()}>Show count</button>
              <button type="button" className="registration-back px-3" disabled={working} onClick={() => void executeReassign(false)}>Reassign unpaid registrations</button>
              <button type="button" className="registration-back px-3" disabled={working} onClick={() => void executeReassign(true)}>Reassign up to available capacity</button>
            </div>
            {preview && <p role="status" className="mt-2 text-xs">{preview}</p>}
          </div>
        </>
      )}
    </section>
  );
}
