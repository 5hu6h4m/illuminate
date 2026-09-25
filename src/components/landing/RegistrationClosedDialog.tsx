"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export type RegistrationClosedVariant = "closed" | "full";

const COPY: Record<RegistrationClosedVariant, { titleId: string; title: string; body: string }> = {
  closed: {
    titleId: "registration-closed-title",
    title: "Registrations are closed",
    body: "Thank you so much for your interest in Illuminate 2026! New registrations are currently closed. We are grateful for the overwhelming response.",
  },
  full: {
    titleId: "registration-full-title",
    title: "Registrations are full",
    body: "Thank you so much for your interest in Illuminate 2026! All 120 seats have now been filled and registrations are closed. We are grateful for the overwhelming response.",
  },
};

/**
 * Thankful "no new registrations" popup. `closed` = admin manually closed
 * registrations; `full` = the 120-seat event cap was reached. Celebratory,
 * not an error wall: thanks the visitor and routes existing holders to
 * login. Escape or backdrop click dismisses; any inline form message stays.
 *
 * Rendered via portal to document.body: callers live inside the sticky
 * landing header (backdrop-filter makes it a containing block for fixed
 * descendants), so an inline fixed overlay would clip under the header bar.
 */
export function RegistrationClosedDialog({ variant, onClose }: { variant: RegistrationClosedVariant; onClose: () => void }) {
  const copy = COPY[variant];
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Portal target exists only on the client; server snapshot renders null so
  // SSR markup matches hydration. Re-reads client-side after hydration.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    headingRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="registration-closed-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={copy.titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="credential-frame registration-closed-panel">
        <div className="credential-frame__inner registration-closed-inner">
          <p className="text-eyebrow" aria-hidden>
            Thank you
          </p>
          <h2 id={copy.titleId} ref={headingRef} tabIndex={-1} className="registration-closed-title">
            {copy.title}
          </h2>
          <p className="mt-3 text-sm text-text-secondary">{copy.body}</p>
          <p className="mt-2 text-sm text-text-secondary">
            Already registered? <Link className="underline" href="/login">Log in with your email or mobile</Link> to
            open your status. For queries, contact E-Cell MET Team at <span className="registration-closed-contact">met.iot.ecell@gmail.com</span>.
          </p>
          <div className="registration-closed-actions">
            <Link href="/login" className="registration-primary-action registration-closed-primary">
              Log in to your registration
            </Link>
            <button type="button" className="registration-closed-dismiss" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
