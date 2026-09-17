"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Row } from "./types";
import { Badge } from "./Badge";

export type DeleteConfirmInput = {
  confirmPublicId: string;
  reason: string;
  password: string;
};

type DeleteVerifiedDialogProps = {
  row: Row;
  pending: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (input: DeleteConfirmInput) => Promise<void>;
};

const REASON_MIN = 10;
const REASON_MAX = 500;

export function DeleteVerifiedDialog({ row, pending, error, onClose, onConfirm }: DeleteVerifiedDialogProps) {
  const isHardDelete = !row.isTest && row.payment.status !== "payment_pending";
  const isVerifiedDelete = !row.isTest && row.payment.status === "verified";
  const [exportConfirmed, setExportConfirmed] = useState(false);
  const [typedPublicId, setTypedPublicId] = useState("");
  const [reason, setReason] = useState(row.isTest ? "test cleanup" : "");
  const [password, setPassword] = useState("");
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

  const reasonLength = reason.trim().length;
  const reasonValid = reasonLength >= REASON_MIN && reasonLength <= REASON_MAX;
  const valid =
    (isHardDelete ? exportConfirmed : true) &&
    typedPublicId === row.publicId &&
    reasonValid &&
    password.length > 0 &&
    !pending;

  const amount = row.payment.snapshot.expectedAmount;
  const recordedAt = row.payment.verifiedAt ?? row.payment.submittedAt;

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-delete-title"
    >
      <section className="credential-frame mx-auto my-8 max-w-2xl">
        <div className="credential-frame__inner p-6">
          <div className="flex justify-between gap-4">
            <div>
              <p className="font-mono text-brand-electric">
                {row.publicId}
                {row.isTest && <Badge />}
              </p>
              <h2 id="admin-delete-title" className="mt-1 text-2xl font-semibold text-red-200">
                {row.isTest
                  ? "Delete TEST record"
                  : row.payment.status === "payment_pending"
                    ? "Delete pending registration"
                    : row.payment.status === "verified"
                      ? "Delete verified registration"
                      : "Delete registration"}
              </h2>
            </div>
            <button ref={closeRef} className="registration-back" onClick={onClose}>
              Close
            </button>
          </div>

          {isHardDelete ? (
            <div className="mt-6 space-y-3 rounded-2xl border border-red-400/30 p-5 text-sm">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-text-secondary">Amount at stake</dt>
                  <dd className="font-semibold">₹{amount ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">Transaction reference</dt>
                  <dd className="font-mono">{row.payment.transactionReference || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">Verified / submitted at</dt>
                  <dd>{recordedAt ? new Date(recordedAt).toLocaleString("en-IN") : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">Participant</dt>
                  <dd>
                    {row.participant.fullName} · {row.participant.email} · {row.participant.phone}
                  </dd>
                </div>
              </dl>
              <p className="font-semibold text-red-200">
                {isVerifiedDelete
                  ? `Revenue −₹${amount ?? "—"}. The IITB CSV loses this row, uploaded proofs are destroyed, and the ID, email, and phone become reusable. This cannot be undone.`
                  : "Uploaded proofs are destroyed, and the ID, email, and phone become reusable. Only verified deletions affect revenue and the IITB CSV. This cannot be undone."}
              </p>
            </div>
          ) : (
            <p className="mt-6 text-sm text-text-secondary">
              {row.isTest
                ? "Permanently delete this TEST record and its uploaded proofs. This cannot be undone."
                : "Permanently delete this pending registration and its uploaded proofs. No payment was submitted, so nothing is preserved for audit. This cannot be undone."}
            </p>
          )}

          {error && (
            <p role="alert" className="registration-field__error mt-4">
              {error}
            </p>
          )}

          <div className="mt-6 space-y-4">
            {isHardDelete && (
              <label className="flex gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={exportConfirmed}
                  onChange={(event) => setExportConfirmed(event.target.checked)}
                />
                <span>I have exported everything I need (IITB CSV / internal CSV).</span>
              </label>
            )}
            <label className="registration-field">
              <span>
                Type <span className="font-mono">{row.publicId}</span> to confirm
              </span>
              <input
                className="font-mono"
                value={typedPublicId}
                onChange={(event) => setTypedPublicId(event.target.value.trim())}
                placeholder={row.publicId}
                autoComplete="off"
                aria-label={`Type ${row.publicId} to confirm deletion`}
              />
            </label>
            <div className="registration-field">
              <label htmlFor="admin-delete-reason">
                <span>Reason for deletion ({REASON_MIN}–{REASON_MAX} characters)</span>
              </label>
              <textarea
                id="admin-delete-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={REASON_MAX}
                aria-describedby="admin-delete-reason-count"
              />
              <p id="admin-delete-reason-count" aria-live="polite" className="text-xs text-text-secondary">
                {reasonLength}/{REASON_MAX} · minimum {REASON_MIN}
              </p>
            </div>
            <label className="registration-field">
              <span>Admin password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button className="registration-back" onClick={onClose} disabled={pending}>
                Cancel
              </button>
              <button
                disabled={!valid}
                className="registration-back border-red-400/40 text-red-200 disabled:opacity-40"
                onClick={() => void onConfirm({ confirmPublicId: typedPublicId, reason: reason.trim(), password })}
              >
                <Trash2 aria-hidden /> {pending ? "Deleting…" : "Permanently delete"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
