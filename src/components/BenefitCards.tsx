const CARDS = [
  { icon: "🎓", title: "E-Cell IIT Bombay Certificate", text: "Certificate of participation from E-Cell IIT Bombay." },
  { icon: "🏛️", title: "IIT Bombay Campus Visit", text: "Opportunity for selected participants to visit the IIT Bombay campus.*" },
  { icon: "🚌", title: "Free Travel", text: "Free bus / travel opportunity for the Top 30 selected participants.*" },
  { icon: "🚀", title: "Startup Kit", text: "The Illuminate Startup Kit for your entrepreneurship learning experience." },
  { icon: "🎤", title: "6-Hour Experience", text: "Interactive sessions, speakers, activities and exclusive content." },
  { icon: "🤝", title: "Networking", text: "Connect with students into startups, innovation, business and technology." },
  { icon: "🏆", title: "E-Summit Benefits", text: "Exclusive benefits associated with E-Summit IIT Bombay." },
];

export function BenefitCards() {
  return (
    <section id="benefits" className="section border-t border-white/8 bg-surface/40">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ember">What you get</p>
        <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight md:text-5xl">
          One day. Everything you need to start up.
        </h2>
        <p className="mt-4 measure leading-relaxed text-white/65">
          Plenty of breathing room by design — seven calm cards, no clutter. Selection-based
          perks are clearly marked.
        </p>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 md:gap-8">
          {CARDS.map((c) => (
            <article
              key={c.title}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 transition hover:border-ember/40"
            >
              <div className="text-3xl" aria-hidden>{c.icon}</div>
              <h3 className="mt-5 font-display text-xl tracking-wide">{c.title}</h3>
              <p className="mt-3 leading-relaxed text-white/65">{c.text}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 text-xs text-white/45">*Subject to applicable eligibility / selection criteria.</p>
      </div>
    </section>
  );
}
