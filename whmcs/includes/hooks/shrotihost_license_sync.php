<?php
/**
 * Keep licences in step with WHMCS: after any lifecycle action, on service
 * edits, and once a day for every managed service.
 */
if (!defined('WHMCS')) {
    exit('This file cannot be accessed directly');
}

$shrotihostLicenseModule = ROOTDIR . '/modules/servers/shrotihost_license/shrotihost_license.php';
if (!is_file($shrotihostLicenseModule)) {
    return;
}
require_once $shrotihostLicenseModule;

$shrotihostLicenseServiceId = static function (array $vars): int {
    foreach ([$vars['serviceid'] ?? null, $vars['params']['serviceid'] ?? null, $vars['id'] ?? null] as $c) {
        if ((int) $c > 0) {
            return (int) $c;
        }
    }
    return 0;
};

foreach (['AdminServiceEdit' => 'admin_service_edit', 'ServiceEdit' => 'service_edit'] as $hook => $trigger) {
    add_hook($hook, 1, static function (array $vars) use ($trigger) {
        $sid = (int) ($vars['serviceid'] ?? 0);
        if ($sid > 0) {
            shrotihost_license_scrub_service_credentials($sid);
            shrotihost_license_reconcile_service($sid, ['trigger' => $trigger, 'allow_create' => true]);
        }
    });
}

// Lifecycle functions already push their own change; this catches edits made
// alongside them (dates, seat overrides) in the same admin action.
foreach (['AfterModuleChangePackage', 'AfterModuleUnsuspend'] as $hook) {
    add_hook($hook, 1, static function (array $vars) use ($shrotihostLicenseServiceId, $hook) {
        $sid = $shrotihostLicenseServiceId($vars);
        if ($sid > 0) {
            shrotihost_license_reconcile_service($sid, ['trigger' => $hook]);
        }
    });
}

add_hook('AfterShoppingCartCheckout', 1, static function (array $vars) {
    $orderId = (int) ($vars['OrderID'] ?? 0);
    if ($orderId > 0) {
        shrotihost_license_scrub_order_credentials($orderId);
    }
});

add_hook('DailyCronJob', 1, static function () {
    shrotihost_license_run_daily_reconcile(['allow_create' => true]);
});
