import type { Metadata } from "next";
import Link from "next/link";
import { event } from "@/config/event";
import { PolicyShell } from "@/components/PolicyShell";

export const metadata: Metadata = { title: "Privacy | Illuminate", robots: { index: true, follow: true } };

export default function PrivacyPage() {
  return <PolicyShell eyebrow="Illuminate 2026" title="Privacy">
    <div className="mt-8 space-y-6 text-text-secondary">
      <p>We collect only information necessary to manage your Illuminate registration, verify payment, communicate event updates, and complete legitimate event administration.</p>
      <section><h2 className="text-xl font-semibold text-text-primary">Information used for registration</h2><p className="mt-2">This can include your name, email address, phone number, approved academic details where requested, UPI transaction/reference ID, and payment proof.</p></section>
      <section><h2 className="text-xl font-semibold text-text-primary">Payment proof and access</h2><p className="mt-2">Payment proof is used only to support manual verification. It is stored privately and is not publicly displayed. Authorized E-Cell MET administrators can access registration and payment information when needed for event administration.</p></section>
      <section><h2 className="text-xl font-semibold text-text-primary">Sharing and retention</h2><p className="mt-2">Participant information is not sold. Event-registration information may be used or shared only where necessary for legitimate Illuminate event administration or reporting. A retention schedule has not yet been confirmed; retention handling remains an organizer and infrastructure follow-up.</p></section>
      <section><h2 className="text-xl font-semibold text-text-primary">Questions</h2><p className="mt-2">For privacy or registration questions, contact {event.contacts.organizer.value} at <a className="underline" href={`mailto:${event.contacts.support.value}`}>{event.contacts.support.value}</a>.</p></section>
    </div>
    <p className="mt-10 text-sm"><Link className="underline" href="/terms">Read the registration terms</Link> <span aria-hidden>·</span> <Link className="underline" href="/refunds">Refund information</Link></p>
  </PolicyShell>;
}
