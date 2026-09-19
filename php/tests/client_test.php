<?php
/**
 * ShrotiLicensing client tests. Run: php php/tests/client_test.php
 * Builds a copy of the client with a throwaway key, then drives evaluate()
 * through every licence decision with forged, expired and valid tokens.
 */
error_reporting(E_ALL);
$root = dirname(__DIR__, 2);
$kp = sodium_crypto_sign_keypair();
$sk = sodium_crypto_sign_secretkey($kp);
$pk = sodium_crypto_sign_publickey($kp);
$b64u = function ($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); };

$xcheck = json_decode(shell_exec('cd ' . escapeshellarg($root) . ' && node --experimental-strip-types --no-warnings scripts/crosscheck-token.mjs'), true);
$tmp = sys_get_temp_dir() . '/shl_client_test_' . getmypid() . '.php';
passthru('cd ' . escapeshellarg($root) . ' && node scripts/build-php-client.mjs "Shl\\\\Test" ' . escapeshellarg($tmp) . ' --keys test-1=' . $b64u($pk) . ',' . $xcheck['kid'] . '=' . $xcheck['x'] . ' > /dev/null');
require $tmp;
unlink($tmp);
use Shl\Test\ShrotiLicensing as C;

$store = [];
$get = function ($k) use (&$store) { return isset($store[$k]) ? $store[$k] : ''; };
$set = function ($k, $v) use (&$store) { $store[$k] = $v; };
C::overrideEnvironment(['domain' => 'https://www.portal.shrotihost.in/', 'dir' => '/home/shrotihost/portal.shrotihost.in']);
$PRODUCT = 'shrotihost-whatsapp-manager-whmcs';

function sign_token(array $claims, $sk, $b64u, $kid = 'test-1', $typ = 'shl-entitlement+jwt') {
    $h = $b64u(json_encode(['alg' => 'EdDSA', 'kid' => $kid, 'typ' => $typ]));
    $p = $b64u(json_encode($claims));
    return $h . '.' . $p . '.' . $b64u(sodium_crypto_sign_detached($h . '.' . $p, $sk));
}
function claims(array $over = []) {
    $now = time();
    return array_replace_recursive([
        'iss' => 'licensing.shrotihost.in', 'aud' => 'shrotihost-whatsapp-manager-whmcs', 'sub' => 'lic_1',
        'iat' => $now, 'nbf' => $now - 60, 'exp' => $now + 7 * 86400, 'grace_until' => $now + 21 * 86400,
        'jti' => bin2hex(random_bytes(8)), 'status' => 'active', 'plan' => 'standard', 'features' => [], 'limits' => [],
        'bind' => ['domain' => 'portal.shrotihost.in', 'install_dir' => '/home/shrotihost/portal.shrotihost.in', 'instance_id' => 'shl_in_1'],
    ], $over);
}

$pass = 0; $fail = 0;
function check($name, $cond) { global $pass, $fail; if ($cond) { $pass++; echo "ok - $name\n"; } else { $fail++; echo "NOT OK - $name\n"; } }
function fresh(array $claims = null, $token = null) {
    global $store, $get, $set, $sk, $b64u, $PRODUCT;
    $store = ['_shl_instance_id' => 'shl_in_1', '_shl_install_token' => 'raw:t', '_shl_install_secret' => 'raw:s'];
    $store['_shl_entitlement'] = $token !== null ? $token : sign_token($claims ?: claims(), $sk, $b64u);
    return new C($PRODUCT, '2.1', $get, $set);
}

$s = fresh()->state();
check('a valid token is active', $s['licensed'] === true && $s['status'] === 'active');

$c = claims(['exp' => time() - 3600, 'grace_until' => time() + 5 * 86400]);
$s = fresh($c)->state();
check('past exp but inside grace keeps working, with a warning', $s['licensed'] === true && $s['status'] === 'grace');

