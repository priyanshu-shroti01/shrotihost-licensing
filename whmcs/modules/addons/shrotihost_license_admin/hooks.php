<?php
/**
 * InvoicePaid: renew licences on the paid services and run any paid reissue.
 */
if (!defined('WHMCS')) {
    exit('This file cannot be accessed directly');
}

add_hook('InvoicePaid', 1, function (array $vars) {
    $invoiceId = (int) ($vars['invoiceid'] ?? 0);
    if ($invoiceId <= 0) {
        return;
    }
    $module = ROOTDIR . '/modules/servers/shrotihost_license/shrotihost_license.php';
    if (!is_file($module)) {
        return;
    }
    require_once $module;
    try {
        shrotihost_license_handle_invoice_paid($invoiceId);
    } catch (\Throwable $e) {
        \ShrotiHost\WHMCS\Licensing\Store::audit('invoice_paid', 'error', $e->getMessage(), []);
    }
});
