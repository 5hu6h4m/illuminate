"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Copy, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { registrationForm } from "@/config/registration";
import { createRegistrationDetailsSchema, emptyRegistrationDetails, formatIndianPhone, type RegistrationDetails, type RegistrationDetailsDraft } from "@/lib/registration-details";
import { clearAttempt, loadPersistedAttempt, saveRegistration, storeAttempt } from "@/lib/registration-continuation";

type Field = keyof RegistrationDetailsDraft;
const schema = createRegistrationDetailsSchema();
const steps = ["Details", "Review", "Payment"];
const newIdempotencyKey = () => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch { /* fall through to fallback */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
};
const registrationCreationMessages: Record<string, string> = {
  REGISTRATION_ALREADY_STARTED: "A registration is already in progress for these details. Recover your private link with your email or mobile (Illuminate ID optional) instead of registering again, or contact E-Cell MET Team at met.iot.ecell@gmail.com if you no longer have it.",
  REGISTRATION_REQUIRES_ACTION: "A registration needs action. Recover your private link with your email or mobile (Illuminate ID optional) to resubmit payment proof, or contact E-Cell MET Team at met.iot.ecell@gmail.com if you no longer have it.",
  PAYMENT_ALREADY_SUBMITTED: "Payment proof for this registration is already awaiting verification. Recover your private link with your email or mobile (Illuminate ID optional) for status, or contact E-Cell MET Team at met.iot.ecell@gmail.com if you no longer have it.",
  REGISTRATION_ALREADY_COMPLETED: "This registration is already complete. Recover your private link with your email or mobile (Illuminate ID optional) for status, or contact E-Cell MET Team at met.iot.ecell@gmail.com if you no longer have it.",
  RATE_LIMITED: "Too many registration attempts right now. Your details are still on this form — wait a minute and retry. If you already registered, log in with your email or mobile instead.",
  REGISTRATION_UNAVAILABLE: "Registration is temporarily unavailable (high demand or server issue). Your details are still on this form — please retry in a minute. If you already registered, log in with your email or mobile instead.",
  REGISTRATION_DB_NOT_CONFIGURED: "Registration is unavailable: server database is not configured. Please contact the organizer (code DB-CONFIG).",
  REGISTRATION_AUTH_NOT_CONFIGURED: "Registration is unavailable: server sign-in secret is missing. Please contact the organizer (code AUTH-CONFIG).",
  REGISTRATION_INDEX_INIT_FAILED: "Registration is temporarily unavailable (database setup failed). Please retry in a minute; if it persists contact the organizer (code DB-INDEX).",
  REGISTRATION_DB_CONNECTION_FAILED: "Registration is temporarily unavailable (cannot reach database). Please retry in a minute (code DB-CONN).",
  REGISTRATION_WRITE_FAILED: "Could not create your registration (code DB-WRITE). Please retry.",
  PAYMENT_NOT_AVAILABLE: "Payment registration is not available yet. Please try again later.",
};
const DUPLICATE_CODES = new Set([
  "REGISTRATION_ALREADY_STARTED",
  "REGISTRATION_REQUIRES_ACTION",
  "PAYMENT_ALREADY_SUBMITTED",
  "REGISTRATION_ALREADY_COMPLETED",
]);

function errorMap(value: RegistrationDetailsDraft) {
  const parsed = schema.safeParse(value);
  if (parsed.success) return {} as Partial<Record<Field, string>>;
  const out: Partial<Record<Field, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as Field | undefined;
    if (key && !out[key]) out[key] = issue.message;
    else if (!key && !out.fullName) out.fullName = issue.message;
  }
  return out;
}

