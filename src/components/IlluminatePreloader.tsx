"use client";

import { useEffect, useRef, useState } from "react";
import { FlameMark } from "@/components/FlameMark";

type Phase = "dot" | "line" | "charge" | "open";

/**
 * IlluminatePreloader — fixed ~5s cinematic castle-door entry.
 * Single rAF clock drives EVERYTHING (phase + bar), so it can never
 * get stuck waiting on window.load:
 * 1. DOT (0–0.6s): single glowing dot pulses at centre (ABOVE doors)
 * 2. LINE (0.6–1.6s): THE SAME node stretches smoothly into a
 *    full-height seam (width/height/border-radius transition)
 * 3. CHARGE (1.6–2.0s): seam thickens + heats, door edges catch light
 * 4. OPEN (2.0–3.6s): plain sheet doors swing FULLY open inward
 *    in 3D — FAST 1s snap. BRIGHT purple light floods through
 *    the wide gap. Loader revealed behind, then fade.
 */
const TOTAL = 3600;
const T_LINE = 600;
const T_CHARGE = 1600;
const T_OPEN = 2000;
const DOOR_MS = 1000;

function phaseFor(e: number): Phase {
  if (e < T_LINE) return "dot";
  if (e < T_CHARGE) return "line";
  if (e < T_OPEN) return "charge";
  return "open";
}

