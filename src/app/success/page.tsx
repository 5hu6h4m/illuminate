import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { Container } from "@/components/ui/Container";

/** Compatibility destination; it never retrieves a record from an id query string. */
export default function SuccessPage() {
  return <div className="registration-shell"><main className="mx-auto max-w-2xl px-6 py-24"><Container><div className="credential-frame"><div className="credential-frame__inner p-8 text-center md:p-12"><span className="credential-frame__node mx-auto" aria-hidden /><p className="text-eyebrow">Illuminate 2026 · E-Cell IIT Bombay × E-Cell MET</p><h1 className="mt-3 text-display">Registration status</h1><hr className="thread-divider" aria-hidden /><p className="mx-auto mt-5 max-w-xl text-text-secondary">New registrations use the private status link shown after payment registration is created — it shows your Registration ID and real-time payment verification. If you no longer have it, contact the organizer; this page deliberately cannot retrieve a participant record by public reference, email, or phone.</p><Link href="/register" className="registration-primary-action mt-8 inline-flex">Register Now <span aria-hidden>→</span></Link></div></div></Container></main><SiteFooter /></div>;
}
