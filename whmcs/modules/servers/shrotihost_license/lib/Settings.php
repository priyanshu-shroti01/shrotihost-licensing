<?php

namespace ShrotiHost\WHMCS\Licensing;

use WHMCS\Database\Capsule;

/**
 * Configuration: addon-wide settings and per-product module options.
 *
 * Product options keep their original POSITIONS (configoption1..20). WHMCS stores
 * them by position, so the six live products keep every value they already
 * have — only the descriptions change.
 */
class Settings
{
    const ADDON = 'shrotihost_license_admin';
    const ALLOCATION_FIELD = 'ShrotiHost Allocations Allowed';
    const DEFAULT_BASE_URL = 'https://licensing.shrotihost.in';

    public static function configOptions(): array
    {
        return [
            'Product Slug' => ['Type' => 'text', 'Size' => '40', 'Description' => 'Product slug on the licensing server (e.g. shrotihost-whatsapp-manager-whmcs)'],
            'Support Days Override' => ['Type' => 'text', 'Size' => '10', 'Default' => '', 'Description' => 'Fallback mode only: days of support'],
            'Updates Days Override' => ['Type' => 'text', 'Size' => '10', 'Default' => '', 'Description' => 'Fallback mode only: days of updates'],
            'Subscription Days Override' => ['Type' => 'text', 'Size' => '10', 'Default' => '', 'Description' => 'Fallback mode only: days of subscription'],
            'Auto Create Remote License' => ['Type' => 'yesno', 'Description' => 'Create the licence when WHMCS provisions the service'],
            'Auto Sync Remote License' => ['Type' => 'yesno', 'Description' => 'Refresh licence details when the service page is viewed (cached 10 minutes)'],
            'Custom Key Prefix Override' => ['Type' => 'text', 'Size' => '40', 'Default' => '', 'Description' => 'Optional key prefix; blank uses the product default'],
            'Entitlement Mode' => ['Type' => 'dropdown', 'Options' => 'recurring,lifetime,trial,fallback', 'Default' => 'recurring', 'Description' => 'recurring: WHMCS suspends/terminates, updates follow the next due date · lifetime · trial: registration + trial days · fallback: fixed days'],
            'Trial Days' => ['Type' => 'text', 'Size' => '10', 'Default' => '14', 'Description' => 'Trial mode only'],
            'Public Verification Enabled' => ['Type' => 'yesno', 'Description' => 'Allow this product on the public licence verification page'],
            'Client Self-Reissue Enabled' => ['Type' => 'yesno', 'Description' => 'Let clients reissue (move) their licence from the service page'],
            'Allocations Allowed' => ['Type' => 'text', 'Size' => '10', 'Default' => '1', 'Description' => 'Installations per licence; -1 = unlimited. The admin-only service field overrides it per service.'],
            'Lifetime Product Toggle' => ['Type' => 'yesno', 'Description' => 'Treat as lifetime (overrides Entitlement Mode)'],
            'Trial Product Toggle' => ['Type' => 'yesno', 'Description' => 'Treat as trial (overrides Entitlement Mode)'],
            'Trial Days Override' => ['Type' => 'text', 'Size' => '10', 'Default' => '', 'Description' => 'Overrides Trial Days when set'],
            'Provisioning Email Template' => ['Type' => 'text', 'Size' => '40', 'Default' => 'ShrotiHost License Provisioning', 'Description' => 'Email sent when a licence is created'],
            'Client Reissue Limit' => ['Type' => 'text', 'Size' => '10', 'Default' => '0', 'Description' => 'Included self-service reissues; 0 = unlimited'],
            'Client Reissue Fee' => ['Type' => 'text', 'Size' => '10', 'Default' => '0', 'Description' => 'Invoice amount for each reissue beyond the limit'],
            'Include WhatsApp API Addon' => ['Type' => 'yesno', 'Description' => 'Attach the managed WhatsApp API addon and keep its lifecycle linked'],
            'WhatsApp API Included Free' => ['Type' => 'yesno', 'Description' => 'Show the WhatsApp API as included on the order form'],
        ];
    }

