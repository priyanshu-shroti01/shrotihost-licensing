<?php

namespace ShrotiHost\WHMCS\Licensing;

use WHMCS\Database\Capsule;

/**
 * WHMCS-side storage. The three original tables are kept (21 live mappings,
 * the audit trail, the paid-reissue queue), plus two columns on the map:
 *
 *   license_server  'synced' once the service's licence exists on the
 *                   licensing server. An old remote_license_id means nothing
 *                   to it, so a row
 *                   without it is adopted (its key registered) on next sync.
 *   key_hint        "SHROTI-WM-…-7K2Q", for screens that should not show the key.
 */
class Store
{
    const MAP = 'mod_shl_license_map';
    const AUDIT = 'mod_shl_audit_log';
    const REISSUE = 'mod_shl_reissue_queue';

    public static function ensureSchema(): void
    {
        static $done = false;
        if ($done) {
            return;
        }
        $schema = Capsule::schema();
        if (!$schema->hasTable(self::MAP)) {
            $schema->create(self::MAP, function ($t) {
                $t->bigIncrements('id');
                $t->unsignedInteger('service_id')->unique();
                $t->unsignedInteger('client_id')->nullable();
                $t->unsignedInteger('product_id')->nullable();
                $t->unsignedBigInteger('remote_license_id')->nullable();
                $t->string('raw_license_key', 191)->nullable();
                $t->string('product_slug', 120)->nullable();
                $t->string('used_key_prefix', 120)->nullable();
                $t->string('service_status', 40)->nullable();
                $t->string('billing_cycle', 60)->nullable();
                $t->dateTime('next_due_date')->nullable();
                $t->dateTime('registration_date')->nullable();
                $t->string('status', 40)->nullable();
                $t->string('remote_status', 40)->nullable();
                $t->string('sync_health', 40)->nullable();
                $t->boolean('support_valid')->default(false);
                $t->boolean('updates_valid')->default(false);
                $t->boolean('subscription_valid')->default(false);
                $t->dateTime('support_expires_at')->nullable();
                $t->dateTime('updates_expires_at')->nullable();
                $t->dateTime('subscription_expires_at')->nullable();
                $t->unsignedInteger('activation_count')->default(0);
                $t->mediumText('activations_json')->nullable();
                $t->string('latest_version', 80)->nullable();
                $t->dateTime('latest_release_at')->nullable();
                $t->mediumText('latest_update_snapshot')->nullable();
                $t->mediumText('response_snapshot')->nullable();
                $t->dateTime('last_sync_at')->nullable();
                $t->dateTime('last_successful_sync_at')->nullable();
                $t->dateTime('last_failed_sync_at')->nullable();
                $t->dateTime('last_request_at')->nullable();
                $t->mediumText('last_error')->nullable();
                $t->mediumText('last_error_message')->nullable();
                $t->unsignedInteger('failure_count')->default(0);
                $t->unsignedInteger('reissue_count')->default(0);
                $t->dateTime('created_at')->nullable();
                $t->dateTime('updated_at')->nullable();
            });
        }
        if (!$schema->hasColumn(self::MAP, 'license_server')) {
            $schema->table(self::MAP, function ($t) {
                $t->string('license_server', 10)->nullable();
            });
        }
        if (!$schema->hasColumn(self::MAP, 'key_hint')) {
            $schema->table(self::MAP, function ($t) {
                $t->string('key_hint', 80)->nullable();
            });
        }
        if (!$schema->hasTable(self::AUDIT)) {
            $schema->create(self::AUDIT, function ($t) {
                $t->bigIncrements('id');
                $t->unsignedInteger('service_id')->nullable()->index();
                $t->unsignedInteger('admin_id')->nullable();
                $t->unsignedInteger('client_id')->nullable();
                $t->string('action', 80)->index();
                $t->string('status', 20)->index();
                $t->text('message')->nullable();
                $t->mediumText('request_payload')->nullable();
                $t->mediumText('response_payload')->nullable();
                $t->mediumText('context_json')->nullable();
                $t->string('ip_address', 64)->nullable();
                $t->dateTime('created_at')->nullable();
            });
        }
        if (!$schema->hasTable(self::REISSUE)) {
            $schema->create(self::REISSUE, function ($t) {
                $t->bigIncrements('id');
                $t->unsignedInteger('service_id')->index();
                $t->unsignedInteger('client_id')->nullable();
                $t->unsignedInteger('invoice_id')->unique();
                $t->decimal('amount', 10, 2)->default(0);
                $t->string('status', 20)->default('pending');
                $t->text('notes')->nullable();
                $t->dateTime('created_at')->nullable();
                $t->dateTime('updated_at')->nullable();
                $t->dateTime('processed_at')->nullable();
            });
        }
        $done = true;
    }

