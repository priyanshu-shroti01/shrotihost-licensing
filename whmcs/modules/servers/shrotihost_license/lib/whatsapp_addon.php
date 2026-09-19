<?php
/**
 * Link to the managed WhatsApp API addon (servers/shrotihost_whatsapp_api).
 *
 * Products with "Include WhatsApp API Addon" get the addon attached
 * automatically, and its lifecycle follows the licence service's: suspend,
 * unsuspend, terminate. Carried over from the v1 module unchanged in
 * behaviour — this is WHMCS plumbing, not licensing, and it works.
 */

use WHMCS\Database\Capsule;

function shrotihost_license_handle_whatsapp_panel_request(array $params): void
{
    $serviceId = (int) ($params['serviceid'] ?? 0);
    if ($serviceId <= 0) {
        return;
    }

    $requestedAction = trim((string) ($_REQUEST['shwa_action'] ?? ''));
    $isStatusPoll = isset($_GET['shwa_status']) && (string) $_GET['shwa_status'] === '1';
    $isAjaxRequest = isset($_REQUEST['ajax']) && (string) $_REQUEST['ajax'] === '1';
    if ($requestedAction === '' && !$isStatusPoll) {
        return;
    }

    $whatsappModule = ROOTDIR . '/modules/servers/shrotihost_whatsapp_api/shrotihost_whatsapp_api.php';
    if (!is_file($whatsappModule)) {
        return;
    }

    require_once $whatsappModule;

    $clientId = (int) ($params['userid'] ?? ($_SESSION['uid'] ?? 0));
    $returnUrl = 'clientarea.php?action=productdetails&id=' . $serviceId;
    $respondJson = static function (int $code, array $payload): void {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode($payload);
        exit;
    };
    $redirect = static function (string $message = '', string $error = '') use ($returnUrl): void {
        $separator = str_contains($returnUrl, '?') ? '&' : '?';
        $target = $returnUrl;
        if ($message !== '') {
            $target .= $separator . 'shwa_notice=' . rawurlencode($message);
            $separator = '&';
        }
        if ($error !== '') {
            $target .= $separator . 'shwa_error=' . rawurlencode($error);
        }

        header('Location: ' . $target);
        exit;
    };

    try {
        if ($clientId <= 0) {
            throw new RuntimeException('Please sign in to continue.');
        }

        $ownerId = (int) Capsule::table('tblhosting')->where('id', $serviceId)->value('userid');
        if ($ownerId !== $clientId) {
            throw new RuntimeException('Service access denied.');
        }

        $addon = shrotihost_whatsapp_api_find_service_addon($serviceId, $clientId);
        if (!$addon) {
            throw new RuntimeException('WhatsApp API addon not found for this service.');
        }

        $waParams = shrotihost_whatsapp_api_build_params_for_addon((int) $addon['id']);
        $manager = shrotihost_whatsapp_api_manager($waParams);

        if ($isStatusPoll) {
            $includeQr = isset($_GET['include_qr']) && (string) $_GET['include_qr'] === '1';
            $forceQrRefresh = isset($_GET['force_qr']) && (string) $_GET['force_qr'] === '1';
            $state = $manager->pollState($waParams, $includeQr, $forceQrRefresh);
            $map = is_array($state['map'] ?? null) ? $state['map'] : [];
            $snapshot = shrotihost_whatsapp_api_snapshot_data($map);
            $connectionStatus = (string) ($map['connection_status'] ?? '');
            $isConnected = \ShrotiHost\WHMCS\WhatsappApi\Config::isConnectedStatus($connectionStatus);
            $deviceName = $isConnected ? (string) (data_get($snapshot, 'data.device_name') ?? '') : '';
            $devicePhone = $isConnected ? (string) (data_get($snapshot, 'data.device_phone') ?? '') : '';
            $deviceVerified = $isConnected ? (bool) (data_get($snapshot, 'data.device_verified') ?? false) : false;
            $deviceUuid = (string) (
                data_get($snapshot, 'data.remote_platform_uuid')
                ?? data_get($snapshot, 'data.session_id')
                ?? data_get($snapshot, 'data.device_uuid')
                ?? ''
            );
            $respondJson(200, [
                'success' => true,
                'data' => [
                    'service_id' => $serviceId,
                    'connection_status' => $connectionStatus,
                    'connection_label' => \ShrotiHost\WHMCS\WhatsappApi\Config::connectionLabel($connectionStatus),
                    'is_connected' => $isConnected,
                    'last_sync_at' => (string) ($map['last_sync_at'] ?? ''),
                    'last_sync_display' => shrotihost_whatsapp_api_display_date((string) ($map['last_sync_at'] ?? '')),
                    'device_limit' => (int) ($map['device_limit'] ?? \ShrotiHost\WHMCS\WhatsappApi\Config::deviceLimit($waParams)),
                    'app_limit' => (int) ($map['app_limit'] ?? \ShrotiHost\WHMCS\WhatsappApi\Config::appLimit($waParams)),
                    'device_name' => $deviceName,
                    'device_phone' => $devicePhone,
                    'device_verified' => $deviceVerified,
                    'device_uuid' => $deviceUuid,
                    'qr_code' => (string) (($state['qr']['qr_code'] ?? '') ?: ''),
                    'qr_message' => (string) (($state['qr']['message'] ?? '') ?: ''),
                ],
            ]);
        }

        switch ($requestedAction) {
            case 'sync':
                $manager->syncRemote($waParams, true);
                $redirect('WhatsApp status refreshed.');
                break;

            case 'disconnect':
                $manager->disconnectRemote($waParams);
                $redirect('WhatsApp device disconnected.');
                break;

            case 'regenerate_auth_key':
                $manager->regenerateAuthKeyRemote($waParams);
                $redirect('Auth key regenerated successfully.');
                break;

            case 'pairing_code':
                $phoneNumber = trim((string) ($_POST['phone_number'] ?? ''));
                if ($phoneNumber === '') {
                    throw new RuntimeException('Please enter the WhatsApp number with country code.');
                }
                $pairing = $manager->requestPairingCodeRemote($waParams, $phoneNumber);
                if ($isAjaxRequest) {
                    $respondJson(200, [
                        'success' => true,
                        'data' => [
                            'message' => (string) ($pairing['message'] ?? 'Pairing code ready.'),
                            'phone_number' => $phoneNumber,
                            'pairing_code' => (string) ($pairing['pairing_code'] ?? ''),
                        ],
                    ]);
                }
                $target = $returnUrl
                    . '&shwa_notice=' . rawurlencode((string) ($pairing['message'] ?? 'Pairing code ready.'))
                    . '&shwa_pairing_phone=' . rawurlencode($phoneNumber)
                    . '&shwa_pairing_code=' . rawurlencode((string) ($pairing['pairing_code'] ?? ''));
                header('Location: ' . $target);
                exit;

            default:
                throw new RuntimeException('Unknown WhatsApp action requested.');
        }
    } catch (\Throwable $e) {
        if ($isStatusPoll || $isAjaxRequest) {
            $respondJson(400, [
                'success' => false,
                'error' => $e->getMessage(),
            ]);
        }

        $redirect('', $e->getMessage());
    }
}

