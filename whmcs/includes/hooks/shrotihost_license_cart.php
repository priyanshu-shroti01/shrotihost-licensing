<?php

if (!defined('WHMCS')) {
    exit('This file cannot be accessed directly');
}

$shrotihostLicenseModule = ROOTDIR . '/modules/servers/shrotihost_license/shrotihost_license.php';
if (!is_file($shrotihostLicenseModule)) {
    return;
}

require_once $shrotihostLicenseModule;

$shrotihostLicenseResolveCartProductId = static function (array $vars): int {
    $candidates = [
        (int) ($vars['pid'] ?? 0),
        (int) ($_REQUEST['pid'] ?? 0),
    ];

    foreach ($candidates as $candidate) {
        if ($candidate > 0) {
            return $candidate;
        }
    }

    $cartIndex = (int) ($_REQUEST['i'] ?? -1);
    $cartProducts = $_SESSION['cart']['products'] ?? null;
    if ($cartIndex >= 0 && is_array($cartProducts) && isset($cartProducts[$cartIndex])) {
        return (int) ($cartProducts[$cartIndex]['pid'] ?? 0);
    }

    return 0;
};

add_hook('ClientAreaPageCart', 1, static function (array $vars) use ($shrotihostLicenseResolveCartProductId): array {
    $productId = $shrotihostLicenseResolveCartProductId($vars);
    if ($productId <= 0) {
        return [];
    }

    try {
        $product = \WHMCS\Database\Capsule::table('tblproducts')
            ->where('id', $productId)
            ->select(['servertype', 'configoption19', 'configoption20'])
            ->first();
    } catch (\Throwable) {
        return [];
    }

    if (!$product || (string) ($product->servertype ?? '') !== 'shrotihost_license') {
        return [];
    }

    return [
        'shwaMandatoryAddonEnabled' => (string) ($product->configoption19 ?? '') === 'on',
        'shwaMandatoryAddonIsFree' => (string) ($product->configoption20 ?? '') === 'on',
    ];
});
