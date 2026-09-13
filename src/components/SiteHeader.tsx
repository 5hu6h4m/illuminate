import Link from "next/link";

const NAV = [
  ["Home", "/#home"],
  ["About Us", "/#about"],
  ["Impact", "/#impact"],
  ["Structure", "/#structure"],
  ["Guidelines", "/#guidelines"],
  ["Incentives", "/#incentives"],
  ["Contact Us", "/#contact"],
] as const;

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
        <Link href="/#home" className="relative flex items-center gap-3" aria-label="Illuminate home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/ecell-logo.png"
            alt="E-Cell"
            fetchPriority="high"
            className="relative h-11 w-auto object-contain"
          />
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
          className="rounded-full bg-ember px-5 py-2 text-sm font-semibold text-white pressable transition-colors hover:bg-ember-deep lg:hidden"
        >
          Register
        </Link>
      </div>
    </header>
  );
}