export function RegistrationWizard({ preview, e2ePreview = false }: { preview: boolean; e2ePreview?: boolean }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<RegistrationDetailsDraft>({ ...emptyRegistrationDetails, college: registrationForm.fixedCollege ?? "" });
  const [errors, setErrors] = useState<Partial<Record<Field | "consent" | "form", string>>>({});
  const [consent, setConsent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formCode, setFormCode] = useState<string | null>(null);
  // Resume a pre-redirect attempt after reload: the same tab reuses the key
  // for identical normalized details, turning a would-be 409 into an
  // idempotent replay that returns the existing secure link.
  const initialAttempt = typeof window !== "undefined" ? loadPersistedAttempt(window.sessionStorage) : null;
  const idempotencyKey = useRef(initialAttempt?.key ?? newIdempotencyKey());
  const requestedDetails = useRef<string | null>(initialAttempt?.fingerprint ?? null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [step]);
  const setField = (field: Field, value: string) => { setDraft((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined, form: undefined })); setFormCode(null); };
  const review = () => { const next = errorMap(draft); if (Object.keys(next).length) { setErrors(next); return; } setDraft(schema.parse(draft)); setFormCode(null); setStep(1); };
  const create = async () => {
    if (!consent) { setErrors({ consent: "Confirm that the details are accurate before continuing." }); return; }
    if (preview && !e2ePreview) { setStep(2); return; }
    setCreating(true); setErrors({}); setFormCode(null);
    try {
      const details = schema.parse(draft);
      const detailsFingerprint = JSON.stringify(details);
      // A retry for unchanged details reuses its request identity. Returning to
      // Review and intentionally changing any normalized participant detail
      // starts a distinct creation attempt instead of replaying the old one.
      if (requestedDetails.current && requestedDetails.current !== detailsFingerprint) idempotencyKey.current = newIdempotencyKey();
      requestedDetails.current = detailsFingerprint;
      if (typeof window !== "undefined") storeAttempt(window.sessionStorage, { key: idempotencyKey.current, fingerprint: detailsFingerprint });
      const response = await fetch("/api/payment/registrations", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.current }, body: JSON.stringify({ details }) });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.data?.statusUrl) {
        const code = typeof json?.error?.code === "string" ? json.error.code : "";
        const retryAfter = Number(response.headers.get("Retry-After"));
        const message = registrationCreationMessages[code] || (typeof json?.error?.message === "string" && json.error.message) || "Could not create your payment registration.";
        const withRetry = code === "RATE_LIMITED" && Number.isFinite(retryAfter) && retryAfter > 0
          ? `${message} (retry in ~${Math.ceil(retryAfter / 60)} min)`
          : message;
        setFormCode(code || null);
        throw new Error(withRetry);
      }
      if (typeof window !== "undefined") {
        // Persist the holder's own link on their device for later recovery,
        // then retire the pre-redirect attempt key.
        if (typeof json.data.publicId === "string" && typeof json.data.statusUrl === "string") {
          saveRegistration(window.localStorage, { publicId: json.data.publicId, statusUrl: json.data.statusUrl, savedAt: new Date().toISOString() });
        }
        clearAttempt(window.sessionStorage);
      }
      window.location.assign(json.data.statusUrl);
    } catch (error) { setErrors({ form: error instanceof Error ? error.message : "Could not create your payment registration. Please retry." }); setCreating(false); }
  };
  return <div className="registration-wizard">
    {preview && <p className="registration-preview" role="status">{e2ePreview ? "DEV PREVIEW — TEST REGISTRATION — NOT PAYABLE. Test data is stored privately for local workflow review only." : "DEV PREVIEW — NOT PAYABLE. No participant data, payment instruction, or proof is sent to the server."}</p>}
    <ol className="registration-progress" aria-label="Registration progress">{steps.map((label, index) => <li key={label} className={index === step ? "is-current" : index < step ? "is-complete" : ""} aria-current={index === step ? "step" : undefined}><span>{index < step ? <Check aria-hidden /> : `0${index + 1}`}</span><strong>{label}</strong></li>)}</ol>
    <p className="registration-live-region" aria-live="polite">{errors.form || errors.consent || ""}</p>
    {formCode && DUPLICATE_CODES.has(formCode) && step === 1 && <p className="registration-login-hint" role="status">Already registered? <Link href="/login">Log in with email or mobile to open your registration</Link> on this device.</p>}
    {step === 0 && <Details draft={draft} errors={errors} setField={setField} onSubmit={review} heading={heading} />}
    {step === 1 && <Review draft={draft} consent={consent} errors={errors} setConsent={setConsent} onBack={() => setStep(0)} onEdit={() => setStep(0)} onContinue={() => void create()} creating={creating} heading={heading} />}
    {step === 2 && <DevPaymentPreview onBack={() => setStep(1)} heading={heading} />}
    <p className="registration-login-hint registration-login-hint--center">Already registered? <Link href="/login">Log in with email or mobile</Link></p>
  </div>;
}

