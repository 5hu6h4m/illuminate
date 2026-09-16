import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Manrope is loaded from the local Fontsource package", async () => {
  const layout = await readFile(path.join(projectRoot, "src/app/layout.tsx"), "utf8");
  const globalStyles = await readFile(path.join(projectRoot, "src/app/globals.css"), "utf8");

  assert.match(layout, /@fontsource-variable\/manrope\/wght\.css/);
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.doesNotMatch(layout, /\bManrope\s*\(/);
  assert.match(globalStyles, /--font-manrope:\s*"Manrope Variable"/);
});
