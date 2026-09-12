"use client";

import { Ticket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BRANCHES,
  COLLEGE_LOCKED,
  INTERESTS,
  YEARS,
  generateRegId,
  isValidEmail,
  isValidIndianMobile,
  loadDraft,
  saveDraft,
  clearDraft,
  saveRegistration,
  type Registration,
} from "@/lib/registration";
import { currentPrice, formatINR, PRICING } from "@/lib/pricing";

type Draft = {
  fullName: string;
  email: string;
  mobile: string;
  sameAsMobile: boolean;
  whatsapp: string;
  gender: string;
  studentId: string;
  branch: string;
  year: string;
  division: string;
  interests: string[];
  hasIdea: string;
  ideaText: string;
  attendedStartupEvent: string;
  attendedEcell: string;
  campusVisit: string;
  willingToTravel: string;
  emergencyName: string;
  emergencyPhone: string;
  accessibility: string;
  utr: string;
  consentAccuracy: boolean;
  consentComms: boolean;
  consentSelection: boolean;
  consentTerms: boolean;
  consentMarketing: boolean;
};

const EMPTY: Draft = {
  fullName: "",
  email: "",
  mobile: "",
  sameAsMobile: true,
  whatsapp: "",
  gender: "",
  studentId: "",
  branch: "",
  year: "",
  division: "",
  interests: [],
  hasIdea: "I'm exploring ideas",
  ideaText: "",
  attendedStartupEvent: "No",
  attendedEcell: "No",
  campusVisit: "Yes",
  willingToTravel: "Yes",
  emergencyName: "",
  emergencyPhone: "",
  accessibility: "",
  utr: "",
  consentAccuracy: false,
  consentComms: false,
  consentSelection: false,
  consentTerms: false,
  consentMarketing: false,
};

const STEPS = ["Personal", "Academic", "Profile", "Travel", "Payment"];

const inputCls =
  "w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-cream placeholder:text-white/30 outline-none focus:border-ember/60";
const labelCls = "mb-2 block text-sm font-medium text-white/80";
const errCls = "mt-1 text-xs text-red-300";

