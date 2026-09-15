"use client";

import { useEffect, useRef, useState } from "react";
import { workshopJourney } from "@/content/landing";

export function WorkshopJourney() {
  const [active, setActive] = useState(0);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
      }),
      { rootMargin: "-38% 0px -50%", threshold: 0 },
    );

    items.current.forEach((item) => item && observer.observe(item));
    return () => observer.disconnect();
  }, []);
  const stage = workshopJourney[active];
  const total = String(workshopJourney.length).padStart(2, "0");
  const current = `0${active + 1}`;
  return <div className="journey-system"><div className="journey-system__context"><span>{current} / {total}</span><strong>{stage.title}</strong><p>{stage.copy}</p></div><div className="journey-system__signal" aria-hidden="true"><span className="journey-system__state">{current} / {total}</span><svg viewBox="0 0 240 560"><path d="M120 15 C45 100 201 160 120 255 S48 404 120 545" />{workshopJourney.map((journeyStage,index)=><circle key={journeyStage.number} cx="120" cy={32 + index * (528 / Math.max(workshopJourney.length - 1, 1))} r={active===index?12:7} className={active===index?"is-active":""}/>)}</svg></div><ol className="journey-list" aria-label="Workshop journey">{workshopJourney.map((journeyStage, index) => <li key={journeyStage.number} data-index={index} ref={(item) => { items.current[index] = item; }} className={active === index ? "is-active" : ""}><button type="button" onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)} aria-pressed={active === index}><span className="journey-list__number">{journeyStage.number}</span><span className="journey-list__line" aria-hidden /><span><strong>{journeyStage.title}</strong><small>{journeyStage.copy}</small></span></button></li>)}</ol></div>;
}
