"use client";
/* eslint-disable @next/next/no-img-element -- authenticated proof requests must carry the session cookie. */

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Trash2, XCircle } from "lucide-react";
import type { Row } from "./types";
import { Badge } from "./Badge";
import { getDisplayAmount, isEcellOverrideApplied } from "@/lib/ecell-pricing";
import { destinationShortLabel } from "./types";

type ReviewModalProps = {
  row: Row;
  verifyPending: boolean;
  rejectPending: boolean;
  ecellPending: boolean;
  error: string;
  onClose: () => void;
  onVerify: (confirmed: boolean) => Promise<void>;
  onReject: (reason: string, privateNote: string) => Promise<void>;
  onToggleEcell: (next: boolean) => Promise<void>;
  onRequestDelete: (row: Row) => void;
};

export function ReviewModal({
  row,
  verifyPending,
  rejectPending,
  ecellPending,
  error,
  onClose,
  onVerify,
  onReject,
  onToggleEcell,
  onRequestDelete,
}: ReviewModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  const busy = verifyPending || rejectPending || ecellPending;
  const isEcell = row.ecellMember === true;
  const snapshotAmount = row.payment.snapshot.expectedAmount;
  const displayAmount = getDisplayAmount(snapshotAmount, row.ecellMember);
  const overrideApplied = isEcellOverrideApplied(snapshotAmount, row.ecellMember);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-review-title"
    >
      <section className="credential-frame mx-auto my-8 max-w-3xl">
        <div className="credential-frame__inner p-6">
          <div className="flex justify-between">
            <div>
              <p className="font-mono text-brand-electric">
                {row.publicId}
                {row.isTest && <Badge />}
              </p>
              <h2 id="admin-review-title" className="mt-1 text-2xl font-semibold">
                {row.participant.fullName}
              </h2>
            </div>
            <button ref={closeRef} className="registration-back" onClick={onClose}>
              Close
            </button>
          </div>
          {error && (
            <p role="alert" className="registration-field__error mt-4">
              {error}
            </p>
          )}
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-text-secondary">Assigned Account</dt>
              <dd className="font-semibold">{row.payment.destination?.destinationId ? destinationShortLabel(row.payment.destination.destinationId) : "Legacy (snapshot)"}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">Payee</dt>
              <dd>{row.payment.destination?.payeeName ?? row.payment.snapshot.payeeName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">UPI</dt>
              <dd className="break-all font-mono">{row.payment.destination?.upiId ?? row.payment.snapshot.upiId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">Expected</dt>
              <dd aria-live="polite">
                {row.isTest ? (
                  "₹XXX · simulated"
                ) : displayAmount === null ? (
                  "—"
                ) : overrideApplied ? (
                  <>₹{snapshotAmount} → ₹{displayAmount} · E-cell</>
                ) : (
                  <>₹{displayAmount}{isEcell ? " · E-cell" : ""}</>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">Transaction/reference</dt>
              <dd className="font-mono">{row.payment.transactionReference}</dd>
            </div>
            {row.payment.proofHistory?.length ? (
              <div>
                <dt className="text-xs text-text-secondary">Proof destination</dt>
                <dd className="text-xs">
                  {row.payment.proofHistory[row.payment.proofHistory.length - 1]?.destination
                    ? `${destinationShortLabel(row.payment.proofHistory[row.payment.proofHistory.length - 1]?.destination?.destinationId)} · ${row.payment.proofHistory[row.payment.proofHistory.length - 1]?.destination?.upiId}`
                    : "Legacy (no snapshot)"}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-6 space-y-3 rounded-2xl border border-white/10 p-5">
            <h3 className="text-sm font-semibold">E-cell member</h3>
            <p className="text-sm text-text-secondary">
              Registration fee for E-cell members is ₹699 instead of ₹599. Marking only changes admin-panel data
              (table, revenue, internal CSV). Payment QR and participant view are untouched.
            </p>
            {row.isTest ? (
              <p className="text-sm text-text-secondary">Not available for TEST records.</p>
            ) : (
              <button
                type="button"
                disabled={busy}
                className="registration-back disabled:opacity-40"
                aria-pressed={isEcell}
                onClick={() => void onToggleEcell(!isEcell)}
              >
                {ecellPending ? "Saving…" : isEcell ? "Remove E-cell flag" : "Mark as E-cell member"}
              </button>
            )}
          </div>
          {!row.isTest && row.payment.destination && (
            <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-text-secondary">
              Verify this payment was found in the assigned recipient account above — a screenshot alone is not sufficient.
            </p>
          )}
          {row.payment.currentProofId && (
            <img
              src={`/api/admin/proof/${row.payment.currentProofId}`}
              alt={`Payment proof for ${row.publicId}`}
              className="mt-6 max-h-[520px] w-full rounded-2xl border border-white/15 object-contain"
            />
          )}
          {row.payment.status === "submitted_for_verification" && (
            <div className="mt-6 space-y-4 rounded-2xl border border-white/10 p-5">
              <label className="flex gap-3 text-sm">
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                <span>
                  {row.isTest
                    ? "This verifies the simulated development workflow. No real bank or UPI payment was confirmed."
                    : "I have confirmed payment in the authorized recipient account. A screenshot alone is not sufficient."}
                </span>
              </label>
              <button
                disabled={!confirmed || busy}
                className="registration-primary-action"
                onClick={() => void onVerify(confirmed)}
              >
                <CheckCircle2 aria-hidden /> {verifyPending ? "Verifying…" : row.isTest ? "Verify simulated test" : "Verify payment"}
              </button>
              <label className="registration-field">
                <span>Participant-facing rejection reason</span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
              </label>
              <label className="registration-field">
                <span>Private admin note</span>
                <textarea value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} maxLength={1000} />
              </label>
              <button
                disabled={!reason.trim() || busy}
                className="registration-back border-red-400/40 text-red-200"
                onClick={() => void onReject(reason, privateNote)}
              >
                <XCircle aria-hidden /> {rejectPending ? "Rejecting…" : "Reject / request resubmission"}
              </button>
            </div>
          )}
          <div className="mt-6 space-y-3 rounded-2xl border border-red-400/30 p-5">
            <p className="text-sm font-semibold text-red-200">Danger zone</p>
            <p className="text-sm text-text-secondary">
              {row.isTest
                ? "Permanently delete this TEST record and its uploaded proofs. This cannot be undone."
                : row.payment.status === "payment_pending"
                  ? "Permanently delete this pending registration and its uploaded proofs. No payment was submitted, so nothing is preserved for audit. This cannot be undone."
                  : "This registration involves submitted or verified money. Deletion requires password re-entry, export confirmation, and a typed reason — revenue drops, the IITB CSV loses this row, and proofs are destroyed."}
            </p>
            <button
              className="registration-back border-red-400/40 text-red-200"
              onClick={() => onRequestDelete(row)}
            >
              <Trash2 aria-hidden /> Delete {row.isTest ? "TEST record" : "registration"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
