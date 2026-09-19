{* Public licence verification — shows only product, status and issue date. *}
<div style="max-width:560px;margin:0 auto">
  <h2 style="margin-top:0">Verify a ShrotiHost licence</h2>
  <p class="text-muted">Check whether a licence key for a ShrotiHost WHMCS module is genuine and active.</p>
  {if !$enabled}
    <div class="alert alert-info">Licence verification is not available right now.</div>
  {else}
  <form method="get" action="index.php" style="display:flex;gap:8px;margin:18px 0">
    <input type="hidden" name="m" value="shrotihost_license_admin">
    <input type="hidden" name="action" value="verify">
    <label for="shla-key" class="sr-only">Licence key</label>
    <input id="shla-key" name="license_key" class="form-control" value="{$query|escape}" placeholder="SHROTI-XX-XXXXX-XXXXX-XXXXX-XXXXX" autocomplete="off" required style="font-family:ui-monospace,Menlo,monospace">
    <button class="btn btn-primary" type="submit">Verify</button>
  </form>
  {if $error}<div class="alert alert-warning" role="status">{$error|escape}</div>{/if}
  {if $result}
    <div class="panel panel-default" role="status"><div class="panel-body">
      <p style="margin:0 0 6px"><strong>{$result.product|escape}</strong></p>
      <p style="margin:0 0 6px">Status: <strong>{if $result.status == 'active'}<span class="text-success">Genuine &amp; active</span>{else}<span class="text-danger">{$result.status|escape|capitalize}</span>{/if}</strong></p>
      <p class="text-muted" style="margin:0">Key {$result.hint|escape} · issued {$result.issued|escape}</p>
    </div></div>
  {/if}
  {/if}
</div>
