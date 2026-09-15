"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const MIN_DISPLAY_MS = 1800;
const MAX_WAIT_MS = 5000;
const EXIT_MS = 700;

/**
 * Full-site preloader: brand moment over the whole landing until the page
 * has loaded AND the hero video can play. Safety caps guarantee it always
 * lifts — never traps the site on black.
 */
export function SitePreloader() {
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">("show");
  const prevOverflow = useRef("");

  useEffect(() => {
    const startedAt = Date.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const min = reduced ? 400 : MIN_DISPLAY_MS;
    let leaving = false;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;

    const leave = () => {
      if (leaving) return;
      leaving = true;
      const wait = Math.max(0, min - (Date.now() - startedAt));
      window.setTimeout(() => {
        setPhase("leaving");
        exitTimer = setTimeout(() => setPhase("gone"), EXIT_MS);
      }, wait);
    };

    let pageLoaded = document.readyState === "complete";
    let heroReady = false;
    const maybe = () => {
      if (pageLoaded && heroReady) leave();
    };
    const onLoad = () => {
      pageLoaded = true;
      maybe();
    };
    const onHero = () => {
      heroReady = true;
      maybe();
    };
    window.addEventListener("load", onLoad);
    window.addEventListener("illuminate:hero-ready", onHero);
    const maxTimer = window.setTimeout(leave, MAX_WAIT_MS);

    const prevOverflowBackup = document.body.style.overflow;
    prevOverflow.current = prevOverflowBackup;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("load", onLoad);
      window.removeEventListener("illuminate:hero-ready", onHero);
      window.clearTimeout(maxTimer);
      if (exitTimer) clearTimeout(exitTimer);
      document.body.style.overflow = prevOverflow.current;
    };
  }, []);

  // Release the scroll lock as the curtain lifts — the component stays
  // mounted (rendering null), so cleanup alone would never restore it.
  useEffect(() => {
    if (phase !== "show") document.body.style.overflow = prevOverflow.current;
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div className={`site-preloader${phase === "leaving" ? " is-leaving" : ""}`} role="status" aria-label="Loading Illuminate">
      <div className="site-preloader__inner">
        <div className="site-preloader__lockup">
          <Image src="/images/logo2.png" alt="Illuminate" width={948} height={345} className="site-preloader__logo" priority />
          <span aria-hidden="true" className="site-preloader__x">×</span>
          <Image src="/images/ecell-logo.png" alt="E-Cell MET" width={500} height={500} className="site-preloader__met" priority />
        </div>
        <span className="site-preloader__seam" aria-hidden="true" />
        <span className="site-preloader__caption">Igniting ideas</span>
      </div>
    </div>
  );
}
