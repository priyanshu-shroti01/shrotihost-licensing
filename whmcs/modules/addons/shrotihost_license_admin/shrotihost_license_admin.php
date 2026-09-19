<?php
/**
 * ShrotiHost Licensing — WHMCS admin addon.
 *
 * Holds the licensing server credentials, and is where releases are published
 * and licences are overseen: overview, every managed service, releases (upload
 * a module zip → the server signs its manifest), and the server's audit and
 * security events. Also serves the public licence verification page.
 */

if (!defined('WHMCS')) {
    exit('This file cannot be accessed directly');
}

require_once ROOTDIR . '/modules/servers/shrotihost_license/shrotihost_license.php';

use ShrotiHost\WHMCS\Licensing\AdminClient;
use ShrotiHost\WHMCS\Licensing\LicenseService;
use ShrotiHost\WHMCS\Licensing\Settings;
use ShrotiHost\WHMCS\Licensing\Store;
use WHMCS\Database\Capsule;

function shrotihost_license_admin_config(): array
{
    return [
        'name' => 'ShrotiHost Licensing',
        'description' => 'Provision and manage licences for ShrotiHost WHMCS modules on the ShrotiHost Licensing Server.',
        'version' => '2.0.0',
        'author' => 'ShrotiHost',
        'language' => 'english',
        'fields' => [
            'BaseUrl' => ['FriendlyName' => 'Licensing Server URL', 'Type' => 'text', 'Size' => '60', 'Default' => Settings::DEFAULT_BASE_URL],
            'ApiKey' => ['FriendlyName' => 'Admin API Key', 'Type' => 'text', 'Size' => '40', 'Description' => 'ADMIN_API_KEY on the licensing server'],
            'ApiSecret' => ['FriendlyName' => 'Admin API Secret', 'Type' => 'password', 'Size' => '60', 'Description' => 'ADMIN_API_SECRET on the licensing server'],
            'PublicVerification' => ['FriendlyName' => 'Public Verification Page', 'Type' => 'yesno', 'Description' => 'index.php?m=shrotihost_license_admin&action=verify'],
            'VerificationRateLimit' => ['FriendlyName' => 'Verification Rate Limit', 'Type' => 'text', 'Size' => '5', 'Default' => '20', 'Description' => 'Lookups per IP per 10 minutes'],
            'RequestTimeout' => ['FriendlyName' => 'Request Timeout (s)', 'Type' => 'text', 'Size' => '5', 'Default' => '20'],
            'DefaultSubscriptionDays' => ['FriendlyName' => 'Fallback Days', 'Type' => 'text', 'Size' => '5', 'Default' => '365', 'Description' => 'Used by products in "fallback" mode with no day overrides'],
        ],
    ];
}

function shrotihost_license_admin_activate(): array
{
    try {
        Store::ensureSchema();
        shrotihost_license_bootstrap_mail_delivery();
        return ['status' => 'success', 'description' => 'ShrotiHost Licensing is ready. Enter the API key and secret, then open the module.'];
    } catch (\Throwable $e) {
        return ['status' => 'error', 'description' => $e->getMessage()];
    }
}

function shrotihost_license_admin_deactivate(): array
{
    // Tables are kept: they hold every service's licence mapping and audit trail.
    return ['status' => 'success', 'description' => 'Deactivated. Licence mappings and audit history were kept.'];
}

function shrotihost_license_admin_upgrade(array $vars): void
{
    Store::ensureSchema();
}

/* ─────────────────────────────── admin UI ─────────────────────────────── */

function shrotihost_license_admin_h($v): string
{
    return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
}

