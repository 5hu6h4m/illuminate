import Link from "next/link";

type Props = {
  href: string;
  children: React.ReactNode;
  variant?: "violet" | "white";
  line?: string;
  className?: string;
};

/** Signature parallelogram button with offset outline, like ecell.in/illuminate */
export function SkewButton({ href, children, variant = "violet", line, className = "" }: Props) {
  const fill =
    variant === "violet" ? "bg-ember text-white" : "bg-white text-ember-deep";
  const edge = line ?? (variant === "violet" ? "#ffffff" : "#8b5cf6");
  return (
    <Link
      href={href}
      className={`skew-btn ${className}`}
      style={{ "--skew-line": edge } as React.CSSProperties}
    >
      <span className={`skew-fill ${fill}`}>
        <span>{children}</span>
      </span>
    </Link>
  );
}
