"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Copy, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { registrationForm } from "@/config/registration";
import { createRegistrationDetailsSchema, emptyRegistrationDetails, formatIndianPhone, type RegistrationDetails, type RegistrationDetailsDraft } from "@/lib/registration-details";

type Field = keyof RegistrationDetailsDraft;
const schema = createRegistrationDetailsSchema();
const steps = ["Details", "Review", "Payment"];
const newIdempotencyKey = () => crypto.randomUUID();
const registrationCreationMessages: Record<string, string> = {
  REGISTRATION_ALREADY_STARTED: "A registration is already in progress for these details. Continue using your secure registration link, or contact E-Cell MET Team at met.iot.ecell@gmail.com if you no longer have it.",
  REGISTRATION_REQUIRES_ACTION: "A registration needs action. Use your existing secure registration link to resubmit payment proof, or contact E-Cell MET Team at met.iot.ecell@gmail.com if you no longer have it.",
  PAYMENT_ALREADY_SUBMITTED: "Payment proof for this registration is already awaiting verification. Use your secure registration link for status, or contact E-Cell MET Team at met.iot.ecell@gmail.com if you no longer have it.",
  REGISTRATION_ALREADY_COMPLETED: "This registration is already complete. Use your secure registration link for status, or contact E-Cell MET Team at met.iot.ecell@gmail.com if you no longer have it.",
};

function errorMap(value: RegistrationDetailsDraft) {
  const parsed = schema.safeParse(value);
  if (parsed.success) return {} as Partial<Record<Field, string>>;
  return parsed.error.issues.reduce<Partial<Record<Field, string>>>((out, issue) => ({ ...out, [issue.path[0] as Field]: issue.message }), {});
}

export function RegistrationWizard({ preview, e2ePreview = false }: { preview: boolean; e2ePreview?: boolean }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<RegistrationDetailsDraft>({ ...emptyRegistrationDetails, college: registrationForm.fixedCollege ?? "" });
  const [errors, setErrors] = useState<Partial<Record<Field | "consent" | "form", string>>>({});
  const [consent, setConsent] = useState(false);
  const [creating, setCreating] = useState(false);
  const idempotencyKey = useRef(newIdempotencyKey());
  const requestedDetails = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [step]);
  const setField = (field: Field, value: string) => { setDraft((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined, form: undefined })); };
  const review = () => { const next = errorMap(draft); if (Object.keys(next).length) { setErrors(next); return; } setDraft(schema.parse(draft)); setStep(1); };
  const create = async () => {
    if (!consent) { setErrors({ consent: "Confirm that the details are accurate before continuing." }); return; }
    if (preview && !e2ePreview) { setStep(2); return; }
    setCreating(true); setErrors({});
    try {
      const details = schema.parse(draft);
      const detailsFingerprint = JSON.stringify(details);
      // A retry for unchanged details reuses its request identity. Returning to
      // Review and intentionally changing any normalized participant detail
      // starts a distinct creation attempt instead of replaying the old one.
      if (requestedDetails.current && requestedDetails.current !== detailsFingerprint) idempotencyKey.current = newIdempotencyKey();
      requestedDetails.current = detailsFingerprint;
      const response = await fetch("/api/payment/registrations", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.current }, body: JSON.stringify({ details }) });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.data?.statusUrl) throw new Error(registrationCreationMessages[json?.error?.code] || json?.error?.message || "Could not create your payment registration.");
      window.location.assign(json.data.statusUrl);
    } catch (error) { setErrors({ form: error instanceof Error ? error.message : "Could not create your payment registration. Please retry." }); setCreating(false); }
  };
  return <div className="registration-wizard">
    {preview && <p className="registration-preview" role="status">{e2ePreview ? "DEV PREVIEW — TEST REGISTRATION — NOT PAYABLE. Test data is stored privately for local workflow review only." : "DEV PREVIEW — NOT PAYABLE. No participant data, payment instruction, or proof is sent to the server."}</p>}
    <ol className="registration-progress" aria-label="Registration progress">{steps.map((label, index) => <li key={label} className={index === step ? "is-current" : index < step ? "is-complete" : ""} aria-current={index === step ? "step" : undefined}><span>{index < step ? <Check aria-hidden /> : `0${index + 1}`}</span><strong>{label}</strong></li>)}</ol>
    <p className="registration-live-region" aria-live="polite">{errors.form || errors.consent || ""}</p>
    {step === 0 && <Details draft={draft} errors={errors} setField={setField} onSubmit={review} heading={heading} />}
    {step === 1 && <Review draft={draft} consent={consent} errors={errors} setConsent={setConsent} onBack={() => setStep(0)} onEdit={() => setStep(0)} onContinue={() => void create()} creating={creating} heading={heading} />}
    {step === 2 && <DevPaymentPreview onBack={() => setStep(1)} heading={heading} />}
  </div>;
}

