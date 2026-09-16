"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const links = [["Entrepreneurship", "#entrepreneurship"], ["Experience", "#journey"], ["Details", "#event-details"], ["FAQ", "#faq"], ["Contact", "#contact"]] as const;

export function LandingHeader({ registrationAvailable }: { registrationAvailable: boolean }) {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);
  const returnFocusRef = useRef(false);
  const cta = registrationAvailable ? { href: "/register", label: "Register Now" } : { href: "#event-details", label: "View event details" };
  useEffect(() => {
    if (open) {
      firstMobileLinkRef.current?.focus();
      return;
    }
    if (returnFocusRef.current) {
      menuButtonRef.current?.focus();
      returnFocusRef.current = false;
    }
  }, [open]);

  const closeFromEscape = () => {
    returnFocusRef.current = true;
    setOpen(false);
  };

  return <header className="landing-header" onKeyDown={(event) => { if (open && event.key === "Escape") { event.preventDefault(); closeFromEscape(); } }}><div className="landing-header__inner"><Link href="#top" className="landing-brand landing-brand--logo-only" aria-label="Illuminate home"><Image src="/images/logo2.png" alt="Illuminate" width={948} height={345} className="landing-brand__illuminate-only" priority /></Link><nav className="landing-nav" aria-label="Primary navigation">{links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav><Link href={cta.href} className={`landing-header__cta ${registrationAvailable ? "" : "is-muted"}`}>{cta.label}</Link><button ref={menuButtonRef} type="button" className="landing-menu" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="landing-mobile-nav" onClick={() => setOpen((value) => !value)}>{open ? <X aria-hidden /> : <Menu aria-hidden />}</button></div>{open ? <nav id="landing-mobile-nav" className="landing-mobile-nav" aria-label="Mobile navigation">{links.map(([label, href], index) => <a key={href} href={href} ref={index === 0 ? firstMobileLinkRef : undefined} onClick={() => setOpen(false)}>{label}</a>)}<Link href={cta.href} onClick={() => setOpen(false)}>{cta.label}</Link></nav> : null}</header>;
}
