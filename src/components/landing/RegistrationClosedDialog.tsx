"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

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
    body: "Thank you so much for your interest in Illuminate 2026! All 90 seats have now been filled and registrations are closed. We are grateful for the overwhelming response.",
  },
};

/**
 * Thankful "no new registrations" popup. `closed` = admin manually closed
 * registrations; `full` = the 90-seat event cap was reached. Celebratory,
 * not an error wall: thanks the visitor and routes existing holders to
 * login. Escape or backdrop click dismisses; any inline form message stays.
 */
export function RegistrationClosedDialog({ variant, onClose }: { variant: RegistrationClosedVariant; onClose: () => void }) {
  const copy = COPY[variant];
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    headingRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={copy.titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="credential-frame mx-auto my-8 max-w-xl">
        <div className="credential-frame__inner p-6 text-center">
          <p className="text-eyebrow" aria-hidden>
            Thank you
          </p>
          <h2 id={copy.titleId} ref={headingRef} tabIndex={-1} className="mt-2 text-2xl font-semibold">
            {copy.title}
          </h2>
          <p className="mt-3 text-sm text-text-secondary">{copy.body}</p>
          <p className="mt-2 text-sm text-text-secondary">
            Already registered? <Link className="underline" href="/login">Log in with your email or mobile</Link> to
            open your status. For queries, contact E-Cell MET Team at met.iot.ecell@gmail.com.
          </p>
          <div className="registration-actions mt-5 justify-center">
            <Link href="/login" className="registration-primary-action">
              Log in to your registration
            </Link>
            <button type="button" className="registration-back" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
