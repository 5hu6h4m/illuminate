import {
  ClipboardList,
  Lightbulb,
  Megaphone,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

type Face = { icon: LucideIcon; title: string; t: string };
const HALF = "translateZ(calc(min(360px,76vw)/2))";

const FACES: Face[] = [
  { icon: Sparkles, title: "Introduction", t: HALF },
  { icon: Lightbulb, title: "What is Entrepreneurship?", t: `rotateY(180deg) ${HALF}` },
  { icon: Users, title: "Team Formation", t: `rotateY(90deg) ${HALF}` },
  { icon: ClipboardList, title: "Business Model Canvas", t: `rotateY(-90deg) ${HALF}` },
  { icon: Wallet, title: "Finance for Entrepreneurs", t: `rotateX(90deg) ${HALF}` },
  { icon: Megaphone, title: "Pitching & Ideas", t: `rotateX(-90deg) ${HALF}` },
];

/** Rotating 3D workshop cube — dark glass like reference, ground glow, pauses on hover. */
export function StructureCube() {
  return (
    <div className="relative">
      {/* violet ground glow under the cube (reference look) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[75%] max-w-[560px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "radial-gradient(closest-side, rgba(124,58,237,0.28), rgba(124,58,237,0.08) 55%, transparent 75%)",
          filter: "blur(10px)",
        }}
      />
      <div className="cube-scene relative py-12" role="img" aria-label="Workshop topics: introduction, entrepreneurship, team formation, business model canvas, finance, pitching">
        <div className="cube">
          {FACES.map((f) => (
            <div key={f.title} className="cube-face" style={{ transform: f.t }}>
              <f.icon className="h-9 w-9 text-white/90" strokeWidth={1.2} aria-hidden />
              <p className="text-center text-sm leading-snug text-white/85">{f.title}</p>
            </div>
          ))}
        </div>
        {/* floor reflection glow */}
        <div
          aria-hidden
          className="pointer-events-none mx-auto -mt-6 h-16 w-[62%] max-w-[420px] rounded-[100%] bg-ember/30 blur-2xl"
        />
      </div>
      <ul className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2 text-sm text-white/70">
        {FACES.map((f) => (
          <li key={f.title} className="flex items-center gap-2 rounded-full border border-ember/35 bg-ember/10 px-4 py-1.5">
            <f.icon className="h-4 w-4 text-ember-soft" strokeWidth={2} aria-hidden />{f.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
