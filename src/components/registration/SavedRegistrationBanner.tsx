"use client";

import Link from "next/link";
import { useState } from "react";
import { clearSavedRegistration, loadSavedRegistration, type SavedRegistration } from "@/lib/registration-continuation";

/**
 * Surfaces this device's previously issued registration link, if any.
 * The link is rendered only from same-origin localStorage and only when it
 * matches the expected status-URL shape (validated in the loader), so a
 * planted value can never become an open redirect or foreign link.
 */
export function SavedRegistrationBanner() {
  // Client component: localStorage read belongs in the lazy initializer,
  // not an effect (avoids a cascading render; SSR-safe via typeof guard).
  const [saved, setSaved] = useState<SavedRegistration | null>(() =>
    typeof window === "undefined" ? null : loadSavedRegistration(window.localStorage),
  );
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