function shrotihost_license_admin_output(array $vars): void
{
    $link = $vars['modulelink'];
    $tab = preg_replace('/[^a-z]/', '', (string) ($_GET['tab'] ?? 'overview')) ?: 'overview';
    $flash = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (function_exists('check_token')) {
            check_token('WHMCS.admin.default');
        }
        $flash = shrotihost_license_admin_post((string) ($_POST['do'] ?? ''));
    }
    $h = 'shrotihost_license_admin_h';
    $tabs = ['overview' => 'Overview', 'services' => 'Services', 'releases' => 'Releases', 'events' => 'Server events', 'settings' => 'Connection'];
    $token = function_exists('generate_token') ? generate_token('form') : '';

    echo '<style>.shla-tabs{margin:0 0 18px}.shla-card{background:#fff;border:1px solid #e4e0ec;border-radius:12px;padding:18px;margin-bottom:18px}.shla-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.shla-stat{border:1px solid #e4e0ec;border-radius:10px;padding:12px}.shla-stat b{display:block;font-size:22px;color:#1b1523}.shla-stat span{font-size:12px;color:#7c7489;font-weight:600}.shla-logo{height:30px;margin:0 0 14px}.shla-mono{font-family:ui-monospace,Menlo,monospace;font-size:12px}.shla-ok{color:#0f7b3f;font-weight:700}.shla-bad{color:#b42318;font-weight:700}</style>';
    echo '<img class="shla-logo" src="../modules/addons/shrotihost_license_admin/logo.svg" alt="ShrotiHost">';
    echo '<ul class="nav nav-tabs shla-tabs">';
    foreach ($tabs as $k => $label) {
        echo '<li class="' . ($k === $tab ? 'active' : '') . '"><a href="' . $h($link . '&tab=' . $k) . '">' . $h($label) . '</a></li>';
    }
    echo '</ul>';
    echo $flash;

    try {
        switch ($tab) {
            case 'services':
                shrotihost_license_admin_services($link, $token);
                break;
            case 'releases':
                shrotihost_license_admin_releases($link, $token);
                break;
            case 'events':
                shrotihost_license_admin_events();
                break;
            case 'settings':
                shrotihost_license_admin_settings($link, $token);
                break;
            default:
                shrotihost_license_admin_overview();
        }
    } catch (\Throwable $e) {
        echo '<div class="alert alert-danger">' . $h($e->getMessage()) . '</div>';
    }
}

function shrotihost_license_admin_post(string $do): string
{
    $h = 'shrotihost_license_admin_h';
    $ok = function ($m) use ($h) {
        return '<div class="alert alert-success">' . $h($m) . '</div>';
    };
    $bad = function ($m) use ($h) {
        return '<div class="alert alert-danger">' . $h($m) . '</div>';
    };
    try {
        switch ($do) {
            case 'sync_products':
                $n = 0;
                $rows = Capsule::table('tblproducts')->where('servertype', 'shrotihost_license')->orderBy('id')->get();
                $seen = [];
                foreach ($rows as $r) {
                    $slug = trim((string) $r->configoption1);
                    if ($slug === '' || isset($seen[$slug])) {
                        continue;
                    }
                    $seen[$slug] = true;
                    $prefix = trim((string) $r->configoption7);
                    $max = trim((string) $r->configoption12);
                    AdminClient::fromSettings()->post('products', array_filter([
                        'slug' => $slug,
                        'name' => preg_replace('/\s+[–-]\s+.*$/u', '', (string) $r->name),
                        'key_prefix' => $prefix !== '' ? $prefix : null,
                        'default_max_installations' => ($max === '-1' || ctype_digit($max)) && $max !== '' && $max !== '0' ? (int) $max : null,
                    ], function ($v) {
                        return $v !== null;
                    }));
                    $n++;
                }
                return $ok("Synced $n product(s) to the licensing server.");
            case 'migrate_all':
                $ok_ = 0;
                $fail = [];
                foreach (LicenseService::managedServiceIds() as $sid) {
                    $map = Store::map($sid);
                    if (!$map || trim((string) $map['raw_license_key']) === '') {
                        continue; // never had a licence; nothing to migrate
                    }
                    if (shrotihost_license_reconcile_service($sid, ['trigger' => 'migrate_all'])) {
                        $ok_++;
                    } else {
                        $fail[] = '#' . $sid . ': ' . (Store::map($sid)['last_error_message'] ?? 'failed');
                    }
                }
                return ($fail ? $bad('Failed: ' . implode(' · ', $fail)) : '') . $ok("Registered or reconciled $ok_ service(s).");
            case 'reconcile':
                $sid = (int) ($_POST['service_id'] ?? 0);
                return shrotihost_license_reconcile_service($sid, ['trigger' => 'admin_addon', 'allow_create' => true])
                    ? $ok("Service #$sid reconciled.") : $bad("Service #$sid: " . (Store::map($sid)['last_error_message'] ?? 'failed'));
            case 'upload_release':
                $f = $_FILES['package'] ?? null;
                if (!$f || $f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
                    return $bad('Choose a zip file to upload.');
                }
                if ($f['size'] > 3 * 1024 * 1024) {
                    return $bad('The package must be under 3 MB.');
                }
                $bytes = (string) file_get_contents($f['tmp_name']);
                $rel = AdminClient::fromSettings()->post('releases', [
                    'product_slug' => (string) $_POST['product'],
                    'version' => trim((string) $_POST['version']),
                    'channel' => ($_POST['channel'] ?? '') === 'beta' ? 'beta' : 'stable',
                    'changelog' => (string) ($_POST['changelog'] ?? ''),
                    'is_security' => !empty($_POST['is_security']),
                    'min_php' => trim((string) ($_POST['min_php'] ?? '')),
                    'filename' => basename((string) $f['name']),
                    'package_b64' => base64_encode($bytes),
                ])['release'];
                Store::audit('release_upload', 'success', 'Published ' . $_POST['product'] . ' ' . $rel['version'] . ' (sha256 ' . $rel['package_sha256'] . ').');
                return $ok('Published v' . $rel['version'] . ' — SHA-256 ' . $rel['package_sha256']);
            case 'unpublish':
            case 'publish':
                AdminClient::fromSettings()->post('releases/' . (int) $_POST['release_id'] . '/' . $do);
                return $ok('Release ' . ($do === 'publish' ? 'published.' : 'withdrawn.'));
        }
    } catch (\Throwable $e) {
        return $bad($e->getMessage());
    }
    return '';
}

