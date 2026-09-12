"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { loadRegistrations, type Registration } from "@/lib/registration";
import { formatINR } from "@/lib/pricing";

function buildICS(r: Registration): string {
  const dt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const start = new Date("2026-10-10T09:00:00+05:30");
  const end = new Date("2026-10-10T16:00:00+05:30");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `UID:${r.id}@illuminate-met`,
    `DTSTAMP:${dt(new Date())}`,
    `DTSTART:${dt(start)}`,
    `DTEND:${dt(end)}`,
    "SUMMARY:Illuminate 2026 — E-Cell IIT Bombay × E-Cell MET",
    "LOCATION:MET Bhujbal Knowledge City",
    `DESCRIPTION:Registration ${r.id}. Report 30 min early with college ID.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function SuccessInner() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const [reg, setReg] = useState<Registration | null>(null);

  useEffect(() => {
    const found = loadRegistrations().find((r) => r.id === id) ?? null;
    setReg(found);
  }, [id]);

  const icsUrl = useMemo(() => {
    if (!reg) return "#";
    return URL.createObjectURL(new Blob([buildICS(reg)], { type: "text/calendar" }));
  }, [reg]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-center md:py-24">
      <p className="text-5xl" aria-hidden>🎉</p>
      <h1 className="mt-6 font-display text-4xl md:text-5xl">REGISTRATION CONFIRMED!</h1>
      <p className="mt-3 text-white/65">Welcome to Illuminate 2026!</p>
      {!reg ? (
        <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <p className="text-white/70">
            We couldn&apos;t find registration <code>{id || "—"}</code> on this device
            (registrations demo-store in this browser).
          </p>
          <Link href="/register" className="mt-6 inline-block rounded-full bg-ember px-8 py-3 font-bold text-ink">
            Register again
          </Link>
        </div>
      ) : (
        <>
          <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-ember/30 bg-ember/[0.06] p-8 text-left">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-white/55">Registration ID</dt><dd className="font-mono font-bold text-ember">{reg.id}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-white/55">Participant</dt><dd>{reg.fullName}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-white/55">Amount paid</dt><dd>{reg.paymentStatus === "paid" ? formatINR(reg.amountPaid) : "Pending verification"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-white/55">Payment status</dt><dd>{reg.paymentStatus === "paid" ? "✅ Successful" : "⏳ " + reg.paymentStatus}</dd></div>
            </dl>
          </div>
          <div className="mx-auto mt-8 grid max-w-xl gap-3 text-left text-sm text-white/70">
            {["🎓 IIT Bombay Certificate", "🚀 Startup Kit", "🎤 6-Hour Workshop", "🤝 Networking", "🏛️ Campus Visit Opportunity*", "🚌 Travel Opportunity*"].map((t) => (
              <p key={t} className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-3">{t}</p>
            ))}
            <p className="text-xs text-white/45">*Subject to applicable eligibility / selection criteria.</p>
          </div>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="https://chat.whatsapp.com/REPLACE_WITH_OFFICIAL_LINK" target="_blank" rel="noreferrer"
              className="rounded-full bg-[#25D366] px-8 py-3.5 font-bold text-ink">
              📲 Join WhatsApp group
            </a>
            <a href={icsUrl} download="illuminate-2026.ics"
              className="rounded-full border border-white/20 px-8 py-3.5 font-semibold text-white/85 hover:border-ember/60 hover:text-ember">
              📅 Add event to calendar
            </a>
          </div>
          <p className="mx-auto mt-8 max-w-xl text-xs leading-relaxed text-white/45">
            Confirmation email spec: name, {reg.id}, date, venue, reporting time, amount, payment ID,
            what-to-bring, WhatsApp link, instructions. Wire Resend with this payload when keys are ready.
          </p>
        </>
      )}
    </main>
  );
}

export default function SuccessPage() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<main className="px-6 py-24 text-center text-white/60">Loading…</main>}>
        <SuccessInner />
      </Suspense>
      <SiteFooter />
    </>
  );
}
