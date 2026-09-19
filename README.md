# ShrotiHost Licensing Server

Issues Ed25519-signed entitlements for ShrotiHost WHMCS modules, and serves their
signed releases. WHMCS (`shrotihost_license` server module + `shrotihost_license_admin`
addon on portal.shrotihost.in) is where licences are provisioned and managed; this
server is the system of record behind it.

Live at **https://licensing.shrotihost.in** (Vercel, Neon Postgres).

## Why it exists

The v1 server returned unsigned JSON, and modules cached it under a key derived from
the customer's own `configuration.php`. A customer could forge the cache, or point
the licence hostname at localhost and answer `{"valid":true}`, without editing any
PHP. Modules now hold only our public key: they can check a token and cannot make one.

## API

Install endpoints (called by `ShrotiLicensing.php` inside each module):

| Method | Path | Auth |
|---|---|---|
| POST | `/api/activate` | licence key (the only call that fails closed) |
| POST | `/api/heartbeat` | install token + request HMAC; daily |
| POST | `/api/deactivate` | install token + request HMAC |
| POST | `/api/updates/check` | install token + request HMAC; returns a signed manifest |
| POST | `/api/updates/download` | install token + request HMAC; one-time URL, 15 min |
| GET  | `/api/updates/download/:token` | the one-time token |
| GET  | `/api/keys` | public; the trusted public keys by `kid` |
| GET  | `/api/health` | public; database + signing key |

Admin endpoints under `/api/admin/*` (products, licences, releases, blacklist, events,
stats) require `X-SHL-Key` plus the request HMAC below, signed with `ADMIN_API_SECRET`.

### Request signing

```
X-SHL-Timestamp: unix seconds (±300 s)
X-SHL-Nonce:     16–64 url-safe chars, single use
X-SHL-Signature: hex HMAC-SHA256(secret, ts \n nonce \n METHOD \n path?query \n sha256hex(body))
```

Install requests also send `Authorization: Bearer <install_token>` and
`X-SHL-Instance: <instance_id>`.

### Entitlement token

Compact JWS, `alg: EdDSA`, `kid` in the header. Lives 7 days (`exp`) with 14 days of
offline grace (`grace_until`). Modules verify the signature, `aud` (product slug) and
`bind` (domain, install dir, instance id). **Only a validly signed negative status**
(`suspended`, `terminated`, `expired`, `reissue_required`) reduces what an install may
do; a timeout, 5xx or unsigned error never does.

## Operating

```bash
npm test                 # 37 tests on PGlite (a real in-process Postgres)
npm run typecheck && npm run lint && npm run build
DATABASE_URL=… npm run db:migrate   # idempotent; apply before deploying schema changes
node scripts/keygen.mjs <kid> <dir> # new signing key (rotation)
```

Environment: see `.env.example`. The signing key's offline copy lives outside the
repo; Vercel cannot show a sensitive variable back.

**Key rotation:** generate the next key, add its public key to every module's bundled
key set and to `LICENSE_PUBLIC_KEYS`, ship those module releases, then switch
`LICENSE_SIGNING_KEY`/`LICENSE_SIGNING_KID`. Tokens signed by the old key keep
verifying for as long as modules still bundle it.
