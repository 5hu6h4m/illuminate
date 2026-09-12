const CARDS = [
  { icon: "🎓", title: "IIT Bombay Certificate", text: "Get a Certificate from E-Cell IIT Bombay after attending the workshop." },
  { icon: "🏛️", title: "IIT Bombay Campus Visit", text: "Exclusive opportunity to visit IIT Bombay Campus for selected / top participants.*" },
  { icon: "🚀", title: "Startup Kit", text: "Every participant gets an Illuminate Startup Kit for hands-on entrepreneurship learning." },
  { icon: "🎤", title: "Interactive 6-Hour Experience", text: "Interactive sessions, speakers, activities and exclusive entrepreneurship content." },
  { icon: "🤝", title: "Networking", text: "Connect with students interested in startups, business, innovation and technology." },
  { icon: "🏆", title: "E-Summit IIT Bombay Benefits", text: "Exclusive benefits related to E-Summit IIT Bombay, including opportunities for passes, accommodation and networking." },
];

export function BenefitCards() {
  return (
    <section id="incentives" className="section border-t border-ember/15 bg-surface/60">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-ember-soft">
          Incentives
        </p>
        <h2 className="mx-auto mt-4 max-w-2xl text-center font-display text-3xl leading-tight md:text-5xl">
          One day. Everything you need to start up.
        </h2>

        {/* Biggest hook — featured travel banner */}
        <div className="relative mt-12 overflow-hidden rounded-3xl border border-ember/50 bg-gradient-to-r from-ember/25 via-ember/10 to-transparent p-8 md:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(30rem 16rem at 85% 50%, rgba(139,92,246,0.35), transparent 65%)",
            }}
          />
          <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center">
            <span className="text-5xl md:text-6xl" aria-hidden>🚌</span>
            <div>
              <p className="inline-block rounded-full bg-ember px-4 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">
                Biggest hook · Top 30 only
              </p>
              <h3 className="mt-3 font-display text-2xl tracking-wide md:text-4xl">
                FREE TRAVEL OPPORTUNITY
              </h3>
              <p className="mt-3 max-w-2xl leading-relaxed text-white/70">
                Free bus / travel to IIT Bombay for the Top 30 selected participants — plus an
                exclusive opportunity to visit the IIT Bombay campus.*
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 md:gap-8">
          {CARDS.map((c) => (
            <article
              key={c.title}
              className="rounded-3xl border border-ember/25 bg-ember/[0.05] p-8 transition hover:border-ember/60 hover:shadow-[0_0_35px_rgba(139,92,246,0.25)]"
            >
              <div className="text-3xl" aria-hidden>{c.icon}</div>
              <h3 className="mt-5 font-display text-xl tracking-wide">{c.title}</h3>
              <p className="mt-3 leading-relaxed text-white/60">{c.text}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-white/40">*Subject to applicable eligibility / selection criteria.</p>
      </div>
    </section>
  );
}