function Details({ draft, errors, setField, onSubmit, heading }: { draft: RegistrationDetailsDraft; errors: Partial<Record<Field | "consent" | "form", string>>; setField: (field: Field, value: string) => void; onSubmit: () => void; heading: React.RefObject<HTMLHeadingElement | null> }) {
  const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Other"] as const;
  return <section aria-labelledby="registration-details-title"><p className="text-eyebrow">Step 01</p><h1 id="registration-details-title" ref={heading} tabIndex={-1}>Your details</h1><p className="registration-step__intro">Name, contact, college, branch and year. You&apos;ll review them before payment.</p><form noValidate onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><div className="registration-fields">
    <label className="registration-field registration-field--wide" htmlFor="registration-fullName"><span>Full name <b aria-hidden>*</b></span><input id="registration-fullName" required name="fullName" autoComplete="name" value={draft.fullName} onChange={(event) => setField("fullName", event.target.value)} aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? "registration-fullName-error" : undefined} />{errors.fullName && <small id="registration-fullName-error" className="registration-field__error">{errors.fullName}</small>}</label>
    <label className="registration-field" htmlFor="registration-email"><span>Email address <b aria-hidden>*</b></span><input id="registration-email" required name="email" type="email" inputMode="email" autoComplete="email" value={draft.email} onChange={(event) => setField("email", event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "registration-email-error" : undefined} />{errors.email && <small id="registration-email-error" className="registration-field__error">{errors.email}</small>}</label>
    <label className="registration-field" htmlFor="registration-phone"><span>Mobile number <b aria-hidden>*</b></span><input id="registration-phone" required name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" value={draft.phone} onChange={(event) => setField("phone", event.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "registration-phone-error" : undefined} />{errors.phone && <small id="registration-phone-error" className="registration-field__error">{errors.phone}</small>}</label>
    <label className="registration-field registration-field--wide" htmlFor="registration-college"><span>College / organization <b aria-hidden>*</b></span><input id="registration-college" required name="college" autoComplete="organization" placeholder="e.g. MET Bhujbal Knowledge City" value={draft.college} onChange={(event) => setField("college", event.target.value)} aria-invalid={Boolean(errors.college)} aria-describedby={errors.college ? "registration-college-error" : undefined} />{errors.college && <small id="registration-college-error" className="registration-field__error">{errors.college}</small>}</label>
    <label className="registration-field" htmlFor="registration-branch"><span>Branch / department <b aria-hidden>*</b></span><input id="registration-branch" required name="branch" placeholder="e.g. Computer Engineering" value={draft.branch} onChange={(event) => setField("branch", event.target.value)} aria-invalid={Boolean(errors.branch)} aria-describedby={errors.branch ? "registration-branch-error" : undefined} />{errors.branch && <small id="registration-branch-error" className="registration-field__error">{errors.branch}</small>}</label>
    <label className="registration-field" htmlFor="registration-year"><span>Year of study <b aria-hidden>*</b></span><select id="registration-year" required name="year" value={draft.year} onChange={(event) => setField("year", event.target.value)} aria-invalid={Boolean(errors.year)} aria-describedby={errors.year ? "registration-year-error" : undefined}><option value="">Select year</option>{YEARS.map((year) => <option key={year} value={year}>{year}</option>)}</select>{errors.year && <small id="registration-year-error" className="registration-field__error">{errors.year}</small>}</label>
  </div><p className="registration-field__help">We&apos;ll use your number and email only for registration-related updates.</p><button className="registration-primary-action">Review details <ArrowRight aria-hidden /></button></form></section>;
}

