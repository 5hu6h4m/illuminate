import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { RegistrationWizard } from "@/components/registration/RegistrationWizard";
import { event, isPaymentRegistrationAvailable } from "@/config/event";
import { Container } from "@/components/ui/Container";
import { isRegistrationPreviewEnabled } from "@/lib/registration-preview";
import { isDevE2EPreviewEnabled } from "@/lib/payment";

export default function RegisterPage() {
  const preview = isRegistrationPreviewEnabled();
  const e2ePreview = isDevE2EPreviewEnabled();
  const available = isPaymentRegistrationAvailable();
  // Explicit E2E preview is always visibly marked as test mode, including if
  // someone has temporarily confirmed payment facts in a local environment.
  const showPreview = e2ePreview || (preview && !available);

  return <div className="registration-shell"><header className="registration-header"><Container className="registration-header__inner"><Link href="/" className="registration-brand" aria-label="Back to Illuminate"><span aria-hidden="true" /><strong>{event.identity.name}</strong><small>{event.organizer.name}</small></Link><Link href="/" className="registration-return"><ArrowLeft aria-hidden /> Back to event</Link></Container></header><main className="registration-main"><Container>{available || preview ? <div className="registration-layout"><RegistrationWizard preview={showPreview} e2ePreview={e2ePreview} /><aside className="registration-summary" aria-label="Event summary"><p className="text-eyebrow text-brand-electric">Illuminate {event.identity.edition}</p><h2>{event.identity.name}</h2><p>{event.identity.shortDescription}</p><div><span>Hosted by</span><strong>{event.organizer.name}</strong></div><div><span>Association</span><strong>{event.association.label}</strong></div></aside></div> : <section className="registration-unavailable" aria-labelledby="registration-unavailable-title"><p className="text-eyebrow text-brand-electric">Illuminate {event.identity.edition}</p><h1 id="registration-unavailable-title">Registration opening soon.</h1><p>Registration details will appear here once the event and payment information are confirmed.</p><Link href="/" className="registration-primary-action">Back to event <ArrowRight aria-hidden /></Link></section>}</Container></main><SiteFooter /></div>;
}
