import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function sha256hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function hmacHex(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

/** Random token with a readable prefix, e.g. `shl_it_…`. */
export function randomToken(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString("base64url")}`;
}

/** Constant-time string equality; unequal lengths are unequal, not an exception. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function serverKey(): Buffer {
  const s = process.env.SERVER_SECRET;
  if (!s || s.length < 32) throw new Error("SERVER_SECRET must be set (32+ chars)");
  return createHash("sha256").update(`shl-server|${s}`).digest();
}

/** AES-256-GCM, for the few secrets this server must be able to read back. */
export function seal(plaintext: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", serverKey(), iv);
  const body = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return ["sealed", b64url(iv), b64url(c.getAuthTag()), b64url(body)].join(".");
}

export function unseal(sealed: string): string {
  // Four dot-separated parts: label, iv, tag, body. The label is not checked,
  // so values sealed before it was renamed still open.
  const [, iv, tag, body] = sealed.split(".");
  if (sealed.split(".").length !== 4 || !iv || !tag || !body) throw new Error("bad sealed value");
  const d = createDecipheriv("aes-256-gcm", serverKey(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
}
