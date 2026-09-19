/**
 * Licence keys and install bindings.
 */
import { randomBytes } from "node:crypto";
import { sha256hex } from "./crypto.ts";

/** Crockford-style alphabet: no I, L, O, U, so a key read aloud survives. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateLicenseKey(prefix: string): string {
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    const bytes = randomBytes(5);
    let s = "";
    for (const b of bytes) s += ALPHABET[b & 31];
    groups.push(s);
  }
  const p = prefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").replace(/-+$/, "") || "SHROTI";
  return `${p}-${groups.join("-")}`;
}

/** Same normalisation as the v1 server, so v1 hashes remain valid. */
export function keyHash(key: string): string {
  return sha256hex(key.trim().toLowerCase());
}

export function keyHint(key: string): string {
  const k = key.trim().toUpperCase();
  const parts = k.split("-");
  const last = parts[parts.length - 1] ?? "";
  const head = parts.length > 2 ? parts.slice(0, 2).join("-") : (parts[0] ?? "");
  return `${head}-…-${last.slice(-4)}`;
}

/**
 * A domain as an install reports it — "https://www.Example.com:443/whmcs/" —
 * reduced to the thing a licence is bound to: "example.com".
 */
export function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  s = s.split(/[/?#]/)[0] ?? "";
  s = s.replace(/:\d+$/, "").replace(/\.$/, "");
  if (s.startsWith("www.")) s = s.slice(4);
  return s;
}

/** Filesystem paths are case-sensitive; only the separators are normalised. */
export function normalizeDir(input: string): string {
  let s = input.trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  if (s.length > 1) s = s.replace(/\/+$/, "");
  return s;
}

/** Loopback and private installs are development copies, never bound seats. */
export function isLocalDomain(domain: string): boolean {
  return domain === "localhost" || domain.endsWith(".localhost") || domain.endsWith(".test") ||
    /^127\./.test(domain) || /^10\./.test(domain) || /^192\.168\./.test(domain);
}