function shrotihost_license_whatsapp_module_available(): bool
{
    return is_file(ROOTDIR . '/modules/servers/shrotihost_whatsapp_api/shrotihost_whatsapp_api.php');
}

function shrotihost_license_whatsapp_addon_definition_id(): int
{
    static $addonId;
    if ($addonId !== null) {
        return $addonId;
    }

    $addonId = (int) Capsule::table('tbladdons')
        ->where('module', 'shrotihost_whatsapp_api')
        ->orderByRaw("CASE WHEN name = 'WhatsApp API' THEN 0 ELSE 1 END")
        ->orderBy('id')
        ->value('id');

    return $addonId;
}

function shrotihost_license_find_whatsapp_addon_instance(int $serviceId): ?array
{
    if ($serviceId <= 0) {
        return null;
    }

    $row = Capsule::table('tblhostingaddons as a')
        ->join('tbladdons as ta', 'ta.id', '=', 'a.addonid')
        ->where('a.hostingid', $serviceId)
        ->where('ta.module', 'shrotihost_whatsapp_api')
        ->whereNotIn('a.status', ['Cancelled', 'Fraud'])
        ->orderBy('a.id', 'desc')
        ->select([
            'a.id',
            'a.addonid',
            'a.hostingid',
            'a.userid',
            'a.status',
            'a.billingcycle',
        ])
        ->first();

    return $row ? (array) $row : null;
}

