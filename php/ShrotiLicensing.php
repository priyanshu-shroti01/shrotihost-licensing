<?php
/**
 * ShrotiHost Licensing client — shared by every ShrotiHost WHMCS module.
 *
 * GENERATED COPY. The source is php/ShrotiLicensing.php in the
 * shrotihost-licensing repo; each module gets its own copy under its own
 * namespace (__NS__), so two modules shipping different client versions can
 * never load each other's class.
 *
 * What it guarantees:
 *  - The only licence state it trusts is an Ed25519-signed entitlement token,
 *    re-verified on EVERY read with public keys compiled into this file. Editing
 *    the stored token, the database row, or pointing the licence hostname at a
 *    fake server produces "invalid", never "active".
 *  - Network trouble is never a licence decision. Timeouts, 5xx, 429 and
 *    unsigned errors keep the current state; only a validly signed negative
 *    status (suspended / terminated / expired / reissue_required) is enforced.
 *  - Offline grace is computed from the token's own exp/grace_until (7 + 14
 *    days), not from "last successful check", so it cannot be stretched.
 *  - A clock rolled backwards cannot extend a licence: time is max(now, the
 *    latest time this install has already observed).
 *  - Binding uses WHMCS's SystemURL and ROOTDIR, which are identical in web
 *    requests and in cron. (v1 used HTTP_HOST / SERVER_ADDR, which differ between
 *    the two, so web and cron kept invalidating each other's cache.)
 */

namespace __NS__;

class ShrotiLicensing
{
    const CLIENT_VERSION = '2.0.0';
    const BASE_URL = 'https://licensing.shrotihost.in';
    const ISSUER = 'licensing.shrotihost.in';

    /** kid => raw Ed25519 public key (base64url). Current key + the next rotation key. */
    const PUBLIC_KEYS = [
        'shl-2026-09' => 'BYr8VFio0MqGdQ00RmnizpImGgAABO1kwz-vhf9Q19c',
        'shl-2027-03' => 'qrtTmhOoYlA3KLjzvEpidcQAd26qtiCZzplfxEEYTgM',
    ];

    /** Heartbeat once a day; sooner if the token is close to expiry. */
    const HEARTBEAT_EVERY = 20 * 3600;
    /** After a failed call, wait this long before trying again (web requests never retry faster). */
    const RETRY_AFTER_FAILURE = 15 * 60;
    const CLOCK_TOLERANCE = 300;

    /** @var string */
    private $product;
    /** @var string */
    private $softwareVersion;
    /** @var callable(string):string */
    private $get;
    /** @var callable(string,string):void */
    private $set;
    /** @var string */
    private $prefix;
    /** @var array|null */
    private $memo = null;

    /**
     * @param string   $product         product slug on the licensing server
     * @param string   $softwareVersion this module's version
     * @param callable $get             fn(string $key): string   — module setting storage
     * @param callable $set             fn(string $key, string $value): void
     * @param string   $prefix          storage key prefix
     */
    public function __construct($product, $softwareVersion, callable $get, callable $set, $prefix = '_shl_')
    {
        $this->product = (string) $product;
        $this->softwareVersion = (string) $softwareVersion;
        $this->get = $get;
        $this->set = $set;
        $this->prefix = (string) $prefix;
    }

    /* ───────────────────────────── public API ───────────────────────────── */

    /**
     * The licence as this install should act on it. No network, ever.
     *
     * Returns:
     *   licensed        bool   — may the module operate
     *   status          active | grace | lapsed | inactive | invalid | moved |
     *                   suspended | terminated | expired | reissue_required
     *   message         string — for the admin
     *   claims          array  — verified token claims (empty when none)
     *   grace_until     int|null, expires_at int|null, days_left int|null
     */
    public function state()
    {
        if ($this->memo !== null) {
            return $this->memo;
        }
        return $this->memo = $this->evaluate();
    }

    /** True when the module may operate (active, or inside offline grace). */
    public function licensed()
    {
        $s = $this->state();
        return !empty($s['licensed']);
    }

