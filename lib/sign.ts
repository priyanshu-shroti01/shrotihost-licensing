/**
 * Ed25519 signing of entitlements and release manifests, as compact JWS.
 *
 * This is the fix for the old licensing bypass. Old responses were unsigned JSON
 * and its "local key" was symmetric, so an install could forge its own cache or
 * point license.shrotihost.in at localhost and answer {"valid":true}. A module
 * now holds only our *public* key: it can check a token, and cannot make one.
 *
 * The private key comes from the environment through the Signer interface and
 * nothing else touches it, so moving it to a KMS or a separate signing host
 * later means replacing `envSigner()` and nothing more.
 */
import { createPrivateKey, createPublicKey, sign as edSign, verify as edVerify, type KeyObject } from "node:crypto";
import { b64url } from "./crypto.ts";

export interface Signer {
  kid: string;
  sign(data: Buffer): Buffer;
  /** Raw 32-byte public key, base64url — the form a PHP sodium client wants. */
  publicKeyB64url(): string;
}

export function signerFromPkcs8(kid: string, pkcs8DerB64: string): Signer {
  const priv = createPrivateKey({ key: Buffer.from(pkcs8DerB64, "base64"), format: "der", type: "pkcs8" });
  if (priv.asymmetricKeyType !== "ed25519") throw new Error("signing key is not Ed25519");
  const pub = createPublicKey(priv);
  const x = (pub.export({ format: "jwk" }) as { x?: string }).x;
  if (!x) throw new Error("could not derive public key");
  return {
    kid,
    sign: (data) => edSign(null, data, priv),
    publicKeyB64url: () => x,
  };
}

let cached: Signer | null = null;
let override: Signer | null = null;

/** Tests install a throwaway key here. */
export function setSigner(s: Signer | null): void {
  override = s;
}

export function getSigner(): Signer {
  if (override) return override;
  if (cached) return cached;
  const key = process.env.LICENSE_SIGNING_KEY;
  const kid = process.env.LICENSE_SIGNING_KID;
  if (!key || !kid) throw Object.assign(new Error("signing key not configured"), { code: "NO_SIGNING_KEY" });
  const s = signerFromPkcs8(kid, key);
  // Self-test once per instance: a key that cannot verify its own signature
  // must never issue a token a module will then reject for a week.
  const probe = Buffer.from(`shl-selftest|${kid}`);
  if (!verifyRaw(s.publicKeyB64url(), probe, s.sign(probe))) throw new Error("signing key self-test failed");
  cached = s;
  return s;
}

function publicKeyObject(xB64url: string): KeyObject {
  return createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: xB64url }, format: "jwk" });
}

export function verifyRaw(xB64url: string, data: Buffer, sig: Buffer): boolean {
  try {
    return edVerify(null, data, publicKeyObject(xB64url), sig);
  } catch {
    return false;
  }
}

/**
 * Every public key a module may trust: the current one plus any listed in
 * LICENSE_PUBLIC_KEYS ({"kid":"x",…}) — the retiring or next key during a
 * rotation. Modules bundle this set; there is no live fetch.
 */
export function publicKeys(): Record<string, string> {
  const s = getSigner();
  const extra: Record<string, string> = {};
  try {
    Object.assign(extra, JSON.parse(process.env.LICENSE_PUBLIC_KEYS || "{}"));
  } catch { /* malformed extra keys are ignored, never fatal */ }
  return { ...extra, [s.kid]: s.publicKeyB64url() };
}

export function signJws(payload: object, typ: string): string {
  const s = getSigner();
  const header = b64url(JSON.stringify({ alg: "EdDSA", kid: s.kid, typ }));
  const body = b64url(JSON.stringify(payload));
  const input = `${header}.${body}`;
  return `${input}.${b64url(s.sign(Buffer.from(input)))}`;
}

/** Verification as a module performs it. Used by tests and the self-check route. */
export function verifyJws<T = any>(jws: string, keys: Record<string, string>): { header: any; payload: T } | null {
  const parts = jws.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts as [string, string, string];
  let header: any;
  try {
    header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (header?.alg !== "EdDSA" || typeof header.kid !== "string") return null;
  const x = Object.prototype.hasOwnProperty.call(keys, header.kid) ? keys[header.kid] : undefined;
  if (!x) return null;
  if (!verifyRaw(x, Buffer.from(`${h}.${p}`), Buffer.from(sig, "base64url"))) return null;
  try {
    return { header, payload: JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as T };
  } catch {
    return null;
  }
}
