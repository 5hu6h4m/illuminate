"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { isPaymentRegistrationAvailable } from "@/config/event";

const links = [["About", "#about"], ["Speakers", "#speakers"], ["Experience", "#journey"], ["E-Cell IITB", "#iitb"], ["Details", "#details"], ["FAQ", "#faq"], ["Contact", "#contact"]] as const;

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const registrationAvailable = isPaymentRegistrationAvailable();
  const cta = registrationAvailable ? { href: "/register", label: "Register Now" } : { href: "#details", label: "Opening soon" };
  return <header className="landing-header"><div className="landing-header__inner"><Link href="#top" className="landing-brand landing-brand--logo-only" aria-label="Illuminate home"><Image src="/images/logo2.png" alt="Illuminate" width={948} height={345} className="landing-brand__illuminate-only" priority /></Link><nav className="landing-nav" aria-label="Primary navigation">{links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav><Link href={cta.href} className={`landing-header__cta ${registrationAvailable ? "" : "is-muted"}`}>{cta.label}</Link><button type="button" className="landing-menu" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="landing-mobile-nav" onClick={() => setOpen((value) => !value)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>{open ? <X aria-hidden /> : <Menu aria-hidden />}</button></div>{open ? <nav id="landing-mobile-nav" className="landing-mobile-nav" aria-label="Mobile navigation">{links.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}<Link href={cta.href} onClick={() => setOpen(false)}>{cta.label}</Link></nav> : null}</header>;
}
