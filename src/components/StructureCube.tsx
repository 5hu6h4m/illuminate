const FACES = [
  { icon: "👋", title: "Introduction", t: "translateZ(calc(min(300px,68vw)/2))" },
  { icon: "💡", title: "What is Entrepreneurship?", t: "rotateY(180deg) translateZ(calc(min(300px,68vw)/2))" },
  { icon: "🤝", title: "Team Formation", t: "rotateY(90deg) translateZ(calc(min(300px,68vw)/2))" },
  { icon: "📋", title: "Business Model Canvas", t: "rotateY(-90deg) translateZ(calc(min(300px,68vw)/2))" },
  { icon: "💰", title: "Finance for Entrepreneurs", t: "rotateX(90deg) translateZ(calc(min(300px,68vw)/2))" },
  { icon: "🎤", title: "Pitching & Ideas", t: "rotateX(-90deg) translateZ(calc(min(300px,68vw)/2))" },
];

/** Rotating 3D workshop cube in official violet — pauses on hover, static list below for readability. */
export function StructureCube() {
  return (
    <div>
      <div className="cube-scene py-10" role="img" aria-label="Workshop topics: introduction, entrepreneurship, team formation, business model canvas, finance, pitching">
        <div className="cube">
          {FACES.map((f) => (
            <div key={f.title} className="cube-face" style={{ transform: f.t }}>
              <span className="text-4xl" aria-hidden>{f.icon}</span>
              <p className="font-display text-lg tracking-wide text-white">{f.title}</p>
            </div>
          ))}
        </div>
      </div>
      <ul className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2 text-sm text-white/70">
        {FACES.map((f) => (
          <li key={f.title} className="rounded-full border border-ember/35 bg-ember/10 px-4 py-1.5">
            <span aria-hidden className="mr-2">{f.icon}</span>{f.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