function shrotihost_license_admin_overview(): void
{
    $h = 'shrotihost_license_admin_h';
    $stats = AdminClient::fromSettings()->get('stats');
    $by = [];
    foreach ((array) $stats['licenses'] as $r) {
        $by[$r['slug']][$r['status']] = (int) $r['n'];
    }
    echo '<div class="shla-card"><div class="shla-grid">';
    echo '<div class="shla-stat"><span>Active installations</span><b>' . (int) $stats['activations']['active'] . '</b></div>';
    echo '<div class="shla-stat"><span>Silent &gt; 3 days</span><b>' . (int) $stats['activations']['stale'] . '</b></div>';
    echo '<div class="shla-stat"><span>Security events (7 days)</span><b>' . (int) $stats['security_events_7d'] . '</b></div>';
    echo '<div class="shla-stat"><span>Signing key</span><b class="shla-mono" style="font-size:14px">' . $h($stats['signing_kid']) . '</b></div>';
    echo '</div></div>';
    echo '<div class="shla-card"><h4>Licences by product</h4><table class="table"><tr><th>Product</th><th>Active</th><th>Suspended</th><th>Terminated</th><th>Latest release</th></tr>';
    $latest = [];
    foreach ((array) $stats['latest_releases'] as $r) {
        $latest[$r['product']] = $r['version'];
    }
    foreach ($by as $slug => $s) {
        echo '<tr><td>' . $h($slug) . '</td><td>' . (int) ($s['active'] ?? 0) . '</td><td>' . (int) ($s['suspended'] ?? 0) . '</td><td>' . (int) ($s['terminated'] ?? 0) . '</td><td>' . $h($latest[$slug] ?? '—') . '</td></tr>';
    }
    if (!$by) {
        echo '<tr><td colspan="5"><em>No licences on the server yet. Use Services → Register existing licences.</em></td></tr>';
    }
    echo '</table></div>';
}

