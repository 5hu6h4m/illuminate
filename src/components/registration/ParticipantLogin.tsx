"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { saveRegistration } from "@/lib/registration-continuation";
import {
  isIlluminateId,
  isLoginPhone,
  normalizeIlluminateId,
} from "@/lib/login-identifier";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

type IdentifierKind = "id" | "email" | "phone" | "unknown";

/**
 * Client-side detection for hint specificity. Intentionally stricter than the
 * server `parseLoginIdentifier` (the source of truth): `@`-containing input
 * is "email, but malformed" and digit-embedded junk is `unknown`, so the form
 * can show a specific hint instead of a generic reject. Anything the client
 * accepts, the server also accepts.
 */
function detectIdentifierKind(raw: string): IdentifierKind {
  const value = raw.trim();
  if (isIlluminateId(value)) return "id";
  if (value.includes("@")) return "email";
  if (/^[\d\s+()\-]+$/.test(value) && value.replace(/\D/g, "").length >= 7) return "phone";
  if (/^ILL/i.test(value)) return "id";
  return "unknown";
}

/**
 * Single smart identifier + optional Illuminate ID.
 * Sends the new `{ identifier, illuminateId? }` shape together with legacy
 * `{ publicId, email, phone }` keys — the recover route accepts both, so
 * old and new clients keep working during the transition.
 */
