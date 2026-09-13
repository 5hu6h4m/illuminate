"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Clock, Hourglass, Search, X } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  downloadCSV,
  loadRegistrations,
  toCSV,
  type Registration,
} from "@/lib/registration";
import { formatINR } from "@/lib/pricing";

const SEED: Registration[] = [
  {
    id: "ILL-MET-2026-00482", fullName: "Shubham Jadhav", email: "shubham@example.com",
    mobile: "9876543210", whatsapp: "9876543210", college: "MET Bhujbal Knowledge City",
    studentId: "MET2023001", branch: "Computer Science & Design", year: "3rd Year",
    interests: ["Startups", "Technology"], hasIdea: "I'm exploring ideas",
    attendedStartupEvent: "No", attendedEcell: "No", campusVisit: "Yes",
    willingToTravel: "Yes", emergencyName: "Guardian", emergencyPhone: "9876543211",
    amountPaid: 599, paymentStatus: "awaiting_verification", utr: "412345678901",
    createdAt: new Date().toISOString(),
  },
];

type StatusFilter = "all" | "paid" | "awaiting_verification" | "pending";

function StatusBadge({ s }: { s: Registration["paymentStatus"] }) {
  if (s === "paid")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Paid
      </span>
    );
  if (s === "awaiting_verification")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
        <Hourglass className="h-3.5 w-3.5" aria-hidden /> Verify pending
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-white/60">
      <Clock className="h-3.5 w-3.5" aria-hidden /> {s}
    </span>
  );
}

