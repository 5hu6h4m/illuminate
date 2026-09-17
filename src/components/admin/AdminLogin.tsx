"use client";

import { useState } from "react";

type AdminLoginProps = {
  onLogin: (password: string) => Promise<void>;
  pending: boolean;
  error: string;
};

export function AdminLogin({ onLogin, pending, error }: AdminLoginProps) {
  const [password, setPassword] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await onLogin(password);
      setPassword("");
    } catch {
      // Error is surfaced through the `error` prop (role=alert below).
    }
  };

  return (
    <div className="admin-shell">
      <main className="mx-auto max-w-md px-5 py-20">
        <p className="text-eyebrow text-brand-electric">Staff workspace</p>
        <h1 className="mt-3 text-display">Admin sign in</h1>
        <hr className="thread-divider" aria-hidden />
        <div className="credential-frame mt-8">
          <div className="credential-frame__inner p-6">
            <form className="space-y-4" onSubmit={submit}>
              <label className="registration-field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              {error && (
                <p role="alert" className="registration-field__error">
                  {error}
                </p>
              )}
              <button className="registration-primary-action w-full justify-center" disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
