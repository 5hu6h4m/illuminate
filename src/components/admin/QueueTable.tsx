"use client";

import type { Row } from "./types";
import { Badge } from "./Badge";
import { statusText } from "./types";

type QueueTableProps = {
  rows: Row[];
  total: number;
  page: number;
  limit: number;
  refreshing: boolean;
  onPageChange: (page: number) => void;
  onSelect: (row: Row) => void;
};

export function QueueTable({ rows, total, page, limit, refreshing, onPageChange, onSelect }: QueueTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="credential-frame mt-6">
      <div className="credential-frame__inner overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-sm">
          <caption className="sr-only">Current-generation registrations matching the active filters</caption>
          <thead className="sticky top-0 border-b border-white/10 bg-[#0a0a0a] text-xs text-text-secondary">
            <tr>
              <th scope="col" className="p-4">
                Reference
              </th>
              <th scope="col" className="p-4">
                Participant
              </th>
              <th scope="col" className="p-4">
                Expected
              </th>
              <th scope="col" className="p-4">
                Transaction
              </th>
              <th scope="col" className="p-4">
                Submitted
              </th>
              <th scope="col" className="p-4">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.publicId}
                onClick={() => onSelect(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(row);
                  }
                }}
                tabIndex={0}
                aria-label={`Review ${row.publicId} ${row.participant.fullName}`}
                className="cursor-pointer border-b border-white/5 hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
              >
                <td className="p-4 font-mono text-brand-electric">
                  {row.publicId}
                  {row.isTest && <Badge />}
                </td>
                <td className="p-4">
                  <p>{row.participant.fullName}</p>
                  <p className="text-xs text-text-secondary">
                    {row.participant.email} · {row.participant.phone}
                  </p>
                </td>
                <td className="p-4">{row.isTest ? "₹XXX · TEST" : `₹${row.payment.snapshot.expectedAmount}`}</td>
                <td className="p-4 font-mono">{row.payment.transactionReference || "—"}</td>
                <td className="p-4">
                  {row.payment.submittedAt ? new Date(row.payment.submittedAt).toLocaleString("en-IN") : "—"}
                </td>
                <td className="p-4">
                  {row.isTest ? "TEST · " : ""}
                  {statusText[row.payment.status]}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-text-secondary">
                  No matching current-generation registrations.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-4">
          <p aria-live="polite" className="text-xs text-text-secondary">
            Page {page} of {totalPages} · {total} total
          </p>
          <nav aria-label="Registration pages" className="flex gap-2">
            <button
              type="button"
              className="registration-back px-3 disabled:opacity-40"
              disabled={page <= 1 || refreshing}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              Prev
            </button>
            <button
              type="button"
              className="registration-back px-3 disabled:opacity-40"
              disabled={page >= totalPages || refreshing}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              Next
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