function shrotihost_license_admin_services(string $link, string $token): void
{
    $h = 'shrotihost_license_admin_h';
    $rows = Capsule::table('tblhosting as h')->join('tblproducts as p', 'p.id', '=', 'h.packageid')
        ->leftJoin('tblclients as c', 'c.id', '=', 'h.userid')
        ->leftJoin(Store::MAP . ' as m', 'm.service_id', '=', 'h.id')
        ->where('p.servertype', 'shrotihost_license')
        ->orderBy('h.id', 'desc')
        ->select(['h.id', 'h.domainstatus', 'p.name', 'c.firstname', 'c.lastname', 'c.companyname', 'h.userid', 'm.license_server', 'm.remote_status', 'm.key_hint', 'm.activation_count', 'm.last_successful_sync_at', 'm.sync_health', 'm.last_error_message', 'm.raw_license_key'])
        ->get();
    $pendingMigration = 0;
    foreach ($rows as $r) {
        if (($r->license_server ?? '') !== 'synced' && trim((string) $r->raw_license_key) !== '') {
            $pendingMigration++;
        }
    }
    echo '<div class="shla-card"><form method="post" style="display:inline">' . $token . '<input type="hidden" name="do" value="sync_products"><button class="btn btn-default">Sync products to server</button></form> ';
    echo '<form method="post" style="display:inline" onsubmit="return confirm(\'Register every existing licence key on the licensing server and reconcile status, dates and seats with WHMCS?\')">' . $token . '<input type="hidden" name="do" value="migrate_all"><button class="btn btn-primary">Register existing licences (' . $pendingMigration . ' pending) &amp; reconcile all</button></form></div>';
    echo '<div class="shla-card"><table class="table table-condensed"><tr><th>Service</th><th>Client</th><th>Product</th><th>WHMCS</th><th>Licence</th><th>Key</th><th>Installs</th><th>Last sync</th><th></th></tr>';
    foreach ($rows as $r) {
        $client = trim($r->firstname . ' ' . $r->lastname) ?: $r->companyname;
        $lic = ($r->license_server ?? '') === 'synced' ? $h($r->remote_status) : (trim((string) $r->raw_license_key) !== '' ? '<em>not registered yet</em>' : '<em>none</em>');
        $health = $r->sync_health === 'error' ? ' <span class="shla-bad" title="' . $h($r->last_error_message) . '">⚠</span>' : '';
        echo '<tr><td><a href="clientsservices.php?userid=' . (int) $r->userid . '&id=' . (int) $r->id . '">#' . (int) $r->id . '</a></td><td>' . $h($client) . '</td><td>' . $h($r->name) . '</td><td>' . $h($r->domainstatus) . '</td><td>' . $lic . $health . '</td><td class="shla-mono">' . $h($r->key_hint ?: '—') . '</td><td>' . (int) $r->activation_count . '</td><td>' . $h($r->last_successful_sync_at ?: '—') . '</td>';
        echo '<td><form method="post" style="margin:0">' . $token . '<input type="hidden" name="do" value="reconcile"><input type="hidden" name="service_id" value="' . (int) $r->id . '"><button class="btn btn-xs btn-default">Reconcile</button></form></td></tr>';
    }
    echo '</table></div>';
}