    /**
     * Activate with a licence key. The one call that fails closed: without a
     * valid answer from the server there is nothing to trust.
     *
     * @return array ['ok' => bool, 'message' => string, 'state' => array]
     */
    public function activate($licenseKey)
    {
        $licenseKey = trim((string) $licenseKey);
        if ($licenseKey === '') {
            return ['ok' => false, 'message' => 'Enter your licence key.', 'state' => $this->state()];
        }
        if (!self::sodiumAvailable()) {
            return ['ok' => false, 'message' => 'The PHP sodium extension is required for licence verification. Ask your host to enable it.', 'state' => $this->state()];
        }
        $res = $this->request('POST', '/api/activate', [
            'license_key' => $licenseKey,
            'product' => $this->product,
            'domain' => self::siteDomain(),
            'install_dir' => self::installDir(),
            'software_version' => $this->softwareVersion,
            'php_version' => PHP_VERSION,
            'whmcs_version' => self::whmcsVersion(),
        ], false);

        if (!$res['ok']) {
            $this->put('last_error', $res['message']);
            return ['ok' => false, 'message' => $res['message'], 'state' => $this->state()];
        }
        $d = $res['data'];
        $claims = $this->verifyToken(isset($d['entitlement']) ? (string) $d['entitlement'] : '', isset($d['instance_id']) ? (string) $d['instance_id'] : '');
        if ($claims === null || empty($d['install_token']) || empty($d['install_secret'])) {
            // A 200 we cannot verify is exactly what a fake server sends.
            $this->put('last_error', 'The licensing server response could not be verified.');
            return ['ok' => false, 'message' => 'The licensing server response could not be verified.', 'state' => $this->state()];
        }
        $this->put('instance_id', (string) $d['instance_id']);
        $this->put('install_token', self::protect((string) $d['install_token']));
        $this->put('install_secret', self::protect((string) $d['install_secret']));
        $this->put('key_hash', hash('sha256', strtolower($licenseKey)));
        $this->storeToken((string) $d['entitlement'], isset($d['server_time']) ? (int) $d['server_time'] : 0);
        $this->put('last_error', '');
        $s = $this->state();
        return ['ok' => !empty($s['licensed']), 'message' => $s['message'], 'state' => $s];
    }

    /** Whether the stored activation belongs to this key (so a changed key re-activates). */
    public function activatedFor($licenseKey)
    {
        $h = $this->get('key_hash');
        return $h !== '' && hash_equals($h, hash('sha256', strtolower(trim((string) $licenseKey))));
    }

    /**
     * Refresh the entitlement if due. Safe to call on every cron run: it only
     * talks to the server when a heartbeat is due, and never faster than
     * RETRY_AFTER_FAILURE after a failure.
     *
     * @return array ['called' => bool, 'ok' => bool, 'message' => string]
     */
    public function heartbeat($force = false)
    {
        if ($this->get('instance_id') === '' || $this->get('install_token') === '') {
            return ['called' => false, 'ok' => false, 'message' => 'Not activated.'];
        }
        $now = time();
        if (!$force && !$this->heartbeatDue($now)) {
            return ['called' => false, 'ok' => true, 'message' => 'Not due.'];
        }
        $this->put('last_attempt', (string) $now);
        $res = $this->request('POST', '/api/heartbeat', [
            'domain' => self::siteDomain(),
            'install_dir' => self::installDir(),
            'software_version' => $this->softwareVersion,
            'php_version' => PHP_VERSION,
            'whmcs_version' => self::whmcsVersion(),
            'client_time' => $now,
        ], true);
        if (!$res['ok']) {
            // Never a licence decision: keep the current token, record why.
            $this->put('last_error', $res['message']);
            return ['called' => true, 'ok' => false, 'message' => $res['message']];
        }
        $d = $res['data'];
        $token = isset($d['entitlement']) ? (string) $d['entitlement'] : '';
        $claims = $this->verifyToken($token, $this->get('instance_id'));
        if ($claims === null) {
            $this->put('last_error', 'The licensing server response could not be verified.');
            return ['called' => true, 'ok' => false, 'message' => 'The licensing server response could not be verified.'];
        }
        $this->storeToken($token, isset($d['server_time']) ? (int) $d['server_time'] : 0);
        $this->put('last_success', (string) $now);
        $this->put('last_error', '');
        return ['called' => true, 'ok' => true, 'message' => $this->state()['message']];
    }

