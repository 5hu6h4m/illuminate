import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { ParticipantLogin } from "@/components/registration/ParticipantLogin";
import { Container } from "@/components/ui/Container";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recover registration | Illuminate",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default function RecoverPage() {
  return (
    <div className="registration-shell">
      <header className="registration-header">
        <Container className="registration-header__inner">
          <Link href="/" className="registration-return"><ArrowLeft aria-hidden /> Back to event</Link>
        </Container>
      </header>
      <main className="registration-main">
        <Container>
          <div className="registration-layout">
            <div className="registration-wizard">
              <ParticipantLogin />
            </div>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
