import Link from "next/link";

const STEPS = [
  { n: "01", t: "Personal details", d: "Name exactly as you want it on the certificate." },
  { n: "02", t: "Academic details", d: "MET college locked · PRN verifies enrollment." },
  { n: "03", t: "Entrepreneurship profile", d: "Interests, ideas and past event experience." },
  { n: "04", t: "Campus visit / travel", d: "Interest, willingness and emergency contact." },
  { n: "05", t: "Payment ₹699", d: "Gateway or manual UPI → instant Registration ID." },
];

export function FlowSteps() {
  return (
    <section id="flow" className="section border-t border-white/8 bg-surface/40">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ember">How it works</p>
        <h2 className="mt-4 font-display text-3xl md:text-5xl">Calm, guided, in minutes</h2>
        <ol className="mt-12 space-y-5">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="flex flex-col gap-2 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:flex-row sm:items-baseline sm:gap-8 md:p-8"
            >
              <span className="font-display text-2xl text-ember">{s.n}</span>
              <div>
                <h3 className="text-lg font-semibold">{s.t}</h3>
                <p className="mt-1 text-white/60">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link
          href="/register"
          className="mt-10 inline-block rounded-full border border-ember/50 px-8 py-3.5 font-semibold text-ember transition hover:bg-ember hover:text-ink"
        >
          Start step 1 →
        </Link>
      </div>
    </section>
  );
}