function shrotihost_license_service_status_to_whatsapp_addon_status(string $action, array $params): string
{
    $serviceStatus = strtolower(trim((string) ($params['status'] ?? '')));

    switch ($action) {
        case 'suspend':
            return 'Suspended';
        case 'terminate':
            return 'Terminated';
        case 'activate':
        case 'unsuspend':
            return $serviceStatus === 'active' ? 'Active' : 'Pending';
        default:
            return 'Pending';
    }
}

function shrotihost_license_whatsapp_addon_billing_data(array $params): array
{
    $today = date('Y-m-d');
    $regDate = trim((string) ($params['regdate'] ?? ''));
    $regDate = ($regDate !== '' && $regDate !== '0000-00-00') ? $regDate : $today;

    $billingCycle = trim((string) ($params['billingcycle'] ?? ''));
    if ($billingCycle === '') {
        $billingCycle = 'Free Account';
    }

    $nextDueDate = trim((string) ($params['nextduedate'] ?? ''));
    $nextDueDate = ($nextDueDate !== '' && $nextDueDate !== '0000-00-00') ? $nextDueDate : $regDate;

    return [
        'billingcycle' => $billingCycle,
        'regdate' => $regDate,
        'nextduedate' => $nextDueDate,
        'nextinvoicedate' => $nextDueDate,
    ];
}

