// Emit a server-signed entitlement for the PHP cross-language test.
import { generateKeyPairSync } from "node:crypto";
import { signerFromPkcs8, setSigner } from "../lib/sign.ts";
import { buildClaims } from "../lib/entitlement.ts";
import { signJws } from "../lib/sign.ts";
const { privateKey } = generateKeyPairSync("ed25519");
const s = signerFromPkcs8("xcheck-1", privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"));
setSigner(s);
const lic = { id: 7, status: "active", plan: "standard", key_hint: "SHROTI-WM-…-ABCD", features: null, limits: null };
const product = { slug: "shrotihost-whatsapp-manager-whmcs", token_ttl_hours: 168, grace_hours: 336, features: ["bulk_send"], limits: {} };
const claims = buildClaims(lic, product, { domain: "portal.shrotihost.in", install_dir: "/home/shrotihost/portal.shrotihost.in", instance_id: "shl_in_xcheck" });
console.log(JSON.stringify({ kid: s.kid, x: s.publicKeyB64url(), token: signJws(claims, "shl-entitlement+jwt") }));
