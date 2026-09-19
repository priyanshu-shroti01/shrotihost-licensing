{* ShrotiHost Licensing — client service page (replaces the Overview tab). *}
{literal}<style>
.shl{--shl-bg:var(--body-bg,#fff);--shl-soft:var(--gray-faded,#f8f7fb);--shl-border:var(--gray-lighter-3,#e4e0ec);--shl-head:var(--text-heading-color,#1b1523);--shl-text:var(--text-body-color,#4a4356);--shl-muted:var(--text-lighter-color,#7c7489);--shl-brand:#a810c7;--shl-brand-ink:#8a0da3;max-width:980px}
.lagom-dark-mode .shl{--shl-brand-ink:#d77be9}
.shl-card{background:var(--shl-bg);border:1px solid var(--shl-border);border-radius:16px;overflow:hidden;margin-bottom:20px}
.shl-head{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid var(--shl-border)}
.shl-title{margin:0;font-size:20px;font-weight:700;color:var(--shl-head)}
.shl-sub{margin:4px 0 0;font-size:13px;color:var(--shl-muted)}
.shl-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.shl-pill:before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.shl-pill.active{background:#e6f5ec;color:#0f7b3f}.shl-pill.suspended,.shl-pill.pending{background:#fff4e0;color:#8a5300}.shl-pill.terminated,.shl-pill.expired{background:#fdeaea;color:#b42318}
.lagom-dark-mode .shl-pill.active{background:#12291c;color:#5fd08f}.lagom-dark-mode .shl-pill.suspended,.lagom-dark-mode .shl-pill.pending{background:#2e2410;color:#f2c14e}.lagom-dark-mode .shl-pill.terminated,.lagom-dark-mode .shl-pill.expired{background:#2e1414;color:#f08080}
.shl-body{padding:20px 22px}
.shl-label{display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:var(--shl-muted)}
.shl-key{display:flex;gap:8px}
.shl-key input{flex:1;min-width:0;height:46px;padding:0 14px;border:1px solid var(--shl-border);border-radius:12px;background:var(--shl-soft);color:var(--shl-head);font:600 15px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.02em}
.shl-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--shl-border);background:var(--shl-bg);color:var(--shl-head);font-weight:700;font-size:14px;text-decoration:none;cursor:pointer;white-space:nowrap}
.shl-btn:hover{text-decoration:none;border-color:var(--shl-brand);color:var(--shl-brand-ink)}
.shl-btn.primary{background:var(--shl-brand);border-color:var(--shl-brand);color:#fff}
.shl-btn.primary:hover{color:#fff;opacity:.92}
.shl-btn[aria-disabled=true]{opacity:.5;pointer-events:none}
.shl-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:18px}
.shl-stat{padding:12px 14px;border:1px solid var(--shl-border);border-radius:12px;background:var(--shl-soft)}
.shl-stat b{display:block;margin-top:2px;font-size:15px;color:var(--shl-head)}
.shl-stat span{font-size:12px;color:var(--shl-muted);font-weight:600}
.shl-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.shl-note{margin:10px 0 0;font-size:12px;color:var(--shl-muted)}
.shl-table{width:100%;border-collapse:collapse;font-size:14px}
.shl-table th{text-align:left;font-size:12px;color:var(--shl-muted);font-weight:700;padding:8px 10px;border-bottom:1px solid var(--shl-border)}
.shl-table td{padding:10px;border-bottom:1px solid var(--shl-border);color:var(--shl-text);vertical-align:middle}
.shl-table td code{font-size:12px;word-break:break-all}
.shl-empty{padding:18px;text-align:center;color:var(--shl-muted);font-size:14px}
.shl-release{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
.shl-release strong{font-size:18px;color:var(--shl-head)}
.shl-security{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:6px;background:#fdeaea;color:#b42318;font-size:11px;font-weight:700}
.shl-changelog{margin:12px 0 0;padding:12px 14px;border-radius:12px;background:var(--shl-soft);font-size:13px;white-space:pre-wrap;color:var(--shl-text);max-height:200px;overflow:auto}
@media (max-width:767px){.shl-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.shl-head,.shl-body{padding:16px}.shl-table th:nth-child(2),.shl-table td:nth-child(2){display:none}}
/* Managed WhatsApp API addon panel (rendered by servers/shrotihost_whatsapp_api) */
.shl-addon-panel{margin-top:24px}
.shl-addon-panel .shwa-grid{display:grid;gap:16px;--shwa-bg:var(--body-bg,#fff);--shwa-bg-soft:var(--gray-faded,#f8fbff);--shwa-border:var(--gray-lighter-3,#dbe5f0);--shwa-heading:var(--text-heading-color,#16324d);--shwa-text:var(--text-body-color,#475569);--shwa-muted:var(--text-lighter-color,#64748b);--shwa-shadow:0 14px 32px rgba(15,23,42,.10);margin-top:0}
.lagom-dark-mode .shl-addon-panel .shwa-grid{--shwa-shadow:0 14px 32px rgba(0,0,0,.32)}
.shl-addon-panel .shwa-card{background:var(--shwa-bg);border:1px solid var(--shwa-border);border-radius:16px;box-shadow:var(--shwa-shadow);overflow:hidden;color:var(--shwa-text)}
.shl-addon-panel .shwa-card [hidden],.shl-addon-panel .shwa-card .is-hidden{display:none !important}
.shl-addon-panel .shwa-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:22px 24px 18px;border-bottom:1px solid var(--shwa-border)}
.shl-addon-panel .shwa-title{margin:0;font-size:28px;line-height:1.15;color:var(--shwa-heading);font-weight:700}
.shl-addon-panel .shwa-subtitle{margin:8px 0 0;color:var(--shwa-muted);font-size:13px}
.shl-addon-panel .shwa-body{padding:22px}
.shl-addon-panel .shwa-status-card,.shl-addon-panel .shwa-credentials-card,.shl-addon-panel .shwa-method-card{border:1px solid var(--shwa-border);border-radius:14px;background:#fff;padding:18px}
.shl-addon-panel .shwa-status-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:start}
.shl-addon-panel .shwa-status-card.is-connected{border-color:#bbf7d0}
.shl-addon-panel .shwa-status-card.is-disconnected{border-color:#fed7aa}
.shl-addon-panel .shwa-status-main{display:flex;gap:14px;min-width:0}
.shl-addon-panel .shwa-status-dot{width:14px;height:14px;border-radius:999px;background:#16a34a;margin-top:8px;box-shadow:0 0 0 4px rgba(22,163,74,.12);flex:0 0 auto}
.shl-addon-panel .shwa-status-card.is-disconnected .shwa-status-dot{background:#f59e0b;box-shadow:0 0 0 4px rgba(245,158,11,.14)}
.shl-addon-panel .shwa-eyebrow,.shl-addon-panel .shwa-label,.shl-addon-panel .shwa-metric-label{margin:0;color:var(--shwa-muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.shl-addon-panel .shwa-status-title{margin:2px 0 6px;color:var(--shwa-heading);font-size:22px;line-height:1.2;font-weight:800}
.shl-addon-panel .shwa-status-copy{margin:0;color:var(--shwa-text);font-size:14px;line-height:1.5}
.shl-addon-panel .shwa-status-side{display:grid;gap:10px;justify-items:end}
.shl-addon-panel .shwa-status-raw{display:inline-flex;padding:7px 11px;border-radius:999px;background:#dcfce7;color:#166534;font-size:12px;font-weight:800;text-transform:uppercase;white-space:nowrap}
.shl-addon-panel .shwa-status-card.is-disconnected .shwa-status-raw{background:#ffedd5;color:#9a3412}
.shl-addon-panel .shwa-status-action{display:flex;justify-content:flex-end}
.shl-addon-panel .shwa-status-action .shwa-form{display:flex;margin:0}
	.shl-addon-panel .shwa-status-metrics{grid-column:1 / -1;display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px}
.shl-addon-panel .shwa-status-metric{min-width:0;padding:12px;border:1px solid rgba(148,163,184,.35);border-radius:12px;background:#f8fafc}
.shl-addon-panel .shwa-metric-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
.shl-addon-panel .shwa-metric-value{margin:0;color:var(--shwa-heading);font-size:14px;font-weight:800;line-height:1.4;word-break:break-word}
.shl-addon-panel .shwa-section-head{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;margin-bottom:14px}
.shl-addon-panel .shwa-section-head--split{align-items:center}
.shl-addon-panel .shwa-section-title{margin:0;color:var(--shwa-heading);font-size:20px;line-height:1.3;font-weight:800}
.shl-addon-panel .shwa-section-copy,.shl-addon-panel .shwa-method-copy{margin:5px 0 0;color:var(--shwa-muted);font-size:13px;line-height:1.5}
.shl-addon-panel .shwa-credentials-card,.shl-addon-panel .shwa-method-card{margin-top:14px}
.shl-addon-panel .shwa-field-grid{display:grid;grid-template-columns:1fr;gap:12px}
.shl-addon-panel .shwa-field{padding:14px;border:1px solid var(--shwa-border);border-radius:12px;background:#fff}
.shl-addon-panel .shwa-field.is-wide{grid-column:1 / -1}
.shl-addon-panel .shwa-field-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.shl-addon-panel .shwa-field-top .shwa-label{margin-bottom:0}
.shl-addon-panel .shwa-value{margin:0;color:var(--shwa-heading);font-size:15px;line-height:1.5;word-break:break-word;font-weight:600}
.shl-addon-panel .shwa-secret-wrap{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center}
.shl-addon-panel .shwa-secret{width:100%;min-width:0;height:44px;padding:0 12px;border:1px solid var(--shl-border-strong);border-radius:10px;background:#fbfcfe;font-size:13px;font-weight:600;color:var(--shwa-heading);box-shadow:inset 0 1px 2px rgba(15,23,42,.04)}
.shl-addon-panel .shwa-copy,.shl-addon-panel .shwa-btn,.shl-addon-panel .shwa-link,.shl-addon-panel .shwa-segment{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:10px;font-weight:800;text-decoration:none;cursor:pointer;line-height:1.2;transition:background .15s ease,border-color .15s ease,color .15s ease}
.shl-addon-panel .shwa-copy,.shl-addon-panel .shwa-btn{border:1px solid var(--shl-border-strong);background:#fff;color:#16324d}
.shl-addon-panel .shwa-link{border:1px solid #0f766e;background:#0f766e;color:#fff !important}
.shl-addon-panel .shwa-link:hover{text-decoration:none;color:#fff !important;background:#0d665f}
.shl-addon-panel .shwa-link.is-secondary,.shl-addon-panel .shwa-link.is-muted,.shl-addon-panel .shwa-btn.is-muted{border-color:var(--shl-border-strong);background:#fff;color:#16324d !important}
.shl-addon-panel .shwa-link.is-danger,.shl-addon-panel .shwa-btn.is-danger{background:#b91c1c;color:#fff !important;border-color:#b91c1c}
.shl-addon-panel .shwa-mini-action{display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:32px;padding:0 10px;border:1px solid var(--shl-border-strong);border-radius:10px;background:#fff;color:#16324d;font-size:18px;line-height:1;font-weight:800;text-decoration:none}
.shl-addon-panel .shwa-actions{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}
.shl-addon-panel .shwa-alert{margin-bottom:14px;padding:12px 14px;border:1px solid #bbf7d0;border-radius:12px;background:#f0fdf4;color:#166534}
.shl-addon-panel .shwa-alert.is-error{border-color:#fecaca;background:#fef2f2;color:#991b1b}
.shl-addon-panel .shwa-form{margin:0;display:inline-flex}
.shl-addon-panel .shwa-segmented{display:inline-flex;padding:4px;border:1px solid var(--shwa-border);border-radius:12px;background:#f8fafc;gap:4px}
.shl-addon-panel .shwa-segment{min-height:38px;border:0;background:transparent;color:#334155}
.shl-addon-panel .shwa-segment.is-active{background:#0f172a;color:#fff}
.shl-addon-panel .shwa-method-panel{border-top:1px solid var(--shwa-border);padding-top:16px}
.shl-addon-panel .shwa-qr-stage{display:flex;flex-direction:column;align-items:center;text-align:center}
.shl-addon-panel .shwa-qr-shell{display:flex;align-items:center;justify-content:center;min-height:248px;width:100%;max-width:340px;padding:16px;border:1px solid var(--shwa-border);border-radius:14px;background:#fff}
.shl-addon-panel .shwa-qr-shell img{display:block;width:220px;height:220px;object-fit:contain}
.shl-addon-panel .shwa-qr-placeholder{display:grid;place-items:center;width:220px;height:220px;border-radius:12px;background:#f8fafc;font-weight:800;text-align:center;padding:16px;color:var(--shwa-muted)}
.shl-addon-panel .shwa-state-text{margin-top:12px;display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:6px 10px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:13px;font-weight:800}
.shl-addon-panel .shwa-state-text.is-success{background:#dcfce7;color:#166534}
.shl-addon-panel .shwa-state-text.is-error{background:#fee2e2;color:#991b1b}
.shl-addon-panel .shwa-note{margin-top:10px;color:var(--shwa-muted);font-size:13px;line-height:1.5}
.shl-addon-panel .shwa-note-center{text-align:center}
.shl-addon-panel .shwa-stage-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px}
.shl-addon-panel .shwa-pairing-form{display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:680px}
.shl-addon-panel .shwa-pairing-form .shwa-secret{flex:1 1 300px}
	.shl-addon-panel .shwa-code-box{margin:16px 0 12px;display:flex;align-items:center;justify-content:center;min-height:72px;max-width:300px;padding:0 20px;border:1px solid #93c5fd;border-radius:12px;background:#eff6ff;color:#1e3a8a;font-size:30px;letter-spacing:0;font-weight:900}
	.shl-addon-panel .shwa-code-box.is-empty{font-size:14px;color:var(--shwa-muted);font-weight:700;text-align:center}
	.shl-addon-panel .shwa-code-box.is-error{border-color:#fecaca;background:#fef2f2;color:#991b1b}
.shl-addon-panel .shwa-code-note{max-width:360px;padding:12px 14px;border-radius:12px;background:#fffbeb;color:#92400e}
.shl-addon-panel .shwa-code-note strong{display:block;font-size:14px}
.shl-addon-panel .shwa-code-note span{display:block;margin-top:4px;font-size:12px}
.shl-addon-panel .shwa-helper{margin-top:16px;border:1px solid var(--shwa-border);border-radius:12px;background:#f8fafc}
.shl-addon-panel .shwa-helper summary{padding:12px 14px;cursor:pointer;color:var(--shwa-heading);font-weight:800}
.shl-addon-panel .shwa-helper-steps{margin:0;padding:0 18px 14px 34px;color:var(--shwa-text);font-size:13px;line-height:1.7}
.shl-addon-panel .shwa-empty{padding:16px 18px;border:1px solid #fed7aa;border-radius:12px;background:#fff7ed;color:#9a3412}
    .shl-addon-panel .shwa-head{flex-direction:column;align-items:flex-start;padding:18px}
    .shl-addon-panel .shwa-body{padding:16px}
    .shl-addon-panel .shwa-status-card{grid-template-columns:1fr}
    .shl-addon-panel .shwa-status-side{justify-items:stretch}
    .shl-addon-panel .shwa-status-action .shwa-form,.shl-addon-panel .shwa-status-action .shwa-link{width:100%}
    .shl-addon-panel .shwa-status-metrics{grid-template-columns:1fr 1fr}
    .shl-addon-panel .shwa-section-head,.shl-addon-panel .shwa-section-head--split{flex-direction:column;align-items:stretch}
    .shl-addon-panel .shwa-segmented{width:100%;display:grid;grid-template-columns:1fr 1fr}
    .shl-addon-panel .shwa-field-grid{grid-template-columns:1fr}
    .shl-addon-panel .shwa-field.is-wide{grid-column:auto}
    .shl-addon-panel .shwa-secret-wrap{display:grid;grid-template-columns:1fr}
    .shl-addon-panel .shwa-copy,.shl-addon-panel .shwa-btn,.shl-addon-panel .shwa-link,.shl-addon-panel .shwa-actions .shwa-link,.shl-addon-panel .shwa-pairing-form .shwa-link{width:100%}
    .shl-addon-panel .shwa-actions{flex-direction:column}
    .shl-addon-panel .shwa-qr-shell{max-width:100%;min-height:230px}
    .shl-addon-panel .shwa-code-box{max-width:100%;width:100%;font-size:26px}
    .shl-addon-panel .shwa-pairing-form{flex-direction:column;align-items:stretch}
        <div class="shl-addon-panel">
</style>{/literal}

<div class="shl">
  <section class="shl-card" aria-labelledby="shl-title">
    <div class="shl-head">
      <div>
        <h2 class="shl-title" id="shl-title">{$shl.product|escape}</h2>
        <p class="shl-sub">Licence for service #{$shl.serviceid}{if $shl.next_due} · next due {$shl.next_due|escape}{/if}</p>
      </div>
      <span class="shl-pill {$shl.status|escape}">{$shl.status|escape}</span>
    </div>
    <div class="shl-body">
      <label class="shl-label" for="shl-key">Licence key</label>
      {if $shl.key}
      <div class="shl-key">
        <input id="shl-key" type="text" value="{$shl.key|escape}" readonly onclick="this.select()">
        <button type="button" class="shl-btn" onclick="var i=document.getElementById('shl-key');i.select();(navigator.clipboard?navigator.clipboard.writeText(i.value):Promise.reject()).then(function(){ this.textContent='Copied'; }.bind(this)).catch(function(){ document.execCommand('copy'); });">Copy</button>
      </div>
      <p class="shl-note">Paste this key in the module's settings in your WHMCS admin, then save. The module activates itself on this domain and folder.</p>
      {else}
      <p class="shl-note">Your licence key is being prepared. Refresh this page in a minute; if it still isn't here, open a support ticket.</p>
      {/if}

      <div class="shl-grid">
        <div class="shl-stat"><span>Installations</span><b>{$shl.seats_used} / {$shl.seats}</b></div>
        <div class="shl-stat"><span>Updates until</span><b>{$shl.updates_until|escape}</b></div>
        <div class="shl-stat"><span>Support until</span><b>{$shl.support_until|escape}</b></div>
        <div class="shl-stat"><span>Billing</span><b>{$shl.billing_cycle|escape}</b></div>
      </div>

      <div class="shl-row">
        {if $shl.release && $shl.status == 'active'}
        <a class="shl-btn primary" href="{$shl.download_url}" {if !$shl.updates_valid && !$shl.release.is_security}aria-disabled="true"{/if}>Download version {$shl.release.version|escape}</a>
        {/if}
        {if $shl.can_reissue}
        <a class="shl-btn" href="{$shl.reissue_url}" onclick="return confirm('Reissue this licence? Every installation using it will need to activate again. Use this to move the module to a new domain or folder.');">Reissue (move installation)</a>
        {/if}
        {if $shl.key && $shl.status == 'active'}
        <a class="shl-btn" href="{$shl.regenerate_url}" onclick="return confirm('Generate a new licence key? The current key stops working immediately and every installation must be activated again with the new one.');">Regenerate key</a>
        {/if}
      </div>
      {if $shl.can_reissue}<p class="shl-note">{$shl.reissue_note|escape}</p>{/if}
      {if !$shl.updates_valid}<p class="shl-note">Your update entitlement has lapsed; renew the service to download new versions. Security releases stay available.</p>{/if}
    </div>
  </section>

  <section class="shl-card" aria-labelledby="shl-installs">
    <div class="shl-head"><h3 class="shl-title" id="shl-installs" style="font-size:16px">Where this licence is active</h3></div>
    {if $shl.activations}
    <div style="overflow-x:auto">
    <table class="shl-table">
      <thead><tr><th scope="col">Domain</th><th scope="col">Folder</th><th scope="col">Version</th><th scope="col">Last check-in</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead>
      <tbody>
      {foreach $shl.activations as $a}
        <tr>
          <td><strong>{$a.domain|escape}</strong></td>
          <td><code>{$a.install_dir|escape}</code></td>
          <td>{if $a.software_version}{$a.software_version|escape}{else}—{/if}</td>
          <td>{if $a.last_heartbeat_at}{$a.last_heartbeat_at|date_format:"%e %b %Y"}{else}—{/if}</td>
          <td style="text-align:right"><a class="shl-btn" style="min-height:36px" href="{$shl.revoke_url}{$a.id}" onclick="return confirm('Remove {$a.domain|escape:'javascript'} from this licence? That installation stops working until it is activated again.');">Remove</a></td>
        </tr>
      {/foreach}
      </tbody>
    </table>
    </div>
    {else}
    <div class="shl-empty">Not activated anywhere yet. Enter the key in your module's settings to activate it.</div>
    {/if}
  </section>

  {if $shl.release}
  <section class="shl-card" aria-labelledby="shl-release">
    <div class="shl-body">
      <div class="shl-release">
        <div><span class="shl-label" id="shl-release">Latest version</span><strong>{$shl.release.version|escape}</strong>{if $shl.release.is_security}<span class="shl-security">Security release</span>{/if}</div>
        <span class="shl-note" style="margin:0">Released {$shl.release.released_at|date_format:"%e %b %Y"} · SHA-256 <code title="{$shl.release.package_sha256|escape}">{$shl.release.package_sha256|truncate:16:"…"|escape}</code></span>
      </div>
      {if $shl.release.changelog}<div class="shl-changelog">{$shl.release.changelog|escape}</div>{/if}
    </div>
  </section>
  {/if}

  {if $whatsappAddonPanel}<div class="shl-addon-panel">{$whatsappAddonPanel}</div>{/if}
</div>
