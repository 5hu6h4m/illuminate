import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/** Premium violet tile for Lucide icons — consistent across hero, cards, cube. */
export function IconTile({ icon: Icon, size = "md", className = "" }: Props) {
  const box =
    size === "sm"
      ? "h-9 w-9 rounded-xl"
      : size === "lg"
        ? "h-16 w-16 rounded-3xl"
        : "h-12 w-12 rounded-2xl";
  const glyph = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-6 w-6";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center border border-ember/30 bg-gradient-to-br from-ember/25 to-ember/5 text-ember-soft shadow-[0_0_24px_rgba(139,92,246,0.25)] ${box} ${className}`}
    >
      <Icon className={glyph} strokeWidth={1.8} />
    </span>
  );
}