export function ParticipantLogin() {
  const [identifier, setIdentifier] = useState("");
  const [illuminateId, setIlluminateId] = useState("");
  const [error, setError] = useState("");
  const [errorTarget, setErrorTarget] = useState<"primary" | "secondary" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fail = (message: string, target: "primary" | "secondary" = "primary") => {
    setError(message);
    setErrorTarget(target);
  };
  const clearError = () => {
    setError("");
    setErrorTarget(null);
  };

  // Valid ID in field 1 means field 2 morphs into required contact input.
  const identifierIsId = identifier.trim() !== "" && isIlluminateId(identifier);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();

    const primary = identifier.trim();
    const secondary = illuminateId.trim();

    if (!primary) {
      fail("Enter your registered email, mobile number, or Illuminate ID.");
      return;
    }

    const kind = detectIdentifierKind(primary);
    if (kind === "email" && !isValidEmail(primary)) {
      fail("Check your email — it should look like you@example.com.");
      return;
    }
    if (kind === "phone" && !isLoginPhone(primary)) {
      fail("Enter the 10-digit mobile number you registered with.");
      return;
    }
    if (kind === "id" && !isIlluminateId(primary)) {
      fail("Enter your Illuminate ID (e.g. ILL26-ABCDEF).");
      return;
    }
    if (kind === "unknown") {
      fail("Enter a valid email, mobile number, or Illuminate ID (e.g. ILL26-ABCDEF).");
      return;
    }

    if (kind === "id") {
      if (!secondary) {
        fail("Enter the email or mobile you registered with.", "secondary");
        return;
      }
      if (secondary.includes("@") ? !isValidEmail(secondary) : !isLoginPhone(secondary)) {
        fail(
          secondary.includes("@")
            ? "Check your email — it should look like you@example.com."
            : "Enter the 10-digit mobile number you registered with.",
          "secondary",
        );
        return;
      }
    } else if (secondary && !isIlluminateId(secondary)) {
      fail("Enter your Illuminate ID (e.g. ILL26-ABCDEF).", "secondary");
      return;
    }

    setSubmitting(true);
    try {
      let body: Record<string, string>;
      if (kind === "email") {
        body = { identifier: primary, email: primary };
        if (secondary) {
          const normalized = normalizeIlluminateId(secondary);
          body.illuminateId = normalized;
          body.publicId = normalized;
        }
      } else if (kind === "phone") {
        body = { identifier: primary, phone: primary };
        if (secondary) {
          const normalized = normalizeIlluminateId(secondary);
          body.illuminateId = normalized;
          body.publicId = normalized;
        }
      } else {
        const normalized = normalizeIlluminateId(primary);
        body = { identifier: normalized, publicId: normalized };
        if (secondary.includes("@")) body.email = secondary;
        else body.phone = secondary;
      }
      const response = await fetch("/api/payment/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || typeof json?.data?.statusUrl !== "string") {
        throw new Error(json?.error?.message || "No registration matches those details.");
      }
      if (typeof window !== "undefined" && typeof json.data.publicId === "string") {
        saveRegistration(window.localStorage, {
          publicId: json.data.publicId,
          statusUrl: json.data.statusUrl,
          savedAt: new Date().toISOString(),
        });
      }
      window.location.assign(json.data.statusUrl);
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "Could not find your registration.");
      setSubmitting(false);
    }
  };

  // Mobile keyboards follow the detected identifier kind (no flicker: the
  // kind only changes when the input crosses a classification boundary).
  const primaryKind = identifier.trim() ? detectIdentifierKind(identifier) : "unknown";
  const primaryInputMode = primaryKind === "email" ? "email" : primaryKind === "phone" ? "tel" : "text";

  return (
    <section aria-labelledby="participant-login-title">
      <p className="text-eyebrow">Participant login</p>
      <h1 id="participant-login-title" tabIndex={-1}>Find your registration</h1>
      <p className="registration-step__intro">
        Log in with your registered email or mobile number. Your Illuminate ID is optional — add it if you have it.
      </p>
      <form noValidate onSubmit={(e) => void submit(e)}>
        <div className="registration-fields">
          <label className="registration-field registration-field--wide" htmlFor="login-identifier">
            <span>Email, mobile number, or Illuminate ID <b aria-hidden>*</b></span>
            <input
              id="login-identifier"
              name="identifier"
              type="text"
              inputMode={primaryInputMode}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              placeholder="you@example.com / +91 98765 43210 / ILL26-ABCDEF"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); clearError(); }}
              aria-invalid={errorTarget === "primary"}
              aria-describedby={errorTarget === "primary" ? "login-error" : undefined}
            />
          </label>
          {identifierIsId ? (
            <label className="registration-field registration-field--wide" htmlFor="login-contact">
              <span>Registered email or mobile (required with ID) <b aria-hidden>*</b></span>
              <input
                id="login-contact"
                name="contact"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                placeholder="you@example.com / +91 98765 43210"
                value={illuminateId}
                onChange={(e) => { setIlluminateId(e.target.value); clearError(); }}
                aria-invalid={errorTarget === "secondary"}
                aria-describedby={errorTarget === "secondary" ? "login-error" : "login-contact-help"}
              />
              <span id="login-contact-help" className="registration-field__help">
                Use the same email or mobile you registered with. Both must match the same registration.
              </span>
            </label>
          ) : (
            <label className="registration-field registration-field--wide" htmlFor="login-illuminateId">
              <span>Illuminate ID (optional)</span>
              <input
                id="login-illuminateId"
                name="illuminateId"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="ILL26-ABCDEF"
                value={illuminateId}
                onChange={(e) => { setIlluminateId(e.target.value); clearError(); }}
                aria-invalid={errorTarget === "secondary"}
                aria-describedby={errorTarget === "secondary" ? "login-error" : "login-illuminateId-help"}
              />
              <span id="login-illuminateId-help" className="registration-field__help">
                If you have it, add it — helps find you faster. Not required.
              </span>
            </label>
          )}
        </div>
        <p className="registration-field__help">
          {identifierIsId
            ? "Your ID and contact must match the same registration."
            : "We\u2019ll find you by email or mobile. Email or phone alone works — ID just speeds it up."}
        </p>
        {error && <p id="login-error" className="registration-field__error" role="alert">{error}</p>}
        <div className="registration-actions">
          <button type="submit" className="registration-primary-action" disabled={submitting}>
            {submitting ? <><LoaderCircle className="animate-spin" aria-hidden /> Finding…</> : <>Open my registration <ArrowRight aria-hidden /></>}
          </button>
        </div>
      </form>
      <p className="mt-6 text-sm text-text-secondary">
        New here? <Link className="underline" href="/register">Start a registration</Link> · Lost everything? Contact{" "}
        <a className="underline" href="mailto:met.iot.ecell@gmail.com">met.iot.ecell@gmail.com</a>.
      </p>
    </section>
  );
}
