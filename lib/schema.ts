export const SCHEMA_SQL = `-- ShrotiHost Licensing Server — schema.
--
-- Idempotent: every statement is IF NOT EXISTS, so applying it twice is safe
-- and an upgrade is "apply the file again". Nothing here ever drops data.
--
-- Ids are INTEGER identities, not BIGSERIAL: int8 comes back from the driver
-- as a string, and every comparison against a number would be a latent bug.

-- ── Products ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug                      TEXT NOT NULL UNIQUE,
  name                      TEXT NOT NULL,
  key_prefix                TEXT NOT NULL DEFAULT 'SHROTI',
  -- Which parts of an install a licence is bound to.
  lock_domain               BOOLEAN NOT NULL DEFAULT true,
  lock_dir                  BOOLEAN NOT NULL DEFAULT true,
  default_max_installations INTEGER NOT NULL DEFAULT 1,
  -- Entitlement token lifetime and the offline grace that follows it.
  token_ttl_hours           INTEGER NOT NULL DEFAULT 168,
  grace_hours               INTEGER NOT NULL DEFAULT 336,
  features                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  limits                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Licences ────────────────────────────────────────────────────────────────
-- The plaintext key is never stored. key_hash = sha256(lower(trim(key))), the
-- same normalisation the old licence server used, so existing hashes carry over.
-- WHMCS holds the plaintext for the customer; this server only recognises it.
CREATE TABLE IF NOT EXISTS licenses (
  id                        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id                INTEGER NOT NULL REFERENCES products(id),
  key_hash                  TEXT NOT NULL UNIQUE,
  key_hint                  TEXT NOT NULL,           -- "SHROTI-WM-…-7K2Q", for humans
  status                    TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','suspended','terminated')),
  status_reason             TEXT,
  plan                      TEXT NOT NULL DEFAULT 'standard',
  max_installations         INTEGER NOT NULL DEFAULT 1,   -- -1 = unlimited
  features                  JSONB,                        -- NULL = product default
  limits                    JSONB,                        -- NULL = product default
  -- NULL = lifetime. A passed subscription date reads as "expired" without a
  -- status write, so an expiry never depends on a cron having run.
  subscription_expires_at   TIMESTAMPTZ,
  support_expires_at        TIMESTAMPTZ,
  updates_expires_at        TIMESTAMPTZ,
  reissues_used             INTEGER NOT NULL DEFAULT 0,
  whmcs_service_id          INTEGER,
  whmcs_client_id           INTEGER,
  whmcs_order_id            INTEGER,
  client_name               TEXT,
  client_email              TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS licenses_whmcs_service_uq ON licenses (whmcs_service_id) WHERE whmcs_service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS licenses_product_status_idx ON licenses (product_id, status);

-- ── Activations ─────────────────────────────────────────────────────────────
-- One row per install. The install token authenticates it (stored hashed);
-- the install secret keys its request HMAC, so it has to be recoverable and is
-- stored encrypted with SERVER_SECRET instead.
--
-- A reissue marks rows 'revoked' rather than deleting them: a revoked install
-- can still authenticate, which is how it receives a *signed* instruction to
-- re-activate instead of an unsigned 401 it is right to ignore.
CREATE TABLE IF NOT EXISTS activations (
  id                        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  license_id                INTEGER NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  instance_id               TEXT NOT NULL UNIQUE,
  status                    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','released','revoked')),
  domain                    TEXT NOT NULL,
  install_dir               TEXT NOT NULL,
  ip                        TEXT,
  software_version          TEXT,
  php_version               TEXT,
  whmcs_version             TEXT,
  install_token_hash        TEXT NOT NULL UNIQUE,
  install_secret_enc        TEXT NOT NULL,
  last_heartbeat_at         TIMESTAMPTZ,
  last_ip                   TEXT,
  last_clock_skew_seconds   INTEGER,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at                  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS activations_license_status_idx ON activations (license_id, status);

-- ── Entitlement tokens ──────────────────────────────────────────────────────
-- An issuance ledger. The tokens themselves are verified offline by the
-- module; this is for audit and for answering "what did we tell that install".
CREATE TABLE IF NOT EXISTS entitlement_tokens (
  jti                       TEXT PRIMARY KEY,
  license_id                INTEGER NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  activation_id             INTEGER REFERENCES activations(id) ON DELETE SET NULL,
  kid                       TEXT NOT NULL,
  status                    TEXT NOT NULL,
  issued_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at                TIMESTAMPTZ NOT NULL,
  grace_until               TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS entitlement_tokens_license_idx ON entitlement_tokens (license_id, issued_at DESC);

-- ── Blacklist ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blacklist (
  id                        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind                      TEXT NOT NULL CHECK (kind IN ('license','domain','ip')),
  value                     TEXT NOT NULL,
  reason                    TEXT,
  active                    BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, value)
);

-- ── Releases ────────────────────────────────────────────────────────────────
-- Packages live here, not in object storage: every module zip is under 1 MB,
-- and one store is one thing to back up. The manifest is signed at upload with
-- the same key as entitlements, so a module can prove a package is ours
-- before it offers it to an admin.
CREATE TABLE IF NOT EXISTS releases (
  id                        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id                INTEGER NOT NULL REFERENCES products(id),
  version                   TEXT NOT NULL,
  channel                   TEXT NOT NULL DEFAULT 'stable' CHECK (channel IN ('stable','beta')),
  changelog                 TEXT NOT NULL DEFAULT '',
  is_security               BOOLEAN NOT NULL DEFAULT false,
  min_php                   TEXT,
  min_whmcs                 TEXT,
  filename                  TEXT NOT NULL,
  package                   BYTEA NOT NULL,
  package_size              INTEGER NOT NULL,
  package_sha256            TEXT NOT NULL,
  manifest_jws              TEXT NOT NULL,
  published                 BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, version, channel)
);

-- ── Download tokens ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS download_tokens (
  token_hash                TEXT PRIMARY KEY,
  release_id                INTEGER NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  license_id                INTEGER NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  activation_id             INTEGER REFERENCES activations(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at                TIMESTAMPTZ NOT NULL,
  used_at                   TIMESTAMPTZ,
  used_ip                   TEXT
);

-- ── Replay protection ───────────────────────────────────────────────────────
-- A nonce is remembered for longer than the timestamp window it is checked
-- in, so a replay inside the window always meets its own first use.
CREATE TABLE IF NOT EXISTS request_nonces (
  scope                     TEXT NOT NULL,
  nonce                     TEXT NOT NULL,
  seen_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, nonce)
);
CREATE INDEX IF NOT EXISTS request_nonces_seen_idx ON request_nonces (seen_at);

-- ── Events: audit trail and security signals in one place ───────────────────
CREATE TABLE IF NOT EXISTS events (
  id                        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind                      TEXT NOT NULL,
  severity                  TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  license_id                INTEGER REFERENCES licenses(id) ON DELETE SET NULL,
  activation_id             INTEGER REFERENCES activations(id) ON DELETE SET NULL,
  actor                     TEXT,
  ip                        TEXT,
  detail                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_created_idx ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS events_license_idx ON events (license_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_kind_idx ON events (kind, created_at DESC);
`;
