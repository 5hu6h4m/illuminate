"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearSavedRegistration, loadSavedRegistration, type SavedRegistration } from "@/lib/registration-continuation";

/**
 * Surfaces this device's previously issued registration link, if any.
 * The link is rendered only from same-origin localStorage and only when it
 * matches the expected status-URL shape (validated in the loader), so a
 * planted value can never become an open redirect or foreign link.
 */
export function SavedRegistrationBanner() {
  // Render null on the first pass (matching SSR) and read localStorage in an
  // effect: reading it during render hydrates differently when a saved
  // registration exists only on the client, causing a hydration mismatch.
  const [saved, setSaved] = useState<SavedRegistration | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Isomorphic localStorage read must run post-hydration so first client render matches SSR (null).
    setSaved(loadSavedRegistration(window.localStorage));
  }, []);
  if (!saved) return null;
  return <div className="registration-preview" role="status">
    <p>You already started a registration on this device ({saved.publicId}).{" "}
      <Link className="underline" href={saved.statusUrl}>Continue your registration</Link>
      {" "}instead of starting a new one.{" "}
      <button
        type="button"
        className="underline"
        onClick={() => { clearSavedRegistration(window.localStorage); setSaved(null); }}
      >
        Start fresh
      </button>
    </p>
  </div>;
}
