import type { Metadata } from "next";
import Link from "next/link";
import { event } from "@/config/event";

export const metadata: Metadata = { title: "Refund information | Illuminate", robots: { index: true, follow: true } };

export default function RefundsPage() {
  return <main className="mx-auto max-w-3xl px-5 py-16 md:py-24">
    <p className="text-eyebrow text-brand-electric">Illuminate 2026</p>
    <h1 className="mt-3 text-display">Refund information</h1>
    <p className="mt-8 text-text-secondary">Registration fees are non-refundable once payment has been verified.</p>
    <p className="mt-4 text-text-secondary">For an operational registration issue, contact {event.contacts.organizer.value} at <a className="underline" href={`mailto:${event.contacts.support.value}`}>{event.contacts.support.value}</a>.</p>
    <p className="mt-10 text-sm"><Link className="underline" href="/terms">Registration terms</Link> <span aria-hidden>·</span> <Link className="underline" href="/privacy">Privacy</Link></p>
  </main>;
}