export function IlluminatePreloader() {
  const [visible, setVisible] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (reduced) {
      // instant, elegant exit — no motion
      const t = window.setTimeout(() => {
        setLeaving(true);
        window.setTimeout(() => {
          setVisible(false);
          document.body.style.overflow = "";
        }, 250);
      }, 400);
      return () => {
        window.clearTimeout(t);
        document.body.style.overflow = prevOverflow;
      };
    }

    const start = performance.now();
    let raf = 0;

    const loop = (now: number) => {
      const e = now - start;
      setElapsed(Math.min(e, TOTAL));
      if (e >= TOTAL && !doneRef.current) {
        doneRef.current = true;
        setLeaving(true);
        window.setTimeout(() => {
          setVisible(false);
          document.body.style.overflow = "";
        }, 700);
        return; // stop looping — done
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (!visible) return null;

  const phase = phaseFor(elapsed);
  const open = phase === "open";
  // door slide 0→1 across the OPEN window (2.1s → 4.6s), eased by CSS
  const openT = open ? Math.min(1, (elapsed - T_OPEN) / (TOTAL - T_OPEN)) : 0;
  const pct = Math.floor(Math.min(100, (elapsed / TOTAL) * 100));

  return (
    <div
      role="status"
      aria-label="Loading Illuminate"
      className={`fixed inset-0 z-[100] overflow-hidden bg-[#050505] transition-opacity duration-700 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* ── loader sits BEHIND the doors — revealed by the opening ── */}
      <div className="absolute inset-0 z-0 flex flex-col items-center justify-center px-6">
        <div className="preloader-flame relative">
          <div aria-hidden className="absolute -inset-10 rounded-full bg-[#8b5cf6]/25 blur-3xl" />
          <FlameMark className="relative h-24 w-24 drop-shadow-[0_0_30px_rgba(139,92,246,0.7)]" />
        </div>
        <div className="mt-10 h-2 w-[min(420px,72vw)] overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] via-[#8b5cf6] to-[#c4b5fd] shadow-[0_0_16px_rgba(139,92,246,0.9)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-4 font-mono text-xs tracking-[0.3em] text-white/40">{pct}%</p>
      </div>

      {/* ── plain sheet doors — full-screen, swing INWARD in 3D, slow grind ── */}
      <div aria-hidden className="absolute inset-0 z-30" style={{ perspective: "1600px" }}>
        {/* LEFT door — hinged on the left, free edge swings inside */}
        <div
          className={open ? "preloader-door-rumble" : ""}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: "50.5%",
            transformOrigin: "left center",
            transform: open ? "rotateY(100deg)" : "rotateY(0deg)",
            transition: `transform ${DOOR_MS}ms cubic-bezier(0.5,0,0.12,1), filter 1000ms ease`,
            filter: open ? "brightness(0.72)" : "brightness(1)",
            background: "#0b0714",
          }}
        >
          {/* glowing meeting edge */}
          <div className="absolute inset-y-0 right-0 w-[3px] bg-[#c4b5fd] shadow-[0_0_24px_6px_rgba(139,92,246,1)]" />
          <div
            className={`absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#a78bfa] via-[#7c3aed] to-transparent blur-[8px] transition-opacity duration-700 ${
              phase === "charge" ? "opacity-90" : open ? "opacity-70" : "opacity-0"
            }`}
          />
        </div>

        {/* RIGHT door — hinged on the right, free edge swings inside */}
        <div
          className={open ? "preloader-door-rumble" : ""}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: "50.5%",
            transformOrigin: "right center",
            transform: open ? "rotateY(-100deg)" : "rotateY(0deg)",
            transition: `transform ${DOOR_MS}ms cubic-bezier(0.5,0,0.12,1), filter 1000ms ease`,
            filter: open ? "brightness(0.72)" : "brightness(1)",
            background: "#0b0714",
          }}
        >
          <div className="absolute inset-y-0 left-0 w-[3px] bg-[#c4b5fd] shadow-[0_0_24px_6px_rgba(139,92,246,1)]" />
          <div
            className={`absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#a78bfa] via-[#7c3aed] to-transparent blur-[8px] transition-opacity duration-700 ${
              phase === "charge" ? "opacity-90" : open ? "opacity-70" : "opacity-0"
            }`}
          />
        </div>
      </div>

      {/* ── BRIGHT interior light flooding through the open doors ── */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-[35] ${
          open ? "preloader-flash-soft" : "opacity-0"
        }`}
        style={{
          background:
            "radial-gradient(52rem 36rem at 50% 46%, rgba(237,233,254,0.98), rgba(196,181,253,0.92) 30%, rgba(139,92,246,0.72) 50%, rgba(109,40,217,0.38) 68%, transparent 84%)",
          opacity: open ? undefined : 0,
        }}
      />

      {/* ── seam: ONE node, always ON TOP (z-40) — dot → line → heat → beam ── */}
      <div aria-hidden className="absolute inset-0 z-40 flex items-center justify-center">
        {!open ? (
          <div
            className={`preloader-seam ${phase === "dot" ? "preloader-dot-in" : ""}`}
            style={{
              width: phase === "dot" ? 14 : phase === "line" ? 2 : 6,
              height: phase === "dot" ? 14 : "100%",
              borderRadius: phase === "dot" ? 9999 : 2,
              background:
                phase === "dot"
                  ? "#c4b5fd"
                  : phase === "charge"
                    ? "linear-gradient(to bottom, transparent, #ede9fe 18%, #ddd6fe 50%, #ede9fe 82%, transparent)"
                    : "linear-gradient(to bottom, transparent, #8b5cf6 20%, #a78bfa 50%, #8b5cf6 80%, transparent)",
              boxShadow:
                phase === "dot"
                  ? "0 0 30px 10px rgba(139,92,246,0.9)"
                  : phase === "charge"
                    ? "0 0 60px 18px rgba(139,92,246,0.95)"
                    : "0 0 24px 4px rgba(139,92,246,0.8)",
              transition:
                "width 1000ms cubic-bezier(0.33,1,0.68,1), height 1000ms cubic-bezier(0.33,1,0.68,1), border-radius 500ms ease, box-shadow 500ms ease, background 400ms ease",
            }}
          />
        ) : (
          <div
            className="preloader-beam-soft h-full"
            style={{ opacity: 1 - openT * 0.35 }}
          />
        )}
      </div>

      {/* ── cinematic vignette + letterbox (subtle, fades with preloader) ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-50"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <div
        aria-hidden
        className={`absolute inset-x-0 top-0 z-50 h-10 bg-black transition-transform duration-1000 md:h-14 ${
          open ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
      />
      <div
        aria-hidden
        className={`absolute inset-x-0 bottom-0 z-50 h-10 bg-black transition-transform duration-1000 md:h-14 ${
          open ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
      />
    </div>
  );
}
