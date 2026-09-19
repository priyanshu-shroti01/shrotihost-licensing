<?php

namespace ShrotiHost\WHMCS\Licensing;

use WHMCS\Database\Capsule;

/**
 * Everything the WHMCS side does to a licence.
 *
 * The rule the whole class follows: WHMCS decides, the licensing server
 * records. reconcile() computes what the licence should be from the service
 * (status, dates, seats) and pushes only the differences.
 */
class LicenseService
{
    const SYNC_TTL = 600;

    /* ─────────────────────────── service params ─────────────────────────── */

    /** Module params for a service, built from the database (hooks and cron have no $params). */
    public static function params(int $serviceId): array
    {
        $s = Capsule::table('tblhosting as h')
            ->join('tblproducts as p', 'p.id', '=', 'h.packageid')
            ->leftJoin('tblclients as c', 'c.id', '=', 'h.userid')
            ->where('h.id', $serviceId)
            ->select(array_merge(
                ['h.id', 'h.userid', 'h.orderid', 'h.domain', 'h.firstpaymentamount', 'h.amount', 'h.paymentmethod', 'h.domainstatus',
                 'h.billingcycle', 'h.nextduedate', 'h.regdate', 'c.currency', 'c.firstname', 'c.lastname', 'c.companyname', 'c.email',
                 'p.id as pid', 'p.name as productname', 'p.servertype'],
                array_map(function ($i) {
                    return 'p.configoption' . $i;
                }, range(1, 20))
            ))
            ->first();
        if (!$s) {
            throw new \RuntimeException('WHMCS service #' . $serviceId . ' not found.');
        }
        $s = (array) $s;
        $p = [
            'serviceid' => (int) $s['id'], 'userid' => (int) $s['userid'], 'pid' => (int) $s['pid'], 'orderid' => (int) $s['orderid'],
            'domain' => (string) $s['domain'], 'firstpaymentamount' => $s['firstpaymentamount'], 'amount' => $s['amount'],
            'recurringamount' => $s['amount'], 'paymentmethod' => (string) $s['paymentmethod'], 'currency' => $s['currency'],
            'status' => (string) $s['domainstatus'], 'billingcycle' => (string) $s['billingcycle'], 'nextduedate' => (string) $s['nextduedate'],
            'regdate' => (string) $s['regdate'], 'productname' => (string) $s['productname'], 'servertype' => (string) $s['servertype'],
            'clientname' => trim($s['firstname'] . ' ' . $s['lastname']) ?: (string) $s['companyname'], 'clientemail' => (string) $s['email'],
        ];
        for ($i = 1; $i <= 20; $i++) {
            $p['configoption' . $i] = $s['configoption' . $i];
        }
        $p['customfields'] = self::customFields($p['pid'], $serviceId);
        return $p;
    }

    /** Merge DB truth over WHMCS-supplied params (WHMCS sometimes passes stale ones). */
    public static function hydrate(array $params): array
    {
        $id = (int) ($params['serviceid'] ?? 0);
        if ($id <= 0) {
            return $params;
        }
        try {
            return array_replace($params, self::params($id));
        } catch (\Throwable $e) {
            return $params;
        }
    }

    public static function isManaged(int $serviceId): bool
    {
        if ($serviceId <= 0) {
            return false;
        }
        return Capsule::table('tblhosting as h')->join('tblproducts as p', 'p.id', '=', 'h.packageid')
            ->where('h.id', $serviceId)->where('p.servertype', 'shrotihost_license')->exists();
    }

    public static function managedServiceIds(): array
    {
        return Capsule::table('tblhosting as h')->join('tblproducts as p', 'p.id', '=', 'h.packageid')
            ->where('p.servertype', 'shrotihost_license')->orderBy('h.id')->pluck('h.id')->map(function ($v) {
                return (int) $v;
            })->all();
    }

