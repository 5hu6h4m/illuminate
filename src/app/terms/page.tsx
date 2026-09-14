import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Registration terms | Illuminate", robots: { index: true, follow: true } };

export default function TermsPage() {
  return <main className="mx-auto max-w-3xl px-5 py-16 md:py-24">
    <p className="text-eyebrow text-brand-electric">Illuminate 2026</p>
    <h1 className="mt-3 text-display">Registration terms</h1>
    <ul className="mt-8 list-disc space-y-3 pl-5 text-text-secondary">
      <li>Registration information submitted for Illuminate must be genuine and accurate.</li>
      <li>Payment details and payment proof must be genuine. Altered, fraudulent, or unverifiable payment evidence may be rejected.</li>
      <li>A registration is confirmed only after an authorized organizer manually verifies payment in the authorized recipient account.</li>
      <li>Organizers may communicate operational event updates and may update confirmed event details when necessary.</li>
      <li>Participants must follow organizer and venue rules that apply to the event.</li>
      <li>Registration fees are non-refundable once payment has been verified.</li>
    </ul>
    <p className="mt-10 text-sm"><Link className="underline" href="/privacy">Privacy</Link> <span aria-hidden>·</span> <Link className="underline" href="/refunds">Refund information</Link></p>
  </main>;
}
