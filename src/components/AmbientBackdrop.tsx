"use client";

import { useEffect, useRef } from "react";

/* Violet particle tints (rgb triplets) — matches #6D28D9 → #A78BFA direction */
const TINTS = ["167,139,250", "139,92,246", "124,58,237", "196,181,253"];

type P = {
  x: number;
  y: number;
  r: number;
  vy: number;
  swayAmp: number;
  swaySpeed: number;
  phase: number;
  alpha: number;
  twinkle: number;
  sprite: number;
};

function countForWidth(w: number) {
  if (w < 640) return 22; // mobile: light
  if (w < 1024) return 42; // tablet: reduced
  return 72; // desktop: full
}

/** Pre-rendered radial glow sprite — drawImage is far cheaper than shadowBlur per frame. */
function makeSprite(tint: string) {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const g = c.getContext("2d");
  if (!g) return c;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, `rgba(233,213,255,0.95)`);
  grad.addColorStop(0.25, `rgba(${tint},0.75)`);
  grad.addColorStop(0.55, `rgba(${tint},0.28)`);
  grad.addColorStop(1, `rgba(${tint},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return c;
}

/**
 * Fixed full-screen violet particle backdrop (canvas).
 * - Sits behind ALL content (z-0), pointer-events: none, never blocks clicks/scroll.
 * - Slow upward drift + gentle sway + twinkle = cinematic, not starfield.
 * - DPR capped at 1.5, density scales down on tablet/mobile, pauses when tab hidden.
 * - prefers-reduced-motion → single static frame, no loop.
 */
export function AmbientBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sprites = TINTS.map(makeSprite);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let parts: P[] = [];
    let raf = 0;
    let running = true;

    const spawn = (w: number, h: number, initial: boolean): P => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 12,
      r: 1 + Math.random() * 2.6,
      vy: 6 + Math.random() * 14, // px/sec upward — slow cinematic
      swayAmp: 6 + Math.random() * 18,
      swaySpeed: 0.2 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.35 + Math.random() * 0.5,
      twinkle: 0.4 + Math.random() * 1.2,
      sprite: Math.floor(Math.random() * sprites.length),
    });

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = countForWidth(w);
      parts = Array.from({ length: n }, () => spawn(w, h, true));
    };

    const draw = (t: number, dt: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.vy * dt;
        if (p.y < -16) Object.assign(p, spawn(w, h, false));
        const x = p.x + Math.sin(t * p.swaySpeed + p.phase) * p.swayAmp * 0.12;
        const a = p.alpha * (0.62 + 0.38 * Math.sin(t * p.twinkle + p.phase));
        const size = p.r * 9; // glow halo around a tiny core
        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        ctx.drawImage(sprites[p.sprite], x - size / 2, p.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    };

    if (reduced) {
      resize();
      draw(1.2, 0); // one static elegant frame
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }

    resize();
    window.addEventListener("resize", resize);
    let last = performance.now();
    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      draw(now / 1000, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        background:
          "radial-gradient(60rem 36rem at 82% 30%, rgba(109,40,217,0.16), transparent 62%), radial-gradient(44rem 30rem at 12% 85%, rgba(124,58,237,0.1), transparent 60%), linear-gradient(180deg, #050505 0%, #0B0612 55%, #050505 100%)",
      }}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
