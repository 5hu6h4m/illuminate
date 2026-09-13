"use client";

import { createElement, useEffect, useRef, type CSSProperties, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "article";
  /** flip entrance (rotateY) instead of the default rise — for card grids */
  flip?: boolean;
};

/** Once-only staggered scroll reveal. Decorative — content is visible without JS-motion. */
export function Reveal({ children, delay = 0, className = "", as = "div", flip = false }: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return createElement(
    as,
    {
      ref: (el: HTMLElement | null) => {
        ref.current = el;
      },
      className: `reveal${flip ? " flip-reveal" : ""} ${className}`,
      style: { "--reveal-delay": `${delay}ms` } as CSSProperties,
    },
    children
  );
}
