<?php
/**
 * Licensing email templates and delivery.
 *
 * Carried over from the previous module unchanged in behaviour: the four
 * "ShrotiHost License *" templates (ids 119/121/122/123 on the portal) are
 * kept in sync from these definitions, WHMCS's generic welcome/suspension
 * emails are swapped for them on managed services, and the shl_* merge fields
 * stay the same so no template needs editing.
 */

use WHMCS\Database\Capsule;

function shrotihost_license_mail_template_name(string $key): string
{
    $templates = [
        'provisioning' => 'ShrotiHost License Provisioning',
        'suspension' => 'ShrotiHost License Suspension',
        'unsuspension' => 'ShrotiHost License Unsuspension',
        'termination' => 'ShrotiHost License Termination',
    ];

    return $templates[$key] ?? $templates['provisioning'];
}

function shrotihost_license_mail_template_definitions(): array
{
    return [
        'provisioning' => [
            'name' => shrotihost_license_mail_template_name('provisioning'),
            'subject' => 'Your {$service_product_name} license is ready',
            'legacy_needles' => [
                'software license has been provisioned',
                'your order for {$service_product_name} has now been activated',
            ],
            'message' => <<<'HTML'
<div data-shl-template-key="provisioning">
<p>Hi {$client_name},</p>
<p>Your ShrotiHost license for <strong>{$service_product_name}</strong> has been provisioned and is ready to use.</p>
<table cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:20px 0;border:1px solid #dbe4f0;border-radius:14px;overflow:hidden;background:#f8fbff;">
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#0f172a;width:180px;border-bottom:1px solid #dbe4f0;">License Key</td>
        <td style="padding:12px 16px;color:#334155;border-bottom:1px solid #dbe4f0;">{if $shl_license_key}{$shl_license_key}{elseif $service_domain}{$service_domain}{else}Pending sync{/if}</td>
    </tr>
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#0f172a;width:180px;border-bottom:1px solid #dbe4f0;">Product</td>
        <td style="padding:12px 16px;color:#334155;border-bottom:1px solid #dbe4f0;">{$service_product_name}</td>
    </tr>
    {if $service_billing_cycle}
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#0f172a;width:180px;border-bottom:1px solid #dbe4f0;">Billing Cycle</td>
        <td style="padding:12px 16px;color:#334155;border-bottom:1px solid #dbe4f0;">{$service_billing_cycle}</td>
    </tr>
    {/if}
    {if $service_next_due_date}
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#0f172a;width:180px;border-bottom:1px solid #dbe4f0;">Next Due Date</td>
        <td style="padding:12px 16px;color:#334155;border-bottom:1px solid #dbe4f0;">{$service_next_due_date}</td>
    </tr>
    {/if}
</table>
{if $shl_verification_url}
<p style="margin:24px 0 14px;">
    <a href="{$shl_verification_url}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;">Verify License</a>
</p>
{/if}
<p>You can manage your license from the client area whenever you need to sync, reissue, or review entitlement status.</p>
<p>{$signature}</p>
</div>
HTML,
        ],
        'suspension' => [
            'name' => shrotihost_license_mail_template_name('suspension'),
            'subject' => 'Your {$service_product_name} license is suspended',
            'message' => <<<'HTML'
<div data-shl-template-key="suspension">
<p>Hi {$client_name},</p>
<p>Your ShrotiHost license for <strong>{$service_product_name}</strong> is currently suspended.</p>
<table cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:20px 0;border:1px solid #f2d4d4;border-radius:14px;overflow:hidden;background:#fff8f8;">
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#7f1d1d;width:180px;border-bottom:1px solid #f2d4d4;">License Key</td>
        <td style="padding:12px 16px;color:#4b5563;border-bottom:1px solid #f2d4d4;">{if $shl_license_key}{$shl_license_key}{elseif $service_domain}{$service_domain}{else}Not available{/if}</td>
    </tr>
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#7f1d1d;width:180px;border-bottom:1px solid #f2d4d4;">WHMCS Status</td>
        <td style="padding:12px 16px;color:#4b5563;border-bottom:1px solid #f2d4d4;">{if $shl_service_status}{$shl_service_status}{elseif $service_status}{$service_status}{else}Suspended{/if}</td>
    </tr>
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#7f1d1d;width:180px;border-bottom:1px solid #f2d4d4;">Remote License Status</td>
        <td style="padding:12px 16px;color:#4b5563;border-bottom:1px solid #f2d4d4;">{if $shl_remote_license_status}{$shl_remote_license_status}{else}suspended{/if}</td>
    </tr>
    {if $service_suspension_reason}
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#7f1d1d;width:180px;">Suspension Reason</td>
        <td style="padding:12px 16px;color:#4b5563;">{$service_suspension_reason}</td>
    </tr>
    {elseif $service_suspendreason}
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#7f1d1d;width:180px;">Suspension Reason</td>
        <td style="padding:12px 16px;color:#4b5563;">{$service_suspendreason}</td>
    </tr>
    {/if}
</table>
<p>Once the underlying service issue is resolved, the license will be restored automatically to match the WHMCS service state.</p>
<p>{$signature}</p>
</div>
HTML,
        ],
        'unsuspension' => [
            'name' => shrotihost_license_mail_template_name('unsuspension'),
            'subject' => 'Your {$service_product_name} license is active again',
            'message' => <<<'HTML'
<div data-shl-template-key="unsuspension">
<p>Hi {$client_name},</p>
<p>Your ShrotiHost license for <strong>{$service_product_name}</strong> has been reactivated and is active again.</p>
<table cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:20px 0;border:1px solid #cfe7d8;border-radius:14px;overflow:hidden;background:#f7fffa;">
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#14532d;width:180px;border-bottom:1px solid #cfe7d8;">License Key</td>
        <td style="padding:12px 16px;color:#334155;border-bottom:1px solid #cfe7d8;">{if $shl_license_key}{$shl_license_key}{elseif $service_domain}{$service_domain}{else}Not available{/if}</td>
    </tr>
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#14532d;width:180px;border-bottom:1px solid #cfe7d8;">WHMCS Status</td>
        <td style="padding:12px 16px;color:#334155;border-bottom:1px solid #cfe7d8;">{if $shl_service_status}{$shl_service_status}{elseif $service_status}{$service_status}{else}Active{/if}</td>
    </tr>
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#14532d;width:180px;border-bottom:1px solid #cfe7d8;">Remote License Status</td>
        <td style="padding:12px 16px;color:#334155;border-bottom:1px solid #cfe7d8;">{if $shl_remote_license_status}{$shl_remote_license_status}{else}active{/if}</td>
    </tr>
    {if $service_next_due_date}
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#14532d;width:180px;">Next Due Date</td>
        <td style="padding:12px 16px;color:#334155;">{$service_next_due_date}</td>
    </tr>
    {/if}
</table>
<p>Your license checks should now pass normally again.</p>
<p>{$signature}</p>
</div>
HTML,
        ],
        'termination' => [
            'name' => shrotihost_license_mail_template_name('termination'),
            'subject' => 'Your {$service_product_name} license has been terminated',
            'message' => <<<'HTML'
<div data-shl-template-key="termination">
<p>Hi {$client_name},</p>
<p>Your ShrotiHost license for <strong>{$service_product_name}</strong> has been terminated.</p>
<table cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:20px 0;border:1px solid #e7d3cf;border-radius:14px;overflow:hidden;background:#fff9f7;">
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#7c2d12;width:180px;border-bottom:1px solid #e7d3cf;">License Key</td>
        <td style="padding:12px 16px;color:#4b5563;border-bottom:1px solid #e7d3cf;">{if $shl_license_key}{$shl_license_key}{elseif $service_domain}{$service_domain}{else}Not available{/if}</td>
    </tr>
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#7c2d12;width:180px;border-bottom:1px solid #e7d3cf;">WHMCS Status</td>
        <td style="padding:12px 16px;color:#4b5563;border-bottom:1px solid #e7d3cf;">{if $shl_service_status}{$shl_service_status}{elseif $service_status}{$service_status}{else}Terminated{/if}</td>
    </tr>
    <tr>
        <td style="padding:12px 16px;font-weight:600;color:#7c2d12;width:180px;">Remote License Status</td>
        <td style="padding:12px 16px;color:#4b5563;">{if $shl_remote_license_status}{$shl_remote_license_status}{else}terminated{/if}</td>
    </tr>
</table>
<p>Runtime validation and future activations for this license will remain unavailable until the service is provisioned again in WHMCS.</p>
<p>{$signature}</p>
</div>
HTML,
        ],
    ];
}

