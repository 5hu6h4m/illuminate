"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { getPublishableFaqItems } from "@/content/faq";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const id = useId();
  const faqItems = getPublishableFaqItems();
  return <div className="faq-list">{faqItems.map((item, index) => { const expanded = open === index; const panelId = `${id}-${index}`; return <article key={item.question} className={expanded ? "is-open" : ""}><h3><button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpen(expanded ? null : index)}><span>{item.question}</span><ChevronDown aria-hidden /></button></h3><div id={panelId} role="region" aria-label={item.question} hidden={!expanded}><p>{item.answer}</p></div></article>; })}</div>;
}
