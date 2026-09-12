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
const HALF = "translateZ(calc(min(300px,68vw)/2))";

const FACES: Face[] = [
  { icon: Sparkles, title: "Introduction", t: HALF },
  { icon: Lightbulb, title: "What is Entrepreneurship?", t: `rotateY(180deg) ${HALF}` },
  { icon: Users, title: "Team Formation", t: `rotateY(90deg) ${HALF}` },
  { icon: ClipboardList, title: "Business Model Canvas", t: `rotateY(-90deg) ${HALF}` },
  { icon: Wallet, title: "Finance for Entrepreneurs", t: `rotateX(90deg) ${HALF}` },
  { icon: Megaphone, title: "Pitching & Ideas", t: `rotateX(-90deg) ${HALF}` },
];

/** Rotating 3D workshop cube in official violet — pauses on hover, static list below for readability. */
export function StructureCube() {
  return (
    <div>
      <div className="cube-scene py-10" role="img" aria-label="Workshop topics: introduction, entrepreneurship, team formation, business model canvas, finance, pitching">
        <div className="cube">
          {FACES.map((f) => (
            <div key={f.title} className="cube-face" style={{ transform: f.t }}>
              <f.icon className="h-10 w-10 text-ember-soft" strokeWidth={1.5} aria-hidden />
              <p className="font-display text-lg tracking-wide text-white">{f.title}</p>
            </div>
          ))}
        </div>
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
