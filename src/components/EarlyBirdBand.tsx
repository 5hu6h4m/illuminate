import { Flame } from "lucide-react";
import Link from "next/link";
import { formatINR, PRICING, savings } from "@/lib/pricing";

export function EarlyBirdBand() {
  return (
    <section id="early-bird" className="section screen border-t border-white/8">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 md:grid-cols-2 md:gap-16">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-ember">
            <Flame className="h-4 w-4" aria-hidden /> Early bird offer
          </p>
          <h2 className="mt-4 font-display text-4xl leading-tight md:text-5xl">
            {formatINR(PRICING.mrp)} → {formatINR(PRICING.earlyBird)}
          </h2>
          <p className="mt-3 text-lg text-ember">Save {formatINR(savings())}</p>
          <p className="mt-4 leading-relaxed text-white/65">
            Valid till {PRICING.earlyBirdEndsAtIST}. Limited early-bird registrations.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-white/50">
            Early-bird participants receive the complete Illuminate workshop experience. Campus
            visit and travel benefits are subject to the applicable selection / eligibility
            criteria.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-10">
          <p className="text-sm uppercase tracking-[0.2em] text-white/55">Secure your seat</p>
          <p className="mt-3 flex items-baseline gap-3">
            <span className="text-white/45 line-through">{formatINR(PRICING.mrp)}</span>
            <span className="font-display text-4xl">{formatINR(PRICING.earlyBird)}/-</span>
          </p>
          <p className="mt-2 text-sm text-ember">You save {formatINR(savings())}</p>
          <Link
            href="/register"
            className="mt-6 inline-block w-full rounded-full bg-ember px-8 py-4 text-center font-bold text-ink pressable transition-colors hover:bg-ember-deep"
          >
            PROCEED TO REGISTRATION
          </Link>
          <p className="mt-4 text-center text-xs text-white/50">
            Takes ~4 minutes · 4 short steps, not one giant form
          </p>
        </div>
      </div>
    </section>
  );
}
