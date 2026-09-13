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
  if (w < 640) return 12;
  if (w < 1024) return 16;
  return 19; // strict 15–20 on screen at once (desktop)
}

/** Sharp close-up firefly sprite — bright core, tight halo, reads IN FRONT. */
function makeSprite(tint: string) {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const g = c.getContext("2d");
  if (!g) return c;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, `rgba(255,255,255,1)`);
  grad.addColorStop(0.18, `rgba(255,255,255,0.95)`);
  grad.addColorStop(0.32, `rgba(${tint},0.85)`);
  grad.addColorStop(0.5, `rgba(${tint},0.25)`);
  grad.addColorStop(0.68, `rgba(${tint},0)`);
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

    const spawn = (w: number, h: number, initial: boolean): P => {
      // random speed tiers — kuch fast, kuch slow (firefly swarm feel)
      const roll = Math.random();
      const vy =
        roll < 0.2
          ? 85 + Math.random() * 45 // fast risers
          : roll < 0.7
            ? 35 + Math.random() * 35 // medium drift
            : 14 + Math.random() * 18; // slow floaters
      return {
        x: Math.random() * w,
        y: initial ? Math.random() * h : h + 12,
        r: 1.6 + Math.random() * 1.8, // bigger = closer to screen, never tiny-far
        vy,
        swayAmp: 10 + Math.random() * 26,
        swaySpeed: 0.4 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
        alpha: 1, // full opacity — close to screen, never behind haze
        twinkle: 0.7 + Math.random() * 1.4,
        sprite: Math.floor(Math.random() * sprites.length),
      };
    };

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

    const smoothstep = (e0: number, e1: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };

    const draw = (t: number, dt: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      // additive glow — particles read as light IN FRONT, never dull behind
      ctx.globalCompositeOperation = "lighter";
      for (const p of parts) {
        p.y -= p.vy * dt;
        // 90% upar (top ~8%) pahunchte hi recycle — gayab ho jayega
        if (p.y < h * 0.06) Object.assign(p, spawn(w, h, false));
        const x = p.x + Math.sin(t * p.swaySpeed + p.phase) * p.swayAmp * 0.35;
        // jugnu: niche (progress=1) full opacity, upar jate fade, top 10% me 0
        const progress = Math.max(0, Math.min(1, p.y / h)); // 1 bottom → 0 top
        const topFade = smoothstep(0.06, 0.42, progress); // 6% pe 0, 42% tak full
        // firefly blink — quadratic pulse, kabhi tez kabhi halka
        const raw = 0.5 + 0.5 * Math.sin(t * p.twinkle + p.phase);
        const blink = raw * raw; // 0..1, jugnu jaisa
        const a = (0.8 + 0.2 * blink) * topFade; // opacity 1 at full — in front
        const size = p.r * 5.5 * (0.6 + 0.7 * progress) * (0.92 + 0.25 * blink);
        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        ctx.drawImage(sprites[p.sprite], x - size / 2, p.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
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
      <canvas ref={canvasRef} className="h-full w-full opacity-100" />
    </div>
  );
}
