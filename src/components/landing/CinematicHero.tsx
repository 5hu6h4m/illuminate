"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { event, isConfirmedText } from "@/config/event";
import { illuminateContent } from "@/content/illuminate";
import { Container } from "@/components/ui/Container";
import { RegistrationClosedDialog } from "@/components/landing/RegistrationClosedDialog";
import { heroWordClass, isBusinessToken, stripTrailingPunctuation } from "@/lib/hero-words";

const HERO_VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_112712_da9d53df-6d27-4b12-bdf6-aa9dc2622bdf.mp4";

function renderHeroToken(token: string, index: number) {
  if (/^\s*$/.test(token)) return <Fragment key={index}>{token}</Fragment>;
  const stemLength = stripTrailingPunctuation(token).length;
  if (isBusinessToken(token)) {
    const stem = token.slice(0, stemLength);
    const punct = token.slice(stemLength);
    return (
      <span key={index} className="hero-word">
        <span className="hero-business">{stem}</span>
        {punct ? <span className="hero-period">{punct}</span> : null}
      </span>
    );
  }
  return (
    <span key={index} className={heroWordClass(token)}>
      {token}
    </span>
  );
}

export function CinematicHero({ registrationAvailable, manuallyClosed = false }: { registrationAvailable: boolean; manuallyClosed?: boolean }) {
  const [closedOpen, setClosedOpen] = useState(false);
  const cta = manuallyClosed
    ? { href: "#event-details", label: "Registration Closed" }
    : registrationAvailable
      ? { href: "/register", label: "Register for Illuminate" }
      : { href: "#event-details", label: "View event details" };
  const deadline = isConfirmedText(event.registration.deadline) ? event.registration.deadline.value : null;
  const eligibility = isConfirmedText(event.registration.eligibility) ? event.registration.eligibility.value : null;
  const facts = [
    { label: "Format", value: isConfirmedText(event.format) ? event.format.value : null },
    { label: "Who can join", value: eligibility },
    { label: "Early Bird", value: `\u20B9${event.fee.pricing.earlyBirdAmount.toLocaleString("en-IN")}` },
    { label: "Register by", value: deadline },
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact.value));

  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NetworkInformation.saveData lacks a DOM lib type; data-saver gate.
    const update = () => setShowVideo(mq.matches && !((navigator as any)?.connection?.saveData));
    update();
    mq.addEventListener("change", update);
    const video = videoRef.current;
    if (!video) return () => mq.removeEventListener("change", update);
    video.muted = true;
    video.defaultMuted = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      return () => mq.removeEventListener("change", update);
    }
    const attempt = video.play();
    if (attempt) attempt.catch(() => {});
    return () => mq.removeEventListener("change", update);
  }, [showVideo]);

  useEffect(() => {
    if (ready) window.dispatchEvent(new Event("illuminate:hero-ready"));
  }, [ready]);

  useEffect(() => {
    // Preloader lifts at 1200ms; video fade decision must precede it; late video events still fade in via onCanPlay.
    const timer = window.setTimeout(() => setReady(true), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="cinematic-hero" aria-labelledby="hero-title">
      {showVideo ? (
      <video
        ref={videoRef}
        className={`cinematic-hero__video${ready ? " is-ready" : ""}`}
        autoPlay
        muted
        loop
        playsInline
        disablePictureInPicture
        preload="auto"
        onCanPlay={() => setReady(true)}
        onPlaying={() => setReady(true)}
        onError={() => setReady(true)}
        aria-hidden="true"
      >
        <source src={HERO_VIDEO_SRC} type="video/mp4" />
      </video>
      ) : null}
      <div className="cinematic-hero__tint" aria-hidden="true" />
      <Container className="cinematic-hero__content">
        <div className="cinematic-hero__copy">
          <p className="cinematic-hero__eyebrow">{event.identity.name} {event.identity.edition}</p>
          <h1 id="hero-title">{illuminateContent.phaseOne.hero.title.split(/(\s+)/).map(renderHeroToken)}</h1>
          <p className="cinematic-hero__summary">{illuminateContent.phaseOne.hero.description}</p>
          <p className="cinematic-hero__association">{event.association.label}</p>
          <div className="cinematic-hero__actions">
            {manuallyClosed ? (
              <button type="button" className="cinematic-hero__button" onClick={() => setClosedOpen(true)}>
                <span>{cta.label}</span>
                <ArrowUpRight aria-hidden />
              </button>
            ) : (
              <Link href={cta.href} className="cinematic-hero__button">
                <span>{cta.label}</span>
                <ArrowUpRight aria-hidden />
              </Link>
            )}
            <a href="#entrepreneurship" className="cinematic-hero__link">
              See what you&apos;ll learn <ArrowDownRight aria-hidden />
            </a>
          </div>
          <p className="cinematic-hero__login">Already registered? <Link href="/login" className="cinematic-hero__link">Log in with email or mobile</Link></p>
          <dl className="cinematic-hero__facts" aria-label="Key event facts">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          <div className="cinematic-hero__teaser" aria-hidden="true">
            <span>Problem</span><i /><span>Idea</span><i /><span>Business</span>
          </div>
        </div>
      </Container>
      {closedOpen ? <RegistrationClosedDialog variant="closed" onClose={() => setClosedOpen(false)} /> : null}
    </section>
  );
}
