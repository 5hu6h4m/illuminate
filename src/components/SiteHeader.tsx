import Link from "next/link";

const NAV = [
  ["Home", "/#home"],
  ["About Us", "/#about"],
  ["Structure", "/#structure"],
  ["Guidelines", "/#guidelines"],
  ["Incentives", "/#incentives"],
  ["Contact Us", "/#contact"],
] as const;

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
        <Link href="/#home" className="flex items-center gap-3" aria-label="Illuminate home">
          <span className="flex h-11 w-11 flex-col items-center justify-center leading-none">
            <span className="font-display text-3xl text-white">E</span>
            <span className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-ember-soft">
              e-cell
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 font-body text-[1.05rem] text-ember-soft lg:flex" aria-label="Primary">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} className="transition hover:text-white">
              {label}
            </a>
          ))}
        </nav>
        <Link
          href="/register"
          className="rounded-full bg-ember px-5 py-2 text-sm font-semibold text-white transition hover:bg-ember-deep lg:hidden"
        >
          Register
        </Link>
      </div>
    </header>
  );
}
