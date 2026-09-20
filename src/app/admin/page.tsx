"use client";

import { useCallback, useState } from "react";
import { Download, LogOut, X } from "lucide-react";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { CapacityPanel } from "@/components/admin/CapacityPanel";
import { RegistrationTogglePanel } from "@/components/admin/RegistrationTogglePanel";
import { DeleteVerifiedDialog } from "@/components/admin/DeleteVerifiedDialog";
import type { DeleteConfirmInput } from "@/components/admin/DeleteVerifiedDialog";
import { FilterBar } from "@/components/admin/FilterBar";
import { MetricsBar } from "@/components/admin/MetricsBar";
import { QueueTable } from "@/components/admin/QueueTable";
import { ReviewModal } from "@/components/admin/ReviewModal";
import type { Row } from "@/components/admin/types";
import { useDashboard } from "@/hooks/admin/useDashboard";

export type { Dashboard, Row, Status } from "@/components/admin/types";
export { statusText } from "@/components/admin/types";

export default function AdminPage() {
  const {
    authed,
    data,
    error,
    notice,
    query,
    status,
    scope,
    page,
    limit,
    refreshing,
    authPending,
    verifyPending,
    rejectPending,
    deletePending,
    ecellPending,
    setQuery,
    setStatus,
    setScope,
    setPage,
    clearNotice,
    login,
    logout,
    refresh,
    verify,
    reject,
    remove,
    toggleEcell,
  } = useDashboard();
  const [selected, setSelected] = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [modalError, setModalError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const closeReview = useCallback(() => {
    setSelected(null);
    setModalError("");
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteTarget(null);
    setDeleteError("");
  }, []);

  if (!authed) return <AdminLogin onLogin={login} pending={authPending} error={error} />;

  const handleVerify = async (confirmed: boolean) => {
    if (!selected) return;
    setModalError("");
    try {
      await verify(selected, confirmed);
      setSelected(null);
    } catch (cause) {
      setModalError(cause instanceof Error ? cause.message : "Verification could not be saved. Refresh and try again.");
    }
  };

  const handleReject = async (reason: string, privateNote: string) => {
    if (!selected) return;
    setModalError("");
    try {
      await reject(selected, reason, privateNote);
      setSelected(null);
    } catch (cause) {
      setModalError(cause instanceof Error ? cause.message : "Verification could not be saved. Refresh and try again.");
    }
  };

  const handleToggleEcell = async (next: boolean) => {
    if (!selected) return;
    setModalError("");
    try {
      const updated = await toggleEcell(selected, next);
      setSelected(updated);
    } catch (cause) {
      setModalError(cause instanceof Error ? cause.message : "E-cell flag could not be saved. Refresh and try again.");
    }
  };

  const handleDeleteConfirm = async (input: DeleteConfirmInput) => {
    if (!deleteTarget) return;
    const publicId = deleteTarget.publicId;
    try {
      await remove(publicId, input);
      setDeleteTarget(null);
      setDeleteError("");
      setSelected((current) => (current?.publicId === publicId ? null : current));
      setModalError("");
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : "Could not delete this registration. Refresh and try again.",
      );
    }
  };

  return (
    <div className="admin-shell">
      <main className="mx-auto max-w-7xl px-5 py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-eyebrow text-brand-electric">Operations</p>
            <h1 className="mt-2 text-display">Payment verification</h1>
            <p className="mt-2 text-sm text-text-secondary">
              {data?.testRecords
                ? `${data.testRecords} development TEST record(s), excluded from real metrics and exports.`
                : "No development test records."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a className="registration-back" href="/api/admin/export">
              <Download aria-hidden /> IITB CSV
            </a>
            <a className="registration-back" href="/api/admin/export?mode=internal">
              <Download aria-hidden /> Internal CSV
            </a>
            <button className="registration-back" onClick={() => void logout()} aria-label="Log out">
              <LogOut aria-hidden /> Log out
            </button>
          </div>
        </header>
        {notice && (
          <div
            role="status"
            className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/30 p-4 text-sm text-emerald-100"
          >
            <span>{notice}</span>
            <button className="registration-back" onClick={clearNotice} aria-label="Dismiss notification">
              <X aria-hidden size={16} />
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 registration-field__error">
            {error}
          </p>
        )}
        <MetricsBar data={data} activeStatus={status} onSelectStatus={(next) => setStatus(next)} />
        <RegistrationTogglePanel />
        <CapacityPanel />
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          status={status}
          onStatusChange={setStatus}
          scope={scope}
          onScopeChange={setScope}
          total={data?.total ?? 0}
          refreshing={refreshing}
          onRefresh={() => void refresh()}
        />
        <QueueTable
          rows={data?.rows ?? []}
          total={data?.total ?? 0}
          page={page}
          limit={limit}
          refreshing={refreshing}
          onPageChange={setPage}
          onSelect={(row) => {
            setModalError("");
            setSelected(row);
          }}
        />
        {selected && (
          <ReviewModal
            key={selected.publicId}
            row={selected}
            verifyPending={verifyPending}
            rejectPending={rejectPending}
            ecellPending={ecellPending}
            error={modalError}
            onClose={closeReview}
            onVerify={handleVerify}
            onReject={handleReject}
            onToggleEcell={handleToggleEcell}
            onRequestDelete={(row) => {
              setDeleteError("");
              setDeleteTarget(row);
            }}
          />
        )}
        {deleteTarget && (
          <DeleteVerifiedDialog
            key={deleteTarget.publicId}
            row={deleteTarget}
            pending={deletePending}
            error={deleteError}
            onClose={closeDeleteDialog}
            onConfirm={handleDeleteConfirm}
          />
        )}
      </main>
    </div>
  );
}
