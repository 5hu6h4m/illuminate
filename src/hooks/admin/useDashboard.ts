"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dashboard, Row, Status } from "@/components/admin/types";

export const ADMIN_PAGE_SIZE = 30;

type DeleteInput = { confirmPublicId: string; reason: string; password: string };

export function useDashboard() {
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQueryState] = useState("");
  const [status, setStatusState] = useState<"" | Status>("submitted_for_verification");
  const [scope, setScopeState] = useState<"" | "test" | "real">("");
  const [page, setPageState] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);
  const [rejectPending, setRejectPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [ecellPending, setEcellPending] = useState(false);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ADMIN_PAGE_SIZE));
  // Derive the clamped page during render so filter changes that shrink the
  // result set never leave the UI (or the API call) on an empty page.
  const currentPage = Math.min(page, totalPages);

  const fetchDashboard = useCallback(async (): Promise<Dashboard> => {
    const url = new URL("/api/admin/registrations", location.origin);
    if (query) url.searchParams.set("q", query);
    if (status) url.searchParams.set("status", status);
    if (scope) url.searchParams.set("scope", scope);
    url.searchParams.set("page", String(currentPage));
    url.searchParams.set("limit", String(ADMIN_PAGE_SIZE));
    const response = await fetch(url, { cache: "no-store" });
    const json = await response.json().catch(() => null);
    if (!response.ok) throw new Error(json?.error?.message || "Could not refresh registrations.");
    return json.data as Dashboard;
  }, [currentPage, query, scope, status]);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }): Promise<boolean> => {
      setRefreshing(true);
      try {
        setData(await fetchDashboard());
        setAuthed(true);
        setError("");
        return true;
      } catch (cause) {
        if (!opts?.silent) setError(cause instanceof Error ? cause.message : "Could not refresh registrations.");
        return false;
      } finally {
        setRefreshing(false);
      }
    },
    [fetchDashboard],
  );

  useEffect(() => {
    const timer = setTimeout(() => void refresh({ silent: true }), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setPageState(1);
  }, []);
  const setStatus = useCallback((value: "" | Status) => {
    setStatusState(value);
    setPageState(1);
  }, []);
  const setScope = useCallback((value: "" | "test" | "real") => {
    setScopeState(value);
    setPageState(1);
  }, []);
  const setPage = useCallback((value: number) => {
    setPageState(Math.max(1, value));
  }, []);
  const clearNotice = useCallback(() => setNotice(""), []);

  const login = useCallback(
    async (password: string): Promise<void> => {
      setAuthPending(true);
      setError("");
      try {
        const response = await fetch("/api/admin/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(json?.error?.message || "Could not sign in.");
        if (!(await refresh())) throw new Error("Signed in, but the queue could not be refreshed.");
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Could not sign in.";
        setError(message);
        throw cause instanceof Error ? cause : new Error(message);
      } finally {
        setAuthPending(false);
      }
    },
    [refresh],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } finally {
      setAuthed(false);
      setData(null);
    }
  }, []);

  const verify = useCallback(
    async (row: Row, confirmed: boolean): Promise<void> => {
      setVerifyPending(true);
      try {
        const body = row.isTest
          ? { action: "verify", developmentSimulationVerified: confirmed }
          : { action: "verify", confirmedInRecipientAccount: confirmed };
        const response = await fetch(`/api/admin/registrations/${row.publicId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(json?.error?.message || "Verification could not be saved. Refresh and try again.");
        setData(await fetchDashboard());
        setNotice(`Verified ${row.publicId}.`);
        setError("");
      } finally {
        setVerifyPending(false);
      }
    },
    [fetchDashboard],
  );

  const reject = useCallback(
    async (row: Row, reason: string, privateNote: string): Promise<void> => {
      setRejectPending(true);
      try {
        const body = { action: "reject", publicReason: reason, privateNote };
        const response = await fetch(`/api/admin/registrations/${row.publicId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(json?.error?.message || "Verification could not be saved. Refresh and try again.");
        setData(await fetchDashboard());
        setNotice(`Rejected ${row.publicId}.`);
        setError("");
      } finally {
        setRejectPending(false);
      }
    },
    [fetchDashboard],
  );

  const remove = useCallback(
    async (publicId: string, input: DeleteInput): Promise<void> => {
      setDeletePending(true);
      try {
        const response = await fetch(`/api/admin/registrations/${publicId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(json?.error?.message || "Could not delete this registration. Refresh and try again.");
        setData(await fetchDashboard());
        // The delete endpoint releases the payment-destination slot; tell the
        // CapacityPanel to reload so per-account counts never look stale.
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("illuminate:capacity-changed"));
        setNotice(`Deleted ${publicId}.`);
        setError("");
      } finally {
        setDeletePending(false);
      }
    },
    [fetchDashboard],
  );

  const toggleEcell = useCallback(
    async (row: Row, next: boolean): Promise<Row> => {
      setEcellPending(true);
      try {
        const response = await fetch(`/api/admin/registrations/${row.publicId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ecell", ecellMember: next }),
        });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(json?.error?.message || "E-cell flag could not be saved. Refresh and try again.");
        const updatedFlag = (json?.data as { ecellMember?: boolean } | undefined)?.ecellMember === true;
        const updated: Row = { ...row, ecellMember: updatedFlag };
        setData(await fetchDashboard());
        setNotice(updatedFlag ? `Marked ${row.publicId} as E-cell member.` : `Removed E-cell flag from ${row.publicId}.`);
        setError("");
        return updated;
      } finally {
        setEcellPending(false);
      }
    },
    [fetchDashboard],
  );

  return {
    authed,
    data,
    error,
    notice,
    query,
    status,
    scope,
    page: currentPage,
    limit: ADMIN_PAGE_SIZE,
    totalPages,
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
  };
}
