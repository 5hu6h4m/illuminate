# Phase 1 Foundation

## Objective and boundaries

Phase 1 establishes content truth, safe public defaults, typed configuration, tokens and implementation rules. It does not rebuild the landing page, registration funnel, direct-UPI system, admin or launch stack.

## Architecture

- Next.js App Router with pages for `/`, `/register`, `/success`, `/admin` and a registration API route.
- MongoDB persistence uses `src/lib/mongodb.ts`; Zod validates the registration boundary.
- Event truth lives solely in `src/config/event.ts`; public components must read from it instead of repeating facts.
- Legacy landing/form/admin components are retained for Phase 2–4 migration and documented rather than deleted blindly.

## Digital Ignition design system

Near-black canvas, restrained violet, electric-blue directional accents and occasional ember are the visual vocabulary. Tokens in `globals.css` define semantic colours, widths, fluid section spacing, radii and typography. `Container`, `SectionHeading` and `StatusBadge` are deliberately small primitives, not a component library.

Typography uses Playfair Display for confident editorial display roles and DM Sans for readable product/body roles. Use `text-display`, `text-section-title`, `text-body`, `text-eyebrow` and `text-label`; preserve narrow measures on mobile.

## Motion

Keep `Reveal` as the single reusable entrance primitive. Ambient canvas, energy trails, 3D cube, globe and long preloader are legacy effects: assess and simplify in Phase 2. Prefer 120–220ms micro-interactions, 200–350ms UI transitions and 400–700ms section reveals; no scroll hijacking, gratuitous bounce or content-blocking motion. Existing reduced-motion rules turn off continuous and entrance effects; all new motion must do the same. Decorative layers must be `pointer-events: none`.

## Responsive and accessibility baseline

Design mobile-first for 360–430px, then fluidly scale to tablet, desktop and large desktop. Use tokenised containers, `clamp()`, readable line lengths and minimum 44px interactive targets; do not create device-specific page variants. Preserve semantic headings/landmarks, visible `:focus-visible`, labels, contrast, keyboard paths and reduced motion. Use ARIA only when native HTML is insufficient.

## Performance rules

Prefer server components; client components only for interaction or browser APIs. Avoid permanent animation loops, uncapped canvases, mousemove work and oversized visual assets. Pause or simplify decoration on reduced motion, hidden tabs and small devices. Do not let visual effects intercept input.

## Future phase boundaries

- Phase 2: original landing/conversion UX and legacy visual/component retirement.
- Phase 3: three-step, data-minimised registration.
- Phase 4: direct UPI, file storage, verification workflow, hardened admin and security controls.
- Phase 5: analytics, SEO, release and production operations.

## Validation command set

`npm run lint`, `npm run typecheck`, `npm run build`.