    /** Release this install's seat and forget the activation. */
    public function deactivate()
    {
        $res = ['ok' => true];
        if ($this->get('install_token') !== '') {
            $res = $this->request('POST', '/api/deactivate', [], true);
        }
        foreach (['instance_id', 'install_token', 'install_secret', 'entitlement', 'key_hash', 'last_success', 'last_attempt', 'last_error', 'update'] as $k) {
            $this->put($k, '');
        }
        $this->memo = null;
        return ['ok' => $res['ok'], 'message' => $res['ok'] ? 'Licence deactivated on this installation.' : $res['message']];
    }

    /** Forget the local activation without calling the server (licence key cleared). */
    public function forget()
    {
        foreach (['instance_id', 'install_token', 'install_secret', 'entitlement', 'key_hash', 'last_success', 'last_attempt', 'last_error', 'update'] as $k) {
            $this->put($k, '');
        }
        $this->memo = null;
    }

    /**
     * Ask the server whether a newer release exists. The manifest is verified
     * before anything is recorded, so a spoofed server cannot advertise a
     * package — and the package itself is checked against the manifest's sha256
     * by verifyPackage() before an admin is ever offered it.
     *
     * @return array ['ok'=>bool, 'available'=>bool, 'eligible'=>bool, 'release'=>array, 'message'=>string]
     */
    public function checkForUpdate($channel = 'stable')
    {
        if ($this->get('install_token') === '') {
            return ['ok' => false, 'available' => false, 'eligible' => false, 'release' => [], 'message' => 'Not activated.'];
        }
        $res = $this->request('POST', '/api/updates/check', ['current_version' => $this->softwareVersion, 'channel' => $channel], true);
        if (!$res['ok']) {
            return ['ok' => false, 'available' => false, 'eligible' => false, 'release' => [], 'message' => $res['message']];
        }
        $d = $res['data'];
        if (empty($d['available'])) {
            $this->put('update', '');
            return ['ok' => true, 'available' => false, 'eligible' => false, 'release' => [], 'message' => 'You are on the latest version.'];
        }
        $manifest = $this->verifyManifest(isset($d['manifest']) ? (string) $d['manifest'] : '');
        if ($manifest === null || !isset($d['release']['version']) || $manifest['version'] !== (string) $d['release']['version']) {
            return ['ok' => false, 'available' => false, 'eligible' => false, 'release' => [], 'message' => 'The update manifest could not be verified.'];
        }
        $info = [
            'version' => $manifest['version'],
            'is_security' => !empty($manifest['is_security']),
            'package_sha256' => $manifest['package_sha256'],
            'filename' => $manifest['filename'],
            'released_at' => $manifest['released_at'],
            'changelog' => isset($d['release']['changelog']) ? (string) $d['release']['changelog'] : '',
            'eligible' => !empty($d['eligible']),
            'checked_at' => time(),
        ];
        $this->put('update', json_encode($info));
        return ['ok' => true, 'available' => true, 'eligible' => $info['eligible'], 'release' => $info, 'message' => 'Version ' . $info['version'] . ' is available.'];
    }

    /** The last verified update notice, if any, and only if it is newer than this version. */
    public function pendingUpdate()
    {
        $raw = $this->get('update');
        $info = $raw !== '' ? json_decode($raw, true) : null;
        if (!is_array($info) || empty($info['version']) || version_compare((string) $info['version'], $this->softwareVersion, '<=')) {
            return null;
        }
        return $info;
    }

