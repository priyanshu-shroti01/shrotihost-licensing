<?php
/**
 * Swap WHMCS's generic welcome/suspension emails for the ShrotiHost licence
 * templates on managed services, and expose the shl_* merge fields.
 */
if (!defined('WHMCS')) {
    exit('This file cannot be accessed directly');
}

$shrotihostLicenseModule = ROOTDIR . '/modules/servers/shrotihost_license/shrotihost_license.php';
if (!is_file($shrotihostLicenseModule)) {
    return;
}
require_once $shrotihostLicenseModule;

add_hook('EmailPreSend', 0, static function (array $vars): array {
    return shrotihost_license_swap_default_service_email($vars);
});

add_hook('EmailTplMergeFields', 1, static function (array $vars): array {
    $type = trim((string) ($vars['type'] ?? ''));
    return ($type !== '' && $type !== 'product') ? [] : shrotihost_license_email_merge_fields();
});

add_hook('DailyCronJob', 5, static function (): void {
    shrotihost_license_bootstrap_mail_delivery(true);
});