$c = claims(['iat' => time() - 30 * 86400, 'exp' => time() - 20 * 86400, 'grace_until' => time() - 86400]);
$s = fresh($c)->state();
check('past grace is lapsed (queue-only), not licensed', $s['licensed'] === false && $s['status'] === 'lapsed');

$t = sign_token(claims(), $sk, $b64u);
$parts = explode('.', $t);
$p = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
$p['exp'] = time() + 999 * 86400;
$forged = $parts[0] . '.' . $b64u(json_encode($p)) . '.' . $parts[2];
$s = fresh(null, $forged)->state();
check('editing the stored token (extending exp) makes it invalid, never active', $s['licensed'] === false && $s['status'] === 'invalid');

$other = sodium_crypto_sign_keypair();
$s = fresh(null, sign_token(claims(), sodium_crypto_sign_secretkey($other), $b64u))->state();
check('a token from a fake server (other key, our kid) is invalid', $s['status'] === 'invalid');

$s = fresh(null, sign_token(claims(), $sk, $b64u, 'unknown-kid'))->state();
check('an unknown kid is invalid', $s['status'] === 'invalid');

$s = fresh(null, '{"status":"active","valid":true}')->state();
check('v1-style plain JSON state is invalid (the forged runtime-state.json bypass)', $s['status'] === 'invalid' && !$s['licensed']);

$s = fresh(claims(['aud' => 'social-proof-premium']))->state();
check("another product's licence does not unlock this one", $s['status'] === 'invalid');

$s = fresh(claims(['bind' => ['instance_id' => 'shl_in_OTHER']]))->state();
check("another install's token does not unlock this one", $s['status'] === 'invalid');

$s = fresh(claims(['bind' => ['domain' => 'staging.example.com']]))->state();
check('a database copied to another domain reads as moved, not active', $s['status'] === 'moved' && !$s['licensed']);

$s = fresh(null, sign_token(claims(), $sk, $b64u, 'test-1', 'shl-manifest+jwt'))->state();
check('a signed manifest cannot be replayed as an entitlement (typ check)', $s['status'] === 'invalid');

foreach (['suspended', 'terminated', 'expired', 'reissue_required'] as $neg) {
    $s = fresh(claims(['status' => $neg, 'grace_until' => time() + 7 * 86400]))->state();
    check("a signed '$neg' is enforced", $s['status'] === $neg && !$s['licensed']);
}

$c = claims(['iat' => time() - 10 * 86400, 'exp' => time() - 3 * 86400, 'grace_until' => time() + 86400]);
$lic = fresh($c);
$store['_shl_watermark'] = (string) (time() + 2 * 86400); // this install has already seen a later time
$s = $lic->state();
check('a clock rolled back cannot un-expire a grace period (watermark wins)', $s['status'] === 'lapsed');

$store = [];
$s = (new C($PRODUCT, '2.1', $get, $set))->state();
check('no activation is inactive', $s['status'] === 'inactive' && !$s['licensed']);

$store = ['_shl_instance_id' => 'shl_in_xcheck', '_shl_entitlement' => $xcheck['token']];
$s = (new C($PRODUCT, '2.1', $get, $set))->state();
check('a token signed by the Node server verifies in PHP (cross-language)', $s['status'] === 'active', $s);

check('domain normalisation matches the server', C::normalizeDomain('HTTPS://WWW.Portal.ShrotiHost.in:443/whmcs/?x=1') === 'portal.shrotihost.in');
check('dir normalisation matches the server', C::normalizeDir('/home/x//whmcs/') === '/home/x/whmcs' && C::normalizeDir('C:\\www\\whmcs\\') === 'C:/www/whmcs');
check('package hash check', C::verifyPackage('abc', hash('sha256', 'abc')) && !C::verifyPackage('abd', hash('sha256', 'abc')));

echo "\n# pass $pass\n# fail $fail\n";
exit($fail === 0 ? 0 : 1);