function shrotihost_license_mail_template_payload(array $definition): array
{
    $timestamp = date('Y-m-d H:i:s');

    return [
        'type' => 'product',
        'name' => (string) ($definition['name'] ?? ''),
        'subject' => (string) ($definition['subject'] ?? ''),
        'message' => (string) ($definition['message'] ?? ''),
        'attachments' => '',
        'fromname' => '',
        'fromemail' => '',
        'disabled' => 0,
        'custom' => 1,
        'language' => '',
        'copyto' => '',
        'blind_copy_to' => '',
        'plaintext' => 0,
        'updated_at' => $timestamp,
    ];
}

function shrotihost_license_normalize_email_template_text(string $value): string
{
    $value = html_entity_decode(strip_tags($value), ENT_QUOTES, 'UTF-8');
    $value = strtolower($value);
    $value = preg_replace('/\s+/', ' ', $value) ?? '';

    return trim($value);
}

function shrotihost_license_should_refresh_mail_template(array $definition, ?object $existing): bool
{
    if (!$existing) {
        return true;
    }

    $message = (string) ($existing->message ?? '');
    $subject = trim((string) ($existing->subject ?? ''));
    if ($message === '' || $subject === '') {
        return true;
    }

    if (strpos($message, 'data-shl-template-key="') !== false) {
        return false;
    }

    $normalized = shrotihost_license_normalize_email_template_text($message);
    foreach ((array) ($definition['legacy_needles'] ?? []) as $needle) {
        if ($needle !== '' && strpos($normalized, strtolower($needle)) !== false) {
            return true;
        }
    }

    return false;
}