function shrotihost_license_admin_releases(string $link, string $token): void
{
    $h = 'shrotihost_license_admin_h';
    $products = (array) AdminClient::fromSettings()->get('products')['products'];
    $releases = (array) AdminClient::fromSettings()->get('releases')['releases'];
    echo '<div class="shla-card"><h4>Publish a release</h4><p class="text-muted">The server hashes the zip and signs a manifest with the licensing key. Installed modules only offer an update whose manifest signature and SHA-256 both verify. Versions are immutable — publish a new version rather than re-uploading.</p>';
    echo '<form method="post" enctype="multipart/form-data" class="form-horizontal">' . $token . '<input type="hidden" name="do" value="upload_release">';
    echo '<div class="form-group"><label class="col-sm-2 control-label">Product</label><div class="col-sm-6"><select name="product" class="form-control" required>';
    foreach ($products as $p) {
        echo '<option value="' . $h($p['slug']) . '">' . $h($p['name'] . ' (' . $p['slug'] . ')') . '</option>';
    }
    echo '</select></div></div>';
    echo '<div class="form-group"><label class="col-sm-2 control-label">Version</label><div class="col-sm-3"><input name="version" class="form-control" placeholder="2.1.0" required pattern="\d+(\.\d+){0,3}([-+][0-9A-Za-z.-]+)?"></div>';
    echo '<div class="col-sm-3"><select name="channel" class="form-control"><option value="stable">stable</option><option value="beta">beta</option></select></div></div>';
    echo '<div class="form-group"><label class="col-sm-2 control-label">Package (zip)</label><div class="col-sm-6"><input type="file" name="package" accept=".zip,application/zip" required></div></div>';
    echo '<div class="form-group"><label class="col-sm-2 control-label">Changelog</label><div class="col-sm-8"><textarea name="changelog" rows="5" class="form-control"></textarea></div></div>';
    echo '<div class="form-group"><label class="col-sm-2 control-label">Min PHP</label><div class="col-sm-2"><input name="min_php" class="form-control" placeholder="7.4"></div><div class="col-sm-4"><label class="checkbox-inline"><input type="checkbox" name="is_security" value="1"> Security release (offered even to lapsed update entitlements)</label></div></div>';
    echo '<div class="form-group"><div class="col-sm-offset-2 col-sm-6"><button class="btn btn-primary">Publish</button></div></div></form></div>';

    echo '<div class="shla-card"><h4>Releases</h4><table class="table table-condensed"><tr><th>Product</th><th>Version</th><th>Channel</th><th>Size</th><th>SHA-256</th><th>Released</th><th>Status</th><th></th></tr>';
    foreach ($releases as $r) {
        $do = $r['published'] ? 'unpublish' : 'publish';
        echo '<tr><td>' . $h($r['product']) . '</td><td><b>' . $h($r['version']) . '</b>' . ($r['is_security'] ? ' <span class="label label-danger">security</span>' : '') . '</td><td>' . $h($r['channel']) . '</td><td>' . number_format($r['package_size'] / 1024) . ' KB</td><td class="shla-mono" title="' . $h($r['package_sha256']) . '">' . $h(substr($r['package_sha256'], 0, 16)) . '…</td><td>' . $h(substr((string) $r['released_at'], 0, 10)) . '</td><td>' . ($r['published'] ? '<span class="shla-ok">published</span>' : 'withdrawn') . '</td>';
        echo '<td><form method="post" style="margin:0">' . $token . '<input type="hidden" name="do" value="' . $do . '"><input type="hidden" name="release_id" value="' . (int) $r['id'] . '"><button class="btn btn-xs btn-default">' . ($r['published'] ? 'Withdraw' : 'Publish') . '</button></form></td></tr>';
    }
    if (!$releases) {
        echo '<tr><td colspan="8"><em>No releases yet.</em></td></tr>';
    }
    echo '</table></div>';
}

function shrotihost_license_admin_events(): void
{
    $h = 'shrotihost_license_admin_h';
    $events = (array) AdminClient::fromSettings()->get('events', ['limit' => 200])['events'];
    echo '<div class="shla-card"><table class="table table-condensed"><tr><th>When (UTC)</th><th>Event</th><th>Severity</th><th>Licence</th><th>IP</th><th>Detail</th></tr>';
    foreach ($events as $e) {
        $sev = $e['severity'] === 'info' ? '' : ' class="' . ($e['severity'] === 'critical' ? 'danger' : 'warning') . '"';
        echo '<tr' . $sev . '><td>' . $h(str_replace('T', ' ', substr((string) $e['created_at'], 0, 19))) . '</td><td>' . $h($e['kind']) . '</td><td>' . $h($e['severity']) . '</td><td>' . ($e['license_id'] ? '#' . (int) $e['license_id'] : '—') . '</td><td>' . $h($e['ip'] ?: '—') . '</td><td class="shla-mono">' . $h(json_encode($e['detail'])) . '</td></tr>';
    }
    echo '</table></div>';
}

