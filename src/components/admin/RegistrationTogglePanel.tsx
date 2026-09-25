"use client";

import { useCallback, useEffect, useState } from "react";

export function RegistrationTogglePanel() {
  const [closed, setClosed] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error?.message || "Could not load registration setting.");
      setClosed(Boolean(json.data.manualClose));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load registration setting.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const toggle = async (next: boolean) => {
    const confirmText = next
      ? "Close registrations? Landing page will show Registration Closed with a popup. New drafts and first QR generation stop; login keeps working."
      : "Re-open registrations? Landing page returns to date-based availability.";
    if (!window.confirm(confirmText)) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closed: next }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error?.message || "Could not save the registration setting.");
      setClosed(Boolean(json.data.manualClose));
      setNotice(typeof json.data.notice === "string" ? json.data.notice : next ? "Registrations are now CLOSED." : "Registrations are now OPEN.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the registration setting.");
    } finally {
      setWorking(false);
    }
  };

  if (loading && closed === null) {
    return <section aria-label="Registration availability" className="mt-6 rounded-2xl border border-white/10 p-5 text-sm text-text-secondary">Loading registration setting…</section>;
  }

  const isClosed = closed === true;

  return (
    <section aria-label="Registration availability" className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Registration availability</h2>
        <button type="button" className="registration-back px-3" onClick={() => void load()} disabled={loading || working}>Refresh</button>
      </div>
      <p className="mt-2 text-sm text-text-secondary">
        Status: {isClosed
          ? <strong className="text-red-200">CLOSED — landing shows Closed popup, new drafts and first QR generation blocked</strong>
          : <strong className="text-emerald-200">OPEN — landing follows the date window</strong>}
      </p>
      <p className="mt-1 text-xs text-text-secondary">
        Closing never blocks login, status pages, existing QR display, or payment proofs for already-registered participants.
      </p>
      {error && <p role="alert" className="registration-field__error mt-3">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-emerald-100">{notice}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        {isClosed ? (
          <button type="button" className="registration-back px-4" disabled={working} onClick={() => void toggle(false)}>
            {working ? "Working…" : "Re-open registrations"}
          </button>
        ) : (
          <button type="button" className="registration-back px-4" disabled={working} onClick={() => void toggle(true)}>
            {working ? "Working…" : "Close registrations"}
          </button>
        )}
      </div>
    </section>
  );
}
