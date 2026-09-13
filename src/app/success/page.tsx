"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BadgeCheck,
  Bus,
  CalendarPlus,
  Clock,
  GraduationCap,
  Handshake,
  Landmark,
  MessageCircle,
  Mic,
  PartyPopper,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { IconTile } from "@/components/IconTile";
import { loadRegistrations, type Registration } from "@/lib/registration";
import { formatINR } from "@/lib/pricing";

const PERKS: { icon: LucideIcon; label: string }[] = [
  { icon: GraduationCap, label: "IIT Bombay Certificate" },
  { icon: Rocket, label: "Startup Kit" },
  { icon: Mic, label: "6-Hour Workshop" },
  { icon: Handshake, label: "Networking" },
  { icon: Landmark, label: "Campus Visit Opportunity*" },
  { icon: Bus, label: "Travel Opportunity*" },
];

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
  const [icsUrl, setIcsUrl] = useState("#");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/registrations?id=${encodeURIComponent(id)}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json?.data) {
            setReg(json.data as Registration);
            return;
          }
        }
      } catch {
        /* API unavailable (DB not configured) → local fallback */
      }
      if (!cancelled) {
        setReg(loadRegistrations().find((r) => r.id === id) ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!reg) return;
    const url = URL.createObjectURL(new Blob([buildICS(reg)], { type: "text/calendar" }));
    setIcsUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [reg]);

  const paid = reg?.paymentStatus === "paid";

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-center md:py-24">
      <IconTile icon={PartyPopper} size="lg" className="mx-auto" />
      <h1 className="mt-6 font-display text-4xl md:text-5xl">REGISTRATION CONFIRMED!</h1>
      <p className="mt-3 text-white/65">Welcome to Illuminate 2026!</p>
      {!reg ? (
        <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <p className="text-white/70">
            We couldn&apos;t find registration <code>{id || "—"}</code> on this device
            (registrations demo-store in this browser).
          </p>
          <Link href="/register" className="pressable mt-6 inline-block rounded-full bg-ember px-8 py-3 font-bold text-white transition-colors hover:bg-ember-deep">
            Register again
          </Link>
        </div>
      ) : (
        <>
          <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-ember/30 bg-ember/[0.06] p-8 text-left">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-white/55">Registration ID</dt><dd className="font-mono font-bold text-ember-soft">{reg.id}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-white/55">Participant</dt><dd>{reg.fullName}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-white/55">Amount paid</dt><dd>{paid ? formatINR(reg.amountPaid) : "Pending verification"}</dd></div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/55">Payment status</dt>
                <dd className="flex items-center gap-1.5">
                  {paid
                    ? <><BadgeCheck className="h-4 w-4 text-emerald-400" aria-hidden /> Successful</>
                    : <><Clock className="h-4 w-4 text-amber-300" aria-hidden /> {reg.paymentStatus}</>}
                </dd>
              </div>
            </dl>
          </div>
          <div className="mx-auto mt-8 grid max-w-xl gap-3 text-left text-sm text-white/70 sm:grid-cols-2">
            {PERKS.map((p) => (
              <p key={p.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <p.icon className="h-5 w-5 shrink-0 text-ember-soft" strokeWidth={1.8} aria-hidden />
                {p.label}
              </p>
            ))}
            <p className="text-xs text-white/45 sm:col-span-2">*Subject to applicable eligibility / selection criteria.</p>
          </div>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="https://chat.whatsapp.com/REPLACE_WITH_OFFICIAL_LINK" target="_blank" rel="noreferrer"
              className="pressable flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-8 py-3.5 font-bold text-ink transition-colors hover:brightness-110">
              <MessageCircle className="h-5 w-5" aria-hidden /> Join WhatsApp group
            </a>
            <a href={icsUrl} download="illuminate-2026.ics"
              className="pressable flex items-center justify-center gap-2 rounded-full border border-white/20 px-8 py-3.5 font-semibold text-white/85 transition-colors hover:border-ember/60 hover:text-ember-soft">
              <CalendarPlus className="h-5 w-5" aria-hidden /> Add event to calendar
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
