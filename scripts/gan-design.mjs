import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_MAX_ITERATIONS = 10;
export const DEFAULT_PASS_THRESHOLD = 7.5;

export const RUBRIC_WEIGHTS = {
  designQuality: 0.35,
  originality: 0.3,
  craft: 0.25,
  functionality: 0.1,
};

export function scoreDesign({ designQuality, originality, craft, functionality }) {
  for (const [key, value] of Object.entries({ designQuality, originality, craft, functionality })) {
    if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 10) {
      throw new Error(`${key} must be a number in 0-10 (got ${value})`);
    }
  }
  return (
    RUBRIC_WEIGHTS.designQuality * designQuality +
    RUBRIC_WEIGHTS.originality * originality +
    RUBRIC_WEIGHTS.craft * craft +
    RUBRIC_WEIGHTS.functionality * functionality
  );
}

export function parseGanArgs(argv) {
  let brief = null;
  let maxIterations = DEFAULT_MAX_ITERATIONS;
  let passThreshold = DEFAULT_PASS_THRESHOLD;
  const positionals = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--brief") {
      brief = argv[++i] ?? null;
    } else if (arg.startsWith("--brief=")) {
      brief = arg.slice("--brief=".length);
    } else if (arg === "--max-iterations") {
      maxIterations = Number(argv[++i]);
    } else if (arg.startsWith("--max-iterations=")) {
      maxIterations = Number(arg.slice("--max-iterations=".length));
    } else if (arg === "--pass-threshold") {
      passThreshold = Number(argv[++i]);
    } else if (arg.startsWith("--pass-threshold=")) {
      passThreshold = Number(arg.slice("--pass-threshold=".length));
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  if (!brief && positionals.length > 0) brief = positionals.join(" ");
  if (!brief || !brief.trim()) {
    throw new Error("Missing brief — usage: node scripts/gan-design.mjs \"<brief>\" [--max-iterations N] [--pass-threshold N]");
  }
  if (!Number.isInteger(maxIterations) || maxIterations <= 0) {
    throw new Error(`--max-iterations must be a positive integer (got ${maxIterations})`);
  }
  if (typeof passThreshold !== "number" || Number.isNaN(passThreshold) || passThreshold < 0 || passThreshold > 10) {
    throw new Error(`--pass-threshold must be a number in 0-10 (got ${passThreshold})`);
  }

  return { brief: brief.trim(), maxIterations, passThreshold };
}

function printHelp() {
  console.log(`GAN-Style Design Harness — whole-website design-evaluate loop

Usage:
  node scripts/gan-design.mjs "<brief>" [--max-iterations N] [--pass-threshold N]
  node scripts/gan-design.mjs --brief "<brief>" [--max-iterations N] [--pass-threshold N]

Args:
  brief                 User's description of the design to create (required).
                        The brief IS the spec — saved to gan-harness/spec.md.
  --max-iterations N    Max design-evaluate cycles (default ${DEFAULT_MAX_ITERATIONS}).
  --pass-threshold N    Weighted 0-10 score to pass (default ${DEFAULT_PASS_THRESHOLD}).

Rubric (gan-harness/eval-rubric.md):
  Design Quality 0.35, Originality 0.30, Craft 0.25, Functionality 0.10.`);
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop() ?? "");
if (isMain || process.argv[1]?.endsWith("gan-design.mjs")) {
  try {
    const { brief, maxIterations, passThreshold } = parseGanArgs(process.argv.slice(2));
    const project = process.cwd();
    const specPath = join(project, "gan-harness", "spec.md");
    const rubricPath = join(project, "gan-harness", "eval-rubric.md");
    if (!existsSync(specPath)) console.warn(`[warn] Missing ${specPath} — the brief IS the spec; create it first.`);
    if (!existsSync(rubricPath)) console.warn(`[warn] Missing ${rubricPath}.`);
    else {
      const rubric = readFileSync(rubricPath, "utf8");
      for (const expected of ["0.35", "0.30", "0.25", "0.10"]) {
        if (!rubric.includes(expected)) console.warn(`[warn] Rubric missing weight ${expected}.`);
      }
    }

    const runState = {
      brief,
      maxIterations,
      passThreshold,
      weights: RUBRIC_WEIGHTS,
      scope: ["/", "/register", "/success", "/admin", "/terms", "/privacy", "/refunds", "/registration"],
      startedAt: new Date().toISOString(),
      status: "ready — run Generator → Evaluator loop in your agent session",
    };
    writeFileSync(join(project, "gan-harness", "run.json"), `${JSON.stringify(runState, null, 2)}\n`);

    console.log("GAN Design Harness — DESIGN-ONLY experimentation");
    console.log("- A design threshold is not a production acceptance result and cannot produce production GO.");
    console.log(`- brief: ${brief.slice(0, 200)}${brief.length > 200 ? "…" : ""}`);
    console.log(`- max-iterations: ${maxIterations}`);
    console.log(`- pass-threshold: ${passThreshold}`);
    console.log("- rubric: Design 0.35 / Originality 0.30 / Craft 0.25 / Functionality 0.10");
    console.log("- state: gan-harness/run.json");
    console.log("\nLoop (no planner — brief IS spec):");
    for (let i = 1; i <= Math.min(maxIterations, 3); i++) {
      console.log(`  ${i}. Generator: implement brief across ALL routes (visual excellence first).`);
      console.log(`     Evaluator: score D/O/C/F, weighted >= ${passThreshold} to pass.`);
    }
    if (maxIterations > 3) console.log(`  … up to ${maxIterations} iterations until weighted >= ${passThreshold}.`);
    console.log("\nGenerator prompt: PRIMARY goal is visual excellence within the production safety baseline.");
    console.log("Evaluator prompt: design-only score; it never waives security, payment, registration, content, accessibility, or production QA.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
