import {
  Bus,
  Clock,
  Flame,
  GraduationCap,
  Landmark,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { FlameMark } from "@/components/FlameMark";
import { SkewButton } from "@/components/SkewButton";
import { EnergyTrails } from "@/components/EnergyTrails";
import { formatINR, PRICING, savings } from "@/lib/pricing";

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
            "radial-gradient(55rem 34rem at 78% 40%, rgba(139,92,246,0.22), transparent 62%), radial-gradient(30rem 20rem at 15% 80%, rgba(124,58,237,0.12), transparent 60%)",
        }}
      />
      {/* official particles reference as faint ambient texture — masked so only
          dots/wing glow show (baked buttons cropped out), canvas stays the live layer */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/illuminate_background_particles_reference.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right-bottom opacity-40"
        style={{
          maskImage:
            "radial-gradient(110% 95% at 85% 85%, black 30%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(110% 95% at 85% 85%, black 30%, transparent 72%)",
        }}
      />
      {/* flowing energy trails — right side only, masked off the text column */}
      <EnergyTrails className="right-[-8rem] top-0 hidden h-full w-[46rem] opacity-90 md:block lg:right-[-4rem] lg:w-[54rem]" />
      <div className="relative z-[2] mx-auto grid w-full max-w-7xl items-center gap-12 px-6 pb-20 pt-32 md:pt-40 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ember-soft">
            E-Cell IIT Bombay × E-Cell MET
          </p>
          <div className="mt-6 flex items-center gap-4">
            <FlameMark className="h-20 w-14 shrink-0 md:h-28 md:w-20" />
            <p className="font-display text-6xl tracking-wide text-white md:text-8xl">
              illuminate
            </p>
          </div>
          <p className="mt-4 text-lg italic text-ember-soft md:text-xl">
            Empowering the next generation of Changemakers
          </p>
          <p className="mt-4 max-w-md leading-relaxed text-white/65">
            6-hour offline, interactive entrepreneurship workshop at MET Bhujbal Knowledge City.
            Learn. Build. Network.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <SkewButton href="/admin" variant="white">
              Login
            </SkewButton>
            <SkewButton href="/register" variant="violet">
              Register
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

        <div className="rounded-3xl border border-ember/30 bg-ember/[0.07] p-8 text-center backdrop-blur-sm md:p-10">
          <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-ember-soft">
            <Flame className="h-4 w-4" aria-hidden /> Early bird
          </p>
          <p className="mt-3 flex items-baseline justify-center gap-3">
            <span className="text-lg text-white/45 line-through">{formatINR(PRICING.mrp)}</span>
            <span className="font-display text-5xl text-white md:text-6xl">
              {formatINR(PRICING.earlyBird)}
            </span>
          </p>
          <p className="mt-2 text-sm text-ember-soft">Save {formatINR(savings())}</p>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-white/55">
            <Clock className="h-4 w-4" aria-hidden /> Valid till {PRICING.earlyBirdEndsAtIST}
          </p>
          <div className="mt-7">
            <SkewButton href="/register" variant="violet">
              REGISTER NOW
            </SkewButton>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-white/45">
            *Campus visit and travel benefits subject to selection / eligibility criteria.
          </p>
        </div>
      </div>
    </section>
  );
}
