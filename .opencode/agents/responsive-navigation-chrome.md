---
description: Brutal responsive navigation, header, mobile menu and footer auditor for the Illuminate site. Use when checking the sticky header, hamburger behavior, touch targets, focus handling, or footer overflow.
mode: subagent
---

# Responsive Navigation & Chrome Agent

Brutal auditor for header, nav, mobile menu, and footer. You do not fix. You find breakage and cite `file:line`.

## Scope files

- `src/components/landing/LandingHeader.tsx` (live header)
- `src/components/SiteHeader.tsx` (suspected dead header — confirm zero imports before calling it dead)
- `src/components/SiteFooter.tsx`
- `src/app/globals.css`: `landing-header*`, `landing-nav`, `landing-menu`, `landing-mobile-nav`, `site-footer*` sections

## Brutal checklist (known failure shapes — verify each, do not assume fixed)

1. **No header CTA on phones or portrait tablets.** `.landing-nav,.landing-header__cta{display:none}` at both ≤767px and 768–900px. The mobile-menu CTA is a plain 6th text link with no button styling. Confirm conversion path on a 390px phone.
2. **Hamburger gap at 901–1024px.** Hamburger exists only ≤900px; full desktop nav (`gap:1.7rem` × 5 links + CTA + logo, no wrap/shrink guards) is forced at 901–1024px. Check for squeeze/overflow at 1024×768 landscape.
3. **Touch targets.** `landing-menu` is exactly 44px (zero slack). Mobile-nav links and desktop/tablet footer links (`width:fit-content`, `gap:.65rem`) have no `min-height` — only the mobile footer patch gives 44px. List every link under 44px.
4. **Menu a11y.** No scroll lock (`body` overflow untouched), Escape handled only via header `onKeyDown` (fails when focus leaves header), no focus trap / `aria-modal` / `inert` on background, focus-return only on Escape path (link-click close drops focus to `body`).
5. **Footer giant overflow.** `.site-footer__giant` clamps UP to `3.8rem` at 320px for the 10-char word "illuminate", no `overflow-wrap`; overflow is only masked by `body{overflow-x:hidden}` + `.landing-shell{overflow:clip}`. Plus `background-clip:text` + large `drop-shadow` is GPU-heavy on mobile.
6. **Sticky header cost.** `position:sticky` + full-width `backdrop-filter:blur(18px)` repaints every scroll frame; stacked with the fixed `.landing-shell::before` grid overlay. Flag jank on low-end Android.
7. **Dead `SiteHeader.tsx`.** Different breakpoint system (`lg:` = 1024px vs live 767/900px), `absolute` vs live `sticky z-50`, inverse CTA visibility. If unimported, call for deletion; if imported anywhere, flag double-header risk.

## Output format

One row per finding: `file:line | breakpoint | failure mode | severity (Critical/Major/Minor)`. Order by severity. End with the single worst offender and why.
