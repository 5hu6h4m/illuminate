"use client";

import { Reveal } from "@/components/Reveal";

const STATS: [string, string][] = [
  ["20,000+", "Students Reached"],
  ["200+", "Colleges Engaged"],
  ["15+", "Cities Covered"],
];

function GlobeMedallion() {
  return (
    <div className="relative h-72 w-72 md:h-[26rem] md:w-[26rem]">
      {/* pulsing violet glow behind the globe */}
      <div
        aria-hidden
        className="globe-glow pointer-events-none absolute -inset-10 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(139,92,246,0.4), transparent 70%)",
        }}
      />
      {/* rotating orbit ring with satellite dots */}
      <div aria-hidden className="globe-orbit pointer-events-none absolute -inset-4">
        <div className="absolute inset-0 rounded-full border border-dashed border-ember/40" />
        <span className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_4px_rgba(196,181,253,0.9)]" />
        <span className="absolute right-[8%] top-[18%] h-2 w-2 rounded-full bg-ember-soft shadow-[0_0_10px_3px_rgba(139,92,246,0.9)]" />
        <span className="absolute bottom-[10%] left-[16%] h-2 w-2 rounded-full bg-white shadow-[0_0_10px_3px_rgba(196,181,253,0.9)]" />
      </div>
      {/* the artwork — black melts into the page via screen blend */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/map.png"
        alt="Glowing network globe over the map of India"
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover mix-blend-screen"
      />
      {/* radar scan sweep clipped to the globe disc */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-8 overflow-hidden rounded-full md:inset-12"
        style={{
          maskImage: "radial-gradient(circle, black 58%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle, black 58%, transparent 70%)",
        }}
      >
        <div
          className="globe-scan absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(196,181,253,0.5), transparent 22%)",
          }}
        />
      </div>
    </div>
  );
}

export function ImpactSection() {
  return (
    <section id="impact" className="section screen scroll-mt-0 border-t border-ember/15">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="relative">
          <div className="grid gap-6 md:grid-cols-2 md:gap-0">
            <Reveal>
              <article className="h-full bg-gradient-to-b from-ember to-ember-deep p-8 text-center md:p-12">
                <h2 className="font-display text-3xl text-white md:text-4xl">
                  illuminate Workshop
                </h2>
                <p className="mx-auto mt-5 max-w-md leading-relaxed text-white/85">
                  illuminate, an initiative by E-Cell IIT Bombay, aims to spark
                  entrepreneurial spirit and build business acumen in students
                  across India through workshops on business models, finance,
                  and core startup principles.
                </p>
              </article>
            </Reveal>
            <Reveal delay={90}>
              <article className="h-full bg-gradient-to-b from-ember to-ember-deep p-8 text-center md:p-12">
                <h2 className="font-display text-3xl text-white md:text-4xl">
                  Vision
                </h2>
                <p className="mx-auto mt-5 max-w-md leading-relaxed text-white/85">
                  To inspire, educate, and empower college students worldwide
                  to become the entrepreneurial leaders of tomorrow through
                  engaging and insightful speaker sessions on entrepreneurship,
                  business, and finance.
                </p>
              </article>
            </Reveal>
          </div>

          {/* horizontal beam the globe sits on (desktop, like the reference) */}
          <div
            aria-hidden
            className="absolute inset-x-[-2rem] top-1/2 hidden h-3 -translate-y-1/2 border-y border-ember/40 bg-black shadow-[0_0_30px_rgba(139,92,246,0.35)] md:block"
          />

          {/* globe overlapping the panel seam */}
          <Reveal className="relative z-[1] mx-auto -my-20 w-fit md:absolute md:left-1/2 md:top-1/2 md:m-0 md:-translate-x-1/2 md:-translate-y-1/2">
            <GlobeMedallion />
          </Reveal>
        </div>

        <h2 className="mt-16 text-center font-display text-4xl tracking-wide text-white md:mt-24 md:text-6xl">
          IMPACT ACROSS INDIA
        </h2>
        <div className="mx-auto mt-10 grid max-w-4xl gap-8 text-center sm:grid-cols-3">
          {STATS.map(([n, label], i) => (
            <Reveal key={label} delay={i * 80}>
              <p className="font-display text-5xl text-white md:text-6xl">{n}</p>
              <p className="mt-2 text-sm uppercase tracking-[0.2em] text-ember-soft">
                {label}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