function Review({ draft, consent, errors, setConsent, onBack, onEdit, onContinue, creating, heading }: { draft: RegistrationDetails; consent: boolean; errors: Partial<Record<Field | "consent" | "form", string>>; setConsent: (value: boolean) => void; onBack: () => void; onEdit: () => void; onContinue: () => void; creating: boolean; heading: React.RefObject<HTMLHeadingElement | null> }) {
  return <section aria-labelledby="registration-review-title"><p className="text-eyebrow">Step 02</p><h1 id="registration-review-title" ref={heading} tabIndex={-1}>Review &amp; confirm</h1><p className="registration-step__intro">Check the essentials. Your payment registration is created only after you continue.</p><div className="registration-review"><div className="registration-review__heading"><h2>Your details</h2><button type="button" onClick={onEdit}>Edit</button></div><dl><div><dt>Full name</dt><dd>{draft.fullName}</dd></div><div><dt>Email</dt><dd>{draft.email}</dd></div><div><dt>Phone</dt><dd>{formatIndianPhone(draft.phone)}</dd></div><div><dt>College</dt><dd>{draft.college}</dd></div><div><dt>Branch</dt><dd>{draft.branch}</dd></div><div><dt>Year</dt><dd>{draft.year}</dd></div></dl></div><div className="registration-expectation"><p className="text-eyebrow">What happens next</p><p>Pay only the amount shown in your secure payment instructions, then submit payment evidence. A seat is confirmed only after manual verification.</p><p className="mt-2 text-sm">By continuing you agree to the <Link className="underline" href="/terms">registration terms</Link>, <Link className="underline" href="/privacy">privacy policy</Link>, and <Link className="underline" href="/refunds">refund policy</Link> (fees non-refundable once verified).</p></div><label className="registration-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "registration-consent-error" : undefined} /><span>I confirm these details are accurate and may be used for registration-related communication.</span></label>{errors.consent && <p id="registration-consent-error" role="alert" className="registration-field__error">{errors.consent}</p>}{errors.form && <p className="registration-field__error" role="alert">{errors.form}</p>}<div className="registration-actions"><button type="button" className="registration-back" onClick={onBack} disabled={creating}><ArrowLeft aria-hidden /> Back</button><button type="button" className="registration-primary-action" onClick={onContinue} disabled={creating}>{creating ? <><LoaderCircle className="animate-spin" aria-hidden /> Creating payment registration…</> : <>Continue to payment <ArrowRight aria-hidden /></>}</button></div></section>;
}

function DevPaymentPreview({ onBack, heading }: { onBack: () => void; heading: React.RefObject<HTMLHeadingElement | null> }) {
  const copy = async () => { await navigator.clipboard?.writeText("preview@upi"); };
  return <section aria-labelledby="registration-payment-title"><p className="text-eyebrow text-brand-ember">Step 03</p><h1 id="registration-payment-title" ref={heading} tabIndex={-1}>Payment preview</h1><p className="registration-step__intro">This development-only visual preview never creates a UPI payment link or registration.</p><div className="registration-handoff"><p className="font-semibold text-amber-200">DEV PREVIEW — NOT PAYABLE</p><div className="my-5 max-w-[260px] rounded-xl bg-white p-4"><Image unoptimized src="/api/payment/preview-qr" alt="Development QR that encodes ILLUMINATE_DEV_PAYMENT_PREVIEW_ONLY" width={720} height={720} className="h-auto w-full" /></div><dl className="space-y-2"><div className="flex justify-between gap-4"><dt>Pay</dt><dd>₹XXX</dd></div><div className="flex justify-between gap-4"><dt>To</dt><dd>Preview recipient</dd></div><div className="flex justify-between gap-4"><dt>UPI ID</dt><dd><button type="button" onClick={() => void copy()} className="underline">preview@upi <Copy className="inline h-3.5" /></button></dd></div></dl><p className="mt-5 text-sm text-white/65">This screen is for layout review only. Its QR encodes only <code>ILLUMINATE_DEV_PAYMENT_PREVIEW_ONLY</code>, never <code>upi://pay</code>, and it cannot collect money or accept a proof.</p></div><div className="registration-actions"><button type="button" className="registration-back" onClick={onBack}><ArrowLeft aria-hidden /> Back to review</button><Link href="/" className="registration-primary-action">Back to event <ArrowRight aria-hidden /></Link></div></section>;
}
