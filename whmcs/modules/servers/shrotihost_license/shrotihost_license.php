<?php
/**
 * ShrotiHost Licensing — WHMCS provisioning module.
 *
 * Provisions and manages licences for ShrotiHost's own WHMCS modules on the
 * ShrotiHost Licensing Server (https://licensing.shrotihost.in). WHMCS is the
 * authority: service status, due dates and seat counts here decide what the
 * licence is; the server records it and signs it for the installs.
 *
 * Source of truth: github.com/priyanshu-shroti01/shrotihost-licensing (whmcs/).
 */

if (!defined('WHMCS')) {
    exit('This file cannot be accessed directly');
}

require_once __DIR__ . '/lib/AdminClient.php';
require_once __DIR__ . '/lib/Settings.php';
require_once __DIR__ . '/lib/Lifecycle.php';
require_once __DIR__ . '/lib/Store.php';
require_once __DIR__ . '/lib/LicenseService.php';
require_once __DIR__ . '/lib/mail.php';
require_once __DIR__ . '/lib/whatsapp_addon.php';

use ShrotiHost\WHMCS\Licensing\AdminClient;
use ShrotiHost\WHMCS\Licensing\LicenseService;
use ShrotiHost\WHMCS\Licensing\Settings;
use ShrotiHost\WHMCS\Licensing\Store;
use WHMCS\Database\Capsule;

