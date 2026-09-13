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
            "radial-gradient(55rem 34rem at 78% 40%, rgba(139,92,246,0.22), transparent 62%), radial-gradient(30rem 20rem at 15% 80%, rgba(124,58,237,0.12), transparent 60%)",
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
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right-bottom opacity-40"
        style={{
          maskImage:
            "radial-gradient(110% 95% at 85% 85%, black 30%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(110% 95% at 85% 85%, black 30%, transparent 72%)",
        }}
      />
      <div className="relative z-[2] mx-auto w-full max-w-7xl px-6 pb-20 pt-32 md:pt-40">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ember-soft">
            E-Cell IIT Bombay × E-Cell MET
          </p>
          {/* official illuminate wordmark — foreground, above all backdrop layers */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo2.png"
            alt="illuminate — Empowering the next generation of Changemakers"
            fetchPriority="high"
            className="relative z-[3] mt-6 w-full max-w-md drop-shadow-[0_0_35px_rgba(139,92,246,0.35)] md:max-w-xl"
          />
          <p className="mt-6 max-w-md leading-relaxed text-white/65">
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
      </div>
    </section>
  );
}