    /** @return array addon settings with defaults applied */
    public static function addon(): array
    {
        static $cache = null;
        if ($cache !== null) {
            return $cache;
        }
        $rows = [];
        try {
            $rows = Capsule::table('tbladdonmodules')->where('module', self::ADDON)->pluck('value', 'setting')->toArray();
        } catch (\Throwable $e) {
            $rows = [];
        }
        $secret = (string) ($rows['ApiSecret'] ?? '');
        // Saving the addon form stores "password" fields encrypted; a value
        // written directly is plain. Accept the decryption only if it looks
        // like a secret (decrypting plain text yields binary noise).
        if ($secret !== '' && function_exists('decrypt')) {
            try {
                $plain = decrypt($secret);
                if (is_string($plain) && preg_match('/^[A-Za-z0-9_\-+\/=]{24,200}$/', $plain)) {
                    $secret = $plain;
                }
            } catch (\Throwable $e) {
            }
        }
        $base = trim((string) ($rows['BaseUrl'] ?? ''));
        return $cache = [
            'base_url' => rtrim($base !== '' ? $base : self::DEFAULT_BASE_URL, '/'),
            'api_key' => trim((string) ($rows['ApiKey'] ?? '')),
            'api_secret' => $secret,
            'debug' => ($rows['DebugMode'] ?? '') === 'on',
            'public_verification' => ($rows['PublicVerification'] ?? '') === 'on',
            'verification_rate_limit' => max(1, (int) ($rows['VerificationRateLimit'] ?? 20)),
            'request_timeout' => max(5, (int) ($rows['RequestTimeout'] ?? 20)),
            'default_days' => max(1, (int) ($rows['DefaultSubscriptionDays'] ?? 365)),
        ];
    }

    public static function slug(array $p): string
    {
        return trim((string) ($p['configoption1'] ?? ''));
    }

    public static function autoCreate(array $p): bool
    {
        return ($p['configoption5'] ?? '') === 'on';
    }

    public static function autoSync(array $p): bool
    {
        return ($p['configoption6'] ?? '') === 'on';
    }

    public static function keyPrefix(array $p): string
    {
        return trim((string) ($p['configoption7'] ?? ''));
    }

    public static function mode(array $p): string
    {
        if (($p['configoption13'] ?? '') === 'on') {
            return 'lifetime';
        }
        if (($p['configoption14'] ?? '') === 'on') {
            return 'trial';
        }
        $m = trim((string) ($p['configoption8'] ?? 'recurring'));
        return in_array($m, ['recurring', 'lifetime', 'trial', 'fallback'], true) ? $m : 'recurring';
    }

    public static function trialDays(array $p): int
    {
        $o = trim((string) ($p['configoption15'] ?? ''));
        return max(1, (int) ($o !== '' ? $o : ($p['configoption9'] ?? 14)));
    }

    public static function fallbackDays(array $p): int
    {
        $days = 0;
        foreach (['configoption2', 'configoption3', 'configoption4'] as $k) {
            $v = trim((string) ($p[$k] ?? ''));
            if ($v !== '') {
                $days = max($days, (int) $v);
            }
        }
        return $days > 0 ? $days : self::addon()['default_days'];
    }

    public static function publicVerification(array $p): bool
    {
        return ($p['configoption10'] ?? '') === 'on' || (($p['configoption10'] ?? '') === '' && self::addon()['public_verification']);
    }

    public static function clientReissue(array $p): bool
    {
        return ($p['configoption11'] ?? '') !== '';
    }

    /** Installations allowed: service custom field overrides the product default. -1 = unlimited. */
    public static function allocations(array $p): int
    {
        $override = trim((string) ($p['customfields'][self::ALLOCATION_FIELD] ?? ''));
        if ($override === '-1' || (ctype_digit($override) && (int) $override >= 1)) {
            return (int) $override;
        }
        $d = trim((string) ($p['configoption12'] ?? '1'));
        if ($d === '-1') {
            return -1;
        }
        return ctype_digit($d) && (int) $d >= 1 ? (int) $d : 1;
    }

    public static function allocationsSource(array $p): string
    {
        $override = trim((string) ($p['customfields'][self::ALLOCATION_FIELD] ?? ''));
        return ($override === '-1' || (ctype_digit($override) && (int) $override >= 1)) ? 'Service override' : 'Product default';
    }

    public static function provisioningTemplate(array $p): string
    {
        $v = trim((string) ($p['configoption16'] ?? ''));
        return $v !== '' ? $v : 'ShrotiHost License Provisioning';
    }

    public static function reissueLimit(array $p): int
    {
        return max(0, (int) ($p['configoption17'] ?? 0));
    }

    public static function reissueFee(array $p): float
    {
        return max(0.0, round((float) ($p['configoption18'] ?? 0), 2));
    }

    public static function includeWhatsappAddon(array $p): bool
    {
        return ($p['configoption19'] ?? '') === 'on';
    }

    public static function whatsappAddonFree(array $p): bool
    {
        return ($p['configoption20'] ?? '') === 'on';
    }
}
