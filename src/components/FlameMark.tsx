/** Original flame wordmark drawn for E-Cell MET — violet gradient, bulb base. */
export function FlameMark({ className = "h-16 w-16" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 96" className={className} role="img" aria-label="Illuminate flame">
      <defs>
        <linearGradient id="illum-flame" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>
      <path
        fill="url(#illum-flame)"
        d="M32 4c3 12 12 18 12 32 0 5-2 9-5 12 1-8-1-15-7-20-1 9-8 14-8 25 0 11 8 19 8 19s-4-3-5-8c-4 3-7 8-7 13 0 9 7 15 12 15s12-6 12-15c0-5-2-9-5-12 3-3 5-8 5-13 0-14-9-20-12-28-3 8-12 14-12 28 0 4 1 8 3 11-3-2-5-6-5-10 0-12 11-17 14-29z"
        opacity="0.95"
      />
      <g fill="#c4b5fd">
        <rect x="20" y="76" width="24" height="3" rx="1.5" />
        <rect x="22" y="81" width="20" height="3" rx="1.5" />
        <rect x="25" y="86" width="14" height="3" rx="1.5" />
      </g>
    </svg>
  );
}