function shrotihost_license_sync_whatsapp_addon_billing(int $addonInstanceId, array $params): void
{
    if ($addonInstanceId <= 0) {
        return;
    }

    $billing = shrotihost_license_whatsapp_addon_billing_data($params);
    Capsule::table('tblhostingaddons')
        ->where('id', $addonInstanceId)
        ->update([
            'billingcycle' => $billing['billingcycle'],
            'regdate' => $billing['regdate'],
            'nextduedate' => $billing['nextduedate'],
            'nextinvoicedate' => $billing['nextinvoicedate'],
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
}

function shrotihost_license_ensure_whatsapp_addon_instance(array $params): ?array
{
    $serviceId = (int) ($params['serviceid'] ?? 0);
    if ($serviceId <= 0) {
        return null;
    }

    $existing = shrotihost_license_find_whatsapp_addon_instance($serviceId);
    if ($existing) {
        return $existing;
    }

    if (!\ShrotiHost\WHMCS\Licensing\Settings::includeWhatsappAddon($params)) {
        return null;
    }

    $addonDefinitionId = shrotihost_license_whatsapp_addon_definition_id();
    if ($addonDefinitionId <= 0) {
        throw new RuntimeException('Managed WhatsApp API addon definition not found.');
    }

    $timestamp = date('Y-m-d H:i:s');
    $billing = shrotihost_license_whatsapp_addon_billing_data($params);
    $addonStatus = shrotihost_license_service_status_to_whatsapp_addon_status('activate', $params);

    $addonInstanceId = (int) Capsule::table('tblhostingaddons')->insertGetId([
        'orderid' => (int) ($params['orderid'] ?? 0),
        'hostingid' => $serviceId,
        'addonid' => $addonDefinitionId,
        'userid' => (int) ($params['userid'] ?? 0),
        'server' => 0,
        'name' => 'WhatsApp API',
        'qty' => 1,
        'firstpaymentamount' => '0.00',
        'setupfee' => '0.00',
        'recurring' => '0.00',
        'billingcycle' => $billing['billingcycle'],
        'tax' => '0',
        'status' => $addonStatus,
        'regdate' => $billing['regdate'],
        'nextduedate' => $billing['nextduedate'],
        'nextinvoicedate' => $billing['nextinvoicedate'],
        'termination_date' => '0000-00-00',
        'proratadate' => '0000-00-00',
        'paymentmethod' => (string) ($params['paymentmethod'] ?? ''),
        'notes' => 'Auto-attached by ShrotiHost Licensing.',
        'subscriptionid' => '',
        'upsell_from_products' => null,
        'created_at' => $timestamp,
        'updated_at' => $timestamp,
    ]);

    shrotihost_license_audit('whatsapp_addon_attach', 'success', 'Auto-attached managed WhatsApp addon to licensing service.', [
        'service_id' => $serviceId,
        'client_id' => (int) ($params['userid'] ?? 0),
        'product_id' => (int) ($params['pid'] ?? 0),
        'order_id' => (int) ($params['orderid'] ?? 0),
        'whatsapp_addon_id' => $addonInstanceId,
        'whatsapp_addon_definition_id' => $addonDefinitionId,
    ]);

    return shrotihost_license_find_whatsapp_addon_instance($serviceId);
}

function shrotihost_license_sync_whatsapp_addon_lifecycle(array $params, string $action): void
{
    $serviceId = (int) ($params['serviceid'] ?? 0);
    if ($serviceId <= 0 || !shrotihost_license_whatsapp_module_available()) {
        return;
    }

    $addon = shrotihost_license_find_whatsapp_addon_instance($serviceId);
    if (!$addon && in_array($action, ['activate', 'unsuspend'], true)) {
        $addon = shrotihost_license_ensure_whatsapp_addon_instance($params);
    }

    if (!$addon) {
        return;
    }

    $addonInstanceId = (int) ($addon['id'] ?? 0);
    if ($addonInstanceId <= 0) {
        return;
    }

    $status = shrotihost_license_service_status_to_whatsapp_addon_status($action, $params);
    $update = [
        'status' => $status,
        'updated_at' => date('Y-m-d H:i:s'),
    ];

    if ($action === 'terminate') {
        $update['termination_date'] = date('Y-m-d');
    } else {
        $update['termination_date'] = '0000-00-00';
    }

    Capsule::table('tblhostingaddons')
        ->where('id', $addonInstanceId)
        ->update($update);

    if ($action !== 'terminate') {
        shrotihost_license_sync_whatsapp_addon_billing($addonInstanceId, $params);
    }

    require_once ROOTDIR . '/modules/servers/shrotihost_whatsapp_api/shrotihost_whatsapp_api.php';

    try {
        $waParams = shrotihost_whatsapp_api_build_params_for_addon($addonInstanceId);
        $manager = shrotihost_whatsapp_api_manager($waParams);

        switch ($action) {
            case 'activate':
                $manager->syncRemote($waParams, true);
                break;
            case 'unsuspend':
                $manager->unsuspendRemote($waParams);
                break;
            case 'suspend':
                $manager->suspendRemote($waParams);
                break;
            case 'terminate':
                $manager->terminateRemote($waParams);
                break;
        }

        shrotihost_license_audit('whatsapp_addon_' . $action, 'success', 'Linked WhatsApp addon lifecycle synced.', [
            'service_id' => $serviceId,
            'client_id' => (int) ($params['userid'] ?? 0),
            'product_id' => (int) ($params['pid'] ?? 0),
            'order_id' => (int) ($params['orderid'] ?? 0),
            'whatsapp_addon_id' => $addonInstanceId,
        ]);
    } catch (\Throwable $e) {
        shrotihost_license_audit('whatsapp_addon_' . $action, 'warning', $e->getMessage(), [
            'service_id' => $serviceId,
            'client_id' => (int) ($params['userid'] ?? 0),
            'product_id' => (int) ($params['pid'] ?? 0),
            'order_id' => (int) ($params['orderid'] ?? 0),
            'whatsapp_addon_id' => $addonInstanceId,
        ]);
    }
}

