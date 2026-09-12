import { FlameMark } from "@/components/FlameMark";
import { SkewButton } from "@/components/SkewButton";
import { formatINR, PRICING, savings } from "@/lib/pricing";

export function Hero() {
  return (
    <section id="home" className="stars relative overflow-hidden bg-ink">
      {/* violet aura, right side */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(55rem 34rem at 78% 40%, rgba(139,92,246,0.28), transparent 62%), radial-gradient(30rem 20rem at 15% 80%, rgba(124,58,237,0.16), transparent 60%)",
        }}
      />
      {/* stylised wing glow — original CSS art in the official spirit */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-1/2 hidden h-[34rem] w-[46rem] -translate-y-1/2 opacity-70 md:block"
        style={{
          background:
            "conic-gradient(from 200deg at 50% 50%, transparent 0deg, rgba(139,92,246,0.5) 25deg, transparent 60deg, rgba(196,181,253,0.35) 95deg, transparent 130deg, rgba(124,58,237,0.45) 170deg, transparent 210deg, rgba(139,92,246,0.4) 250deg, transparent 290deg)",
          filter: "blur(28px)",
          maskImage: "radial-gradient(closest-side, black 30%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(closest-side, black 30%, transparent 72%)",
        }}
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-32 md:pt-40 lg:grid-cols-2">
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
            6-hour interactive entrepreneurship workshop at MET Bhujbal Knowledge City.
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
          <ul className="mt-10 flex max-w-md flex-wrap gap-2 text-xs text-white/70" aria-label="Highlights">
            {["🎓 IIT Bombay Certificate", "🏛️ Campus Visit*", "🚌 Free Travel Top-30*", "🚀 Startup Kit"].map(
              (b) => (
                <li key={b} className="rounded-full border border-ember/40 bg-ember/10 px-3 py-1.5">
                  {b}
                </li>
              )
            )}
          </ul>
        </div>

        <div className="rounded-3xl border border-ember/30 bg-ember/[0.07] p-8 text-center backdrop-blur-sm md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ember-soft">
            🔥 Early bird
          </p>
          <p className="mt-3 flex items-baseline justify-center gap-3">
            <span className="text-lg text-white/45 line-through">{formatINR(PRICING.mrp)}</span>
            <span className="font-display text-5xl text-white md:text-6xl">
              {formatINR(PRICING.earlyBird)}
            </span>
          </p>
          <p className="mt-2 text-sm text-ember-soft">Save {formatINR(savings())}</p>
          <p className="mt-2 text-sm text-white/55">⏳ Valid till {PRICING.earlyBirdEndsAtIST}</p>
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
