import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Mic, Sparkles } from "lucide-react";
import { event } from "@/config/event";
import { illuminateContent } from "@/content/illuminate";
import { getConfirmedPaymentSnapshot } from "@/lib/payment";
import { confirmedBenefits } from "@/content/landing";
import { Faq } from "@/components/landing/Faq";
import { Reveal } from "@/components/Reveal";
import { CinematicHero } from "@/components/landing/CinematicHero";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LearningMap } from "@/components/landing/LearningMap";
import { ProblemToBusiness } from "@/components/landing/ProblemToBusiness";
import { Takeaways } from "@/components/landing/Takeaways";
import { IsThisForMe } from "@/components/landing/IsThisForMe";
import { IlluminateRelationship } from "@/components/landing/IlluminateRelationship";
import { EventDetails } from "@/components/landing/EventDetails";
import { RegistrationProcess } from "@/components/landing/RegistrationProcess";
import { SupportContact } from "@/components/landing/SupportContact";
import { FinalCta } from "@/components/landing/FinalCta";
import { SitePreloader } from "@/components/landing/SitePreloader";
import { WorkshopJourney } from "@/components/landing/WorkshopJourney";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export default function Home() {
  const paymentSnapshot = getConfirmedPaymentSnapshot();
  const registrationAvailable = Boolean(paymentSnapshot);
  const pricingTier = paymentSnapshot?.pricingTier ?? null;
  const cta = registrationAvailable ? { href: "/register", label: "Register for Illuminate" } : { href: "#event-details", label: "View event details" };
  return <div id="top" className="landing-shell"><SitePreloader /><LandingHeader registrationAvailable={registrationAvailable} /><main>
    <CinematicHero registrationAvailable={registrationAvailable} />
    <section className="landing-association" aria-label="Event association"><Container><div className="association-lockup association-lockup--branded"><div className="association-lockup__logos"><Image unoptimized src="/images/logo2.png" alt="Illuminate 2026 logo" width={188} height={68} className="association-lockup__illuminate" /><span aria-hidden className="association-lockup__connector">·</span><Image unoptimized src="/images/ecell-logo.png" alt="E-Cell MET logo" width={72} height={72} className="association-lockup__met" /><span aria-hidden className="association-lockup__connector">·</span><Image unoptimized src="/images/e-cell-iitb.png" alt="E-Cell IIT Bombay logo" width={54} height={62} className="association-lockup__iitb" /></div><div className="association-lockup__details"><span className="association-lockup__eyebrow">Illuminate 2026</span><strong className="association-lockup__title">Hosted by {event.organizer.name}</strong><p>{event.association.label}</p></div></div></Container></section>
    <section id="entrepreneurship" className="landing-section entrepreneurship-explained" aria-labelledby="entrepreneurship-title" tabIndex={-1}><Container><div className="entrepreneurship-explained__intro"><p className="text-eyebrow">{illuminateContent.entrepreneurship.title}</p><h2 id="entrepreneurship-title">{illuminateContent.phaseOne.entrepreneurshipExplained.title}</h2><p>{illuminateContent.phaseOne.entrepreneurshipExplained.description}</p></div><Reveal doorway className="entrepreneurship-explained__body"><ol className="thinking-model">{illuminateContent.phaseOne.thinkingModel.map((step, index) => <li key={step.key}><span className="thinking-model__number">0{index + 1}</span><div><strong>{step.label}</strong><span>{step.description}</span></div></li>)}</ol><div className="entrepreneurship-explained__aside"><p className="entrepreneurship-explained__examples-label">Problems are everywhere</p><ul aria-label="Everyday examples"><li>{illuminateContent.phaseOne.examples[0]}</li><li>{illuminateContent.phaseOne.examples[1]}</li><li>{illuminateContent.phaseOne.examples[2]}</li></ul><p className="entrepreneurship-explained__closing">{illuminateContent.phaseOne.entrepreneurshipExplained.closing}</p></div></Reveal></Container></section>
    <ProblemToBusiness />
    <LearningMap />
    <section id="journey" className="landing-section landing-journey"><Container><SectionHeading className="journey-intro" eyebrow="Workshop experience" title="From understanding a problem to explaining an idea."><p>{illuminateContent.workshopJourney.supportCopy}</p></SectionHeading><Reveal doorway><WorkshopJourney /></Reveal></Container></section>
    <Takeaways />
    <IsThisForMe />
    <IlluminateRelationship />
    <section id="updates" className="landing-section landing-speakers"><Container><SectionHeading eyebrow="Workshop updates" title="Details will be announced here."><p>Confirmed workshop information will appear here once it is ready to publish.</p></SectionHeading><Reveal doorway><div className="credential-frame speakers-frame"><div className="credential-frame__inner speakers-panel"><Mic aria-hidden className="speakers-mic" /><p className="speakers-live"><span className="speakers-pulse" aria-hidden />Updates to follow</p><p className="speakers-soon">Workshop details will be published once confirmed.</p><Link href={cta.href} className="landing-button"><span>{cta.label}</span><ArrowUpRight aria-hidden /></Link></div></div></Reveal></Container></section>
    <section className="landing-section landing-value"><Container><div className="value-grid"><div><p className="text-eyebrow">Workshop registration</p><h2 className="text-section-title">Simple, transparent pricing.</h2></div><div className="value-grid__body"><p>Registration gives you access to the Illuminate workshop.</p><p className="text-text-muted">The amount shown during registration is determined from the active registration tier.</p><div className="value-grid__rule" /><p className="text-text-muted">Registration fees are non-refundable once payment has been verified. <Link href="/refunds">Read the refund policy</Link>.</p></div><div className="price-cards"><div className={`price-card${pricingTier === "early_bird" ? " is-featured" : ""}`}><p className="price-card__tier">Early Bird{pricingTier === "early_bird" ? <span className="price-card__badge">Current</span> : null}</p><p className="price-card__amount">₹{event.fee.pricing.earlyBirdAmount.toLocaleString("en-IN")}</p><p className="price-card__note">Available through 23 September 2026.</p></div><div className={`price-card${pricingTier === "regular" ? " is-featured" : ""}`}><p className="price-card__tier">Regular{pricingTier === "regular" ? <span className="price-card__badge">Current</span> : null}</p><p className="price-card__amount">₹{event.fee.pricing.regularAmount.toLocaleString("en-IN")}</p><p className="price-card__note">24 September – 5 October 2026.</p></div></div></div></Container></section>
    <RegistrationProcess />
    {confirmedBenefits.length ? <section className="landing-section landing-benefits"><Container><SectionHeading eyebrow="Confirmed inclusions" title="Part of your experience." /><ul>{confirmedBenefits.map((benefit) => <li key={benefit.key}><Sparkles aria-hidden /><div><h3>{benefit.label}</h3><p>{benefit.copy}</p></div></li>)}</ul></Container></section> : null}
    <EventDetails />
    <section id="faq" className="landing-section landing-faq"><Container><div className="landing-section__split"><SectionHeading eyebrow="Questions, answered" title="Clear before you decide."><p>Answers based on what is currently confirmed for the MET edition.</p></SectionHeading><Faq /></div></Container></section>
    <SupportContact />
    <FinalCta cta={cta} />
  </main><SiteFooter /></div>;
}
