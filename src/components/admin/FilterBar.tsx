"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import type { Status } from "./types";
import { statusText } from "./types";

type FilterBarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  status: "" | Status;
  onStatusChange: (status: "" | Status) => void;
  scope: "" | "test" | "real";
  onScopeChange: (scope: "" | "test" | "real") => void;
  qr: "" | "draft" | "issued";
  onQrChange: (qr: "" | "draft" | "issued") => void;
  total: number;
  refreshing: boolean;
  onRefresh: () => void;
};

export function FilterBar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  scope,
  onScopeChange,
  qr,
  onQrChange,
  total,
  refreshing,
  onRefresh,
}: FilterBarProps) {
  const [draft, setDraft] = useState(query);

  useEffect(() => {
    if (draft === query) return;
    const timer = setTimeout(() => onQueryChange(draft), 300);
    return () => clearTimeout(timer);
  }, [draft, onQueryChange, query]);

  return (
    <div className="mt-8">
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          onQueryChange(draft);
          onRefresh();
        }}
      >
        <div className="relative min-h-11 flex-1">
          <input
            className="min-h-11 w-full rounded-xl border border-white/15 bg-transparent px-4 pr-11"
            placeholder="Reference, name, email, phone, or transaction reference"
            aria-label="Search registrations"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          {draft && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setDraft("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-2 text-text-secondary hover:text-white"
            >
              <X aria-hidden size={16} />
            </button>
          )}
        </div>
        <select
          className="min-h-11 rounded-xl border border-white/15 bg-ink px-4"
          aria-label="Filter by status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as "" | Status)}
        >
          <option value="">All statuses</option>
          {Object.entries(statusText).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
        <select
          className="min-h-11 rounded-xl border border-white/15 bg-ink px-4"
          aria-label="Filter by record scope"
          value={scope}
          onChange={(event) => onScopeChange(event.target.value as "" | "test" | "real")}
        >
          <option value="">All visible records</option>
          <option value="test">TEST records</option>
          <option value="real">Real records</option>
        </select>
        <select
          className="min-h-11 rounded-xl border border-white/15 bg-ink px-4"
          aria-label="Filter by QR issuance"
          value={qr}
          onChange={(event) => onQrChange(event.target.value as "" | "draft" | "issued")}
        >
          <option value="">All QR states</option>
          <option value="draft">Draft — QR not generated</option>
          <option value="issued">QR generated</option>
        </select>
        <button className="registration-primary-action" disabled={refreshing}>
          <Search aria-hidden /> Search
        </button>
      </form>
      <p aria-live="polite" className="mt-3 text-xs text-text-secondary">
        {total} matching registration{total === 1 ? "" : "s"}
        {refreshing ? " · refreshing…" : ""}
      </p>
    </div>
  );
}
