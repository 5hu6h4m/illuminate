"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { event, isPaymentRegistrationAvailable } from "@/config/event";

const links = [["About", "#about"], ["Experience", "#journey"], ["Details", "#details"], ["FAQ", "#faq"]] as const;

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const registrationAvailable = isPaymentRegistrationAvailable();
  const cta = registrationAvailable ? { href: "/register", label: "Register" } : { href: "#details", label: "Opening soon" };
  return <header className="landing-header"><div className="landing-header__inner"><Link href="#top" className="landing-brand" aria-label="Illuminate home"><span className="landing-brand__mark" aria-hidden /><span>{event.identity.name}</span><small>{event.organizer.name}</small></Link><nav className="landing-nav" aria-label="Primary navigation">{links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav><Link href={cta.href} className={`landing-header__cta ${registrationAvailable ? "" : "is-muted"}`}>{cta.label}</Link><button type="button" className="landing-menu" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</button></div>{open ? <nav className="landing-mobile-nav" aria-label="Mobile navigation">{links.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}<Link href={cta.href} onClick={() => setOpen(false)}>{cta.label}</Link></nav> : null}</header>;
}
