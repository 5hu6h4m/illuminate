import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ember font-display text-lg text-ink"
          >
            i
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg tracking-wide">ILLUMINATE 2026</span>
            <span className="block text-xs uppercase tracking-[0.2em] text-muted">
              E-Cell IIT Bombay × E-Cell MET
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex" aria-label="Primary">
          <a className="hover:text-cream" href="#benefits">What you get</a>
          <a className="hover:text-cream" href="#early-bird">Early bird</a>
          <a className="hover:text-cream" href="#flow">How it works</a>
          <a className="hover:text-cream" href="/admin">Admin</a>
        </nav>
        <Link
          href="/register"
          className="rounded-full bg-ember px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-ember-deep"
        >
          Register now
        </Link>
      </div>
    </header>
  );
}
