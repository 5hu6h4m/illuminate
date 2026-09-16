"use client";

import { createElement, useEffect, useState, type CSSProperties, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "article";
  /** flip entrance (rotateY) instead of the default rise — for card grids */
  flip?: boolean;
  /** doorway entrance (perspective settle) — for flagship section moments */
  doorway?: boolean;
};

/** Once-only decorative reveal. Content stays visible until client motion is ready. */
export function Reveal({ children, delay = 0, className = "", as = "div", flip = false, doorway = false }: Props) {
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!element) return;
    const reveal = () => element.classList.add("is-visible");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reveal();
      return;
    }

    element.classList.add("is-motion-ready");
    if (typeof IntersectionObserver === "undefined") {
      reveal();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            reveal();
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(element);
    const safetyTimer = window.setTimeout(reveal, 900);
    return () => {
      io.disconnect();
      window.clearTimeout(safetyTimer);
    };
  }, [element]);

  return createElement(
    as,
    {
      ref: setElement,
      className: `reveal${flip ? " flip-reveal" : ""}${doorway ? " doorway-reveal" : ""} ${className}`,
      style: { "--reveal-delay": `${delay}ms` } as CSSProperties,
    },
    children
  );
}