function shrotihost_license_admin_settings(string $link, string $token): void
{
    $h = 'shrotihost_license_admin_h';
    $s = Settings::addon();
    echo '<div class="shla-card"><table class="table"><tr><th style="width:220px">Server</th><td class="shla-mono">' . $h($s['base_url']) . '</td></tr>';
    echo '<tr><th>Admin API key</th><td>' . ($s['api_key'] !== '' ? '<span class="shla-ok">set</span>' : '<span class="shla-bad">missing</span>') . ' · secret ' . ($s['api_secret'] !== '' ? '<span class="shla-ok">set</span>' : '<span class="shla-bad">missing</span>') . ' — edit in Setup → Addon Modules</td></tr>';
    try {
        $t0 = microtime(true);
        $ping = AdminClient::fromSettings()->get('ping');
        $ms = (int) round((microtime(true) - $t0) * 1000);
        $skew = (int) $ping['server_time'] - time();
        echo '<tr><th>Connection</th><td><span class="shla-ok">OK</span> · ' . $ms . ' ms · clock skew ' . $skew . ' s' . (abs($skew) > 120 ? ' <span class="shla-bad">(fix NTP: requests are refused beyond 300 s)</span>' : '') . '</td></tr>';
    } catch (\Throwable $e) {
        echo '<tr><th>Connection</th><td><span class="shla-bad">' . $h($e->getMessage()) . '</span></td></tr>';
    }
    echo '</table></div>';
    echo '<div class="shla-card"><h4>Recent WHMCS-side activity</h4><table class="table table-condensed"><tr><th>When</th><th>Action</th><th>Status</th><th>Service</th><th>Message</th></tr>';
    foreach (Store::recentAudit(40) as $a) {
        echo '<tr><td>' . $h($a['created_at']) . '</td><td>' . $h($a['action']) . '</td><td>' . $h($a['status']) . '</td><td>' . ($a['service_id'] ? '#' . (int) $a['service_id'] : '—') . '</td><td>' . $h(mb_substr((string) $a['message'], 0, 200)) . '</td></tr>';
    }
    echo '</table></div>';
}

/* ─────────────────────── public verification page ─────────────────────── */

function shrotihost_license_admin_clientarea(array $vars): array
{
    $result = null;
    $error = '';
    $key = trim((string) ($_REQUEST['license_key'] ?? ''));
    $enabled = Settings::addon()['public_verification'];
    if ($enabled && $key !== '') {
        if (!shrotihost_license_admin_verify_rate_ok()) {
            $error = 'Too many lookups. Please try again in a few minutes.';
        } else {
            try {
                $lic = (array) AdminClient::fromSettings()->post('licenses/lookup', ['license_key' => $key])['license'];
                $result = [
                    'product' => (string) $lic['product_name'],
                    'status' => (string) $lic['effective_status'],
                    'issued' => substr((string) $lic['created_at'], 0, 10),
                    'hint' => (string) $lic['key_hint'],
                ];
            } catch (\Throwable $e) {
                $error = 'No ShrotiHost licence matches that key.';
            }
        }
    }
    return [
        'pagetitle' => 'Licence Verification',
        'breadcrumb' => ['index.php?m=shrotihost_license_admin&action=verify' => 'Licence Verification'],
        'templatefile' => 'public_verify',
        'requirelogin' => false,
        'forcessl' => true,
        'vars' => ['enabled' => $enabled, 'result' => $result, 'error' => $error, 'query' => $key],
    ];
}

function shrotihost_license_admin_verify_rate_ok(): bool
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    $key = 'shla_verify_' . substr(hash('sha256', $ip), 0, 24);
    $limit = Settings::addon()['verification_rate_limit'];
    $row = Capsule::table('tbltransientdata')->where('name', $key)->first();
    $n = $row && (int) $row->expires > time() ? (int) $row->data : 0;
    if ($n >= $limit) {
        return false;
    }
    Capsule::table('tbltransientdata')->updateOrInsert(['name' => $key], ['data' => (string) ($n + 1), 'expires' => $row && (int) $row->expires > time() ? (int) $row->expires : time() + 600]);
    return true;
}
