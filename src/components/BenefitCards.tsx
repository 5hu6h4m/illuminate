"use client";

import { useState } from "react";
import {
  Bus,
  GraduationCap,
  Handshake,
  Landmark,
  Mic,
  Rocket,
  Trophy,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";

type Card = {
  icon: LucideIcon;
  slug: string;
  image: string;
  tag: string;
  title: string;
  text: string;
};

const CARDS: Card[] = [
  {
    icon: GraduationCap,
    slug: "certificate",
    image: "/images/certificate.jpg",
    tag: "Certified",
    title: "IIT Bombay Certificate",
    text: "Get a Certificate from E-Cell IIT Bombay after attending the workshop.",
  },
  {
    icon: Landmark,
    slug: "campus",
    image: "/images/campus-iitb.jpg",
    tag: "Selected / Top",
    title: "IIT Bombay Campus Visit",
    text: "Exclusive opportunity to visit IIT Bombay campus for selected / top participants.*",
  },
  {
    icon: Rocket,
    slug: "kit",
    image: "/images/startup-kit.jpg",
    tag: "For everyone",
    title: "Illuminate Startup Kit",
    text: "Every participant gets a hands-on Startup Kit for real entrepreneurship learning.",
  },
  {
    icon: Mic,
    slug: "interactive",
    image: "/images/workshop.jpg",
    tag: "6 hours live",
    title: "Interactive 6-Hour Experience",
    text: "Interactive sessions, speakers, activities and exclusive entrepreneurship content.",
  },
  {
    icon: Handshake,
    slug: "network",
    image: "/images/networking.jpg",
    tag: "Community",
    title: "Networking",
    text: "Connect with students into startups, business, innovation and technology.",
  },
  {
    icon: Trophy,
    slug: "esummit",
    image: "/images/esummit.jpg",
    tag: "E-Summit",
    title: "E-Summit IIT Bombay Benefits",
    text: "Exclusive E-Summit benefits — passes, accommodation support and networking opportunities.*",
  },
];

/** Image with violet art fallback — drop official images into /public/images to activate. */
function CardVisual({ card, tall = false }: { card: Pick<Card, "image" | "slug" | "icon">; tall?: boolean }) {
  const [failed, setFailed] = useState(false);
  const Icon = card.icon;
  return (
    <div className={`relative overflow-hidden ${tall ? "h-full min-h-[280px]" : "aspect-[16/10] w-full"}`}>
      {/* fallback art — always rendered underneath */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(22rem 12rem at 80% 20%, rgba(139,92,246,0.5), transparent 65%), radial-gradient(18rem 12rem at 15% 90%, rgba(124,58,237,0.4), transparent 60%), linear-gradient(135deg, #17102e 0%, #0d0a18 55%, #1a1035 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(167,139,250,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.14) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(closest-side at 50% 40%, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(closest-side at 50% 40%, black 40%, transparent 100%)",
        }}
      />
      <Icon
        aria-hidden
        className="absolute -bottom-6 -right-4 h-36 w-36 text-ember/25"
        strokeWidth={1}
      />
      <div aria-hidden className="absolute left-1/2 top-1/3 h-24 w-40 -translate-x-1/2 rounded-full bg-ember/40 blur-3xl" />
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.image}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {!failed && <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0d0a18] via-transparent to-transparent" />}
    </div>
  );
}

export function BenefitCards() {
  return (
    <section id="incentives" className="section screen relative overflow-hidden border-t border-ember/15 bg-surface/60">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50rem 26rem at 50% 0%, rgba(139,92,246,0.18), transparent 62%), radial-gradient(30rem 20rem at 50% 100%, rgba(124,58,237,0.12), transparent 60%)",
        }}
      />

      <div className="relative z-[2] mx-auto max-w-6xl px-6 py-24 md:py-32">
        {/* ---- header — centered, single measure ---- */}
        <div className="relative mx-auto max-w-2xl text-center">
          {/* logo crop as unrecognizable violet glow texture — blurred past readability */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/illuminate_logo_crop.png"
            alt=""
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-40 w-[30rem] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover opacity-25 blur-3xl"
          />
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ember-soft">
            🔥 Illuminate 2026 · E-Cell IIT Bombay
          </p>
          <h2 className="mt-4 font-display text-3xl leading-tight md:text-5xl">
            One day. Everything you need to start up.
          </h2>
          <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-ember/40 bg-ember/10 px-4 py-1.5 text-sm text-white/80">
            <Clock className="h-4 w-4 text-ember-soft" aria-hidden />
            6-Hour Offline Entrepreneurship Workshop
          </p>
        </div>

        {/* ---- biggest hook — featured travel banner, strict 2-col alignment ---- */}
        <Reveal className="mt-12">
          <article className="grid overflow-hidden rounded-3xl border border-ember/50 bg-gradient-to-r from-ember/25 via-ember/10 to-transparent md:grid-cols-2">
            <div className="flex flex-col justify-center p-8 md:p-12">
              <p className="inline-flex w-fit items-center gap-2 rounded-full bg-ember px-4 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">
                <Bus className="h-3.5 w-3.5" aria-hidden /> Biggest hook · Top 30 only
              </p>
              <h3 className="mt-4 font-display text-2xl tracking-wide md:text-4xl">
                FREE TRAVEL OPPORTUNITY
              </h3>
              <p className="mt-3 max-w-xl leading-relaxed text-white/70">
                Free bus / travel to IIT Bombay for the Top 30 selected participants — plus an
                exclusive IIT Bombay campus visit. Students see the extra value instantly.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2 text-xs text-white/75">
                {["Free bus / travel", "Campus visit", "Top 30 selected"].map((t) => (
                  <li key={t} className="rounded-full border border-ember/40 bg-black/30 px-3 py-1.5">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <CardVisual
              tall
              card={{ image: "/images/bus-iitb.jpg", slug: "travel", icon: Bus }}
            />
          </article>
        </Reveal>

        {/* ---- grid — equal heights, aligned visuals ---- */}
        <div className="mt-8 grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3 md:gap-8">
          {CARDS.map((c, i) => (
            <Reveal key={c.slug} flip delay={(i % 3) * 70} className="h-full">
              <div className="clip-chamfer h-full bg-ember/40 p-px transition-[filter] duration-200 hover:drop-shadow-[0_0_28px_rgba(139,92,246,0.45)]">
              <article className="clip-chamfer-inner flex h-full flex-col overflow-hidden bg-[#0d0a18]">
                <div className="relative">
                  <CardVisual card={c} />
                  <span className="absolute left-5 top-4 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ember-soft backdrop-blur-sm">
                    {c.tag}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-7">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-ember/30 bg-gradient-to-br from-ember/25 to-ember/5 text-ember-soft shadow-[0_0_24px_rgba(139,92,246,0.25)]">
                    <c.icon className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-xl leading-snug tracking-wide">{c.title}</h3>
                  <p className="mt-2 flex-1 text-[0.95rem] leading-relaxed text-white/60">{c.text}</p>
                </div>
              </article>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-white/40">
          *Campus visit, travel and E-Summit benefits subject to selection / eligibility criteria.
        </p>
      </div>
    </section>
  );
}
