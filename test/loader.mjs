/**
 * Module resolution for testing route handlers with the bare node runner.
 *
 * Handlers import "@/lib/…" (a tsconfig path the runner knows nothing about)
 * and "next/server" (which resolves under CommonJS but is absent from Next's
 * ESM exports map). Between them, no test had ever invoked a request handler --
 * so lib/authz.test.ts reads route files as *text* and asserts substrings,
 * which cannot tell `requireCap(...)` followed by a correct target check from
 * the same call followed by none. That is exactly how an admin came to be able
 * to delete the owner.
 *
 * Used with: node --import ./test/loader.mjs --experimental-strip-types
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./resolver.mjs", pathToFileURL("./test/"));