export function MultiStepForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);
  const price = useMemo(() => currentPrice(), []);

  useEffect(() => {
    setD(loadDraft(EMPTY));
  }, []);

  useEffect(() => {
    saveDraft(d);
  }, [d]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setD((p) => ({ ...p, [k]: v }));

  function toggleInterest(v: string) {
    setD((p) => ({
      ...p,
      interests: p.interests.includes(v)
        ? p.interests.filter((i) => i !== v)
        : [...p.interests, v],
    }));
  }

  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (d.fullName.trim().length < 3) e.fullName = "Enter your full name as on the certificate.";
      if (!isValidEmail(d.email)) e.email = "Enter a valid email address.";
      if (!isValidIndianMobile(d.mobile)) e.mobile = "Enter a valid 10-digit mobile number.";
      const wa = d.sameAsMobile ? d.mobile : d.whatsapp;
      if (!isValidIndianMobile(wa)) e.whatsapp = "Enter a valid WhatsApp number.";
    }
    if (s === 1) {
      if (d.studentId.trim().length < 2) e.studentId = "Enter your college ID / PRN.";
      if (!d.branch) e.branch = "Select your department / branch.";
      if (!d.year) e.year = "Select your year of study.";
    }
    if (s === 3) {
      if (!d.emergencyName.trim()) e.emergencyName = "Emergency contact name is required.";
      if (!isValidIndianMobile(d.emergencyPhone)) e.emergencyPhone = "Enter a valid emergency number.";
      if (!d.consentAccuracy || !d.consentComms || !d.consentSelection || !d.consentTerms)
        e.consents = "Please accept the 4 required checkboxes to continue.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validate(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function confirmRegistration(status: Registration["paymentStatus"], paymentId?: string) {
    const now = new Date();
    const reg: Registration = {
      id: generateRegId(),
      fullName: d.fullName.trim(),
      email: d.email.trim(),
      mobile: d.mobile.trim(),
      whatsapp: (d.sameAsMobile ? d.mobile : d.whatsapp).trim(),
      gender: d.gender || undefined,
      college: COLLEGE_LOCKED,
      studentId: d.studentId.trim(),
      branch: d.branch,
      year: d.year,
      division: d.division || undefined,
      interests: d.interests,
      hasIdea: d.hasIdea,
      ideaText: d.ideaText || undefined,
      attendedStartupEvent: d.attendedStartupEvent,
      attendedEcell: d.attendedEcell,
      campusVisit: d.campusVisit,
      willingToTravel: d.willingToTravel,
      emergencyName: d.emergencyName.trim(),
      emergencyPhone: d.emergencyPhone.trim(),
      accessibility: d.accessibility || undefined,
      amountPaid: status === "paid" ? price : 0,
      paymentStatus: status,
      paymentId,
      utr: d.utr || undefined,
      createdAt: now.toISOString(),
    };
    saveRegistration(reg);
    clearDraft();
    router.push(`/success?id=${encodeURIComponent(reg.id)}`);
  }

  function payOnline() {
    setPaying(true);
    // Placeholder for Razorpay/Cashfree order + webhook verify.
    setTimeout(() => {
      setPaying(false);
      confirmRegistration("paid", `pay_${Date.now().toString(36)}`);
    }, 1200);
  }

  return (
    <div>
      <ol className="flex flex-wrap gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide ${
              i === step
                ? "bg-ember text-ink"
                : i < step
                  ? "border border-ember/50 text-ember"
                  : "border border-white/12 text-white/50"
            }`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <div key={step} className="step-enter mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-10">
        {step === 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <h2 className="font-display text-2xl">Step 1 — Personal details</h2>
              <p className="mt-1 text-sm text-white/55">Use the name exactly as you want it on the certificate.</p>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls} htmlFor="fullName">Full name *</label>
              <input id="fullName" className={inputCls} placeholder="Enter your full name"
                value={d.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" />
              {errors.fullName && <p className={errCls}>{errors.fullName}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="email">Email address *</label>
              <input id="email" className={inputCls} placeholder="yourname@gmail.com" inputMode="email"
                value={d.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
              {errors.email && <p className={errCls}>{errors.email}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="mobile">Mobile number *</label>
              <input id="mobile" className={inputCls} placeholder="+91 XXXXX XXXXX" inputMode="tel"
                value={d.mobile} onChange={(e) => set("mobile", e.target.value)} autoComplete="tel" />
              {errors.mobile && <p className={errCls}>{errors.mobile}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="flex cursor-pointer items-center gap-3 text-sm text-white/75">
                <input type="checkbox" className="h-4 w-4 accent-[#8b5cf6]" checked={d.sameAsMobile}
                  onChange={(e) => set("sameAsMobile", e.target.checked)} />
                Same as mobile number (WhatsApp)
              </label>
              {!d.sameAsMobile && (
                <div className="mt-4">
                  <label className={labelCls} htmlFor="whatsapp">WhatsApp number</label>
                  <input id="whatsapp" className={inputCls} placeholder="Enter WhatsApp number"
                    value={d.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} inputMode="tel" />
                  {errors.whatsapp && <p className={errCls}>{errors.whatsapp}</p>}
                </div>
              )}
            </div>
            <div>
              <label className={labelCls} htmlFor="gender">Gender <span className="text-white/40">(optional)</span></label>
              <select id="gender" className={inputCls} value={d.gender} onChange={(e) => set("gender", e.target.value)}>
                <option value="">Prefer not to say</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <h2 className="font-display text-2xl">Step 2 — College / academic details</h2>
              <p className="mt-1 text-sm text-white/55">Locked to MET for this edition. PRN verifies enrollment.</p>
            </div>
            <div>
              <label className={labelCls}>College name *</label>
              <input className={`${inputCls} opacity-70`} value={COLLEGE_LOCKED} readOnly aria-readonly />
            </div>
            <div>
              <label className={labelCls} htmlFor="studentId">Student ID / PRN *</label>
              <input id="studentId" className={inputCls} placeholder="Enter your college ID / PRN"
                value={d.studentId} onChange={(e) => set("studentId", e.target.value)} />
              {errors.studentId && <p className={errCls}>{errors.studentId}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="branch">Department / Branch *</label>
              <select id="branch" className={inputCls} value={d.branch} onChange={(e) => set("branch", e.target.value)}>
                <option value="">Select branch</option>
                {BRANCHES.map((b) => <option key={b}>{b}</option>)}
              </select>
              {errors.branch && <p className={errCls}>{errors.branch}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="year">Year of study *</label>
              <select id="year" className={inputCls} value={d.year} onChange={(e) => set("year", e.target.value)}>
                <option value="">Select year</option>
                {YEARS.map((y) => <option key={y}>{y}</option>)}
              </select>
              {errors.year && <p className={errCls}>{errors.year}</p>}
            </div>
            <div className="md:col-span-2">
              <label className={labelCls} htmlFor="division">Division / Class <span className="text-white/40">(optional)</span></label>
              <input id="division" className={inputCls} placeholder="e.g. A" value={d.division}
                onChange={(e) => set("division", e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-7">
            <div>
              <h2 className="font-display text-2xl">Step 3 — Entrepreneurship profile</h2>
              <p className="mt-1 text-sm text-white/55">Helps E-Cell MET plan better events. Not part of IITB submission.</p>
            </div>
            <fieldset>
              <legend className={labelCls}>Why are you interested in Illuminate?</legend>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((i) => (
                  <button key={i} type="button" onClick={() => toggleInterest(i)}
                    aria-pressed={d.interests.includes(i)}
                    className={`rounded-full border px-4 py-2 text-sm pressable transition-colors ${
                      d.interests.includes(i)
                        ? "border-ember bg-ember/15 text-ember"
                        : "border-white/12 text-white/65 hover:border-white/30"
                    }`}>
                    {i}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="hasIdea">Do you have a startup / business idea?</label>
                <select id="hasIdea" className={inputCls} value={d.hasIdea} onChange={(e) => set("hasIdea", e.target.value)}>
                  <option>Yes</option>
                  <option>No</option>
                  <option>I&apos;m exploring ideas</option>
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="ideaText">Briefly describe it <span className="text-white/40">(optional, 50–200 chars)</span></label>
                <input id="ideaText" className={inputCls} placeholder="One-line idea" value={d.ideaText}
                  onChange={(e) => set("ideaText", e.target.value)} maxLength={200} />
              </div>
              <div>
                <label className={labelCls} htmlFor="attendedStartupEvent">Attended a startup event before?</label>
                <select id="attendedStartupEvent" className={inputCls} value={d.attendedStartupEvent}
                  onChange={(e) => set("attendedStartupEvent", e.target.value)}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="attendedEcell">Attended an E-Cell IIT Bombay event?</label>
                <select id="attendedEcell" className={inputCls} value={d.attendedEcell}
                  onChange={(e) => set("attendedEcell", e.target.value)}>
                  <option>Yes</option>
                  <option>No</option>
                  <option>Not sure</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <h2 className="font-display text-2xl">Step 4 — Campus visit / travel</h2>
              <p className="mt-1 text-sm text-white/55">Top-30 selection only. We collect only what travel needs.</p>
            </div>
            <div>
              <label className={labelCls} htmlFor="campusVisit">Interested in IIT Bombay campus visit?</label>
              <select id="campusVisit" className={inputCls} value={d.campusVisit} onChange={(e) => set("campusVisit", e.target.value)}>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="willingToTravel">If selected, willing to travel?</label>
              <select id="willingToTravel" className={inputCls} value={d.willingToTravel}
                onChange={(e) => set("willingToTravel", e.target.value)}>
                <option>Yes</option>
                <option>No</option>
                <option>Need more information</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="emergencyName">Emergency contact name *</label>
              <input id="emergencyName" className={inputCls} placeholder="Parent / guardian name"
                value={d.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} />
              {errors.emergencyName && <p className={errCls}>{errors.emergencyName}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="emergencyPhone">Emergency contact number *</label>
              <input id="emergencyPhone" className={inputCls} placeholder="+91 XXXXX XXXXX"
                value={d.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} inputMode="tel" />
              {errors.emergencyPhone && <p className={errCls}>{errors.emergencyPhone}</p>}
            </div>
            <div className="md:col-span-2">
              <label className={labelCls} htmlFor="accessibility">Travel / accessibility requirement <span className="text-white/40">(optional)</span></label>
              <input id="accessibility" className={inputCls} placeholder="Anything we should arrange for?"
                value={d.accessibility} onChange={(e) => set("accessibility", e.target.value)} />
            </div>
            <fieldset className="space-y-3 md:col-span-2">
              <legend className={labelCls}>Consent *</legend>
              {(
                [
                  ["consentAccuracy", "I confirm the information provided by me is accurate."],
                  ["consentComms", "I agree to receive event updates over email / WhatsApp."],
                  ["consentSelection", "I understand campus visit / travel is subject to eligibility & selection."],
                  ["consentTerms", "I agree to the event terms and conditions."],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex cursor-pointer items-start gap-3 text-sm text-white/75">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[#8b5cf6]"
                    checked={d[k]} onChange={(e) => set(k, e.target.checked)} />
                  {label}
                </label>
              ))}
              <label className="flex cursor-pointer items-start gap-3 text-sm text-white/60">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[#8b5cf6]"
                  checked={d.consentMarketing} onChange={(e) => set("consentMarketing", e.target.checked)} />
                I&apos;d like future E-Cell MET event updates. (optional)
              </label>
              {errors.consents && <p className={errCls}>{errors.consents}</p>}
            </fieldset>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-8 md:grid-cols-2">
            <div className="md:col-span-2">
              <h2 className="flex items-center gap-2.5 font-display text-2xl">
                <Ticket className="h-6 w-6 text-ember-soft" aria-hidden /> Secure your seat
              </h2>
              <p className="mt-1 text-sm text-white/55">Review, then pay. Registration ID is issued instantly.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-white/55">Name</dt><dd>{d.fullName || "—"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-white/55">Email</dt><dd className="break-all">{d.email || "—"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-white/55">Branch · Year</dt><dd>{d.branch || "—"} · {d.year || "—"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-white/55">Campus / Travel</dt><dd>{d.campusVisit} / {d.willingToTravel}</dd></div>
              </dl>
            </div>
            <div className="rounded-3xl border border-ember/30 bg-ember/[0.06] p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-ember">Early bird price</p>
              <p className="mt-2 flex items-baseline gap-3">
                <span className="text-white/45 line-through">{formatINR(PRICING.mrp)}</span>
                <span className="font-display text-4xl">{formatINR(price)}/-</span>
              </p>
              <p className="mt-1 text-xs text-white/55">Valid till {PRICING.earlyBirdEndsAtIST}</p>
              <button
                onClick={payOnline}
                disabled={paying}
                className="mt-5 w-full rounded-full bg-ember px-6 py-3.5 font-bold text-ink pressable transition-colors hover:bg-ember-deep disabled:opacity-60"
              >
                {paying ? "Processing…" : `PROCEED TO PAYMENT · ${formatINR(price)}`}
              </button>
              <div className="mt-5 border-t border-white/10 pt-5">
                <label className={labelCls} htmlFor="utr">Paid manually via UPI? Enter UTR *</label>
                <input id="utr" className={inputCls} placeholder="12-digit UTR / Transaction ID"
                  value={d.utr} onChange={(e) => set("utr", e.target.value)} />
                <button
                  onClick={() => {
                    if (d.utr.trim().length < 6) {
                      setErrors({ utr: "Enter your UPI UTR to submit for verification." });
                      return;
                    }
                    confirmRegistration("awaiting_verification");
                  }}
                  className="mt-3 w-full rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/85 pressable transition-colors hover:border-ember/60 hover:text-ember"
                >
                  Submit UTR for verification
                </button>
                {errors.utr && <p className={errCls}>{errors.utr}</p>}
                <p className="mt-3 text-xs leading-relaxed text-white/45">
                  Gateway integration (Razorpay) plugs into <code>payOnline()</code> + webhook verify.
                  UTR path marks status <code>awaiting_verification</code> for admin.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse justify-between gap-3 sm:flex-row">
          <button
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0}
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/70 pressable transition-colors hover:border-white/40 disabled:opacity-40"
          >
            ← Back
          </button>
          {step < 4 && (
            <button
              onClick={next}
              className="rounded-full bg-cream px-8 py-3 text-sm font-bold text-ink pressable transition-colors hover:bg-white"
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
