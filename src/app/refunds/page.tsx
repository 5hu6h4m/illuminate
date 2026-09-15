import type { Metadata } from "next";
import Link from "next/link";
import { event } from "@/config/event";
import { PolicyShell } from "@/components/PolicyShell";

export const metadata: Metadata = { title: "Refund information | Illuminate", robots: { index: true, follow: true } };

export default function RefundsPage() {
  return <PolicyShell eyebrow="Illuminate 2026" title="Refund information">
    <p className="mt-8 text-text-secondary">Registration fees are non-refundable once payment has been verified.</p>
    <p className="mt-4 text-text-secondary">For an operational registration issue, contact {event.contacts.organizer.value} at <a className="underline" href={`mailto:${event.contacts.support.value}`}>{event.contacts.support.value}</a>.</p>
    <p className="mt-10 text-sm"><Link className="underline" href="/terms">Registration terms</Link> <span aria-hidden>·</span> <Link className="underline" href="/privacy">Privacy</Link></p>
  </PolicyShell>;
}
