import type { ReactNode } from "react";

type SectionHeadingProps = { eyebrow?: string; title: ReactNode; children?: ReactNode; className?: string };

export function SectionHeading({ eyebrow, title, children, className = "" }: SectionHeadingProps) {
  return <div className={`max-w-reading ${className}`}>
    {eyebrow ? <p className="text-eyebrow text-brand-violet">{eyebrow}</p> : null}
    <h2 className="mt-3 text-section-title text-text-primary">{title}</h2>
    {children ? <div className="mt-4 text-body text-text-secondary">{children}</div> : null}
  </div>;
}
