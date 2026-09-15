import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(scriptsDirectory, "..", "src");

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { shortCircuit: true, url: "data:text/javascript,export%20%7B%7D%3B" };
  }
  if (specifier.startsWith("@/")) {
    const base = specifier.slice(2);
    // Try explicit extension first, then .ts/.tsx fallbacks, then directory index.
    // pathToFileURL never throws for a well-formed path, so gate on real
    // file existence instead of try/catch.
    const candidates = base.match(/\.(ts|tsx|mts|mjs|js)$/)
      ? [base]
      : [`${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}/index.ts`, `${base}/index.tsx`];
    for (const candidate of candidates) {
      if (existsSync(path.join(sourceRoot, candidate))) {
        return { shortCircuit: true, url: pathToFileURL(path.join(sourceRoot, candidate)).href };
      }
    }
    return { shortCircuit: true, url: pathToFileURL(path.join(sourceRoot, `${base}.ts`)).href };
  }
  return nextResolve(specifier, context);
}