function Details({ draft, errors, setField, onSubmit, heading }: { draft: RegistrationDetailsDraft; errors: Partial<Record<Field | "consent" | "form", string>>; setField: (field: Field, value: string) => void; onSubmit: () => void; heading: React.RefObject<HTMLHeadingElement | null> }) {
  const fields: Array<{ field: Field; label: string; type?: string; inputMode?: "email" | "tel" }> = [{ field: "fullName", label: "Full name" }, { field: "email", label: "Email address", type: "email", inputMode: "email" }, { field: "phone", label: "Phone number", type: "tel", inputMode: "tel" }];
  return <section aria-labelledby="registration-details-title"><p className="text-eyebrow text-brand-electric">Step 01</p><h1 id="registration-details-title" ref={heading} tabIndex={-1}>Your details</h1><p className="registration-step__intro">A few essentials first. You&apos;ll review them before payment.</p><form noValidate onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><div className="registration-fields">{fields.map(({ field, label, type, inputMode }) => <label className={`registration-field${field === "fullName" ? " registration-field--wide" : ""}`} key={field} htmlFor={`registration-${field}`}><span>{label} <b aria-hidden>*</b></span><input id={`registration-${field}`} required name={field} type={type} inputMode={inputMode} autoComplete={field === "fullName" ? "name" : field === "email" ? "email" : "tel"} placeholder={field === "phone" ? "+91 98765 43210" : undefined} value={draft[field]} onChange={(event) => setField(field, event.target.value)} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `registration-${field}-error` : undefined} />{errors[field] && <small id={`registration-${field}-error`} className="registration-field__error">{errors[field]}</small>}</label>)}</div><p className="registration-field__help">We&apos;ll use your number only for registration-related updates.</p><button className="registration-primary-action">Review details <ArrowRight aria-hidden /></button></form></section>;
}

function Review({ draft, consent, errors, setConsent, onBack, onEdit, onContinue, creating, heading }: { draft: RegistrationDetails; consent: boolean; errors: Partial<Record<Field | "consent" | "form", string>>; setConsent: (value: boolean) => void; onBack: () => void; onEdit: () => void; onContinue: () => void; creating: boolean; heading: React.RefObject<HTMLHeadingElement | null> }) {
  return <section aria-labelledby="registration-review-title"><p className="text-eyebrow text-brand-electric">Step 02</p><h1 id="registration-review-title" ref={heading} tabIndex={-1}>Review &amp; confirm</h1><p className="registration-step__intro">Check the essentials. Your payment registration is created only after you continue.</p><div className="registration-review"><div className="registration-review__heading"><h2>Your details</h2><button type="button" onClick={onEdit}>Edit</button></div><dl><div><dt>Full name</dt><dd>{draft.fullName}</dd></div><div><dt>Email</dt><dd>{draft.email}</dd></div><div><dt>Phone</dt><dd>{formatIndianPhone(draft.phone)}</dd></div></dl></div><div className="registration-expectation"><p className="text-eyebrow text-brand-ember">What happens next</p><p>Pay only the amount shown in your secure payment instructions, then submit payment evidence. A seat is confirmed only after manual verification.</p></div><label className="registration-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} aria-invalid={Boolean(errors.consent)} /><span>I confirm these details are accurate and may be used for registration-related communication.</span></label>{errors.consent && <p className="registration-field__error">{errors.consent}</p>}{errors.form && <p className="registration-field__error">{errors.form}</p>}<div className="registration-actions"><button type="button" className="registration-back" onClick={onBack} disabled={creating}><ArrowLeft aria-hidden /> Back</button><button type="button" className="registration-primary-action" onClick={onContinue} disabled={creating}>{creating ? <><LoaderCircle className="animate-spin" aria-hidden /> Creating payment registration…</> : <>Continue to payment <ArrowRight aria-hidden /></>}</button></div></section>;
}

function DevPaymentPreview({ onBack, heading }: { onBack: () => void; heading: React.RefObject<HTMLHeadingElement | null> }) {
  const copy = async () => { await navigator.clipboard?.writeText("preview@upi"); };
  return <section aria-labelledby="registration-payment-title"><p className="text-eyebrow text-brand-ember">Step 03</p><h1 id="registration-payment-title" ref={heading} tabIndex={-1}>Payment preview</h1><p className="registration-step__intro">This development-only visual preview never creates a UPI payment link or registration.</p><div className="registration-handoff"><p className="font-semibold text-amber-200">DEV PREVIEW — NOT PAYABLE</p><div className="my-5 max-w-[260px] rounded-xl bg-white p-4"><Image unoptimized src="/api/payment/preview-qr" alt="Development QR that encodes ILLUMINATE_DEV_PAYMENT_PREVIEW_ONLY" width={720} height={720} className="h-auto w-full" /></div><dl className="space-y-2"><div className="flex justify-between gap-4"><dt>Pay</dt><dd>₹XXX</dd></div><div className="flex justify-between gap-4"><dt>To</dt><dd>Preview recipient</dd></div><div className="flex justify-between gap-4"><dt>UPI ID</dt><dd><button type="button" onClick={() => void copy()} className="underline">preview@upi <Copy className="inline h-3.5" /></button></dd></div></dl><p className="mt-5 text-sm text-white/65">This screen is for layout review only. Its QR encodes only <code>ILLUMINATE_DEV_PAYMENT_PREVIEW_ONLY</code>, never <code>upi://pay</code>, and it cannot collect money or accept a proof.</p></div><div className="registration-actions"><button type="button" className="registration-back" onClick={onBack}><ArrowLeft aria-hidden /> Back to review</button><Link href="/" className="registration-primary-action">Back to event <ArrowRight aria-hidden /></Link></div></section>;
}
