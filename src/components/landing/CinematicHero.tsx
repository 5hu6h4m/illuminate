"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { event, isConfirmedText, isPaymentRegistrationAvailable } from "@/config/event";
import { Container } from "@/components/ui/Container";

const HERO_VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_112712_da9d53df-6d27-4b12-bdf6-aa9dc2622bdf.mp4";

/**
 * Cinematic hero: full-bleed looping video stage carrying only confirmed
 * Illuminate event facts. No cards, no decorative gradients — the video is
 * the visual, with monochrome edge fades for legibility.
 */
export function CinematicHero() {
  const registrationAvailable = isPaymentRegistrationAvailable();
  const cta = registrationAvailable
    ? { href: "/register", label: "Register Now" }
    : { href: "#details", label: "View event details" };
  const deadline = isConfirmedText(event.registration.deadline) ? event.registration.deadline.value : null;
  const eligibility = isConfirmedText(event.registration.eligibility) ? event.registration.eligibility.value : null;
  const date = isConfirmedText(event.schedule.date) ? event.schedule.date.value : "Date to be announced";
  const venue = isConfirmedText(event.schedule.venue) ? event.schedule.venue.value : "Venue to be announced";
  const facts = [
    registrationAvailable ? "Registration open" : "Registration opening soon",
    date,
    venue,
    `Early Bird \u20B9${event.fee.pricing.earlyBirdAmount} · Regular \u20B9${event.fee.pricing.regularAmount}`,
    ...(deadline ? [`Deadline ${deadline}`] : []),
    ...(eligibility ? [eligibility] : []),
  ];

  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Cross-browser autoplay: the muted IDL property (not just the JSX
    // attribute) is what autoplay policies inspect, and Safari requires an
    // explicit play() attempt in some cases.
    video.muted = true;
    video.defaultMuted = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      return;
    }
    const attempt = video.play();
    if (attempt) attempt.catch(() => {});
  }, []);

  // The site preloader lifts once the hero video can play; the timeouts
  // guarantee the signal is always sent even if the CDN stalls or errors.
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
          <p className="cinematic-hero__eyebrow">
            {event.identity.name} {event.identity.edition} · E-Cell IIT Bombay × {event.organizer.name}
          </p>
          <h1 id="hero-title">
            <span>Ideas deserve</span>
            <span>an ignition point.</span>
          </h1>
          <p className="cinematic-hero__summary">{event.identity.shortDescription}</p>
          <p className="cinematic-hero__association">{event.association.label}</p>
          <div className="cinematic-hero__actions">
            <Link href={cta.href} className="cinematic-hero__button">
              <span>{cta.label}</span>
              <ArrowUpRight aria-hidden />
            </Link>
            <a href="#journey" className="cinematic-hero__link">
              Explore the experience <ArrowDownRight aria-hidden />
            </a>
          </div>
          <p className="cinematic-hero__meta" aria-label="Key event facts">
            {facts.map((fact, index) => (
              <span key={fact}>
                {index > 0 ? <span aria-hidden="true"> · </span> : null}
                {fact}
              </span>
            ))}
          </p>
        </div>
      </Container>
    </section>
  );
}