function shrotihost_license_ensure_mail_templates(): array
{
    static $summary;
    if (is_array($summary)) {
        return $summary;
    }

    $definitions = shrotihost_license_mail_template_definitions();
    $names = array_column($definitions, 'name');
    $existing = Capsule::table('tblemailtemplates')
        ->whereIn('name', $names)
        ->get()
        ->keyBy('name');

    $created = 0;
    $updated = 0;

    foreach ($definitions as $definition) {
        $name = (string) ($definition['name'] ?? '');
        if ($name === '') {
            continue;
        }

        $current = $existing[$name] ?? null;
        $payload = shrotihost_license_mail_template_payload($definition);

        if (!$current) {
            $payload['created_at'] = $payload['updated_at'];
            Capsule::table('tblemailtemplates')->insert($payload);
            $created++;
            continue;
        }

        if (!shrotihost_license_should_refresh_mail_template($definition, $current)) {
            continue;
        }

        Capsule::table('tblemailtemplates')
            ->where('id', (int) $current->id)
            ->update($payload);
        $updated++;
    }

    $summary = [
        'created' => $created,
        'updated' => $updated,
    ];

    return $summary;
}

function shrotihost_license_disable_product_welcome_emails(): int
{
    return Capsule::table('tblproducts')
        ->where('servertype', 'shrotihost_license')
        ->where('welcomeemail', '!=', 0)
        ->update([
            'welcomeemail' => 0,
        ]);
}

function shrotihost_license_bootstrap_mail_delivery(bool $logChanges = false): array
{
    static $summary;
    if (is_array($summary)) {
        return $summary;
    }

    $templates = shrotihost_license_ensure_mail_templates();
    $disabledWelcomeEmails = shrotihost_license_disable_product_welcome_emails();

    $summary = [
        'templates_created' => (int) ($templates['created'] ?? 0),
        'templates_updated' => (int) ($templates['updated'] ?? 0),
        'welcome_emails_disabled' => (int) $disabledWelcomeEmails,
    ];

    if ($logChanges && array_sum($summary) > 0) {
        shrotihost_license_audit('mail_template_bootstrap', 'success', 'Ensured ShrotiHost licensing email templates and disabled generic welcome emails for managed products.', [
            'request' => $summary,
        ]);
    }

    return $summary;
}

function shrotihost_license_mail_customvars(array $params, array $context = []): array
{
    $serviceId = (int) ($params['serviceid'] ?? 0);
    $map = $serviceId > 0 ? \ShrotiHost\WHMCS\Licensing\Store::map($serviceId) : null;

    $licenseKey = trim((string) ($context['license_key'] ?? $context['shl_license_key'] ?? ($map['raw_license_key'] ?? ($params['domain'] ?? ''))));
    $productSlug = trim((string) ($context['product_slug'] ?? $context['shl_product_slug'] ?? ($map['product_slug'] ?? \ShrotiHost\WHMCS\Licensing\Settings::slug($params))));
    $remoteLicenseId = (string) ($context['remote_license_id'] ?? $context['shl_remote_license_id'] ?? ($map['remote_license_id'] ?? ''));
    $usedKeyPrefix = trim((string) ($context['used_key_prefix'] ?? $context['shl_used_key_prefix'] ?? ($map['used_key_prefix'] ?? '')));
    $serviceStatus = trim((string) ($context['service_status'] ?? $context['shl_service_status'] ?? ($params['status'] ?? '')));
    $remoteStatus = trim((string) ($context['remote_license_status'] ?? $context['shl_remote_license_status'] ?? ($map['remote_status'] ?? ($map['status'] ?? ''))));

    $customVars = [
        'shl_license_key' => $licenseKey,
        'shl_product_slug' => $productSlug,
        'shl_remote_license_id' => $remoteLicenseId,
        'shl_used_key_prefix' => $usedKeyPrefix,
        'shl_service_status' => $serviceStatus,
        'shl_remote_license_status' => $remoteStatus,
        'shl_verification_url' => $licenseKey !== '' ? shrotihost_license_verification_url($licenseKey) : '',
    ];

    foreach (['service_suspension_reason', 'service_suspendreason'] as $field) {
        if (!empty($context[$field])) {
            $customVars[$field] = (string) $context[$field];
        }
    }

    return $customVars;
}

