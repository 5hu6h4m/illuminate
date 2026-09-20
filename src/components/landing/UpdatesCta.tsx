"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { RegistrationClosedDialog } from "@/components/landing/RegistrationClosedDialog";

export function UpdatesCta({ cta, manuallyClosed = false }: { cta: { href: string; label: string }; manuallyClosed?: boolean }) {
  const [closedOpen, setClosedOpen] = useState(false);
  if (manuallyClosed) {
    return (
      <>
        <button type="button" className="landing-button" onClick={() => setClosedOpen(true)}>
          <span>Registration Closed</span>
          <ArrowUpRight aria-hidden />
        </button>
        {closedOpen ? <RegistrationClosedDialog variant="closed" onClose={() => setClosedOpen(false)} /> : null}
      </>
    );
  }
  return (
    <Link href={cta.href} className="landing-button">
      <span>{cta.label}</span>
      <ArrowUpRight aria-hidden />
    </Link>
  );
}
