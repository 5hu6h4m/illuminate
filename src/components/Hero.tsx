import Link from "next/link";
import { formatINR, PRICING, savings } from "@/lib/pricing";

const BADGES = [
  { icon: "🎓", label: "IIT Bombay Certificate" },
  { icon: "🏛️", label: "Campus Visit Opportunity*" },
  { icon: "🚌", label: "Free Travel — Top 30*" },
  { icon: "🚀", label: "Illuminate Startup Kit" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 30rem at 50% -10rem, rgba(255,201,60,0.16), transparent 60%), radial-gradient(40rem 24rem at 85% 20rem, rgba(255,201,60,0.08), transparent 60%)",
        }}
      />
      <div className="section relative mx-auto max-w-6xl px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ember">
          E-Cell IIT Bombay × E-Cell MET
        </p>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-5xl leading-[1.05] tracking-wide md:text-7xl">
          ILLUMINATE 2026
        </h1>
        <p className="mx-auto mt-5 text-lg text-white/75 md:text-xl">
          6-Hour Interactive Entrepreneurship Workshop
        </p>
        <p className="mx-auto mt-3 measure text-base leading-relaxed text-muted">
          Learn. Build. Network. Experience entrepreneurship — with speakers, activities and
          exclusive startup content.
        </p>

        <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-3" aria-label="Highlights">
          {BADGES.map((b) => (
            <li
              key={b.label}
              className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/85"
            >
              <span aria-hidden className="mr-2">{b.icon}</span>
              {b.label}
            </li>
          ))}
        </ul>

        <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-ember/30 bg-ember/[0.07] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ember">
            🔥 Early bird
          </p>
          <p className="mt-3 flex items-baseline justify-center gap-3">
            <span className="text-lg text-white/50 line-through">{formatINR(PRICING.mrp)}</span>
            <span className="font-display text-5xl text-cream">{formatINR(PRICING.earlyBird)}</span>
          </p>
          <p className="mt-2 text-sm text-ember">Save {formatINR(savings())}</p>
          <p className="mt-2 text-sm text-white/60">⏳ Valid till {PRICING.earlyBirdEndsAtIST}</p>
          <Link
            href="/register"
            className="mt-6 inline-block w-full rounded-full bg-ember px-8 py-4 text-base font-bold text-ink transition hover:bg-ember-deep sm:w-auto"
          >
            REGISTER NOW
          </Link>
          <p className="mt-4 text-xs leading-relaxed text-white/50">
            *Campus visit and travel benefits are subject to applicable selection / eligibility
            criteria.
          </p>
        </div>
      </div>
    </section>
  );
}
