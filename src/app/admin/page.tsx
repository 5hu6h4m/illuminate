"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Clock } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  downloadCSV,
  loadRegistrations,
  toCSV,
  type Registration,
} from "@/lib/registration";

const SEED: Registration[] = [
  {
    id: "ILL-MET-2026-00482", fullName: "Shubham Jadhav", email: "shubham@example.com",
    mobile: "9876543210", whatsapp: "9876543210", college: "MET Bhujbal Knowledge City",
    studentId: "MET2023001", branch: "Computer Science & Design", year: "3rd Year",
    interests: ["Startups", "Technology"], hasIdea: "I'm exploring ideas",
    attendedStartupEvent: "No", attendedEcell: "No", campusVisit: "Yes",
    willingToTravel: "Yes", emergencyName: "Guardian", emergencyPhone: "9876543211",
    amountPaid: 599, paymentStatus: "paid", paymentId: "pay_demo1",
    createdAt: new Date().toISOString(),
  },
];

export default function AdminPage() {
  const [rows, setRows] = useState<Registration[]>([]);
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  async function fetchRows(key: string): Promise<Registration[] | null> {
    const res = await fetch("/api/registrations", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401) throw new Error("wrong");
    if (res.status === 429) throw new Error("locked");
    if (!res.ok) return null; // API unavailable → local fallback
    const json = await res.json().catch(() => null);
    return Array.isArray(json?.data) ? (json.data as Registration[]) : null;
  }

  async function unlock(key: string) {
    const trimmed = key.trim();
    if (!trimmed) {
      setAuthError("Enter the admin passcode.");
      return;
    }
    setUnlocking(true);
    setAuthError("");
    try {
      const data = await fetchRows(trimmed);
      if (data && data.length) {
        setRows(data);
      } else if (data === null) {
        const local = loadRegistrations();
        setRows(local.length ? local : SEED);
      } else {
        setRows([]);
      }
      sessionStorage.setItem("illuminate-admin", trimmed);
      setPin(trimmed);
      setAuthed(true);
    } catch (e) {
      setAuthError(
        e instanceof Error && e.message === "locked"
          ? "Too many wrong attempts. Try again in 15 minutes."
          : "Wrong passcode. Try again.",
      );
    } finally {
      setUnlocking(false);
    }
  }

  // Resume session on reload (session-only, cleared when the tab closes).
  useEffect(() => {
    const saved = sessionStorage.getItem("illuminate-admin");
    if (saved) void unlock(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRows(pin);
        if (!cancelled && data) setRows(data);
      } catch {
        /* wrong/expired key mid-session → keep current rows */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const stats = useMemo(() => ({
    total: rows.length,
    paid: rows.filter((r) => r.paymentStatus === "paid").length,
    pending: rows.filter((r) => r.paymentStatus !== "paid").length,
    campus: rows.filter((r) => r.campusVisit === "Yes").length,
    travel: rows.filter((r) => r.willingToTravel === "Yes").length,
  }), [rows]);

  const byBranch = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.branch, (m.get(r.branch) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [rows]);
  const maxBranch = Math.max(1, ...byBranch.map(([, n]) => n));

  if (!authed) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="font-display text-3xl">Admin panel</h1>
          <p className="mt-2 text-sm text-white/55">Passcode only — no email needed. Enter the admin passcode to unlock.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void unlock(pin);
            }}
          >
            <input
              className="mt-6 w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-center"
              placeholder="Admin passcode" type="password" value={pin} onChange={(e) => setPin(e.target.value)}
              autoComplete="off"
            />
            {authError && <p className="mt-3 text-sm text-red-300">{authError}</p>}
            <button
              type="submit"
              disabled={unlocking}
              className="pressable mt-4 w-full rounded-full bg-ember px-6 py-3 font-bold text-white transition-colors hover:bg-ember-deep disabled:opacity-60"
            >
              {unlocking ? "Checking…" : "Unlock dashboard"}
            </button>
          </form>
          <p className="mt-4 text-xs text-white/40"><Link href="/" className="underline">← Back home</Link></p>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl space-y-12 px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">Overview</h1>
            <p className="mt-2 text-sm text-white/55">Live from MongoDB when configured, otherwise this browser (demo store).</p>
          </div>
          <div className="flex gap-3">
          <button
            onClick={() => downloadCSV("illuminate-participants.csv", toCSV(rows))}
            className="pressable rounded-full bg-ember px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-ember-deep"
          >
            EXPORT PARTICIPANTS (CSV)
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem("illuminate-admin");
              setAuthed(false);
              setPin("");
              setRows([]);
            }}
            className="pressable rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/70 transition-colors hover:border-white/40"
          >
            Lock
          </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5 md:gap-6">
          {[
            ["Total", stats.total],
            ["Paid", stats.paid],
            ["Pending", stats.pending],
            ["Campus visit", stats.campus],
            ["Travel", stats.travel],
          ].map(([k, v]) => (
            <div key={k} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <p className="font-display text-4xl text-ember">{v}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/55">{k}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
          <h2 className="font-display text-xl">Registrations by branch</h2>
          <div className="mt-5 space-y-3">
            {byBranch.length === 0 && <p className="text-sm text-white/50">No data yet.</p>}
            {byBranch.map(([b, n]) => (
              <div key={b} className="flex items-center gap-4 text-sm">
                <span className="w-48 truncate text-white/70">{b}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-ember" style={{ width: `${(n / maxBranch) * 100}%` }} />
                </div>
                <span className="w-8 text-right font-mono">{n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-white/10">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                {["ID", "Name", "Email", "Phone", "Branch", "Year", "Payment", "Campus", "Travel"].map((h) => (
                  <th key={h} className="px-5 py-4 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-4 font-mono text-xs text-ember">{r.id.slice(-5)}</td>
                  <td className="px-5 py-4">{r.fullName}</td>
                  <td className="max-w-[200px] truncate px-5 py-4 text-white/65">{r.email}</td>
                  <td className="px-5 py-4 text-white/65">{r.mobile}</td>
                  <td className="px-5 py-4 text-white/65">{r.branch}</td>
                  <td className="px-5 py-4 text-white/65">{r.year}</td>
                  <td className="px-5 py-4">
                    {r.paymentStatus === "paid" ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-300">
                        <BadgeCheck className="h-4 w-4" aria-hidden /> Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-amber-200">
                        <Clock className="h-4 w-4" aria-hidden /> {r.paymentStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">{r.campusVisit}</td>
                  <td className="px-5 py-4">{r.willingToTravel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-white/40">
          Export columns: Registration ID, Name, Email, Phone, College, Student ID, Branch, Year,
          Campus Visit Interest, Travel Interest, Payment Status, Registration Date.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
