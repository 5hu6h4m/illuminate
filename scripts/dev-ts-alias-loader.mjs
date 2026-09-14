import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(scriptsDirectory, "..", "src");

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { shortCircuit: true, url: "data:text/javascript,export%20%7B%7D%3B" };
  }
  if (specifier.startsWith("@/")) {
    return { shortCircuit: true, url: pathToFileURL(path.join(sourceRoot, `${specifier.slice(2)}.ts`)).href };
  }
  return nextResolve(specifier, context);
}
