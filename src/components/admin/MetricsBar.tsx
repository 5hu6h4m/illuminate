"use client";

import type { Dashboard, Status } from "./types";
import { statusText } from "./types";

const ORDER: Status[] = ["payment_pending", "submitted_for_verification", "verified", "rejected"];

export function Metric({ text, value }: { text: string; value: string | number }) {
  return (
    <div className="metric-panel">
      <p className="text-xs text-text-secondary">{text}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

type MetricsBarProps = {
  data: Dashboard | null;
  activeStatus: "" | Status;
  onSelectStatus: (status: "" | Status) => void;
};

export function MetricsBar({ data, activeStatus, onSelectStatus }: MetricsBarProps) {
  const count = (key: Status) => data?.metrics.find((item) => item._id === key)?.count ?? 0;
  const revenue = data?.metrics.reduce((sum, item) => sum + item.revenue, 0) ?? 0;

  return (
    <section aria-label="Registration metrics" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <Metric text="Real registrations" value={data?.realTotal ?? 0} />
      {ORDER.map((key) => {
        const active = activeStatus === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectStatus(active ? "" : key)}
            aria-pressed={active}
            aria-label={`Filter by status: ${statusText[key]}${active ? " (active, select to clear)" : ""}`}
            className={`metric-panel text-left outline-none transition focus-visible:ring-2 focus-visible:ring-violet-300 ${
              active ? "ring-2 ring-violet-300" : ""
            }`}
          >
            <span className="block text-xs text-text-secondary">{statusText[key]}</span>
            <span className="mt-2 block text-3xl font-semibold">{count(key)}</span>
          </button>
        );
      })}
      <Metric text="Verified revenue (real only)" value={`₹${revenue.toLocaleString("en-IN")}`} />
    </section>
  );
}