    public static function map(int $serviceId): ?array
    {
        self::ensureSchema();
        $row = Capsule::table(self::MAP)->where('service_id', $serviceId)->first();
        return $row ? (array) $row : null;
    }

    public static function saveMap(int $serviceId, array $data): void
    {
        self::ensureSchema();
        $now = date('Y-m-d H:i:s');
        $data['updated_at'] = $now;
        if (Capsule::table(self::MAP)->where('service_id', $serviceId)->exists()) {
            Capsule::table(self::MAP)->where('service_id', $serviceId)->update($data);
        } else {
            Capsule::table(self::MAP)->insert(array_merge(['service_id' => $serviceId, 'created_at' => $now], $data));
        }
    }

    public static function recordFailure(int $serviceId, string $message): void
    {
        if (!self::map($serviceId)) {
            return;
        }
        Capsule::table(self::MAP)->where('service_id', $serviceId)->update([
            'sync_health' => 'error',
            'last_failed_sync_at' => date('Y-m-d H:i:s'),
            'last_error_message' => mb_substr($message, 0, 2000),
            'failure_count' => Capsule::raw('failure_count + 1'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public static function audit(string $action, string $status, string $message, array $ctx = []): void
    {
        try {
            self::ensureSchema();
            $adminId = isset($_SESSION['adminid']) ? (int) $_SESSION['adminid'] : null;
            Capsule::table(self::AUDIT)->insert([
                'service_id' => isset($ctx['service_id']) ? (int) $ctx['service_id'] : null,
                'admin_id' => $adminId,
                'client_id' => isset($ctx['client_id']) ? (int) $ctx['client_id'] : null,
                'action' => mb_substr($action, 0, 80),
                'status' => mb_substr($status, 0, 20),
                'message' => mb_substr($message, 0, 5000),
                'context_json' => json_encode(array_diff_key($ctx, ['license_key' => 1])),
                'ip_address' => isset($_SERVER['REMOTE_ADDR']) ? mb_substr((string) $_SERVER['REMOTE_ADDR'], 0, 64) : null,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        } catch (\Throwable $e) {
            // An audit write must never break provisioning.
        }
    }

    public static function recentAudit(int $limit = 50, ?int $serviceId = null): array
    {
        self::ensureSchema();
        $q = Capsule::table(self::AUDIT)->orderBy('id', 'desc')->limit($limit);
        if ($serviceId) {
            $q->where('service_id', $serviceId);
        }
        return array_map(function ($r) {
            return (array) $r;
        }, $q->get()->all());
    }

    public static function queuePaidReissue(int $serviceId, int $clientId, int $invoiceId, float $amount, string $notes): void
    {
        self::ensureSchema();
        $now = date('Y-m-d H:i:s');
        Capsule::table(self::REISSUE)->insert([
            'service_id' => $serviceId, 'client_id' => $clientId, 'invoice_id' => $invoiceId, 'amount' => $amount,
            'status' => 'pending', 'notes' => $notes, 'created_at' => $now, 'updated_at' => $now,
        ]);
    }

    public static function pendingPaidReissue(int $invoiceId): ?array
    {
        self::ensureSchema();
        $r = Capsule::table(self::REISSUE)->where('invoice_id', $invoiceId)->where('status', 'pending')->first();
        return $r ? (array) $r : null;
    }

    /** True if THIS call moved it to processed (so a replayed InvoicePaid cannot reissue twice). */
    public static function claimPaidReissue(int $invoiceId): bool
    {
        return Capsule::table(self::REISSUE)->where('invoice_id', $invoiceId)->where('status', 'pending')->update([
            'status' => 'processed', 'processed_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s'),
        ]) === 1;
    }

    public static function pendingPaidReissueForService(int $serviceId): ?array
    {
        self::ensureSchema();
        $r = Capsule::table(self::REISSUE)->where('service_id', $serviceId)->where('status', 'pending')->orderBy('id', 'desc')->first();
        return $r ? (array) $r : null;
    }
}
