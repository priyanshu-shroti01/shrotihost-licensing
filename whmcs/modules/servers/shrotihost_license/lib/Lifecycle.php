<?php

namespace ShrotiHost\WHMCS\Licensing;

/**
 * What a licence should look like, derived from the WHMCS service alone.
 *
 * WHMCS is the authority: a recurring licence has NO subscription expiry on
 * the licensing server — WHMCS suspends and terminates it when an invoice goes
 * unpaid. (The old module set expiry = next due date, so a licence died the day an invoice
 * fell due, before WHMCS's own overdue grace had even started.) Support and
 * updates do follow the paid-up date.
 */
class Lifecycle
{
    /** WHMCS service status → licence status. */
    public static function remoteStatus(string $serviceStatus): string
    {
        switch (strtolower(trim($serviceStatus))) {
            case 'active':
                return 'active';
            case 'terminated':
            case 'cancelled':
            case 'fraud':
                return 'terminated';
            default: // pending, suspended, completed
                return 'suspended';
        }
    }

    /** @return array{subscription_expires_at: ?string, support_expires_at: ?string, updates_expires_at: ?string} */
    public static function dates(array $p): array
    {
        $mode = Settings::mode($p);
        $next = self::date($p['nextduedate'] ?? '');
        $reg = self::date($p['regdate'] ?? '') ?: gmdate('Y-m-d');

        switch ($mode) {
            case 'lifetime':
                return ['subscription_expires_at' => null, 'support_expires_at' => null, 'updates_expires_at' => null];
            case 'trial':
                $end = gmdate('Y-m-d\T23:59:59\Z', strtotime($reg . ' +' . Settings::trialDays($p) . ' days'));
                return ['subscription_expires_at' => $end, 'support_expires_at' => $end, 'updates_expires_at' => $end];
            case 'fallback':
                $end = gmdate('Y-m-d\T23:59:59\Z', strtotime($reg . ' +' . Settings::fallbackDays($p) . ' days'));
                return ['subscription_expires_at' => $end, 'support_expires_at' => $end, 'updates_expires_at' => $end];
            default:
                $recurring = in_array(strtolower(trim((string) ($p['billingcycle'] ?? ''))), ['monthly', 'quarterly', 'semi-annually', 'annually', 'biennially', 'triennially'], true);
                if (!$recurring) {
                    // One Time / Free Account: nothing ever falls due.
                    return ['subscription_expires_at' => null, 'support_expires_at' => null, 'updates_expires_at' => null];
                }
                $paidTo = $next ? gmdate('Y-m-d\T23:59:59\Z', strtotime($next)) : null;
                return ['subscription_expires_at' => null, 'support_expires_at' => $paidTo, 'updates_expires_at' => $paidTo];
        }
    }

    private static function date($v): ?string
    {
        $v = trim((string) $v);
        if ($v === '' || strpos($v, '0000-00-00') === 0) {
            return null;
        }
        $t = strtotime($v);
        return $t ? gmdate('Y-m-d', $t) : null;
    }

    /** Compare an ISO date from the server with ours at day precision. */
    public static function sameDay(?string $a, ?string $b): bool
    {
        if (!$a || !$b) {
            return !$a && !$b;
        }
        return gmdate('Y-m-d', strtotime($a)) === gmdate('Y-m-d', strtotime($b));
    }
}
