import { FlaskConical, Handshake, Target, type LucideIcon } from "lucide-react";
import { IconTile } from "@/components/IconTile";
import { Reveal } from "@/components/Reveal";
import { StructureCube } from "@/components/StructureCube";

export function AboutSection() {
  return (
    <section id="about" className="section screen scroll-mt-0 border-t border-ember/15">
      <div className="mx-auto w-full max-w-6xl px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ember-soft">About Us</p>
        <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl leading-tight md:text-5xl">
          Asia&apos;s largest student-run entrepreneurship movement, now at MET
        </h2>
        <p className="measure mx-auto mt-6 leading-relaxed text-white/65">
          The Entrepreneurship Cell of IIT Bombay has spent close to three decades building
          founders across India. <strong className="text-white">Illuminate</strong> carries that
          spirit to campuses — a 6-hour offline workshop on business models, finance and core
          startup principles, delivered by an expert trainer.
        </p>
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 text-left sm:grid-cols-3">
          {(
            [
              [Target, "Vision", "Inspire, educate and empower students to become entrepreneurial leaders of tomorrow."],
              [FlaskConical, "Format", "Interactive speaker sessions, activities and case-based learning — not a lecture."],
              [Handshake, "Host", "E-Cell MET Bhujbal Knowledge City, in collaboration with E-Cell IIT Bombay."],
            ] as [LucideIcon, string, string][]
          ).map(([Icon, title, text], i) => (
            <Reveal key={title} delay={i * 60}>
              <article className="lift h-full rounded-3xl border border-ember/25 bg-ember/[0.05] p-7">
                <IconTile icon={Icon} />
                <h3 className="mt-4 font-display text-xl">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StructureSection() {
  return (
    <section id="structure" className="section screen border-t border-ember/15 bg-surface/60">
      <div className="mx-auto w-full max-w-6xl px-6 text-center">
        <h2 className="font-display text-4xl tracking-wide md:text-6xl">STRUCTURE</h2>
        <p className="mt-3 text-lg italic text-ember-soft">Workshop in your college/school</p>
        <div className="mt-8">
          <StructureCube />
        </div>
      </div>
    </section>
  );
}

const GUIDELINES = [
  "The workshop is conducted at your college in an offline format.",
  "It is a paid event — every participant pays the registration fee.",
  "A minimum number of participants is required for the workshop to proceed.",
  "Every participant receives a certificate of participation and the Startup Kit.",
  "Campus visit and free travel apply to the Top 30 selected participants only.",
];

export function GuidelinesSection() {
  return (
    <section id="guidelines" className="section screen border-t border-ember/15">
      <div className="mx-auto w-full max-w-4xl px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-ember-soft">
          Guidelines
        </p>
        <h2 className="mt-4 text-center font-display text-3xl md:text-5xl">How the day works</h2>
        <ol className="mt-10 space-y-4">
          {GUIDELINES.map((g, i) => (
            <Reveal
              key={g}
              as="li"
              delay={Math.min(i, 4) * 50}
              className="flex items-start gap-5 rounded-3xl border border-ember/20 bg-white/[0.02] p-6"
            >
              <span className="font-display text-2xl text-ember-soft">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="leading-relaxed text-white/70">{g}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
