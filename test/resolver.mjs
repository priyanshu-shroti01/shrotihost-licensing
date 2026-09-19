import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(join(root, "package.json"));

/** Try the extensions a TypeScript import would have omitted. */
function withExtension(base) {
  for (const ext of ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"]) {
    const p = base + ext;
    if (existsSync(p) && !p.endsWith("/")) return p;
  }
  return null;
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const found = withExtension(join(root, specifier.slice(2)));
    if (found) return next(pathToFileURL(found).href, context);
  }
  // next/server resolves under CommonJS but is not in the ESM exports map.
  if (specifier.startsWith("next/")) {
    try {
      return next(pathToFileURL(require.resolve(specifier)).href, context);
    } catch { /* fall through to the default resolver */ }
  }
  return next(specifier, context);
}
