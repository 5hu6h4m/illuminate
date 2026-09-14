import Link from "next/link";
import { event } from "@/config/event";
import { Container } from "@/components/ui/Container";

export function SiteFooter() {
  return <footer id="contact" className="border-t border-border-subtle bg-surface/80"><Container className="py-10"><p className="font-display text-2xl text-text-primary">{event.identity.name}</p><p className="mt-2 text-body text-text-secondary">Hosted by {event.organizer.name}. For registration or payment support, contact {event.contacts.organizer.value} at <a className="underline" href={`mailto:${event.contacts.support.value}`}>{event.contacts.support.value}</a>.</p><nav className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-secondary" aria-label="Policies"><Link className="underline" href="/privacy">Privacy</Link><Link className="underline" href="/terms">Terms</Link><Link className="underline" href="/refunds">Refund information</Link></nav><p className="mt-6 text-label text-text-muted">© {event.identity.edition} {event.organizer.name}</p></Container></footer>;
}
