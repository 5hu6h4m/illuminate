import {
  Bus,
  GraduationCap,
  Landmark,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { SkewButton } from "@/components/SkewButton";

const BADGES: { icon: LucideIcon; label: string }[] = [
  { icon: GraduationCap, label: "IIT Bombay Certificate" },
  { icon: Landmark, label: "Campus Visit Opportunity*" },
  { icon: Bus, label: "Free Travel — Top 30*" },
  { icon: Rocket, label: "Illuminate Startup Kit" },
];

export function Hero() {
  return (
    <section id="home" className="relative flex min-h-svh items-center overflow-hidden">
      {/* transparent base so the fixed AmbientBackdrop shows through; fills one viewport */}
      {/* violet aura, right side — supports the trails, never covers text */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(55rem 34rem at 82% 40%, rgba(139,92,246,0.22), transparent 62%), radial-gradient(30rem 20rem at 18% 80%, rgba(124,58,237,0.12), transparent 60%)",
        }}
      />
      {/* flame artwork — bigger showcase, shifted slightly right with the text */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/herobg.png"
        alt=""
        aria-hidden
        fetchPriority="high"
        className="pointer-events-none absolute right-0 top-24 w-[102vw] max-w-none object-contain opacity-70 md:right-[-6rem] md:top-1/2 md:w-[68vw] md:max-w-[80rem] md:-translate-y-1/2 md:opacity-90 lg:right-[-4rem] lg:w-[64vw] lg:opacity-90"
        style={{
          mixBlendMode: "screen",
          filter: "brightness(1.18) saturate(0.85)",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 35%), linear-gradient(to bottom, black 82%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 35%), linear-gradient(to bottom, black 82%, transparent 100%)",
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      />
      {/* gentle bottom fade into the next section */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, transparent 72%, rgba(5,5,5,0.85) 100%)",
        }}
      />
      {/* official particles reference as faint ambient texture (masked), canvas stays the live layer */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/illuminate_background_particles_reference.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right-bottom opacity-15"
        style={{
          maskImage:
            "radial-gradient(110% 95% at 85% 85%, black 30%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(110% 95% at 85% 85%, black 30%, transparent 72%)",
        }}
      />
      <div className="relative z-[2] mr-auto w-full max-w-7xl px-6 pb-20 pt-32 md:pl-20 md:pt-40 lg:pl-32 xl:pl-40">
        <div className="max-w-2xl md:ml-6 lg:ml-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ember-soft">
            E-Cell IIT Bombay × E-Cell MET
          </p>
          {/* official illuminate wordmark — foreground, above all backdrop layers */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo2.png"
            alt="illuminate — Empowering the next generation of Changemakers"
            fetchPriority="high"
            className="relative z-[3] -ml-1 mt-6 w-full max-w-md drop-shadow-[0_0_35px_rgba(139,92,246,0.35)] md:-ml-6 md:max-w-xl lg:-ml-8"
          />
          <p className="mt-6 max-w-md leading-relaxed text-white/65">
            6-hour offline, interactive entrepreneurship workshop at MET Bhujbal Knowledge City.
            IIT Bombay certificate, Startup Kit, campus visit + free travel for Top 30*.
            Learn. Build. Network.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <SkewButton href="/register" variant="violet">
              Register Now
            </SkewButton>
            <SkewButton href="/#about" variant="white">
              Explore Event
            </SkewButton>
          </div>
          <ul className="mt-10 flex max-w-md flex-wrap gap-2 text-xs text-white/75" aria-label="Highlights">
            {BADGES.map((b) => (
              <li
                key={b.label}
                className="flex items-center gap-2 rounded-full border border-ember/40 bg-ember/10 px-3 py-1.5"
              >
                <b.icon className="h-3.5 w-3.5 text-ember-soft" strokeWidth={2} aria-hidden />
                {b.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
