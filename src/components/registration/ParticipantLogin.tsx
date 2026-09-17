"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { saveRegistration } from "@/lib/registration-continuation";

/**
 * Participant login with Illuminate ID + registered contact.
 * Re-issues the holder's own private status link on any device, so a lost
 * localStorage banner never forces a duplicate registration (409 loop).
 */
export function ParticipantLogin() {
  const [publicId, setPublicId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const normalizedId = publicId.trim().toUpperCase();
    if (!/^ILL26-[A-Z0-9]{6}$/.test(normalizedId)) {
      setError("Enter your Illuminate ID (e.g. ILL26-ABCDEF).");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("Enter your registered email or mobile number.");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, string> = { publicId: normalizedId };
      if (email.trim()) body.email = email.trim();
      if (phone.trim()) body.phone = phone.trim();
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
      setError(cause instanceof Error ? cause.message : "Could not find your registration.");
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="participant-login-title">
      <p className="text-eyebrow">Participant login</p>
      <h1 id="participant-login-title" tabIndex={-1}>Find your registration</h1>
      <p className="registration-step__intro">
        Enter your Illuminate ID and the email or mobile number you registered with.
        We&apos;ll reopen your private payment and status link on this device.
      </p>
      <form noValidate onSubmit={(e) => void submit(e)}>
        <div className="registration-fields">
          <label className="registration-field registration-field--wide" htmlFor="login-publicId">
            <span>Illuminate ID <b aria-hidden>*</b></span>
            <input
              id="login-publicId"
              name="publicId"
              autoComplete="off"
              placeholder="ILL26-ABCDEF"
              value={publicId}
              onChange={(e) => { setPublicId(e.target.value); setError(""); }}
              aria-invalid={Boolean(error && !publicId.trim())}
            />
          </label>
          <label className="registration-field" htmlFor="login-email">
            <span>Registered email</span>
            <input
              id="login-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
            />
          </label>
          <label className="registration-field" htmlFor="login-phone">
            <span>Registered mobile</span>
            <input
              id="login-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(""); }}
            />
          </label>
        </div>
        <p className="registration-field__help">At least one contact is required. Both the ID and the contact must match the same registration.</p>
        {error && <p className="registration-field__error" role="alert">{error}</p>}
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