    /** The admin-only "Allocations Allowed" field, created on demand per product. */
    private static function customFields(int $productId, int $serviceId): array
    {
        $fieldId = (int) Capsule::table('tblcustomfields')->where('type', 'product')->where('relid', $productId)
            ->where('fieldname', 'like', Settings::ALLOCATION_FIELD . '%')->value('id');
        if ($fieldId <= 0) {
            try {
                $fieldId = (int) Capsule::table('tblcustomfields')->insertGetId([
                    'type' => 'product', 'relid' => $productId, 'fieldname' => Settings::ALLOCATION_FIELD, 'fieldtype' => 'text',
                    'description' => 'Admin-only. Blank = product default; -1 = unlimited.', 'fieldoptions' => '', 'regexpr' => '',
                    'adminonly' => 'on', 'required' => '', 'showorder' => '', 'showinvoice' => '', 'sortorder' => 0,
                    'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s'),
                ]);
            } catch (\Throwable $e) {
                return [];
            }
        }
        $value = Capsule::table('tblcustomfieldsvalues')->where('fieldid', $fieldId)->where('relid', $serviceId)->value('value');
        return [Settings::ALLOCATION_FIELD => $value === null ? '' : (string) $value];
    }

    /* ─────────────────────────── provisioning ─────────────────────────── */

    /**
     * Make sure this service has a licence on the v2 server.
     * A key WHMCS already holds (from v1) is adopted, never replaced, so no
     * customer's key changes in the migration.
     *
     * @return array{created: bool, adopted: bool, key: ?string, license: array}
     */
    public static function provision(array $p): array
    {
        $sid = (int) $p['serviceid'];
        $slug = Settings::slug($p);
        if ($slug === '') {
            throw new \RuntimeException('Set the Product Slug in this product\'s Module Settings.');
        }
        $map = Store::map($sid);
        if ($map && ($map['license_server'] ?? '') === 'v2' && !empty($map['remote_license_id'])) {
            return ['created' => false, 'adopted' => false, 'key' => $map['raw_license_key'], 'license' => self::fetch($p, true)];
        }
        $existingKey = trim((string) ($map['raw_license_key'] ?? ''));
        if ($existingKey === '' && preg_match('/^[A-Z0-9]+(-[A-Z0-9]+){3,}$/', trim((string) $p['domain']))) {
            $existingKey = trim((string) $p['domain']); // key kept in the service's domain field
        }
        $body = array_merge(self::desired($p), [
            'product_slug' => $slug,
            'whmcs_service_id' => $sid,
            'whmcs_client_id' => (int) $p['userid'],
            'whmcs_order_id' => (int) $p['orderid'],
            'client_name' => (string) ($p['clientname'] ?? ''),
            'client_email' => (string) ($p['clientemail'] ?? ''),
            'plan' => Settings::mode($p),
        ]);
        if ($existingKey !== '') {
            $body['license_key'] = $existingKey;
        } elseif (Settings::keyPrefix($p) !== '') {
            $body['key_prefix'] = Settings::keyPrefix($p);
        }

        $res = AdminClient::fromSettings()->post('licenses', $body);
        $license = (array) $res['license'];
        $key = $res['license_key'] ?? null;
        if ($key === null && $existingKey !== '') {
            $key = $existingKey;
        }
        if ($key === null) {
            // The server already has a licence for this service and only it
            // ever saw the plaintext. Mint a new key rather than leave the
            // customer without one.
            $regen = AdminClient::fromSettings()->post('licenses/' . (int) $license['id'] . '/regenerate-key');
            $key = (string) $regen['license_key'];
            $license = (array) $regen['license'];
        }
        Store::saveMap($sid, [
            'client_id' => (int) $p['userid'],
            'product_id' => (int) $p['pid'],
            'remote_license_id' => (int) $license['id'],
            'raw_license_key' => $key,
            'key_hint' => (string) ($license['key_hint'] ?? ''),
            'product_slug' => $slug,
            'license_server' => 'v2',
            'used_key_prefix' => (string) strtok((string) ($license['key_hint'] ?? ''), '…'),
        ]);
        self::writeKeyToService($sid, $key);
        self::applySnapshot($sid, $p, $license);
        $created = !empty($res['created']) && $existingKey === '';
        Store::audit($created ? 'license_created' : 'license_adopted', 'success', ($created ? 'Licence created' : 'Existing key registered') . ' on the v2 licensing server (#' . $license['id'] . ').', ['service_id' => $sid, 'client_id' => (int) $p['userid']]);
        return ['created' => $created, 'adopted' => $existingKey !== '', 'key' => $key, 'license' => $license];
    }

    /** Status, dates and seats the licence should have, from WHMCS. */
    public static function desired(array $p): array
    {
        return array_merge(Lifecycle::dates($p), [
            'status' => Lifecycle::remoteStatus((string) $p['status']),
            'max_installations' => Settings::allocations($p),
        ]);
    }

    /**
     * Bring the server in line with WHMCS. Pushes only what differs.
     * @return array the licence after reconciliation
     */
    public static function reconcile(array $p, bool $allowCreate = false): array
    {
        $sid = (int) $p['serviceid'];
        $map = Store::map($sid);
        if (!$map || ($map['license_server'] ?? '') !== 'v2' || empty($map['remote_license_id'])) {
            $status = strtolower((string) $p['status']);
            $hasKey = $map && trim((string) ($map['raw_license_key'] ?? '')) !== '';
            // Adopt existing v1 keys always; only create brand-new licences when allowed.
            if (!$hasKey && (!$allowCreate || !in_array($status, ['active', 'suspended'], true))) {
                return [];
            }
            self::provision($p);
        }
        $lic = self::fetch($p, true);
        $want = self::desired($p);
        $client = AdminClient::fromSettings();
        $id = (int) $lic['id'];

        if ($lic['status'] !== $want['status']) {
            if ($want['status'] === 'active') {
                $lic = (array) $client->post("licenses/$id/unsuspend", ['reason' => 'WHMCS service active', 'force' => true])['license'];
            } elseif ($want['status'] === 'suspended') {
                $lic = (array) $client->post("licenses/$id/suspend", ['reason' => 'WHMCS service ' . strtolower((string) $p['status']), 'force' => true])['license'];
            } else {
                $lic = (array) $client->post("licenses/$id/terminate", ['reason' => 'WHMCS service ' . strtolower((string) $p['status'])])['license'];
            }
        }
        $update = [];
        foreach (['subscription_expires_at', 'support_expires_at', 'updates_expires_at'] as $k) {
            if (!Lifecycle::sameDay($lic[$k] ?? null, $want[$k])) {
                $update[$k] = $want[$k];
            }
        }
        if ((int) $lic['max_installations'] !== (int) $want['max_installations']) {
            $update['max_installations'] = (int) $want['max_installations'];
        }
        if ((int) ($lic['whmcs_service_id'] ?? 0) !== $sid) {
            $update['whmcs_service_id'] = $sid;
        }
        if ($update) {
            $lic = (array) $client->post("licenses/$id/update", $update)['license'];
        }
        self::applySnapshot($sid, $p, $lic);
        return $lic;
    }

    /** The licence from the server, or from the local cache when fresh. */
    public static function fetch(array $p, bool $force = false): array
    {
        $sid = (int) $p['serviceid'];
        $map = Store::map($sid);
        if (!$map || empty($map['remote_license_id']) || ($map['license_server'] ?? '') !== 'v2') {
            throw new \RuntimeException('No licence has been created for this service yet.');
        }
        if (!$force && !empty($map['last_successful_sync_at']) && time() - strtotime((string) $map['last_successful_sync_at']) < self::SYNC_TTL) {
            $cached = json_decode((string) $map['response_snapshot'], true);
            if (is_array($cached) && isset($cached['id'])) {
                return $cached;
            }
        }
        try {
            $lic = (array) AdminClient::fromSettings()->get('licenses/' . (int) $map['remote_license_id'])['license'];
        } catch (\Throwable $e) {
            Store::recordFailure($sid, $e->getMessage());
            throw $e;
        }
        self::applySnapshot($sid, $p, $lic);
        return $lic;
    }

    /** Cache the server's view of the licence on the WHMCS side. */
    public static function applySnapshot(int $sid, array $p, array $lic): void
    {
        $active = array_values(array_filter((array) ($lic['activations'] ?? []), function ($a) {
            return ($a['status'] ?? '') === 'active';
        }));
        $dt = function ($v) {
            return $v ? date('Y-m-d H:i:s', strtotime((string) $v)) : null;
        };
        $now = date('Y-m-d H:i:s');
        Store::saveMap($sid, [
            'client_id' => (int) ($p['userid'] ?? 0) ?: null,
            'product_id' => (int) ($p['pid'] ?? 0) ?: null,
            'service_status' => strtolower((string) ($p['status'] ?? '')),
            'billing_cycle' => (string) ($p['billingcycle'] ?? ''),
            'next_due_date' => $dt($p['nextduedate'] ?? null),
            'registration_date' => $dt($p['regdate'] ?? null),
            'status' => (string) ($lic['status'] ?? ''),
            'remote_status' => (string) ($lic['effective_status'] ?? $lic['status'] ?? ''),
            'key_hint' => (string) ($lic['key_hint'] ?? ''),
            'support_expires_at' => $dt($lic['support_expires_at'] ?? null),
            'updates_expires_at' => $dt($lic['updates_expires_at'] ?? null),
            'subscription_expires_at' => $dt($lic['subscription_expires_at'] ?? null),
            'support_valid' => empty($lic['support_expires_at']) || strtotime((string) $lic['support_expires_at']) > time() ? 1 : 0,
            'updates_valid' => empty($lic['updates_expires_at']) || strtotime((string) $lic['updates_expires_at']) > time() ? 1 : 0,
            'subscription_valid' => ($lic['effective_status'] ?? '') === 'active' ? 1 : 0,
            'activation_count' => count($active),
            'activations_json' => json_encode($lic['activations'] ?? []),
            'response_snapshot' => json_encode($lic),
            'reissue_count' => max((int) (Store::map($sid)['reissue_count'] ?? 0), (int) ($lic['reissues_used'] ?? 0)),
            'sync_health' => 'ok',
            'last_sync_at' => $now,
            'last_successful_sync_at' => $now,
            'last_error_message' => null,
            'failure_count' => 0,
        ]);
    }

    /** The key lives in the service's Domain field (shown by WHMCS everywhere); login fields are cleared. */
    public static function writeKeyToService(int $sid, string $key): void
    {
        Capsule::table('tblhosting')->where('id', $sid)->update(['domain' => $key, 'username' => '', 'password' => '']);
    }

    /* ─────────────────────────── actions ─────────────────────────── */

    public static function setStatus(array $p, string $status, string $reason = ''): array
    {
        $lic = self::fetch($p, true);
        $id = (int) $lic['id'];
        $client = AdminClient::fromSettings();
        if ($status === 'active') {
            $lic = (array) $client->post("licenses/$id/unsuspend", ['reason' => $reason, 'force' => true])['license'];
        } elseif ($status === 'suspended') {
            $lic = (array) $client->post("licenses/$id/suspend", ['reason' => $reason, 'force' => true])['license'];
        } else {
            $lic = (array) $client->post("licenses/$id/terminate", ['reason' => $reason])['license'];
        }
        self::applySnapshot((int) $p['serviceid'], $p, $lic);
        return $lic;
    }

    /** Push renewal dates and seats (after an invoice is paid or the package changes). */
    public static function renew(array $p): array
    {
        return self::reconcile($p, false);
    }

    public static function reissue(array $p, bool $countIt): int
    {
        $lic = self::fetch($p, true);
        $res = AdminClient::fromSettings()->post('licenses/' . (int) $lic['id'] . '/reissue', ['count' => $countIt]);
        self::applySnapshot((int) $p['serviceid'], $p, (array) $res['license']);
        if ($countIt) {
            Capsule::table(Store::MAP)->where('service_id', (int) $p['serviceid'])->update(['reissue_count' => Capsule::raw('reissue_count + 1')]);
        }
        return (int) $res['released'];
    }

    public static function regenerateKey(array $p): string
    {
        $lic = self::fetch($p, true);
        $res = AdminClient::fromSettings()->post('licenses/' . (int) $lic['id'] . '/regenerate-key');
        $key = (string) $res['license_key'];
        $sid = (int) $p['serviceid'];
        Store::saveMap($sid, ['raw_license_key' => $key]);
        self::writeKeyToService($sid, $key);
        self::applySnapshot($sid, $p, (array) $res['license']);
        return $key;
    }

    public static function revokeActivation(array $p, int $activationId): void
    {
        $lic = self::fetch($p, true);
        $res = AdminClient::fromSettings()->post('licenses/' . (int) $lic['id'] . '/activations/' . $activationId . '/revoke');
        self::applySnapshot((int) $p['serviceid'], $p, (array) $res['license']);
    }

    /** One-time download URL for the latest release the licence is entitled to. */
    public static function download(array $p): array
    {
        $lic = self::fetch($p);
        return AdminClient::fromSettings()->post('licenses/' . (int) $lic['id'] . '/download');
    }

    /** Latest published release for the product (for the client area), cached per request. */
    public static function latestRelease(string $slug): ?array
    {
        static $cache = [];
        if (array_key_exists($slug, $cache)) {
            return $cache[$slug];
        }
        try {
            $rows = (array) AdminClient::fromSettings()->get('releases', ['product' => $slug])['releases'];
            $pub = array_values(array_filter($rows, function ($r) {
                return !empty($r['published']) && ($r['channel'] ?? '') === 'stable';
            }));
            usort($pub, function ($a, $b) {
                return version_compare((string) $b['version'], (string) $a['version']);
            });
            return $cache[$slug] = $pub[0] ?? null;
        } catch (\Throwable $e) {
            return $cache[$slug] = null;
        }
    }
}
