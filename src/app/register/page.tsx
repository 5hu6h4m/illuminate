import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { RegistrationWizard } from "@/components/registration/RegistrationWizard";
import { SavedRegistrationBanner } from "@/components/registration/SavedRegistrationBanner";
import { event } from "@/config/event";
import { Container } from "@/components/ui/Container";
import { isRegistrationPreviewEnabled } from "@/lib/registration-preview";
import { getConfirmedPaymentSnapshot, isDevE2EPreviewEnabled } from "@/lib/payment";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  const preview = isRegistrationPreviewEnabled();
  const e2ePreview = isDevE2EPreviewEnabled();
  const available = Boolean(getConfirmedPaymentSnapshot());
  const showPreview = e2ePreview || (preview && !available);
  return <div className="registration-shell"><header className="registration-header"><Container className="registration-header__inner"><Link href="/" className="registration-brand" aria-label="Back to Illuminate"><span className="registration-brand__logos" aria-hidden><Image src="/images/logo2.png" alt="" width={120} height={44} /><span className="registration-brand__x">·</span><Image src="/images/ecell-logo.png" alt="" width={40} height={40} className="registration-brand__met" /><span className="registration-brand__x">·</span><Image src="/images/e-cell-iitb.png" alt="" width={36} height={42} className="registration-brand__iitb" /></span><span><strong>{event.identity.name} {event.identity.edition}</strong></span></Link><Link href="/" className="registration-return"><ArrowLeft aria-hidden /> Back to event</Link></Container></header><main className="registration-main"><Container>{available || preview ? <><SavedRegistrationBanner /><div className="registration-layout"><a className="registration-summary-link" href="#registration-summary">Fee & event details</a><RegistrationWizard preview={showPreview} e2ePreview={e2ePreview} /><aside id="registration-summary" className="registration-summary" aria-label="Event summary"><p className="text-eyebrow">Illuminate {event.identity.edition}</p><h2>{event.identity.name}</h2><p>{event.identity.shortDescription}</p><div><span>Hosted by</span><strong>{event.organizer.name}</strong></div><div><span>Association</span><strong>{event.association.label}</strong></div><div><span>Fee</span><strong>Early Bird ₹{event.fee.pricing.earlyBirdAmount} · Regular ₹{event.fee.pricing.regularAmount}</strong></div><div className="registration-summary__logos"><Image src="/images/logo2.png" alt="Illuminate 2026 logo" width={120} height={44} loading="lazy" /><span aria-hidden className="registration-brand__x">·</span><Image src="/images/ecell-logo.png" alt="E-Cell MET logo" width={40} height={40} loading="lazy" /><span aria-hidden className="registration-brand__x">·</span><Image src="/images/e-cell-iitb.png" alt="E-Cell IIT Bombay logo" width={36} height={42} className="registration-summary__iitb" loading="lazy" /></div></aside></div></> : <section className="registration-unavailable" aria-labelledby="registration-unavailable-title"><p className="text-eyebrow">Illuminate {event.identity.edition}</p><h1 id="registration-unavailable-title">Registration opening soon.</h1><p>Registration details will appear here once the event and payment information are confirmed.</p><Link href="/" className="registration-primary-action">Back to event <ArrowRight aria-hidden /></Link></section>}</Container></main><SiteFooter /></div>;
}
