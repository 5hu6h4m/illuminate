import Link from "next/link";

/** Compatibility destination; it never retrieves a record from an id query string. */
export default function SuccessPage() {
  return <main className="mx-auto max-w-2xl px-6 py-24 text-center"><p className="text-eyebrow text-brand-electric">Illuminate 2026</p><h1 className="mt-3 text-display">Registration status</h1><p className="mt-5 text-text-secondary">New registrations use the private status link shown after payment registration is created. If you no longer have it, contact the organizer; this page deliberately cannot retrieve a participant record by public reference, email, or phone.</p><Link href="/register" className="registration-primary-action mt-8 inline-flex">Register <span aria-hidden>→</span></Link></main>;
}