if (!function_exists('shrotihost_license_MetaData')) {

define('SHROTIHOST_LICENSE_MODULE_VERSION', '2.0.0');

function shrotihost_license_MetaData(): array
{
    return ['DisplayName' => 'ShrotiHost Licensing', 'APIVersion' => '1.1', 'RequiresServer' => false];
}

function shrotihost_license_ConfigOptions(): array
{
    return Settings::configOptions();
}

function shrotihost_license_TestConnection(array $params): array
{
    try {
        AdminClient::fromSettings()->get('ping');
        return ['success' => true, 'error' => ''];
    } catch (\Throwable $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

/** Run a lifecycle step; WHMCS expects 'success' or an error string. */
function shrotihost_license_run(string $action, array $params, callable $fn)
{
    $p = LicenseService::hydrate($params);
    try {
        $fn($p);
        Store::audit($action, 'success', 'Completed.', shrotihost_license_ctx($p));
        return 'success';
    } catch (\Throwable $e) {
        Store::recordFailure((int) ($p['serviceid'] ?? 0), $e->getMessage());
        Store::audit($action, 'error', $e->getMessage(), shrotihost_license_ctx($p));
        return $e->getMessage();
    }
}

function shrotihost_license_ctx(array $p): array
{
    return ['service_id' => (int) ($p['serviceid'] ?? 0), 'client_id' => (int) ($p['userid'] ?? 0), 'product_id' => (int) ($p['pid'] ?? 0)];
}

function shrotihost_license_CreateAccount(array $params)
{
    return shrotihost_license_run('module_create', $params, function (array $p) {
        shrotihost_license_sync_whatsapp_addon_lifecycle($p, 'activate');
        if (!Settings::autoCreate($p)) {
            return;
        }
        $r = LicenseService::provision($p);
        LicenseService::reconcile($p);
        if ($r['created']) {
            shrotihost_license_send_custom_service_email($p, Settings::provisioningTemplate($p), [
                'license_key' => (string) $r['key'],
                'remote_license_id' => (string) $r['license']['id'],
                'remote_license_status' => 'active',
            ], 'provisioning_email');
        }
    });
}

function shrotihost_license_SuspendAccount(array $params)
{
    return shrotihost_license_run('module_suspend', $params, function (array $p) {
        LicenseService::setStatus($p, 'suspended', (string) ($p['suspendreason'] ?? 'Suspended in WHMCS'));
        shrotihost_license_sync_whatsapp_addon_lifecycle($p, 'suspend');
    });
}

function shrotihost_license_UnsuspendAccount(array $params)
{
    return shrotihost_license_run('module_unsuspend', $params, function (array $p) {
        LicenseService::setStatus($p, 'active', 'Unsuspended in WHMCS');
        shrotihost_license_sync_whatsapp_addon_lifecycle($p, 'unsuspend');
    });
}

function shrotihost_license_TerminateAccount(array $params)
{
    return shrotihost_license_run('module_terminate', $params, function (array $p) {
        LicenseService::setStatus($p, 'terminated', 'Terminated in WHMCS');
        shrotihost_license_sync_whatsapp_addon_lifecycle($p, 'terminate');
        shrotihost_license_send_custom_service_email($p, shrotihost_license_mail_template_name('termination'), ['remote_license_status' => 'terminated'], 'termination_email');
    });
}

function shrotihost_license_ChangePackage(array $params)
{
    return shrotihost_license_run('module_change_package', $params, function (array $p) {
        LicenseService::reconcile($p);
    });
}

/** Called by WHMCS when a renewal invoice is paid. */
function shrotihost_license_Renew(array $params)
{
    return shrotihost_license_run('module_renew', $params, function (array $p) {
        LicenseService::renew($p);
    });
}

function shrotihost_license_AdminCustomButtonArray(array $params): array
{
    return [
        'Sync with Server' => 'SyncLicense',
        'Reissue (release installs)' => 'ReissueLicense',
        'Regenerate Key' => 'RegenerateKey',
    ];
}

function shrotihost_license_ClientAreaCustomButtonArray(array $params): array
{
    $b = ['Regenerate Key' => 'RequestClientRegenerateKey', 'Download Latest' => 'ClientDownload'];
    if (Settings::clientReissue($params)) {
        $b['Reissue Licence'] = 'RequestClientReissue';
    }
    return $b;
}

function shrotihost_license_ClientAreaAllowedFunctions(): array
{
    return ['RequestClientReissue', 'RequestClientRegenerateKey', 'ClientDownload', 'ClientRevokeActivation'];
}

function shrotihost_license_SyncLicense(array $params)
{
    return shrotihost_license_run('admin_sync', $params, function (array $p) {
        LicenseService::reconcile($p, true);
    });
}

function shrotihost_license_ReissueLicense(array $params)
{
    return shrotihost_license_run('admin_reissue', $params, function (array $p) {
        LicenseService::reissue($p, false);
    });
}

function shrotihost_license_RegenerateKey(array $params)
{
    return shrotihost_license_run('admin_regenerate_key', $params, function (array $p) {
        $key = LicenseService::regenerateKey($p);
        shrotihost_license_send_custom_service_email($p, Settings::provisioningTemplate($p), ['license_key' => $key], 'provisioning_email');
    });
}

/**
 * Client reissue. Inside the included limit it is immediate; beyond it an
 * invoice is raised and the reissue happens when it is paid (InvoicePaid hook).
 */
function shrotihost_license_RequestClientReissue(array $params)
{
    $p = LicenseService::hydrate($params);
    if (!Settings::clientReissue($p)) {
        return 'Self-service reissue is not available for this product. Please open a support ticket.';
    }
    $map = Store::map((int) $p['serviceid']) ?: [];
    $used = (int) ($map['reissue_count'] ?? 0);
    $limit = Settings::reissueLimit($p);
    if ($limit > 0 && $used >= $limit) {
        $fee = Settings::reissueFee($p);
        if ($fee <= 0) {
            return 'You have used all ' . $limit . ' included reissues. Please open a support ticket.';
        }
        $pending = Store::pendingPaidReissueForService((int) $p['serviceid']);
        if ($pending) {
            return 'An invoice (#' . (int) $pending['invoice_id'] . ') for an extra reissue is already open. The licence is reissued as soon as it is paid.';
        }
        try {
            $invoiceId = shrotihost_license_create_reissue_invoice($p, $fee);
            Store::queuePaidReissue((int) $p['serviceid'], (int) $p['userid'], $invoiceId, $fee, 'Client self-service paid reissue');
            Store::audit('client_reissue_invoiced', 'success', 'Invoice #' . $invoiceId . ' raised for an extra reissue.', shrotihost_license_ctx($p));
            return 'You have used all ' . $limit . ' included reissues. Invoice #' . $invoiceId . ' has been created; the licence is reissued as soon as it is paid.';
        } catch (\Throwable $e) {
            return $e->getMessage();
        }
    }
    return shrotihost_license_run('client_reissue', $p, function (array $p) {
        LicenseService::reissue($p, true);
    });
}

function shrotihost_license_RequestClientRegenerateKey(array $params)
{
    return shrotihost_license_run('client_regenerate_key', $params, function (array $p) {
        $key = LicenseService::regenerateKey($p);
        shrotihost_license_send_custom_service_email($p, Settings::provisioningTemplate($p), ['license_key' => $key], 'provisioning_email');
    });
}

/** Redirect the client straight to a one-time download link. */
function shrotihost_license_ClientDownload(array $params)
{
    $p = LicenseService::hydrate($params);
    try {
        $d = LicenseService::download($p);
        Store::audit('client_download', 'success', 'Download link issued for ' . ($d['release']['version'] ?? '?') . '.', shrotihost_license_ctx($p));
        header('Location: ' . $d['url']);
        exit;
    } catch (\Throwable $e) {
        Store::audit('client_download', 'error', $e->getMessage(), shrotihost_license_ctx($p));
        return $e->getMessage();
    }
}

function shrotihost_license_ClientRevokeActivation(array $params)
{
    $aid = (int) ($_REQUEST['activation'] ?? 0);
    return shrotihost_license_run('client_revoke_activation', $params, function (array $p) use ($aid) {
        if ($aid <= 0) {
            throw new \RuntimeException('No installation selected.');
        }
        LicenseService::revokeActivation($p, $aid);
    });
}

function shrotihost_license_create_reissue_invoice(array $p, float $fee): int
{
    $r = localAPI('CreateInvoice', [
        'userid' => (int) $p['userid'],
        'date' => date('Y-m-d'),
        'duedate' => date('Y-m-d'),
        'sendinvoice' => true,
        'paymentmethod' => (string) ($p['paymentmethod'] ?? ''),
        'itemdescription1' => 'Extra licence reissue — ' . ($p['productname'] ?? 'licence') . ' (service #' . (int) $p['serviceid'] . ')',
        'itemamount1' => number_format($fee, 2, '.', ''),
        'itemtaxed1' => 0,
    ]);
    if (($r['result'] ?? '') !== 'success' || empty($r['invoiceid'])) {
        throw new \RuntimeException((string) ($r['message'] ?? 'Could not create the reissue invoice.'));
    }
    return (int) $r['invoiceid'];
}

/* ─────────────────────────────── admin tab ─────────────────────────────── */

function shrotihost_license_AdminServicesTabFields(array $params): array
{
    $p = LicenseService::hydrate($params);
    $sid = (int) $p['serviceid'];
    $map = Store::map($sid);
    $lic = null;
    $error = '';
    if ($map && ($map['license_server'] ?? '') === 'synced') {
        try {
            $lic = LicenseService::fetch($p);
        } catch (\Throwable $e) {
            $error = $e->getMessage();
        }
    }
    $h = function ($v) {
        return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
    };
    $date = function ($v) {
        return $v ? date('j M Y', strtotime((string) $v)) : 'Never (lifetime)';
    };
    if (!$lic) {
        $state = !$map ? 'No licence yet. Use <b>Create</b> or <b>Sync with Server</b>.' : (($map['license_server'] ?? '') !== 'synced' ? 'Not registered yet — click <b>Sync with Server</b> to register its key on the licensing server.' : 'Could not load: ' . $h($error));
        return ['Licence' => '<div class="alert alert-info" style="margin:0">' . $state . '</div>'];
    }
    $badge = ['active' => 'success', 'suspended' => 'warning', 'terminated' => 'danger', 'expired' => 'danger'][$lic['effective_status']] ?? 'default';
    $rows = '';
    foreach ((array) $lic['activations'] as $a) {
        $rows .= '<tr><td>' . $h($a['domain']) . '</td><td><code>' . $h($a['install_dir']) . '</code></td><td>' . $h($a['software_version'] ?: '—') . '</td><td>' . $h($a['status']) . '</td><td>'
            . ($a['last_heartbeat_at'] ? $h(date('j M Y H:i', strtotime($a['last_heartbeat_at']))) : '—') . '</td></tr>';
    }
    $acts = $rows ? '<table class="table table-condensed" style="margin:0"><tr><th>Domain</th><th>Directory</th><th>Version</th><th>Status</th><th>Last heartbeat</th></tr>' . $rows . '</table>' : '<em>No installations have activated this licence yet.</em>';
    $seats = (int) $lic['max_installations'] === -1 ? 'Unlimited' : (int) $lic['max_installations'];
    return [
        'Licence' => '<span class="label label-' . $badge . '">' . $h(ucfirst($lic['effective_status'])) . '</span> &nbsp; <code>' . $h($map['raw_license_key'] ?: $lic['key_hint']) . '</code> &nbsp; <small class="text-muted">server #' . (int) $lic['id'] . ' · ' . $h($lic['product']) . '</small>',
        'Entitlements' => 'Updates until <b>' . $h($date($lic['updates_expires_at'])) . '</b> · Support until <b>' . $h($date($lic['support_expires_at'])) . '</b> · Seats <b>' . $h($lic['active_installations'] . ' / ' . $seats) . '</b> (' . $h(Settings::allocationsSource($p)) . ') · Reissues used <b>' . (int) $lic['reissues_used'] . '</b>',
        'Installations' => $acts,
        'Last sync' => $h($map['last_successful_sync_at'] ?? '—') . ($map['sync_health'] === 'error' ? ' <span class="text-danger">' . $h($map['last_error_message']) . '</span>' : ''),
    ];
}

/* ─────────────────────────────── client area ─────────────────────────────── */

function shrotihost_license_ClientArea(array $params): array
{
    $p = LicenseService::hydrate($params);
    shrotihost_license_handle_whatsapp_panel_request($p);
    if (Settings::includeWhatsappAddon($p)) {
        try {
            shrotihost_license_ensure_whatsapp_addon_instance($p);
        } catch (\Throwable $e) {
            Store::audit('client_area_whatsapp_attach', 'warning', $e->getMessage(), shrotihost_license_ctx($p));
        }
    }
    $sid = (int) $p['serviceid'];
    $map = Store::map($sid) ?: [];
    $lic = null;
    if (($map['license_server'] ?? '') === 'synced') {
        try {
            $lic = LicenseService::fetch($p, false);
        } catch (\Throwable $e) {
            $cached = json_decode((string) ($map['response_snapshot'] ?? ''), true);
            $lic = is_array($cached) && isset($cached['id']) ? $cached : null;
        }
    }
    $release = LicenseService::latestRelease(Settings::slug($p));
    $whatsappPanel = '';
    $waModule = ROOTDIR . '/modules/servers/shrotihost_whatsapp_api/shrotihost_whatsapp_api.php';
    if (is_file($waModule)) {
        require_once $waModule;
        if (function_exists('shrotihost_whatsapp_api_render_product_details_output')) {
            try {
                $whatsappPanel = (string) shrotihost_whatsapp_api_render_product_details_output($sid, (int) $p['userid']);
            } catch (\Throwable $e) {
                Store::audit('client_area_whatsapp_panel', 'warning', $e->getMessage(), shrotihost_license_ctx($p));
            }
        }
    }
    $limit = Settings::reissueLimit($p);
    $used = (int) ($map['reissue_count'] ?? 0);
    $base = 'clientarea.php?action=productdetails&id=' . $sid . '&modop=custom&a=';
    $status = $lic ? (string) $lic['effective_status'] : 'pending';
    $currency = function_exists('getCurrency') ? getCurrency((int) $p['userid']) : null;
    $fee = Settings::reissueFee($p);

    return [
        'tabOverviewReplacementTemplate' => 'templates/managelicense.tpl',
        'templateVariables' => [
            'shl' => [
                'serviceid' => $sid,
                'product' => (string) $p['productname'],
                'status' => $status,
                'key' => (string) ($map['raw_license_key'] ?? ''),
                'seats_used' => $lic ? (int) $lic['active_installations'] : 0,
                'seats' => $lic ? ((int) $lic['max_installations'] === -1 ? 'Unlimited' : (int) $lic['max_installations']) : Settings::allocations($p),
                'updates_until' => $lic && $lic['updates_expires_at'] ? date('j M Y', strtotime($lic['updates_expires_at'])) : 'Lifetime',
                'updates_valid' => !$lic || !$lic['updates_expires_at'] || strtotime($lic['updates_expires_at']) > time(),
                'support_until' => $lic && $lic['support_expires_at'] ? date('j M Y', strtotime($lic['support_expires_at'])) : 'Lifetime',
                'activations' => array_values(array_filter((array) ($lic['activations'] ?? []), function ($a) {
                    return $a['status'] === 'active';
                })),
                'release' => $release,
                'can_reissue' => Settings::clientReissue($p) && $status === 'active',
                'reissue_note' => $limit > 0 ? max(0, $limit - $used) . ' of ' . $limit . ' included reissues left' . ($fee > 0 ? ' · then ' . ($currency && function_exists('formatCurrency') ? (string) formatCurrency($fee, $currency['id']) : number_format($fee, 2)) . ' each' : '') : 'Unlimited reissues',
                'download_url' => $base . 'ClientDownload',
                'reissue_url' => $base . 'RequestClientReissue',
                'regenerate_url' => $base . 'RequestClientRegenerateKey',
                'revoke_url' => $base . 'ClientRevokeActivation&activation=',
                'next_due' => !empty($p['nextduedate']) && strpos((string) $p['nextduedate'], '0000') !== 0 ? date('j M Y', strtotime((string) $p['nextduedate'])) : '',
                'billing_cycle' => (string) $p['billingcycle'],
            ],
            'whatsappAddonPanel' => $whatsappPanel,
        ],
    ];
}

/* ─────────────── functions called by hooks and the admin addon ─────────────── */

function shrotihost_license_audit(string $action, string $status, string $message, array $ctx = []): void
{
    // Mail/WhatsApp contexts carry full request payloads (with licence keys in
    // serialized customvars): keep ids only.
    Store::audit($action, $status, $message, array_intersect_key($ctx, array_flip(['service_id', 'client_id', 'product_id', 'order_id', 'whatsapp_addon_id'])));
}

function shrotihost_license_is_managed_service(int $serviceId): bool
{
    return LicenseService::isManaged($serviceId);
}

function shrotihost_license_verification_url(string $key): string
{
    $root = rtrim((string) \WHMCS\Config\Setting::getValue('SystemURL'), '/');
    return $root . '/index.php?m=shrotihost_license_admin&action=verify&license_key=' . rawurlencode($key);
}

/** Reconcile one service with the server (used by hooks). Never throws. */
function shrotihost_license_reconcile_service(int $serviceId, array $options = []): bool
{
    if (!LicenseService::isManaged($serviceId)) {
        return false;
    }
    try {
        $p = LicenseService::params($serviceId);
        LicenseService::reconcile($p, !empty($options['allow_create']) && Settings::autoCreate($p));
        return true;
    } catch (\Throwable $e) {
        Store::recordFailure($serviceId, $e->getMessage());
        Store::audit('reconcile_' . ($options['trigger'] ?? 'hook'), 'error', $e->getMessage(), ['service_id' => $serviceId]);
        return false;
    }
}

function shrotihost_license_run_daily_reconcile(array $options = []): array
{
    $ok = 0;
    $failed = 0;
    foreach (LicenseService::managedServiceIds() as $sid) {
        shrotihost_license_reconcile_service($sid, $options + ['trigger' => 'daily_cron']) ? $ok++ : $failed++;
    }
    Store::audit('daily_reconcile', $failed ? 'warning' : 'success', "Reconciled $ok service(s), $failed failed.", []);
    return ['ok' => $ok, 'failed' => $failed];
}

/** Licence services have no login; blank WHMCS's generated username/password. */
function shrotihost_license_scrub_service_credentials(int $serviceId): bool
{
    if (!LicenseService::isManaged($serviceId)) {
        return false;
    }
    return Capsule::table('tblhosting')->where('id', $serviceId)->where(function ($q) {
        $q->where('username', '!=', '')->orWhere('password', '!=', '');
    })->update(['username' => '', 'password' => '']) > 0;
}

function shrotihost_license_scrub_order_credentials(int $orderId): int
{
    $n = 0;
    foreach (Capsule::table('tblhosting')->where('orderid', $orderId)->pluck('id') as $sid) {
        $n += shrotihost_license_scrub_service_credentials((int) $sid) ? 1 : 0;
    }
    return $n;
}

/** Called from InvoicePaid: renew paid services and run any paid reissue. */
function shrotihost_license_handle_invoice_paid(int $invoiceId): void
{
    $items = Capsule::table('tblinvoiceitems')->where('invoiceid', $invoiceId)->where('type', 'Hosting')->pluck('relid');
    foreach ($items as $sid) {
        if (LicenseService::isManaged((int) $sid)) {
            shrotihost_license_reconcile_service((int) $sid, ['trigger' => 'invoice_paid']);
        }
    }
    $pending = Store::pendingPaidReissue($invoiceId);
    if ($pending && Store::claimPaidReissue($invoiceId)) {
        try {
            $p = LicenseService::params((int) $pending['service_id']);
            LicenseService::reissue($p, true);
            Store::audit('paid_reissue', 'success', 'Reissued after invoice #' . $invoiceId . ' was paid.', ['service_id' => (int) $pending['service_id']]);
        } catch (\Throwable $e) {
            Store::audit('paid_reissue', 'error', $e->getMessage(), ['service_id' => (int) $pending['service_id']]);
        }
    }
}

}