    /** One-time, 15-minute download URL for the latest (or given) version. */
    public function downloadUrl($version = null)
    {
        $res = $this->request('POST', '/api/updates/download', $version ? ['version' => (string) $version] : [], true);
        if (!$res['ok']) {
            return ['ok' => false, 'message' => $res['message']];
        }
        $manifest = $this->verifyManifest(isset($res['data']['manifest']) ? (string) $res['data']['manifest'] : '');
        if ($manifest === null) {
            return ['ok' => false, 'message' => 'The update manifest could not be verified.'];
        }
        return ['ok' => true, 'url' => (string) $res['data']['url'], 'expires_at' => (string) $res['data']['expires_at'], 'package_sha256' => $manifest['package_sha256'], 'version' => $manifest['version']];
    }

    /** Check downloaded bytes against a verified manifest hash. */
    public static function verifyPackage($bytes, $expectedSha256)
    {
        return is_string($bytes) && $bytes !== '' && hash_equals(strtolower((string) $expectedSha256), hash('sha256', $bytes));
    }

    /** Diagnostics for the admin screen. No secrets. */
    public function diagnostics()
    {
        $s = $this->state();
        return [
            'status' => $s['status'],
            'instance_id' => $this->get('instance_id'),
            'bound_domain' => isset($s['claims']['bind']['domain']) ? $s['claims']['bind']['domain'] : '',
            'bound_dir' => isset($s['claims']['bind']['install_dir']) ? $s['claims']['bind']['install_dir'] : '',
            'this_domain' => self::siteDomain(),
            'this_dir' => self::installDir(),
            'expires_at' => $s['expires_at'],
            'grace_until' => $s['grace_until'],
            'last_success' => (int) $this->get('last_success'),
            'last_attempt' => (int) $this->get('last_attempt'),
            'last_error' => $this->get('last_error'),
            'signature' => isset($s['claims']['jti']) ? 'verified (Ed25519, key ' . $this->get('kid') . ')' : 'none',
            'client_version' => self::CLIENT_VERSION,
        ];
    }

    /* ───────────────────────────── evaluation ───────────────────────────── */

    private function evaluate()
    {
        $base = ['licensed' => false, 'claims' => [], 'grace_until' => null, 'expires_at' => null, 'days_left' => null];
        $token = $this->get('entitlement');
        if ($token === '' || $this->get('instance_id') === '') {
            return $base + ['status' => 'inactive', 'message' => 'Enter your licence key to activate this module.'];
        }
        if (!self::sodiumAvailable()) {
            return $base + ['status' => 'invalid', 'message' => 'The PHP sodium extension is required for licence verification.'];
        }
        $claims = $this->verifyToken($token, $this->get('instance_id'));
        if ($claims === null) {
            return $base + ['status' => 'invalid', 'message' => 'The stored licence could not be verified. Activate the licence again.'];
        }
        $base['claims'] = $claims;
        $base['expires_at'] = (int) $claims['exp'];
        $base['grace_until'] = (int) $claims['grace_until'];

        $negative = [
            'suspended' => 'This licence is suspended. Contact ShrotiHost support.',
            'terminated' => 'This licence has been terminated.',
            'expired' => 'This licence has expired. Renew it in your ShrotiHost client area.',
            'reissue_required' => 'This licence must be activated again on this installation.',
        ];
        if (isset($negative[$claims['status']])) {
            $msg = !empty($claims['reason']) && $claims['status'] === 'reissue_required' ? (string) $claims['reason'] : $negative[$claims['status']];
            return array_merge($base, ['status' => $claims['status'], 'message' => $msg]);
        }
        if ($claims['status'] !== 'active') {
            return array_merge($base, ['status' => 'invalid', 'message' => 'Unrecognised licence status.']);
        }

        // Bound to this install? A database copied to another site or folder is
        // not this install, whatever its tables say.
        $bind = $claims['bind'];
        if (self::normalizeDomain((string) $bind['domain']) !== self::siteDomain() || self::normalizeDir((string) $bind['install_dir']) !== self::installDir()) {
            return array_merge($base, ['status' => 'moved', 'message' => 'This installation has moved to a new domain or folder. Activate the licence again here.']);
        }

        $now = $this->now();
        if ($now <= (int) $claims['exp']) {
            $base['days_left'] = (int) floor(((int) $claims['exp'] - $now) / 86400);
            return array_merge($base, ['licensed' => true, 'status' => 'active', 'message' => 'Licence active.']);
        }
        if ($now <= (int) $claims['grace_until']) {
            $base['days_left'] = (int) floor(((int) $claims['grace_until'] - $now) / 86400);
            return array_merge($base, [
                'licensed' => true,
                'status' => 'grace',
                'message' => 'The licensing server has not been reached since ' . gmdate('j M Y', (int) $claims['iat']) . '. The module keeps working for ' . max(0, $base['days_left']) . ' more day(s); check that this server can reach ' . self::BASE_URL . '.',
            ]);
        }
        return array_merge($base, ['status' => 'lapsed', 'message' => 'The licence could not be refreshed for over three weeks. Sending is paused until this server can reach ' . self::BASE_URL . '.']);
    }

