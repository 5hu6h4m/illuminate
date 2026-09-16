"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { event, isConfirmedText } from "@/config/event";
import { illuminateContent } from "@/content/illuminate";
import { Container } from "@/components/ui/Container";

const HERO_VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_112712_da9d53df-6d27-4b12-bdf6-aa9dc2622bdf.mp4";

export function CinematicHero({ registrationAvailable }: { registrationAvailable: boolean }) {
  const cta = registrationAvailable
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      return;
    }
    const attempt = video.play();
    if (attempt) attempt.catch(() => {});
  }, []);

  useEffect(() => {
    if (ready) window.dispatchEvent(new Event("illuminate:hero-ready"));
  }, [ready]);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 6000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="cinematic-hero" aria-labelledby="hero-title">
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
      <div className="cinematic-hero__tint" aria-hidden="true" />
      <Container className="cinematic-hero__content">
        <div className="cinematic-hero__copy">
          <p className="cinematic-hero__eyebrow">{event.identity.name} {event.identity.edition}</p>
          <h1 id="hero-title">{illuminateContent.phaseOne.hero.title}</h1>
          <p className="cinematic-hero__summary">{illuminateContent.phaseOne.hero.description}</p>
          <p className="cinematic-hero__association">{event.association.label}</p>
          <div className="cinematic-hero__actions">
            <Link href={cta.href} className="cinematic-hero__button">
              <span>{cta.label}</span>
              <ArrowUpRight aria-hidden />
            </Link>
            <a href="#entrepreneurship" className="cinematic-hero__link">
              See what you&apos;ll learn <ArrowDownRight aria-hidden />
            </a>
          </div>
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
    </section>
  );
}
