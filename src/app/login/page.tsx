import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { ParticipantLogin } from "@/components/registration/ParticipantLogin";
import { event } from "@/config/event";
import { Container } from "@/components/ui/Container";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Participant login | Illuminate",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default function LoginPage() {
  return (
    <div className="registration-shell">
      <header className="registration-header">
        <Container className="registration-header__inner">
          <Link href="/" className="registration-brand" aria-label="Back to Illuminate">
            <span className="registration-brand__logos" aria-hidden>
              <Image src="/images/logo2.png" alt="" width={120} height={44} />
              <span className="registration-brand__x">·</span>
              <Image src="/images/ecell-logo.png" alt="" width={40} height={40} className="registration-brand__met" />
            </span>
            <span><strong>{event.identity.name} {event.identity.edition}</strong></span>
          </Link>
          <Link href="/" className="registration-return"><ArrowLeft aria-hidden /> Back to event</Link>
        </Container>
      </header>
      <main className="registration-main">
        <Container>
          <div className="registration-layout">
            <div className="registration-wizard">
              <ParticipantLogin />
            </div>
            <aside className="registration-summary" aria-label="Login help">
              <p className="text-eyebrow">Illuminate {event.identity.edition}</p>
              <h2>Your Illuminate ID</h2>
              <p>Your ID looks like <strong className="font-mono">ILL26-ABCDEF</strong> and was shown right after registration.</p>
              <div><span>Login needs</span><strong>ID + registered email or mobile</strong></div>
              <div><span>New participant?</span><strong><Link className="underline" href="/register">Register instead</Link></strong></div>
            </aside>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