    /** Current time, never earlier than a time this install has already observed. */
    private function now()
    {
        $t = time();
        $mark = (int) $this->get('watermark');
        if ($t + self::CLOCK_TOLERANCE < $mark) {
            return $mark;
        }
        // Persist coarsely (hourly) so checking a licence is not a write per request.
        if ($t > $mark + 3600) {
            $this->put('watermark', (string) $t);
        }
        return max($t, $mark);
    }

    private function heartbeatDue($now)
    {
        $lastAttempt = (int) $this->get('last_attempt');
        $lastSuccess = (int) $this->get('last_success');
        if ($lastAttempt > 0 && $lastAttempt > $lastSuccess && $now - $lastAttempt < self::RETRY_AFTER_FAILURE) {
            return false;
        }
        if ($now + self::CLOCK_TOLERANCE < (int) $this->get('watermark')) {
            return true; // clock went backwards: confirm with the server
        }
        $s = $this->state();
        if (!empty($s['expires_at']) && (int) $s['expires_at'] - $now < 2 * 86400) {
            return true;
        }
        return $now - $lastSuccess >= self::HEARTBEAT_EVERY;
    }

    private function storeToken($token, $serverTime)
    {
        $this->put('entitlement', $token);
        $parts = explode('.', $token);
        $h = json_decode((string) self::b64urlDecode($parts[0]), true);
        $this->put('kid', isset($h['kid']) ? (string) $h['kid'] : '');
        if ($serverTime > 0 && $serverTime > (int) $this->get('watermark')) {
            $this->put('watermark', (string) $serverTime);
        }
        $this->memo = null;
    }

    /* ─────────────────────────── crypto / tokens ─────────────────────────── */

    /**
     * Verify an entitlement JWS. Signature first (ignoring exp: expiry and grace
     * are applied separately, from the claims, by evaluate()), then issuer,
     * audience, and the instance binding.
     */
    private function verifyToken($jws, $instanceId)
    {
        $payload = self::verifyJws((string) $jws, 'shl-entitlement+jwt');
        if (!is_array($payload)) {
            return null;
        }
        foreach (['iss', 'aud', 'exp', 'grace_until', 'iat', 'status', 'bind', 'jti'] as $k) {
            if (!array_key_exists($k, $payload)) {
                return null;
            }
        }
        if ($payload['iss'] !== self::ISSUER || $payload['aud'] !== $this->product) {
            return null;
        }
        if (!is_array($payload['bind']) || !isset($payload['bind']['instance_id'], $payload['bind']['domain'], $payload['bind']['install_dir'])) {
            return null;
        }
        if ($instanceId === '' || !hash_equals((string) $instanceId, (string) $payload['bind']['instance_id'])) {
            return null;
        }
        return $payload;
    }

    private function verifyManifest($jws)
    {
        $m = self::verifyJws((string) $jws, 'shl-manifest+jwt');
        if (!is_array($m) || ($m['iss'] ?? '') !== self::ISSUER || ($m['product'] ?? '') !== $this->product) {
            return null;
        }
        if (empty($m['version']) || !preg_match('/^[0-9a-f]{64}$/', (string) ($m['package_sha256'] ?? ''))) {
            return null;
        }
        return $m;
    }

