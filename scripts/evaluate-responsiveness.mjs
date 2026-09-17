// Brutal static responsiveness scorer for the Illuminate site.
// Static analysis only: it proves the presence of known failure shapes, it does
// not replace manual testing at 320 / 768 / 1024 / 1440px.
// Usage: node scripts/evaluate-responsiveness.mjs [--json] [--threshold <n>]

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = join(root, "src", "app", "globals.css");

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const thresholdIndex = args.indexOf("--threshold");
const thresholdRaw = thresholdIndex === -1 ? 70 : Number(args[thresholdIndex + 1]);
const threshold = Number.isFinite(thresholdRaw) && thresholdRaw > 0 ? thresholdRaw : 70;

function read(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const css = read(cssPath);
const hero = read(join(root, "src", "components", "landing", "CinematicHero.tsx"));

function walkTsx(dir, out = []) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      if (statSync(full).isDirectory()) walkTsx(full, out);
      else if (full.endsWith(".tsx") || full.endsWith(".ts")) out.push(full);
    } catch { /* ignore */ }
  }
  return out;
}

const tsxFiles = walkTsx(join(root, "src"));
const tsxContents = tsxFiles.map((f) => ({ file: f, text: read(f) }));

function rawContainerFiles() {
  // Files using Tailwind's raw `container` class instead of the Container component.
  return tsxContents.filter(({ text }) => text.includes('className="container"')).map(({ file }) => file);
}

function countUnoptimized() {
  // QR-code and blob-preview Images are intentionally unoptimized:
  // re-encoding a QR risks blurring modules, and blob: URLs cannot be
  // optimized. Everything else must use the optimizer.
  return tsxContents.reduce(
    (n, { text }) => n + text.split(/\r?\n/).filter((line) => {
      if (!line.includes("unoptimized")) return false;
      if (line.includes("preview-qr") || line.includes("/qr") || line.includes("preview}")) return false;
      return true;
    }).length,
    0,
  );
}

const checks = [];
function check(id, label, severity, weight, failed, evidence, hint) {
  checks.push({ id, label, severity, weight, status: failed ? "FAIL" : "PASS", evidence, hint });
}