export default function AdminPage() {
  const [rows, setRows] = useState<Registration[]>([]);
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  async function fetchRows(key: string): Promise<Registration[] | null> {
    const res = await fetch("/api/registrations", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401) throw new Error("wrong");
    if (res.status === 429) throw new Error("locked");
    if (!res.ok) return null;
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
        /* keep current rows */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // Esc se detail modal band
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const stats = useMemo(() => ({
    total: rows.length,
    paid: rows.filter((r) => r.paymentStatus === "paid").length,
    awaiting: rows.filter((r) => r.paymentStatus === "awaiting_verification").length,
    pending: rows.filter((r) => r.paymentStatus === "pending").length,
  }), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.paymentStatus !== statusFilter) return false;
      if (!q) return true;
      return [r.id, r.fullName, r.email, r.mobile, r.whatsapp, r.branch, r.studentId, r.utr ?? ""]
        .join(" ").toLowerCase().includes(q);
    });
  }, [rows, query, statusFilter]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  );

  async function verify(id: string, action: "approve" | "reject") {
    setActing(true);
    try {
      const res = await fetch("/api/registrations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pin}`,
        },
        body: JSON.stringify({ id, action, key: pin }),
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const updated = json?.data as Registration | undefined;
        if (updated) {
          setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
          return;
        }
      }
      // Local fallback (DB not configured / demo store): state + localStorage update
      if (res.status === 503) {
        const next = (action === "approve" ? "paid" : "pending") as Registration["paymentStatus"];
        setRows((prev) => {
          const mapped = prev.map((r) => (r.id === id ? { ...r, paymentStatus: next } : r));
          try {
            localStorage.setItem("illuminate-registrations-v1", JSON.stringify(mapped));
          } catch { /* ignore */ }
          return mapped;
        });
      }
    } finally {
      setActing(false);
    }
  }

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
      {/* FULL SCREEN admin — max width hataya, pura viewport use */}
      <main className="min-h-screen w-full px-4 py-16 md:px-8 md:py-20">
        <div className="mx-auto w-full max-w-[1600px] space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl">Registrations — full view</h1>
              <p className="mt-2 text-sm text-white/55">Live from MongoDB when configured, otherwise this browser (demo store). Row pe click → full info + payment screenshot.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => downloadCSV("illuminate-participants.csv", toCSV(filtered))}
                className="pressable rounded-full bg-ember px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-ember-deep"
              >
                EXPORT {filtered.length} ROWS (CSV)
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

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ["Total", stats.total],
              ["Paid ✓", stats.paid],
              ["Verify pending", stats.awaiting],
              ["Pending / rejected", stats.pending],
            ].map(([k, v]) => (
              <div key={k} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="font-display text-4xl text-ember">{v}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/55">{k}</p>
              </div>
            ))}
          </div>

          {/* search + filter */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search — naam, email, mobile, ID, UTR…"
                className="w-full rounded-full border border-white/12 bg-white/[0.04] py-3 pl-11 pr-4 text-sm outline-none focus:border-ember/60"
              />
            </label>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Payment filter">
              {(["all", "paid", "awaiting_verification", "pending"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold pressable ${
                    statusFilter === f
                      ? "bg-ember text-white"
                      : "border border-white/15 text-white/60 hover:border-white/40"
                  }`}
                >
                  {f === "all" ? "All" : f === "awaiting_verification" ? "Verify pending" : f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-white/10">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                  {["Reg ID", "Name / Email", "Mobile", "Branch · Year", "Amount", "UTR", "Screenshot", "Payment", "→"].map((h) => (
                    <th key={h} className="px-5 py-4 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className="cursor-pointer border-b border-white/5 transition-colors hover:bg-ember/[0.07]"
                  >
                    <td className="px-5 py-4 font-mono text-xs text-ember">{r.id}</td>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{r.fullName}</p>
                      <p className="max-w-[220px] truncate text-xs text-white/55">{r.email}</p>
                    </td>
                    <td className="px-5 py-4 text-white/70">{r.mobile}</td>
                    <td className="max-w-[200px] truncate px-5 py-4 text-white/65">{r.branch} · {r.year}</td>
                    <td className="px-5 py-4 font-semibold">{formatINR(r.amountPaid)}</td>
                    <td className="px-5 py-4 font-mono text-xs text-white/70">{r.utr ?? "—"}</td>
                    <td className="px-5 py-4">
                      {r.paymentScreenshot ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.paymentScreenshot} alt="" aria-hidden className="h-10 w-10 rounded-lg border border-white/15 object-cover" />
                      ) : (
                        <span className="text-xs text-white/35">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4"><StatusBadge s={r.paymentStatus} /></td>
                    <td className="px-5 py-4 text-ember">View</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-white/50">
                      Koi registration nahi mila. Search/filter clear karke dekho.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-white/40">
            Export me full info: contact, college, PRN, division, interests, idea, emergency, UTR, screenshot flag, amount, date.
          </p>
        </div>
      </main>

      {/* DETAIL MODAL — proper full info + payment SS */}
      {selected && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setSelectedId(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Registration ${selected.id}`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl border border-white/12 bg-[#0d0817] p-6 sm:rounded-3xl md:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-ember">{selected.id}</p>
                <h2 className="mt-1 font-display text-3xl">{selected.fullName}</h2>
                <div className="mt-2"><StatusBadge s={selected.paymentStatus} /></div>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                aria-label="Close details"
                className="rounded-full border border-white/15 p-2 text-white/70 hover:border-white/40 hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">Personal</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-white/50">Email</dt><dd className="break-all text-right">{selected.email}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-white/50">Mobile</dt><dd>{selected.mobile}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-white/50">WhatsApp</dt><dd>{selected.whatsapp}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-white/50">Gender</dt><dd>{selected.gender ?? "—"}</dd></div>
                </dl>
              </section>
              <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">Academic</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-white/50">College</dt><dd className="text-right">{selected.college}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-white/50">Student ID</dt><dd>{selected.studentId}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-white/50">Branch</dt><dd className="text-right">{selected.branch}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-white/50">Year · Div</dt><dd>{selected.year}{selected.division ? ` · ${selected.division}` : ""}</dd></div>
                </dl>
              </section>
              <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">Profile</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div><dt className="text-white/50">Interests</dt><dd className="mt-1">{(selected.interests ?? []).join(", ") || "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-white/50">Idea?</dt><dd>{selected.hasIdea}</dd></div>
                  {selected.ideaText && <div><dt className="text-white/50">Idea</dt><dd className="mt-1 text-white/80">{selected.ideaText}</dd></div>}
                  <div className="flex justify-between gap-3"><dt className="text-white/50">Startup event</dt><dd>{selected.attendedStartupEvent}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-white/50">E-Cell event</dt><dd>{selected.attendedEcell}</dd></div>
                </dl>
              </section>
              <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">Travel / Emergency</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-white/50">Campus visit</dt><dd>{selected.campusVisit}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-white/50">Travel</dt><dd>{selected.willingToTravel}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-white/50">Emergency</dt><dd className="text-right">{selected.emergencyName} · {selected.emergencyPhone}</dd></div>
                  {selected.accessibility && <div><dt className="text-white/50">Accessibility</dt><dd className="mt-1">{selected.accessibility}</dd></div>}
                  <div className="flex justify-between gap-3"><dt className="text-white/50">Date</dt><dd className="text-xs">{new Date(selected.createdAt).toLocaleString("en-IN")}</dd></div>
                </dl>
              </section>
            </div>

            {/* PAYMENT verification block */}
            <section className="mt-5 rounded-2xl border border-ember/30 bg-ember/[0.06] p-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-ember">Payment verification</h3>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-3"><dt className="text-white/55">Amount</dt><dd className="font-bold">{formatINR(selected.amountPaid)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-white/55">UTR</dt><dd className="font-mono">{selected.utr ?? "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-white/55">Payment ID</dt><dd className="font-mono text-xs">{selected.paymentId ?? "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-white/55">Status</dt><dd><StatusBadge s={selected.paymentStatus} /></dd></div>
              </dl>
              {selected.paymentScreenshot ? (
                <div className="mt-4">
                  <p className="text-xs text-white/55">Screenshot — UTR + amount + date match karo, phir Approve:</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.paymentScreenshot}
                    alt={`Payment screenshot ${selected.id}`}
                    className="mt-2 max-h-[420px] w-full rounded-2xl border border-white/15 bg-black object-contain"
                  />
                  <div className="mt-3 flex flex-wrap gap-3">
                    <a
                      href={selected.paymentScreenshot}
                      download={`${selected.id}-payment.jpg`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white/80 hover:border-ember/60 hover:text-ember"
                    >
                      Open / Download full SS
                    </a>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-amber-200">Screenshot nahi mila — bina SS ke approve mat karo.</p>
              )}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  disabled={acting || selected.paymentStatus === "paid"}
                  onClick={() => void verify(selected.id, "approve")}
                  className="flex-1 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-black pressable hover:brightness-110 disabled:opacity-40"
                >
                  {acting ? "Saving…" : "✓ Verify & mark PAID"}
                </button>
                <button
                  disabled={acting || selected.paymentStatus === "pending"}
                  onClick={() => void verify(selected.id, "reject")}
                  className="flex-1 rounded-full border border-red-400/40 px-6 py-3 text-sm font-bold text-red-200 pressable hover:bg-red-500/10 disabled:opacity-40"
                >
                  Reject → pending
                </button>
              </div>
              <p className="mt-3 text-xs text-white/45">
                Approve sirf tab jab UTR 12-digit + screenshot me same amount + date dikhe. Doubt ho to pehle student se WhatsApp pe confirm karo.
              </p>
            </section>
          </div>
        </div>
      )}
      <SiteFooter />
    </>
  );
}