    /** @return array|null the payload, only when the signature verifies under a bundled key */
    public static function verifyJws($jws, $expectedTyp)
    {
        if (!self::sodiumAvailable()) {
            return null;
        }
        $parts = explode('.', (string) $jws);
        if (count($parts) !== 3) {
            return null;
        }
        $header = json_decode((string) self::b64urlDecode($parts[0]), true);
        if (!is_array($header) || ($header['alg'] ?? '') !== 'EdDSA' || ($header['typ'] ?? '') !== $expectedTyp) {
            return null;
        }
        $kid = isset($header['kid']) ? (string) $header['kid'] : '';
        if (!array_key_exists($kid, self::PUBLIC_KEYS)) {
            return null;
        }
        $pk = self::b64urlDecode(self::PUBLIC_KEYS[$kid]);
        $sig = self::b64urlDecode($parts[2]);
        if ($pk === false || strlen($pk) !== 32 || $sig === false || strlen($sig) !== 64) {
            return null;
        }
        try {
            if (!sodium_crypto_sign_verify_detached($sig, $parts[0] . '.' . $parts[1], $pk)) {
                return null;
            }
        } catch (\Throwable $e) {
            return null;
        }
        $payload = json_decode((string) self::b64urlDecode($parts[1]), true);
        return is_array($payload) ? $payload : null;
    }

    public static function sodiumAvailable()
    {
        return function_exists('sodium_crypto_sign_verify_detached');
    }

    private static function b64urlDecode($s)
    {
        $s = strtr((string) $s, '-_', '+/');
        $pad = strlen($s) % 4;
        if ($pad) {
            $s .= str_repeat('=', 4 - $pad);
        }
        return base64_decode($s, true);
    }

    /* ─────────────────────────────── transport ─────────────────────────────── */

    /**
     * @return array ['ok'=>bool, 'status'=>int, 'data'=>array, 'message'=>string, 'retryable'=>bool]
     */
    private function request($method, $path, array $body, $signed)
    {
        if (!function_exists('curl_init')) {
            return ['ok' => false, 'status' => 0, 'data' => [], 'message' => 'The PHP curl extension is required.', 'retryable' => true];
        }
        $raw = $body ? json_encode($body, JSON_UNESCAPED_SLASHES) : '{}';
        $headers = ['Content-Type: application/json', 'Accept: application/json', 'User-Agent: ShrotiLicensing/' . self::CLIENT_VERSION . ' (' . $this->product . ' ' . $this->softwareVersion . ')'];
        if ($signed) {
            $token = self::unprotect($this->get('install_token'));
            $secret = self::unprotect($this->get('install_secret'));
            if ($token === '' || $secret === '') {
                return ['ok' => false, 'status' => 0, 'data' => [], 'message' => 'Not activated.', 'retryable' => false];
            }
            $ts = (string) time();
            $nonce = rtrim(strtr(base64_encode(random_bytes(18)), '+/', '-_'), '=');
            $canonical = implode("\n", [$ts, $nonce, strtoupper($method), $path, hash('sha256', $raw)]);
            $headers[] = 'Authorization: Bearer ' . $token;
            $headers[] = 'X-SHL-Instance: ' . $this->get('instance_id');
            $headers[] = 'X-SHL-Timestamp: ' . $ts;
            $headers[] = 'X-SHL-Nonce: ' . $nonce;
            $headers[] = 'X-SHL-Signature: ' . hash_hmac('sha256', $canonical, $secret);
        }
        $ch = curl_init(self::BASE_URL . $path);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_POSTFIELDS => $raw,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        $resp = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($resp === false) {
            return ['ok' => false, 'status' => 0, 'data' => [], 'message' => 'Could not reach the licensing server: ' . $err, 'retryable' => true];
        }
        $data = json_decode((string) $resp, true);
        if (!is_array($data)) {
            return ['ok' => false, 'status' => $status, 'data' => [], 'message' => 'Unexpected response from the licensing server (HTTP ' . $status . ').', 'retryable' => true];
        }
        if ($status >= 200 && $status < 300) {
            return ['ok' => true, 'status' => $status, 'data' => $data, 'message' => '', 'retryable' => false];
        }
        $e = isset($data['error']) && is_array($data['error']) ? $data['error'] : [];
        return [
            'ok' => false,
            'status' => $status,
            'data' => $data,
            'message' => isset($e['message']) ? (string) $e['message'] : 'Licensing server error (HTTP ' . $status . ').',
            'retryable' => !empty($e['retryable']) || $status >= 500 || $status === 429,
            'code' => isset($e['code']) ? (string) $e['code'] : '',
        ];
    }

