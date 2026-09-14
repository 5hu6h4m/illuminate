import type { ConfirmationState } from "@/config/event";

const styleByState: Record<ConfirmationState, string> = {
  confirmed: "border-status-success/35 bg-status-success/10 text-status-success",
  pending: "border-status-warning/35 bg-status-warning/10 text-status-warning",
  unavailable: "border-border-subtle bg-surface-elevated text-text-muted",
};

export function StatusBadge({ state }: { state: ConfirmationState }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-label ${styleByState[state]}`}>{state}</span>;
}
