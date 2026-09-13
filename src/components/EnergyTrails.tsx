/**
 * Flowing violet energy trails — abstract electric blades sweeping
 * lower-left → upper-right, inspired by the reference hero art.
 * Pure inline SVG + slow CSS drift (transform-only). No video/GIF, no library.
 * Decorative: aria-hidden, pointer-events-none. Hidden on mobile by the parent.
 */
export function EnergyTrails({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute ${className}`}>
      <svg viewBox="0 0 640 720" className="h-full w-full" focusable="false">
        <defs>
          <linearGradient id="trail-main" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#6D28D9" stopOpacity="0.9" />
            <stop offset="0.45" stopColor="#7C3AED" stopOpacity="0.95" />
            <stop offset="0.72" stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#A78BFA" />
          </linearGradient>
          <linearGradient id="trail-deep" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#4C1D95" stopOpacity="0.7" />
            <stop offset="0.5" stopColor="#6D28D9" stopOpacity="0.85" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="trail-bright" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#7C3AED" />
            <stop offset="0.6" stopColor="#A78BFA" />
            <stop offset="1" stopColor="#DDD6FE" />
          </linearGradient>
          <linearGradient id="trail-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="black" stopOpacity="0" />
            <stop offset="0.42" stopColor="black" stopOpacity="1" />
          </linearGradient>
          <mask id="trail-mask">
            <rect x="0" y="0" width="640" height="720" fill="url(#trail-fade)" />
          </mask>
          <filter id="trail-blur-lg" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id="trail-blur-sm" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>

        <g mask="url(#trail-mask)">
          {/* soft back glow — blurred, slow drift */}
          <g className="trail-drift-a" filter="url(#trail-blur-lg)" opacity="0.6">
            <path
              fill="url(#trail-deep)"
              d="M120 700 C240 560 360 430 520 180 C550 135 575 95 600 50 C585 110 545 180 470 290 C360 440 230 580 150 705 Z"
            />
            <path
              fill="url(#trail-deep)"
              d="M250 710 C350 590 450 460 560 240 C585 190 605 140 620 100 C605 160 570 230 510 340 C420 480 320 600 275 712 Z"
            />
            <path
              fill="url(#trail-deep)"
              d="M60 690 C160 570 260 470 380 280 C410 235 435 195 455 160 C440 210 400 275 330 380 C240 500 140 600 85 695 Z"
            />
          </g>

          {/* sharp front blades — tapered ends, gradient + bright core */}
          <g className="trail-drift-b">
            <g filter="url(#trail-blur-sm)" opacity="0.9">
              <path
                fill="url(#trail-main)"
                d="M120 700 C240 560 360 430 520 180 C550 135 575 95 600 50 C585 110 545 180 470 290 C360 440 230 580 150 705 Z"
              />
              <path
                fill="url(#trail-main)"
                d="M250 710 C350 590 450 460 560 240 C585 190 605 140 620 100 C605 160 570 230 510 340 C420 480 320 600 275 712 Z"
              />
            </g>
            <path
              fill="url(#trail-bright)"
              opacity="0.92"
              d="M60 690 C160 570 260 470 380 280 C410 235 435 195 455 160 C440 210 400 275 330 380 C240 500 140 600 85 695 Z"
            />
            <path
              fill="url(#trail-bright)"
              opacity="0.85"
              d="M180 620 C260 530 330 450 420 320 C440 292 458 268 472 245 C460 280 430 325 380 400 C310 495 235 565 200 625 Z"
            />
            <path
              fill="url(#trail-bright)"
              opacity="0.8"
              d="M470 220 C500 180 530 140 560 95 C565 85 572 75 580 65 C572 95 555 130 530 170 C510 200 490 220 478 228 Z"
            />
            {/* electric core highlights */}
            <g fill="none" strokeLinecap="round">
              <path d="M150 680 C260 550 370 420 555 95" stroke="#DDD6FE" strokeWidth="2.5" opacity="0.4" />
              <path d="M270 695 C365 580 455 455 590 130" stroke="#C4B5FD" strokeWidth="2" opacity="0.35" />
              <path d="M95 675 C190 560 280 465 425 200" stroke="#DDD6FE" strokeWidth="1.5" opacity="0.3" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