    /* ───────────────────────────── environment ───────────────────────────── */

    /** @var array|null test-only: ['domain' => ..., 'dir' => ...] */
    private static $environment = null;

    /** Test hook. Production code never calls this. */
    public static function overrideEnvironment($env)
    {
        self::$environment = is_array($env) ? $env : null;
    }

    /** The WHMCS System URL's host — the same in web requests and in cron. */
    public static function siteDomain()
    {
        if (self::$environment !== null) {
            return self::normalizeDomain(self::$environment['domain']);
        }
        $url = '';
        try {
            if (class_exists('\\WHMCS\\Config\\Setting')) {
                $url = (string) \WHMCS\Config\Setting::getValue('SystemURL');
            }
        } catch (\Throwable $e) {
            $url = '';
        }
        if ($url === '' && class_exists('\\WHMCS\\Database\\Capsule')) {
            try {
                $url = (string) \WHMCS\Database\Capsule::table('tblconfiguration')->where('setting', 'SystemURL')->value('value');
            } catch (\Throwable $e) {
                $url = '';
            }
        }
        return self::normalizeDomain($url);
    }

    public static function installDir()
    {
        if (self::$environment !== null) {
            return self::normalizeDir(self::$environment['dir']);
        }
        $dir = defined('ROOTDIR') ? ROOTDIR : dirname(__DIR__, 3);
        $real = realpath($dir);
        return self::normalizeDir($real !== false ? $real : $dir);
    }

    public static function whmcsVersion()
    {
        try {
            if (class_exists('\\WHMCS\\Config\\Setting')) {
                return (string) \WHMCS\Config\Setting::getValue('Version');
            }
        } catch (\Throwable $e) {
        }
        return '';
    }

    /** Must match normalizeDomain() in the server's lib/keys.ts. */
    public static function normalizeDomain($input)
    {
        $s = strtolower(trim((string) $input));
        $s = preg_replace('#^[a-z][a-z0-9+.-]*://#', '', $s);
        $s = preg_split('#[/?\#]#', $s)[0];
        $s = preg_replace('#:\d+$#', '', $s);
        $s = rtrim($s, '.');
        if (strpos($s, 'www.') === 0) {
            $s = substr($s, 4);
        }
        return $s;
    }

    /** Must match normalizeDir() in the server's lib/keys.ts. */
    public static function normalizeDir($input)
    {
        $s = str_replace('\\', '/', trim((string) $input));
        $s = preg_replace('#/{2,}#', '/', $s);
        if (strlen($s) > 1) {
            $s = rtrim($s, '/');
        }
        return $s;
    }

    /** Encrypt at rest with WHMCS's own key when available (it is, in web and cron). */
    private static function protect($value)
    {
        if (function_exists('encrypt')) {
            try {
                return 'enc:' . encrypt($value);
            } catch (\Throwable $e) {
            }
        }
        return 'raw:' . $value;
    }

    private static function unprotect($stored)
    {
        $stored = (string) $stored;
        if (strpos($stored, 'enc:') === 0 && function_exists('decrypt')) {
            try {
                return (string) decrypt(substr($stored, 4));
            } catch (\Throwable $e) {
                return '';
            }
        }
        if (strpos($stored, 'raw:') === 0) {
            return substr($stored, 4);
        }
        return '';
    }

    private function get($key)
    {
        return (string) call_user_func($this->get, $this->prefix . $key);
    }

    private function put($key, $value)
    {
        call_user_func($this->set, $this->prefix . $key, (string) $value);
        if ($key === 'entitlement' || $key === 'instance_id') {
            $this->memo = null;
        }
    }
}
