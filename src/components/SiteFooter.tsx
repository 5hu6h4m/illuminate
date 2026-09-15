import Image from "next/image";
import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { event } from "@/config/event";
import { Container } from "@/components/ui/Container";

const explore = [["About", "/#about"], ["Speakers", "/#speakers"], ["Experience", "/#journey"], ["IIT Bombay", "/#iitb"], ["Details", "/#details"], ["FAQ", "/#faq"], ["Contact", "/#contact"]] as const;

export function SiteFooter() {
  return <footer className="site-footer"><Container className="site-footer__inner">
    <div className="site-footer__top"><div className="site-footer__brands"><Image unoptimized src="/images/logo2.png" alt="Illuminate 2026 official logo" width={188} height={68} className="site-footer__illuminate" /><span aria-hidden className="site-footer__x">×</span><Image unoptimized src="/images/ecell-logo.png" alt="E-Cell MET logo" width={72} height={72} className="site-footer__met" /><span aria-hidden className="site-footer__x">×</span><Image unoptimized src="/images/e-cell-iitb.png" alt="E-Cell IIT Bombay logo" width={54} height={62} className="site-footer__iitb" /></div><a href="#top" className="site-footer__top-link" aria-label="Back to top"><ArrowUp aria-hidden /> Top</a></div>
    <p aria-hidden className="site-footer__giant">Illuminate</p>
    <div className="site-footer__grid">
      <div><p className="site-footer__label">Explore</p><nav className="site-footer__links" aria-label="Footer">{explore.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav></div>
      <div><p className="site-footer__label">Support</p><p className="site-footer__text">Hosted by {event.organizer.name}. For registration or payment support, contact {event.contacts.organizer.value} at <a className="underline" href={`mailto:${event.contacts.support.value}`}>{event.contacts.support.value}</a>.</p><Link href="/register" className="site-footer__cta">Register Now <span aria-hidden>→</span></Link></div>
      <div><p className="site-footer__label">Policies</p><nav className="site-footer__links" aria-label="Policies"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/refunds">Refund information</Link></nav></div>
    </div>
    <div className="site-footer__bottom"><p>© {event.identity.edition} {event.organizer.name} · Associated with the Illuminate initiative of E-Cell IIT Bombay</p></div>
  </Container></footer>;
}
