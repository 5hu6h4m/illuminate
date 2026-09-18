import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { illuminateContent } from "@/content/illuminate";
import { Reveal } from "@/components/Reveal";
import { IgnitionThread } from "@/components/landing/IgnitionThread";
import { Container } from "@/components/ui/Container";

type FinalCtaProps = {
  cta: { href: string; label: string };
};

export function FinalCta({ cta }: FinalCtaProps) {
  const content = illuminateContent.finalCta;

  return (
    <section className="landing-final" aria-labelledby="final-cta-title">
      <Container>
        <Reveal doorway>
          <div className="landing-final__inner">
            <IgnitionThread variant="converge" />
            <p className="text-eyebrow">Illuminate 2026</p>
            <h2 id="final-cta-title">{content.title}</h2>
            <p>{content.description}</p>
            <Link href={cta.href} className="landing-button"><span>{cta.label}</span><ArrowUpRight aria-hidden /></Link>
            <p className="landing-final__login-wrap"><Link href="/login" className="landing-final__login">Already registered? Log in</Link></p>
            <ul className="landing-final__assurances" aria-label="Registration reassurance">
              {content.assurances.map((assurance) => <li key={assurance}>{assurance}</li>)}
            </ul>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