// 1. Tablet dead zone: no single media query covering the 768-1024 band.
// Fragments don't count: the 768-900px header patch and the hero-only
// max-width:1024px tweak leave every grid without a tablet layout.
check(
  "tablet-dead-zone", "Tablet band (768-1024px) has no grid rules", "Critical", 8,
  !/@media[^{]*min-width:\s*768px[^{]*max-width:\s*1024px/.test(css),
  "No @media (min-width:768px) and (max-width:1024px) band; 7/6/4/3-col grids hold to 767px.",
  "Add a 768-1024px pass for every multi-col grid (problem-steps, process-steps, thinking-model, takeaways, relationship, value-grid, footer-grid).",
);

// 2. Two-container drift.
{
  const files = rawContainerFiles();
  check(
    "container-drift", "Raw `container` class mixed with Container component", "Critical", 8,
    files.length > 0,
    files.length > 0 ? files.length + " files use raw container: " + files.map((f) => relative(join(root, "src"), f)).join(", ") : "none",
    "Replace every raw `container` div with the Container component (72rem + px-5/6/8).",
  );
}

// 3. Overflow masking.
check(
  "overflow-masking", "body overflow-x:hidden + .landing-shell overflow:clip hide breakage", "Major", 4,
  /body\s*\{[^}]*overflow-x:\s*hidden/.test(css) && /\.landing-shell\s*\{[^}]*overflow:\s*clip/.test(css),
  "Both present in globals.css; wide visuals (110-116% threads, calc(100%+2rem)) are cropped, never fixed.",
  "Remove masking, fix each horizontal overflow at its source, then re-verify at 320px with no clipping ancestor.",
);

// 4. Sticky trap.
check(
  "sticky-trap", "position:sticky inside an overflow:clip ancestor", "Major", 4,
  /\.journey-system__context\s*\{[^}]*position:\s*sticky/.test(css) && /\.landing-shell\s*\{[^}]*overflow:\s*clip/.test(css),
  ".journey-system__context{position:sticky} inside .landing-shell{overflow:clip} — sticky cannot work.",
  "Move sticky out of the clipped subtree or drop overflow:clip; verify the context label sticks on desktop.",
);

// 5. Video min-width wider than phones.
check(
  "video-min-width", "Hero video min-width (440px) exceeds small phones", "Major", 4,
  css.includes("clamp(440px"),
  ".cinematic-hero__video{width:clamp(440px,54%,860px)} + matching ::before fade.",
  "Use a fluid width capped at 100vw (e.g. min(100%, ...) with no px floor above 320px).",
);

// 6. Unconditional mobile video download.
check(
  "video-preload", "Hero video preload=auto with no mobile/poster gate", "Major", 4,
  hero.includes('preload="auto"') && !hero.includes("poster") && !/matchMedia\([^)]*width|Save-Data|saveData/.test(hero),
  "CinematicHero.tsx: preload=auto, autoplay+loop, no poster, no width/Save-Data gate; mobile shows it at opacity .3.",
  "Serve poster + metadata/none on mobile or prefers-reduced-data; keep full video for wide screens only.",
);

// 7. Unoptimized images.
{
  const total = countUnoptimized();
  check(
    "unoptimized-images", "next/image optimizer bypassed (unoptimized)", "Minor", 2,
    total > 0,
    `${total} unoptimized usages repo-wide (948px logo displayed at ~2.6rem).`,
    "Drop unoptimized, add sizes + lazy for below-fold, priority only for the true LCP image.",
  );
}

// 8. Header CTA hidden on mobile + portrait tablet.
check(
  "mobile-cta-hidden", "Header CTA display:none on <=900px, mobile CTA is a plain link", "Critical", 8,
  /\.landing-header__cta\s*\{\s*display:\s*none/.test(css),
  "globals.css hides .landing-nav,.landing-header__cta at <=767px and again at 768-900px; mobile CTA has no button style.",
  "Keep a compact CTA visible at every width; style the mobile-menu CTA as a button, not the 6th text link.",
);

// 9. Unreadable progress type.
check(
  "tiny-progress", "Registration progress at .54rem (8.6px) uppercase", "Critical", 6,
  css.includes("font-size:.54rem"),
  ".registration-progress li + step numbers at .54rem; inactive #6b6b6b on #050505 (~3.2:1).",
  "Raise to >=.7rem, strengthen inactive contrast to 4.5:1, enlarge step circles.",
);

// 10. Undersized consent control.
check(
  "consent-touch", "Consent checkbox 17.6px, Edit button ~20px (both < 44px)", "Major", 4,
  /\.registration-consent input\s*\{[^}]*width:\s*1\.1rem/.test(css),
  ".registration-consent input{1.1rem x 1.1rem}; review Edit button has no min-height.",
  "Hit 44px targets on checkbox row and Edit; keep the visual box small if needed via padding.",
);

// 11. Footer giant floor.
check(
  "footer-giant", "Footer giant clamps UP to 3.8rem at 320px (overflow masked)", "Minor", 2,
  css.includes("clamp(3.8rem,13.5vw"),
  ".site-footer__giant 10-char word, no overflow-wrap; only body overflow-x:hidden saves it.",
  "Lower the floor, allow wrap/balance, verify at 320px with masking removed.",
);

// 12-13. Extreme column counts must not apply at tablet/phone widths.
// Desktop-only restores live in `@media (min-width: 1025px)` blocks, which are
// stripped before checking — mobile-first base + 768-1024 band must not
// contain them.
function withoutDesktopRestores(source) {
  return source.replace(/@media[^{]*min-width:\s*1025px[^{]*\{((?:[^{}]|\{[^{}]*\})*)\}/g, "");
}
const responsiveCss = withoutDesktopRestores(css);
check(
  "seven-col-grid", "7-column grid applies at <=1024px", "Critical", 8,
  responsiveCss.includes("repeat(7,1fr)"),
  ".problem-business__steps{repeat(7,1fr)} reaches tablet/phone widths.",
  "Mobile-first: base 1fr, 768-1024 band 2-3 cols, 7 cols only in min-width:1025px.",
);
check(
  "six-col-grid", "6-column grid applies at <=1024px (no 901-1024 plan)", "Major", 4,
  responsiveCss.includes("repeat(6,"),
  ".registration-process__steps{repeat(6,...)} with no 901-1024px plan.",
  "Mobile-first: base vertical, 768-1024 band keeps the stepped treatment, 6 cols only in min-width:1025px.",
);

// 14. Journey signal forces scroll.
check(
  "signal-minheight", "Journey SVG min-height 25-31rem forces mobile scroll", "Major", 4,
  /\.journey-system__signal svg\s*\{[^}]*min-height:\s*2[5-9]rem/.test(css) || /\.journey-system__signal svg\s*\{[^}]*min-height:\s*3[0-1]rem/.test(css),
  "Three conflicting min-height overrides (25/28/31rem) on the signal SVG.",
  "Size the signal to its content on mobile; one override, not three.",
);

// 15. Value-map absolute pileup at 320px.
check(
  "valuemap-320", "Value-map labels absolutely piled at 50%+1.8rem on phones", "Major", 4,
  css.includes("calc(50% + 1.8rem)"),
  "4 labels share left:calc(50%+1.8rem) at 1.35rem; core at left:31% width:7.3rem clips.",
  "Re-layout the map for narrow screens (stacked list or scaled orbit), not offset absolutes.",
);

// 16. Mobile nav links have no 44px target (container rule or link rule).
{
  const blocks = [...css.matchAll(/\.landing-mobile-nav[^{]*\{([^}]*)\}/g)].map((m) => m[1]);
  const anyMinHeight = blocks.some((b) => /min-height/.test(b));
  check(
    "mobile-nav-touch", "Mobile nav links have no min-height (fail 44px)", "Major", 4,
    blocks.length > 0 && !anyMinHeight,
    ".landing-mobile-nav — .82rem text links with no 44px target (checked container + link rules).",
    "Give every mobile nav link min-height:2.75rem with centered alignment.",
  );
}

// 17. svh without vh fallback.
check(
  "svh-fallback", "Bare 100svh with no 100vh fallback (old browsers jump)", "Minor", 1,
  /\.screen\s*\{[^}]*100svh/.test(css) && !/\.screen\s*\{[^}]*100vh/.test(css),
  ".screen/.landing-hero/.registration-shell use bare 100svh; only the cinematic hero orders vh-then-svh.",
  "Declare 100vh first, then 100svh, everywhere.",
);

// 18. Competing anchor offsets.
check(
  "scroll-drift", "Three competing scroll offsets (5.25rem vs 4.75/4.15rem vs 5.5rem)", "Minor", 1,
  css.includes("scroll-padding-top: 5.25rem") && css.includes("scroll-margin-top:5.5rem"),
  "scroll-padding-top:5.25rem vs header 4.75/4.15rem vs section scroll-margin:5.5rem.",
  "Derive all three from one header-height token per breakpoint.",
);

// 19. Bleeders: >100% widths that only survive because of overflow masking.
// Must be zero before overflow:clip / overflow-x:hidden may be removed.
check(
  "bleeders", "Elements wider than 100% (masked, not fixed)", "Critical", 8,
  /width:\s*1(0[1-9]|1\d)%|calc\(100%\s*\+/.test(css),
  "116%/115%/110% threads, calc(100%+2rem) visuals, 82rem journey inside a 72rem container.",
  "Constrain every bleeder to <=100% of its containing block, then remove the masking.",
);

const deductions = checks.filter((c) => c.status === "FAIL").reduce((s, c) => s + c.weight, 0);
const score = Math.max(0, 100 - deductions);
const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

const result = {
  score, grade, threshold,
  pass: score >= threshold,
  deductions,
  checks: checks.map(({ id, label, severity, weight, status, evidence }) => ({ id, label, severity, weight, status, evidence })),
  notes: [],
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`\nResponsiveness score: ${score}/100 (grade ${grade}) — threshold ${threshold}: ${result.pass ? "PASS" : "FAIL"}\n`);
  console.log("Signatures are historical detection patterns: PASS means the pattern is absent, not that rendering was verified.");
  console.log("ID                  SEV       W   STATUS  SIGNATURE");
  console.log("-".repeat(100));
  for (const c of checks) {
    console.log(`${c.id.padEnd(20)}${c.severity.padEnd(10)}${String(c.weight).padEnd(4)}${c.status.padEnd(8)}${c.evidence.slice(0, 60)}`);
  }
  const failed = checks.filter((c) => c.status === "FAIL");
  if (failed.length) {
    console.log("\nFix hints (highest weight first):");
    for (const c of [...failed].sort((a, b) => b.weight - a.weight)) console.log(`- [${c.id}] ${c.hint}`);
  }
  for (const n of result.notes) console.log(`\nNOTE: ${n}`);
  console.log(`\nStatic analysis only — still verify manually at 320 / 768 / 1024 / 1440px.\n`);
}

process.exitCode = result.pass ? 0 : 1;