function shrotihost_license_send_custom_service_email(array $params, string $template, array $context = [], string $logAction = 'custom_service_email'): bool
{
    $template = trim($template);
    $serviceId = (int) ($params['serviceid'] ?? 0);
    if ($template === '' || $serviceId <= 0 || !function_exists('localAPI')) {
        return false;
    }

    shrotihost_license_bootstrap_mail_delivery();

    $postData = [
        'messagename' => $template,
        'id' => $serviceId,
        'customvars' => base64_encode(serialize(shrotihost_license_mail_customvars($params, $context))),
    ];

    $result = localAPI('SendEmail', $postData);
    if (($result['result'] ?? '') !== 'success') {
        shrotihost_license_audit($logAction, 'error', (string) ($result['message'] ?? 'Custom service email send failed'), [
            'service_id' => $serviceId,
            'client_id' => (int) ($params['userid'] ?? 0),
            'request' => $postData,
            'response' => $result,
        ]);

        return false;
    }

    shrotihost_license_audit($logAction, 'success', 'Custom service email sent.', [
        'service_id' => $serviceId,
        'client_id' => (int) ($params['userid'] ?? 0),
        'request' => $postData,
        'response' => $result,
    ]);

    return true;
}

function shrotihost_license_default_email_swap_map(): array
{
    return [
        'Other Product/Service Welcome Email' => shrotihost_license_mail_template_name('provisioning'),
        'Product/Service Welcome Email' => shrotihost_license_mail_template_name('provisioning'),
        'Service Suspension Notification' => shrotihost_license_mail_template_name('suspension'),
        'Service Unsuspension Notification' => shrotihost_license_mail_template_name('unsuspension'),
    ];
}

function shrotihost_license_resolve_service_id_from_email_vars(array $vars): int
{
    $mergeFields = isset($vars['mergefields']) && is_array($vars['mergefields']) ? $vars['mergefields'] : [];
    $candidates = [
        (int) ($vars['relid'] ?? 0),
        (int) ($mergeFields['service_id'] ?? 0),
        (int) ($mergeFields['serviceid'] ?? 0),
        (int) ($mergeFields['id'] ?? 0),
    ];

    foreach ($candidates as $candidate) {
        if ($candidate > 0 && shrotihost_license_is_managed_service($candidate)) {
            return $candidate;
        }
    }

    return 0;
}

function shrotihost_license_swap_default_service_email(array $vars): array
{
    $messageName = trim((string) ($vars['messagename'] ?? ''));
    if ($messageName === '' || strpos($messageName, 'ShrotiHost License ') === 0) {
        return [];
    }

    $targetTemplate = shrotihost_license_default_email_swap_map()[$messageName] ?? null;
    if ($targetTemplate === null) {
        return [];
    }

    $serviceId = shrotihost_license_resolve_service_id_from_email_vars($vars);
    if ($serviceId <= 0) {
        return [];
    }

    try {
        $params = \ShrotiHost\WHMCS\Licensing\LicenseService::params($serviceId);
    } catch (\Throwable $e) {
        shrotihost_license_audit('swap_default_service_email', 'error', $e->getMessage(), [
            'service_id' => $serviceId,
            'request' => [
                'message_name' => $messageName,
            ],
        ]);

        return [];
    }

    $mergeFields = isset($vars['mergefields']) && is_array($vars['mergefields']) ? $vars['mergefields'] : [];
    $context = [
        'license_key' => (string) ($mergeFields['service_domain'] ?? ($params['domain'] ?? '')),
        'service_status' => (string) ($mergeFields['service_status'] ?? ($params['status'] ?? '')),
    ];

    if (!empty($mergeFields['service_suspension_reason'])) {
        $context['service_suspension_reason'] = (string) $mergeFields['service_suspension_reason'];
    } elseif (!empty($mergeFields['service_suspendreason'])) {
        $context['service_suspendreason'] = (string) $mergeFields['service_suspendreason'];
    }

    if (!shrotihost_license_send_custom_service_email($params, $targetTemplate, $context, 'swap_default_service_email')) {
        return [];
    }

    return [
        'abortsend' => true,
    ];
}

function shrotihost_license_email_merge_fields(): array
{
    return [
        'shl_license_key' => 'Resolved ShrotiHost license key',
        'shl_product_slug' => 'Licensing server product slug',
        'shl_remote_license_id' => 'Mapped remote license ID',
        'shl_used_key_prefix' => 'Applied license key prefix',
        'shl_service_status' => 'Current WHMCS service status',
        'shl_remote_license_status' => 'Current remote license status',
        'shl_verification_url' => 'Public ShrotiHost verification URL',
    ];
}

