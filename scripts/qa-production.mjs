import { spawnSync } from "node:child_process";
import { join } from "node:path";

const node = process.execPath;
const project = process.cwd();
let failed = false;

function run(label, command, args) {
  console.log(`\n${label}`);
  const result = spawnSync(command, args, { encoding: "utf8", env: process.env });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) process.stderr.write(`${result.error.message}\n`);
  if (result.status !== 0 || result.error) failed = true;
}

console.log("Illuminate Production QA");
run("[Unit] payment + duplicate policy", node, ["--import", "./scripts/register-dev-ts-loader.mjs", "--test", "tests/registration-duplicate-policy.test.mjs", "tests/payment-pricing.test.mjs", "tests/payment-core.test.mjs", "tests/registration-details.test.mjs"]);
run("[Static] lint", node, [join(project, "node_modules", "eslint", "bin", "eslint.js")]);
run("[Static] typecheck", node, [join(project, "node_modules", "typescript", "bin", "tsc"), "--noEmit"]);
run("[Build] production build", node, [join(project, "node_modules", "next", "dist", "bin", "next"), "build"]);
run("[Static] git diff --check", "git", ["diff", "--check"]);
run("[Config] launch check", node, ["--env-file-if-exists=.env.local", "--import", "./scripts/register-dev-ts-loader.mjs", "scripts/launch-check.mts"]);

const e2eEnabled = process.env.NODE_ENV !== "production"
  && process.env.REGISTRATION_PREVIEW === "1"
  && process.env.PAYMENT_UI_PREVIEW === "1"
  && process.env.PAYMENT_E2E_PREVIEW === "1";
if (e2eEnabled) run("[Integration] development payment E2E", node, ["--env-file-if-exists=.env.local", "--import", "./scripts/register-dev-ts-loader.mjs", "scripts/dev-test-payment-e2e.mts"]);
else console.log("\n[SKIP] Development payment E2E requires the three explicit non-production preview flags; it was not enabled by this command.");

console.log(`\nRESULT: ${failed ? "FAIL" : "PASS"}`);
if (failed) process.exitCode = 1;
