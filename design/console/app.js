(() => {
  "use strict";

  /* ═══════════════════════════════ helpers ═══════════════════════════════ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ic = (name, cls = "i") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("shl." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("shl." + k, JSON.stringify(v)); } catch (e) { /* storage unavailable: preference lasts this visit only */ } },
  };
  const reduceMotion = () => document.documentElement.getAttribute("data-motion") === "reduce";
  const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion() ? 0 : ms));

  /* ═══════════════════════════════ snapshot data ═══════════════════════════════
     Real state of licensing.shrotihost.in, captured 19 Sep 2026 14:01 IST (08:31 UTC).
     Times and ages are shown "as of" this moment, never as live. */
  const SNAP = Date.UTC(2026, 8, 19, 8, 31, 0);
  const T = (hh, mm, ss = 0, d = 19) => Date.UTC(2026, 8, d, hh, mm, ss);
  const DAY = 86400000;

  const PRODUCTS = {
    wa:  { key: "wa",  slug: "shrotihost-whatsapp-manager-whmcs", name: "WhatsApp Manager", short: "WA", prefix: "SHROTI-WM", version: "2.0", icon: "pulse",
           plans: [["#63", "ShrotiHost WhatsApp Manager WHMCS", "Recurring · annual"], ["#64", "WhatsApp Manager Trial", "Trial · 7 days"]] },
    sgf: { key: "sgf", slug: "smart-gateway-fees-and-gateway-allocator-for-whmcs", name: "Smart Gateway Fees", short: "SGF", prefix: "SHROTI-SGF", version: "1.0", icon: "cube",
           plans: [["#62", "Smart Gateway Fees And Gateway Allocator", "Recurring · annual"], ["#65", "Smart Gateway Fees (trial, hidden)", "Recurring"]] },
    sp:  { key: "sp",  slug: "social-proof-premium", name: "Social Proof Premium", short: "SP", prefix: "SHROTI-SP", version: "2.0", icon: "grid",
           plans: [["#59", "Social Proof Premium – Real-Time Sales Notification", "Recurring · annual"], ["#60", "Social Proof Premium – Open Source", "No licences issued"]] },
  };

  const L = (id, svc, hint, p, status, client, max, updates) => ({ id, svc, hint, p, status, client, max, updates, created: T(8, 14, 39) });
  const LICENCES = [
    L(1, 338, "SHROTI-SP-…-AE5D", "sp", "active", "Shroti Host", 1, "2027-03-10"),
    L(2, 339, "SHROTI-SP-…-77D1", "sp", "active", "Shroti Host", 1, "2027-03-10"),
    L(3, 342, "SHROTI-WM-…-6FC7", "wa", "active", "Shroti Host", 1, "2027-03-20"),
    L(4, 343, "SHROTI-WM-…-9EFF", "wa", "active", "Shroti Host", 1, "2027-03-20"),
    L(5, 346, "SHROTI-WM-…-E3BE", "wa", "suspended", "HIFI Tech India", 1, "2026-03-25"),
    L(6, 347, "SHROTI-WM-…-B6FD", "wa", "terminated", "—", 1, null),
    L(7, 349, "SHROTI-WM-…-4EF5", "wa", "terminated", "—", 1, null),
    L(8, 350, "SHROTI-WM-…-FAA3", "wa", "terminated", "—", 1, null),
    L(9, 354, "SHROTI-SGF-…-82CE", "sgf", "active", "Shroti Host", 2, "2027-04-02"),
    L(10, 355, "SHROTI-WM-…-F20A", "wa", "terminated", "—", 1, null),
    L(11, 366, "SHROTI-SGF-…-355C", "sgf", "terminated", "—", 1, null),
    L(12, 367, "SHROTI-SGF-…-F111", "sgf", "terminated", "—", 1, null),
    L(13, 370, "SHROTI-SGF-…-56D0", "sgf", "terminated", "—", 1, null),
    L(14, 371, "SHROTI-SGF-…-6D55", "sgf", "terminated", "—", 1, null),
    L(15, 372, "SHROTI-WM-…-629B", "wa", "terminated", "—", 1, null),
    L(16, 376, "SHROTI-WM-…-8AE3", "wa", "terminated", "—", 1, null),
    L(17, 377, "SHROTI-SGF-…-C8F8", "sgf", "terminated", "—", 1, null),
    L(18, 382, "SHROTI-SGF-…-07AC", "sgf", "terminated", "—", 1, null),
  ];

  const I = (id, domain, p, lic, ver, hb, inst, note) => ({
    id, domain, p, lic, ver, hb, inst, note, php: "8.1.34", whmcs: "8.13.1", ip: "141.95.16.140",
    dir: domain === "portal.shrotihost.in" ? "/home/shrotihost/portal.shrotihost.in" : "/home/codemarket/license.codemarket.in",
  });
  const INSTALLS = [
    I("i1", "portal.shrotihost.in", "wa", 3, "2.0", T(8, 23, 4), "shl_in_jLP2ZPy0kRrcm14QDRprrA", "No WhatsApp delivery receipts are reaching this install."),
    I("i2", "portal.shrotihost.in", "sgf", 9, "1.0", T(8, 22, 21), "shl_in_cAOSxXb…"),
    I("i3", "portal.shrotihost.in", "sp", 2, "2.0", T(8, 25, 3), "shl_in_RhA5W4j…"),
    I("i4", "license.codemarket.in", "wa", 4, "2.0", T(8, 24, 3), "shl_in_8vedfnz…"),
    I("i5", "license.codemarket.in", "sgf", 9, "1.0", T(8, 24, 21), "shl_in_s0ahsgQ…"),
    I("i6", "license.codemarket.in", "sp", 1, "2.0", T(8, 25, 2), "shl_in_WYHNP09…"),
  ];

  const RELEASES = [
    { p: "wa", version: "2.0", size: "529 KB", files: 105, sha: "a46c01fc2940d919", at: "19 Sep 2026" },
    { p: "sgf", version: "1.0", size: "172 KB", files: 61, sha: "ff4c31ae6703d289", at: "19 Sep 2026" },
    { p: "sp", version: "2.0", size: "35 KB", files: 7, sha: "a078c4393eacb66f", at: "19 Sep 2026" },
  ];

  const KEYS = [
    { kid: "shl-2026-09", role: "active", fp: "SHA256:b3:0f:f8:63:e6:9f:d5:61:ca:07:d0:f6:71:95:7a:11", pub: "BYr8VFio0MqGdQ00RmnizpImGgAABO1kwz-vhf9Q19c", created: "19 Sep 2026", lastUsed: T(8, 25, 3) },
    { kid: "shl-2027-03", role: "next", fp: "SHA256:2e:99:08:23:1a:bc:15:9b:e9:f7:0b:02:29:b6:df:0c", pub: "qrtTmhOoYlA3KLjzvEpidcQAd26qtiCZzplfxEEYTgM", created: "19 Sep 2026", lastUsed: null },
  ];

  /* Recorded events (from the server's event log). */
  const EVENTS = [
    { t: T(8, 13, 13), k: "admin_auth_failure", lv: "warn", lic: null, d: "admin API · unknown key id · 141.95.16.140" },
    { t: T(8, 14, 39), k: "license_adopted", lv: "info", lic: null, d: "18 existing keys registered from WHMCS" },
    { t: T(8, 15, 58), k: "license_updated", lv: "info", lic: 9, d: "#9 · seats 1 → 2 (WHMCS allocation override)" },
    { t: T(8, 22, 8), k: "activated", lv: "ok", lic: 3, inst: "i1", d: "#3 · portal.shrotihost.in · WhatsApp Manager" },
    { t: T(8, 22, 21), k: "activated", lv: "ok", lic: 9, inst: "i2", d: "#9 · portal.shrotihost.in · Smart Gateway Fees" },
    { t: T(8, 22, 51), k: "reactivated", lv: "ok", lic: 2, inst: "i3", d: "#2 · portal.shrotihost.in · Social Proof Premium" },
    { t: T(8, 23, 59), k: "activation_failed", lv: "warn", lic: null, d: "unknown key · license.codemarket.in · Smart Gateway Fees" },
    { t: T(8, 23, 59), k: "activation_failed", lv: "warn", lic: null, d: "unknown key · license.codemarket.in · Smart Gateway Fees" },
    { t: T(8, 23, 59), k: "activated", lv: "ok", lic: 4, inst: "i4", d: "#4 · license.codemarket.in · WhatsApp Manager" },
    { t: T(8, 23, 59), k: "activated", lv: "ok", lic: 1, inst: "i6", d: "#1 · license.codemarket.in · Social Proof Premium" },
    { t: T(8, 24, 2), k: "activated", lv: "ok", lic: 9, inst: "i5", d: "#9 · license.codemarket.in · Smart Gateway Fees" },
    { t: T(8, 26, 41), k: "release_created", lv: "info", lic: null, d: "3 signed releases published" },
  ];

  const SECURITY = [
    { id: "s1", t: T(8, 23, 59), sev: "warn", kind: "Refused activation", code: "activation_failed", count: 2,
      what: "Smart Gateway Fees on license.codemarket.in tried to activate with a key this server does not know — its old key, retired during the switch-over.",
      licence: "none (key not recognised)", install: "license.codemarket.in · Smart Gateway Fees",
      outcome: "Resolved 22 s later: the install activated with licence #9 at {T:08:24:21}.",
      action: "No action needed. If it repeats, check the licence key saved in that module's settings.", to: "#/installations/i5", angle: 40, radius: .34 },
    { id: "s2", t: T(8, 23, 59), sev: "warn", kind: "Refused activation", code: "activation_failed", count: 1, dup: "s1",
      what: "Second attempt with the same retired key, from the module's own validation during the same page load.",
      licence: "none (key not recognised)", install: "license.codemarket.in · Smart Gateway Fees",
      outcome: "Resolved with s1.", action: "No action needed.", to: "#/installations/i5", angle: 58, radius: .38 },
    { id: "s3", t: T(8, 13, 13), sev: "warn", kind: "Admin authentication failure", code: "admin_auth_failure", count: 1,
      what: "An admin API request presented a key id the server does not recognise. It came from this server (141.95.16.140) during deployment testing.",
      licence: "—", install: "—", outcome: "Request refused (401). No data returned.",
      action: "If you did not run that test, rotate ADMIN_API_SECRET and review who can reach the admin API.", to: "#/access", angle: 205, radius: .62 },
  ];

  const DETECTORS = [
    ["Signature failure", "Request HMAC did not match", 0],
    ["Replay detection", "Nonce reused inside the 5-minute window", 0],
    ["Clock skew", "Install clock off by more than 120 s", 0],
    ["Binding move", "Install seen on a new domain or folder", 0],
    ["Blacklist hit", "Blocked key, domain or IP", 0],
    ["Refused activation", "Unknown, suspended or over-limit key", 2],
    ["Admin auth failure", "Admin API credential rejected", 1],
  ];

  /* ═══════════════════════════════ state ═══════════════════════════════ */
  const state = {
    theme: store.get("themePref", null) ?? (() => { try { return localStorage.getItem("shl.theme") || "dark"; } catch (e) { return "dark"; } })(),
    motion: store.get("motionPref", "system"),
    time: store.get("timePref", "ist"),
    lab: "normal",
    inst: { q: "", p: "", ver: "", php: "", whmcs: "", status: "", sort: { key: "domain", dir: 1 } },
    lic: { q: "", status: "", p: "", sort: { key: "id", dir: 1 } },
    secSel: null,
    recents: store.get("recents", []),
  };

  /* ═══════════════════════════════ formatting ═══════════════════════════════ */
  /* Times show in Indian Standard Time by default; UTC is one setting away. */
  const TZ = () => (state.time === "utc" ? { tz: "UTC", name: "UTC", off: 0 } : { tz: "Asia/Kolkata", name: "IST", off: 330 });
  const fmtTime = (ts, withDate = false) => {
    const z = TZ(), d = new Date(ts);
    const hms = d.toLocaleTimeString("en-GB", { timeZone: z.tz, hour12: false });
    if (!withDate) return `${hms} ${z.name}`;
    const day = d.toLocaleDateString("en-GB", { timeZone: z.tz, day: "numeric", month: "short" });
    return `${day} ${hms.slice(0, 5)} ${z.name}`;
  };
  const hhmm = (ts) => `${fmtTime(ts).slice(0, 5)} ${TZ().name}`;
  const localHour = (ts) => new Date(ts + TZ().off * 60000).getUTCHours();
  const rel = (ts) => {
    const s = Math.round((SNAP - ts) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} d ago`;
  };
  const fmtDate = (iso) => iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

  const LV_ICON = { ok: "ok", warn: "warn", bad: "bad", info: "info", idle: "idle" };
  const status = (lv, text) => `<span class="status s-${lv}">${ic(LV_ICON[lv])}${esc(text)}</span>`;
  const licStatus = (s) => status({ active: "ok", suspended: "warn", terminated: "idle", expired: "bad" }[s] || "idle", s[0].toUpperCase() + s.slice(1));
  const prodDot = (p) => `<span class="pd"><i style="background:var(--p-${p})" aria-hidden="true"></i>${esc(PRODUCTS[p].name)}</span>`;

  /* ═══════════════════════════════ derived state (lab-aware) ═══════════════════════════════ */
  const data = () => {
    const empty = state.lab === "empty";
    return {
      licences: empty ? [] : LICENCES,
      installs: empty ? [] : INSTALLS,
      events: empty ? [] : EVENTS,
      security: empty ? [] : SECURITY,
    };
  };
  const systemStatus = () => ({
    normal: { lv: "ok", text: "Operational" }, loading: { lv: "ok", text: "Operational" }, empty: { lv: "ok", text: "Operational" },
    degraded: { lv: "warn", text: "Degraded" }, offline: { lv: "bad", text: "Offline" }, error: { lv: "bad", text: "Offline" },
    denied: { lv: "ok", text: "Operational" }, maintenance: { lv: "info", text: "Maintenance" },
  }[state.lab]);
  const HEALTH = () => {
    const deg = state.lab === "degraded", off = state.lab === "offline" || state.lab === "error", mnt = state.lab === "maintenance";
    const row = (name, detail, lv, text, pct, metric) => ({ name, detail, lv, text, pct, metric });
    if (off) return ["API", "Database", "Licensing engine", "Signing service", "Telemetry", "Update service"].map((n) => row(n, "no response", "bad", "Unreachable", 0, "—"));
    return [
      row("API", "GET /api/keys from the portal", deg ? "warn" : "ok", deg ? "Slow" : "Operational", deg ? 62 : 100, deg ? "1.9 s" : "97 ms"),
      row("Database", "Neon Postgres · fra1", "ok", "Operational", 100, "health check"),
      row("Licensing engine", "activate · heartbeat · deactivate", "ok", "Operational", 100, "6/6 activated"),
      row("Signing service", "Ed25519 · shl-2026-09", mnt ? "info" : "ok", mnt ? "Rotation window" : "Operational", 100, "self-test ok"),
      row("Telemetry", "install heartbeats · 24 h", deg ? "warn" : "ok", deg ? "Degraded" : "Operational", deg ? 67 : 100, deg ? "4/6 in 24 h" : "6/6 in 24 h"),
      row("Update service", "signed manifests · one-time links", "ok", "Operational", 100, "3 releases"),
    ];
  };

  /* ═══════════════════════════════ reusable blocks ═══════════════════════════════ */
  const emptyState = (title, body, action = "") => `<div class="empty"><h3>${esc(title)}</h3><div class="rule" aria-hidden="true"></div><p>${esc(body)}</p>${action}</div>`;
  const errorState = (title, body, code) => `<div class="error" role="alert"><h3>${esc(title)}</h3><p>${esc(body)}</p>
    <div class="meta">${esc(code)} · Request ID 8F3A21</div>
    <div class="actions" style="justify-content:center"><button class="btn primary" data-action="retry">Retry</button><a class="btn" href="#/overview?focus=health">View diagnostics</a></div></div>`;
  const deniedState = () => `<div class="empty"><h3>Access restricted</h3><div class="rule" aria-hidden="true"></div><p>Your role (Viewer) can see licences but not change them. Ask the owner for the Operator role.</p></div>`;
  const skeleton = (rows = 4) => `<div class="sk-block" aria-hidden="true">${Array.from({ length: rows }, (_, i) => `<div class="sk" style="width:${[92, 64, 80, 48, 72][i % 5]}%"></div>`).join("")}</div><span class="sr-only">Loading…</span>`;
  const labBody = (fn) => {
    if (state.lab === "loading") return skeleton();
    if (state.lab === "offline") return errorState("Telemetry channel degraded", "The licensing service could not be reached from this console.", "HTTP 503");
    if (state.lab === "error") return errorState("Request failed", "The licensing service returned an error while loading this data.", "HTTP 500");
    return fn();
  };
  const canAct = () => state.lab !== "denied";

  /* Responsive table: cards on phones via data-label. */
  function table({ id, caption, cols, rows, rowHref, sort, empty }) {
    if (!rows.length) return empty;
    const th = cols.map((c) => {
      const s = sort && c.sort ? (sort.key === c.key ? (sort.dir > 0 ? "ascending" : "descending") : "none") : null;
      return `<th scope="col"${s ? ` aria-sort="${s}"` : ""}>${c.sort ? `<button type="button" data-sort="${id}:${c.key}">${esc(c.label)}</button>` : esc(c.label)}</th>`;
    }).join("");
    const tr = rows.map((r) => {
      const href = rowHref ? rowHref(r) : null;
      return `<tr${href ? ` data-href="${href}" tabindex="0"` : ""}>${cols.map((c, i) => `<td data-label="${esc(c.label)}"${i === 0 ? " data-primary" : ""}${c.cls ? ` class="${c.cls}"` : ""}>${c.render(r)}</td>`).join("")}</tr>`;
    }).join("");
    return `<div class="table-wrap"><table class="t" id="${id}"><caption class="sr-only">${esc(caption)}</caption><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
  }
  const sortRows = (rows, sort, getters) => {
    const g = getters[sort.key] || ((r) => r[sort.key]);
    return [...rows].sort((a, b) => { const x = g(a), y = g(b); return (x > y ? 1 : x < y ? -1 : 0) * sort.dir; });
  };

  /* ═══════════════════════════════ views ═══════════════════════════════ */
  const VIEWS = {};

  /* ── Overview ── */
  VIEWS.overview = () => {
    const D = data();
    const ss = systemStatus();
    const active = D.licences.filter((l) => l.status === "active").length;
    const susp = D.licences.filter((l) => l.status === "suspended").length;
    const term = D.licences.filter((l) => l.status === "terminated").length;
    const total = D.licences.length || 1;
    const healthy = D.installs.length;
    const failed = D.events.filter((e) => e.k === "activation_failed").length;
    const secW = D.security.length;
    const coreState = { ok: "idle", warn: "warning", bad: "critical", info: "processing" }[ss.lv];
    const kpi = (href, label, value, note, meter, warn) => `<a class="kpi" href="${href}"><span class="kpi-label">${esc(label)}${ic("arrow")}</span><span class="kpi-value${warn ? " warn" : ""}">${value}</span><span class="kpi-note">${note}</span>${meter}</a>`;
    const meter = (parts) => `<span class="meter" aria-hidden="true">${parts.map(([n, c]) => `<span class="${c}" style="width:${(n / total) * 100}%"></span>`).join("")}</span>`;

    return `
      <div class="page-head">
        <div><span class="eyebrow accent">Control plane · overview</span><h1 class="h1" tabindex="-1">${ss.lv === "ok" ? "All systems operational" : ss.lv === "warn" ? "Service degraded — telemetry and API latency need attention" : ss.lv === "info" ? "Scheduled maintenance in progress" : "Licensing service unreachable"}</h1>
          <p class="lede">State as of ${fmtTime(SNAP, true)}. ${D.installs.length} installations reporting, ${secW} security warnings and 0 critical events in the last 7 days.</p></div>
        <div class="actions"><button class="btn" data-action="replay">${ic("play")}Replay switch-over</button><a class="btn primary" href="#/licences?new=1">${ic("plus")}New licence</a></div>
      </div>

      <section class="panel core hud" aria-labelledby="core-h" data-core="${coreState}" id="core-panel">
        <div class="core-vis">
          <div class="orbit" role="img" aria-label="Signing core ${ss.lv === "ok" ? "healthy" : ss.text.toLowerCase()}">
            <div class="ring r1"><span class="sat"></span></div><div class="ring r2"><span class="sat"></span></div><div class="ring r3"></div>
            <div class="orbit-core">${ic("sig")}</div>
          </div>
          <div class="core-cap">Signing core · Ed25519</div>
        </div>
        <div class="core-info">
          <div class="core-top">
            <div><span class="eyebrow">Signing infrastructure</span><h2 class="h2" id="core-h" style="margin-top:6px">Every entitlement is signed by <span class="mono">shl-2026-09</span></h2></div>
            ${status(ss.lv, ss.lv === "ok" ? "Operational" : ss.text)}
          </div>
          <dl class="facts">
            <div><dt>Algorithm</dt><dd>Ed25519<small>compact JWS · EdDSA</small></dd></div>
            <div><dt>Active key</dt><dd>shl-2026-09<small>b3:0f:f8:63…7a:11</small></dd></div>
            <div><dt>Next key</dt><dd>shl-2027-03<small>bundled in 3/3 modules</small></dd></div>
            <div><dt>Rotation window</dt><dd>21 days<small>7 d token + 14 d grace</small></dd></div>
          </dl>
          <div class="actions"><a class="btn" href="#/keys">${ic("key")}View signing keys</a><button class="btn ghost" data-action="verify-sample">${ic("sig")}Run verification</button></div>
        </div>
      </section>

      <section class="panel kpis" aria-label="Operational metrics">
        ${labBody(() => [
          kpi("#/licences", "Active licences", active, `of ${D.licences.length} · ${susp} suspended · ${term} terminated`, meter([[active, "ok"], [susp, "warn"], [term, "idle"]])),
          kpi("#/installations", "Installations", healthy, `${healthy} healthy · 0 stale`, `<span class="meter" aria-hidden="true"><span class="ok" style="width:${healthy ? 100 : 0}%"></span></span>`),
          kpi("#/licences", "Expiring soon", 0, "next 30 days · next renewal 10 Mar 2027", `<span class="meter" aria-hidden="true"></span>`),
          kpi("#/security", "Failed activations", failed, failed ? "last 24 h · retired key on codemarket" : "last 24 h", `<span class="meter" aria-hidden="true"><span class="warn" style="width:${failed ? 100 : 0}%"></span></span>`, failed > 0),
          kpi("#/security", "Security events", secW, `7 days · ${secW} warnings · 0 critical`, `<span class="meter" aria-hidden="true"><span class="warn" style="width:${secW ? 100 : 0}%"></span></span>`, secW > 0),
        ].join(""))}
      </section>

      <div class="grid-2">
        <section class="panel" aria-labelledby="attn-h">
          <div class="panel-head"><div><span class="eyebrow">Operations</span><h2 class="h2" id="attn-h">Needs attention</h2></div><span class="chip warn">${ic("warn")}2 warnings</span></div>
          ${labBody(() => D.installs.length ? `<ul class="attn">
            <li><span class="ico warn active">${ic("warn")}</span><div><b>WhatsApp delivery receipts are not reaching portal.shrotihost.in</b><p>Account health cannot be judged, so auto-pause stays off until receipts flow.</p><div class="meta">180 messages · 0 receipts · install i1 · licence #3</div></div><a class="btn sm" href="#/installations/i1">Investigate</a></li>
            <li><span class="ico warn">${ic("warn")}</span><div><b>2 refused activations on license.codemarket.in</b><p>A retired key was tried during the switch-over; the install activated with licence #9 22 s later.</p><div class="meta">${fmtTime(T(8, 23, 59))} · ${rel(T(8, 23, 59))} · resolved</div></div><a class="btn sm" href="#/security?event=s1">Review event</a></li>
            <li><span class="ico info">${ic("info")}</span><div><b>Licence #5 is suspended — order unpaid since 25 Mar 2026</b><p>HIFI Tech India · WhatsApp Manager. WHMCS will terminate it when the order is cancelled.</p></div><a class="btn sm" href="#/licences/5">Review licence</a></li>
            <li><span class="ico info">${ic("info")}</span><div><b>Signing-key rotation rehearsal not recorded</b><p>The next key is bundled everywhere; steps 4–5 of the rotation checklist are still open.</p></div><a class="btn sm" href="#/keys">Review</a></li>
            <li><span class="ico info">${ic("info")}</span><div><b>Licensing server runs on a Vercel Hobby plan</b><p>Hobby is for non-commercial use. Upgrade the support-2550 team to Pro.</p></div><a class="btn sm" href="#/settings">Details</a></li>
          </ul>` : emptyState("Nothing needs attention", "No warnings, expiries or failed activations right now."))}
        </section>

        <section class="panel hud" aria-labelledby="health-h" id="health">
          <div class="panel-head"><div><span class="eyebrow">Node status</span><h2 class="h2" id="health-h">System health</h2></div>${status(ss.lv, ss.text)}</div>
          ${state.lab === "loading" ? skeleton(6) : `<ul class="health">${HEALTH().map((h) => `<li><span class="name">${esc(h.name)}<small>${esc(h.detail)}</small></span><span class="bar" aria-hidden="true"><span class="${h.lv === "ok" || h.lv === "info" ? "" : h.lv}" style="width:${h.pct}%"></span></span><span style="display:grid;justify-items:end;gap:2px">${status(h.lv, h.text)}<span class="mono muted" style="font-size:11px">${esc(h.metric)}</span></span></li>`).join("")}</ul>`}
          <div class="panel-foot mono">Checked ${fmtTime(SNAP)} · region fra1 · from portal.shrotihost.in</div>
        </section>
      </div>

      <section class="panel" aria-labelledby="lanes-h">
        <div class="panel-head"><div><span class="eyebrow">Entitlements · to scale</span><h2 class="h2" id="lanes-h">Token lifecycle per installation</h2></div>
          <div class="legend"><span><i style="background:var(--success)"></i>valid · 7 d</span><span><i style="background:var(--warning)"></i>offline grace · 14 d</span><span><i style="background:var(--text)"></i>snapshot</span></div></div>
        ${labBody(() => D.installs.length ? lanes(D.installs) : emptyState("No active installations", "Telemetry is waiting for the first authenticated heartbeat.", `<a class="btn" href="#/products">View installation guide</a>`))}
      </section>

      <div class="grid-2">
        <section class="panel" aria-labelledby="topo-h">
          <div class="panel-head"><div><span class="eyebrow">Topology</span><h2 class="h2" id="topo-h">Installations → signing core</h2></div>
            <div class="legend"><span><i style="background:var(--p-wa)"></i>WhatsApp</span><span><i style="background:var(--p-sgf)"></i>Gateway Fees</span><span><i style="background:var(--p-sp)"></i>Social Proof</span></div></div>
          ${labBody(() => D.installs.length ? topology() : emptyState("No installations", "Nodes appear here once a module activates."))}
        </section>
        <section class="panel" aria-labelledby="stream-h">
          <div class="panel-head"><div><span class="eyebrow">Telemetry</span><h2 class="h2" id="stream-h">Recorded events</h2></div><span class="chip">${fmtTime(T(8, 13, 13)).slice(0, 5)}–${hhmm(T(8, 26, 41))}</span></div>
          ${labBody(() => D.events.length ? `<div class="stream" id="stream" role="log" aria-label="Recorded licensing events">${D.events.map(evRow).join("")}</div>` : emptyState("No events recorded", "Events appear as installs activate, check in and receive updates."))}
        </section>
      </div>

      <section class="panel" aria-labelledby="raster-h">
        <div class="panel-head"><div><span class="eyebrow">Signal</span><h2 class="h2" id="raster-h">Heartbeats · 24 hours to ${hhmm(SNAP)}</h2></div><span class="chip">Hatched hours ran on the old licence server</span></div>
        ${labBody(() => D.installs.length ? raster(D.installs) : emptyState("No heartbeats", "Nothing has checked in yet."))}
      </section>`;
  };

  function lanes(installs) {
    const from = T(8, 0) - DAY, to = T(8, 0) + 22 * DAY, span = to - from;
    const pct = (t) => Math.max(0, Math.min(100, ((t - from) / span) * 100));
    const rows = installs.map((i) => {
      const exp = i.hb + 7 * DAY, grace = exp + 14 * DAY;
      return `<div class="lane"><div class="who"><b>${esc(i.domain)}</b><span>${PRODUCTS[i.p].short} ${i.ver} · #${i.lic}</span></div>
        <div class="track" role="img" aria-label="${esc(i.domain)} ${esc(PRODUCTS[i.p].name)}: valid to ${new Date(exp).toUTCString().slice(5, 16)}, grace to ${new Date(grace).toUTCString().slice(5, 16)}">
          <span class="seg-valid" style="left:${pct(i.hb)}%;width:${pct(exp) - pct(i.hb)}%"></span><span class="seg-grace" style="left:${pct(exp)}%;width:${pct(grace) - pct(exp)}%"></span><span class="now-mark" style="left:${pct(SNAP)}%"></span>
        </div><div class="left">${Math.round((exp - SNAP) / DAY)} d left</div></div>`;
    }).join("");
    const ticks = [0, 7, 14, 21].map((d) => `<span style="left:${pct(T(8, 0) + d * DAY)}%">${d ? "+" + d + " d" : "issued"}</span>`).join("");
    return `<div class="lanes">${rows}<div class="lane axis"><div></div><div class="ticks">${ticks}</div><div></div></div>
      <p class="muted" style="font-size:12px">Installs refresh daily, so each green bar restarts long before it ends. If this server went dark, installs keep working through the amber window before they hold their queues.</p></div>`;
  }

  function raster(installs) {
    const endH = localHour(SNAP);
    const hours = Array.from({ length: 24 }, (_, k) => (endH - 23 + k + 24) % 24);
    const liveHoursAgo = Math.floor((SNAP - T(8, 22)) / 3600000);
    const rows = installs.map((i) => `<div class="rrow"><div class="who"><b>${esc(i.domain)}</b><span>${PRODUCTS[i.p].short}</span></div><div class="cells">${hours.map((h, k) => {
      const ago = 23 - k;
      const cls = ago > liveHoursAgo ? "cell pre" : "cell on";
      return `<span class="${cls}" title="${String(h).padStart(2, "0")}:00 ${TZ().name}${ago > liveHoursAgo ? " · old licence server" : " · heartbeat"}"></span>`;
    }).join("")}</div></div>`).join("");
    return `<div class="raster" role="img" aria-label="All ${installs.length} installations checked in during the current hour; earlier hours ran on the old licence server.">${rows}<div class="rrow"><div></div><div class="rlabels">${hours.map((h) => `<span>${String(h).padStart(2, "0")}</span>`).join("")}</div></div></div>`;
  }

  const evRow = (e) => `<div class="ev" data-t="${e.t}"><time>${fmtTime(e.t).slice(0, 8)}</time><span class="k ${e.lv}">${esc(e.k)}</span><span class="d">${esc(e.d)}</span></div>`;

  function topology() {
    const W = 640, H = 300, core = { x: 320, y: 150 };
    const hosts = { "portal.shrotihost.in": { x: 128, y: 150 }, "license.codemarket.in": { x: 512, y: 150 } };
    const pos = {};
    const order = { wa: -1, sgf: 0, sp: 1 };
    INSTALLS.forEach((i) => {
      const h = hosts[i.domain], left = h.x < core.x;
      const a = (left ? Math.PI : 0) + order[i.p] * 0.85;
      pos[i.id] = { x: h.x + Math.cos(a) * 64, y: h.y + Math.sin(a) * 64, h };
    });
    const links = Object.entries(hosts).map(([, h]) => `<line class="ln dash" x1="${h.x}" y1="${h.y}" x2="${core.x}" y2="${core.y}"/>`).join("");
    const spokes = INSTALLS.map((i) => `<line class="ln" x1="${pos[i.id].x}" y1="${pos[i.id].y}" x2="${pos[i.id].h.x}" y2="${pos[i.id].h.y}"/>`).join("");
    const nodes = INSTALLS.map((i) => `<a href="#/installations/${i.id}" aria-label="${esc(i.domain)} · ${esc(PRODUCTS[i.p].name)} · healthy"><circle class="n" cx="${pos[i.id].x}" cy="${pos[i.id].y}" r="7" style="stroke:var(--p-${i.p})"/></a>`).join("");
    const hostEls = Object.entries(hosts).map(([n, h]) => `<circle class="host" cx="${h.x}" cy="${h.y}" r="13"/><text class="lbl" x="${h.x}" y="${h.y + 92}" text-anchor="middle">${n}</text>`).join("");
    return `<svg class="topo" id="topo" viewBox="0 0 ${W} ${H}" role="group" aria-label="Topology: 3 installations on portal.shrotihost.in and 3 on license.codemarket.in, all connected to the signing core">
      <circle class="rng" cx="${core.x}" cy="${core.y}" r="60"/><circle class="rng" cx="${core.x}" cy="${core.y}" r="110"/>
      ${links}${spokes}${hostEls}${nodes}
      <circle class="core-c" cx="${core.x}" cy="${core.y}" r="20"/><text class="core-t" x="${core.x}" y="${core.y + 3.5}" text-anchor="middle">CORE</text>
      <text class="lbl sm" x="${core.x}" y="${core.y + 44}" text-anchor="middle">licensing.shrotihost.in · fra1</text>
      <g id="sigs"></g></svg>`;
  }

  /* ── Installations ── */
  VIEWS.installations = (id) => {
    if (id) return installationDetail(id);
    const D = data();
    const f = state.inst;
    const opts = (key, label, values) => `<label class="sr-only" for="f-${key}">${label}</label><select class="sel" id="f-${key}" data-filter="inst:${key}"><option value="">${label}: all</option>${values.map((v) => `<option value="${esc(v[0])}"${f[key] === v[0] ? " selected" : ""}>${esc(v[1])}</option>`).join("")}</select>`;
    return `
      <div class="page-head"><div><span class="eyebrow accent">Monitor</span><h1 class="h1" tabindex="-1">Installations</h1><p class="lede">Every WHMCS that has activated a licence. A copy seen on another domain is told to re-activate and never counts as the original.</p></div></div>
      <section class="panel" aria-label="Installations list">
        <div class="toolbar" role="search">
          <label class="field-inline" for="inst-q">${ic("search")}<span class="sr-only">Search installations</span><input id="inst-q" data-filter="inst:q" value="${esc(f.q)}" placeholder="Search domain, instance, licence, IP…" autocomplete="off"></label>
          ${opts("p", "Product", Object.values(PRODUCTS).map((p) => [p.key, p.name]))}
          ${opts("ver", "Version", [["2.0", "2.0"], ["1.0", "1.0"]])}
          ${opts("php", "PHP", [["8.1.34", "8.1.34"]])}
          ${opts("whmcs", "WHMCS", [["8.13.1", "8.13.1"]])}
          ${opts("status", "Health", [["healthy", "Healthy"], ["stale", "Stale"]])}
          <span class="count" id="inst-count"></span>
        </div>
        <div id="inst-table">${labBody(() => instTable(D.installs))}</div>
      </section>`;
  };
  function instFiltered(list) {
    const f = state.inst, q = f.q.trim().toLowerCase();
    return sortRows(list.filter((i) => (!q || [i.domain, i.inst, "#" + i.lic, i.ip, PRODUCTS[i.p].name, i.dir].join(" ").toLowerCase().includes(q))
      && (!f.p || i.p === f.p) && (!f.ver || i.ver === f.ver) && (!f.php || i.php === f.php) && (!f.whmcs || i.whmcs === f.whmcs) && (!f.status || f.status === "healthy")),
      f.sort, { product: (i) => PRODUCTS[i.p].name, heartbeat: (i) => -i.hb });
  }
  function instTable(list) {
    const rows = instFiltered(list);
    const html = table({
      id: "inst", caption: "Installations", sort: state.inst.sort, rows,
      rowHref: (i) => `#/installations/${i.id}`,
      cols: [
        { key: "domain", label: "Domain", sort: true, cls: "strong", render: (i) => esc(i.domain) },
        { key: "product", label: "Product", sort: true, render: (i) => prodDot(i.p) },
        { key: "ver", label: "Version", sort: true, cls: "mono", render: (i) => esc(i.ver) },
        { key: "php", label: "PHP", cls: "mono", render: (i) => esc(i.php) },
        { key: "whmcs", label: "WHMCS", cls: "mono", render: (i) => esc(i.whmcs) },
        { key: "health", label: "Health", render: (i) => i.note && i.p === "wa" && i.domain.startsWith("portal") ? `${status("ok", "Healthy")} <span class="chip warn" title="${esc(i.note)}">receipts</span>` : status("ok", "Healthy") },
        { key: "heartbeat", label: "Last heartbeat", sort: true, cls: "mono", render: (i) => `${rel(i.hb)} <span class="muted">· ${fmtTime(i.hb).slice(0, 5)}</span>` },
      ],
      empty: list.length ? emptyState("No matching installations", "Try another search or clear the filters.", `<button class="btn" data-action="clear-inst">Clear filters</button>`)
        : emptyState("No active installations", "Telemetry channel is awaiting its first authenticated heartbeat.", `<a class="btn" href="#/products">View installation guide</a>`),
    });
    queueMicrotask(() => { const c = $("#inst-count"); if (c) c.textContent = `${rows.length} of ${list.length}`; });
    return html;
  }

  function installationDetail(id) {
    const i = INSTALLS.find((x) => x.id === id);
    if (!i) return notFound("installation");
    const lic = LICENCES.find((l) => l.id === i.lic);
    const evs = EVENTS.filter((e) => e.inst === id);
    return `
      <nav aria-label="Breadcrumb" class="mono muted" style="font-size:12px"><a href="#/installations">Installations</a> / ${esc(i.domain)} · ${PRODUCTS[i.p].short}</nav>
      <div class="page-head"><div><span class="eyebrow accent">Installation ${esc(i.id)}</span><h1 class="h1" tabindex="-1">${esc(i.domain)}</h1><p class="lede">${esc(PRODUCTS[i.p].name)} ${esc(i.ver)} · licence <a href="#/licences/${i.lic}">#${i.lic}</a></p></div>
        <div class="actions">${status("ok", "Healthy")}<span class="chip ok">${ic("sig")}Signature verified</span></div></div>
      ${i.note ? `<div class="banner" role="note"><span class="tag" style="color:var(--warning)">Attention</span>${esc(i.note)} Delivery health on the module's Health tab shows UNKNOWN until they do.</div>` : ""}
      <div class="grid-2">
        <section class="panel"><div class="panel-head"><h2 class="h2">Binding</h2></div><div class="panel-body"><dl class="kv">
          <dt>Domain</dt><dd>${esc(i.domain)}</dd><dt>Directory</dt><dd class="mono">${esc(i.dir)}</dd><dt>Instance</dt><dd class="mono">${esc(i.inst)}</dd>
          <dt>Server IP</dt><dd class="mono">${esc(i.ip)}</dd><dt>PHP · WHMCS</dt><dd class="mono">${esc(i.php)} · ${esc(i.whmcs)}</dd></dl></div></section>
        <section class="panel"><div class="panel-head"><h2 class="h2">Entitlement</h2></div><div class="panel-body"><dl class="kv">
          <dt>Last heartbeat</dt><dd>${fmtTime(i.hb, true)} · ${rel(i.hb)}</dd><dt>Token expires</dt><dd>${new Date(i.hb + 7 * DAY).toUTCString().slice(5, 16)}</dd>
          <dt>Grace until</dt><dd>${new Date(i.hb + 21 * DAY).toUTCString().slice(5, 16)}</dd><dt>Licence</dt><dd><a href="#/licences/${i.lic}">${esc(lic.hint)}</a> · ${licStatus(lic.status)}</dd><dt>Signed by</dt><dd class="mono">shl-2026-09</dd></dl></div></section>
      </div>
      <section class="panel"><div class="panel-head"><h2 class="h2">Events for this installation</h2></div>${evs.length ? `<div class="stream">${evs.map(evRow).join("")}</div>` : emptyState("No events", "Nothing recorded for this installation yet.")}</section>
      <div class="actions">${canAct() ? `<button class="btn danger" data-action="revoke-activation" data-id="${i.id}">Remove from licence</button>` : ""}<a class="btn" href="#/licences/${i.lic}">Open licence #${i.lic}</a></div>`;
  }

  /* ── Security ── */
  VIEWS.security = () => {
    const D = data();
    const sel = state.secSel;
    const blips = D.security.map((s) => {
      const a = (s.angle * Math.PI) / 180, r = s.radius * 50;
      return `<button class="blip${s.sev === "bad" ? " bad" : ""}" style="left:${50 + Math.cos(a) * r}%;top:${50 + Math.sin(a) * r}%" data-action="sec-select" data-id="${s.id}" aria-pressed="${sel === s.id}" aria-label="${esc(s.kind)} at ${fmtTime(s.t)}"><span></span></button>`;
    }).join("");
    return `
      <div class="page-head"><div><span class="eyebrow accent">Monitor</span><h1 class="h1" tabindex="-1">Security</h1><p class="lede">Refused activations, bad signatures, replays and clock skew. Nothing here changes a licence on its own — only a signed status does.</p></div></div>
      <section class="panel sec-hero hud warn" aria-labelledby="sec-h">
        <div class="radar-wrap">
          <div class="radar" role="group" aria-label="Threat activity: ${D.security.length} warnings, 0 critical in 7 days. Select a point to open the event.">
            <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="rr" cx="50" cy="50" r="49"/><circle class="rr faint" cx="50" cy="50" r="33"/><circle class="rr faint" cx="50" cy="50" r="17"/><path class="rr faint" d="M50 1v98M1 50h98"/></svg>
            <div class="sweep" aria-hidden="true"></div>
            ${blips}
          </div>
        </div>
        <div class="sec-summary">
          <div><span class="eyebrow">Security status</span><h2 class="h2" id="sec-h" style="margin-top:6px">${status(D.security.some((s) => s.sev === "bad") ? "bad" : "ok", D.security.some((s) => s.sev === "bad") ? "Critical events" : "No critical events")}</h2></div>
          <div class="sec-counts"><div><b style="color:var(--warning)">${D.security.length}</b><span>Warnings</span></div><div><b>0</b><span>Critical</span></div><div><b>7</b><span>Days</span></div></div>
          <p class="muted" style="font-size:12.5px">Distance from the centre is age; each point is one recorded event. All three are explained below.</p>
        </div>
      </section>
      <section class="panel" aria-labelledby="ev-h">
        <div class="panel-head"><div><span class="eyebrow">Last 7 days</span><h2 class="h2" id="ev-h">Security events</h2></div></div>
        ${labBody(() => D.security.length ? `<ul class="events">${D.security.map((s) => `<li id="ev-${s.id}" class="${sel === s.id ? "sel" : ""}"><div class="event">
          <span>${ic(s.sev === "bad" ? "bad" : "warn")}</span>
          <div><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><b>${esc(s.kind)}</b>${status(s.sev === "bad" ? "bad" : "warn", s.sev === "bad" ? "Critical" : "Warning")}<span class="mono muted" style="font-size:12px">${fmtTime(s.t, true)} · ${rel(s.t)}${s.count > 1 ? ` · ×${s.count}` : ""}</span></div>
          <dl><dt>What happened</dt><dd>${esc(s.what)}</dd><dt>Affected licence</dt><dd>${esc(s.licence)}</dd><dt>Affected installation</dt><dd>${esc(s.install)}</dd><dt>Outcome</dt><dd>${esc(s.outcome.replace(/\{T:(\d+):(\d+):(\d+)\}/, (_, h, m, sec) => fmtTime(T(+h, +m, +sec))))}</dd><dt>Recommended action</dt><dd>${esc(s.action)}</dd></dl>
          <div class="actions" style="margin-top:10px"><a class="btn sm" href="${s.to}">Open ${s.to.includes("installations") ? "installation" : "access"}</a></div></div></div></li>`).join("")}</ul>`
          : emptyState("No security events", "No refused activations, bad signatures, replays or skewed clocks in the last 7 days."))}
      </section>
      <section class="panel" aria-labelledby="det-h"><div class="panel-head"><div><span class="eyebrow">Coverage</span><h2 class="h2" id="det-h">Detectors</h2></div></div>
        ${table({ id: "det", caption: "Security detectors", rows: DETECTORS, cols: [
          { key: "n", label: "Detector", cls: "strong", render: (d) => esc(d[0]) }, { key: "w", label: "Watches for", render: (d) => esc(d[1]) },
          { key: "c", label: "7 days", cls: "mono", render: (d) => (state.lab === "empty" ? 0 : d[2]) }, { key: "s", label: "State", render: (d) => (d[2] && state.lab !== "empty" ? status("warn", "Triggered") : status("ok", "Quiet")) }] })}
      </section>`;
  };

  /* ── Licences ── */
  VIEWS.licences = (id, tab) => (id ? licenceDetail(Number(id), tab || "overview") : licenceList());
  function licFiltered(list) {
    const f = state.lic, q = f.q.trim().toLowerCase();
    return sortRows(list.filter((l) => (!q || [l.hint, "#" + l.id, String(l.svc), l.client, PRODUCTS[l.p].name].join(" ").toLowerCase().includes(q)) && (!f.status || l.status === f.status) && (!f.p || l.p === f.p)),
      f.sort, { product: (l) => PRODUCTS[l.p].name });
  }
  function licTable(list) {
    const rows = licFiltered(list);
    queueMicrotask(() => { const c = $("#lic-count"); if (c) c.textContent = `${rows.length} of ${list.length}`; });
    return table({
      id: "lic", caption: "Licences", sort: state.lic.sort, rows, rowHref: (l) => `#/licences/${l.id}`,
      cols: [
        { key: "hint", label: "Licence", sort: true, cls: "mono strong", render: (l) => `${esc(l.hint)} <span class="muted">#${l.id}</span>` },
        { key: "product", label: "Product", sort: true, render: (l) => prodDot(l.p) },
        { key: "client", label: "Customer", sort: true, render: (l) => esc(l.client) },
        { key: "status", label: "Status", sort: true, render: (l) => licStatus(l.status) },
        { key: "seats", label: "Activations", cls: "mono", render: (l) => `${INSTALLS.filter((i) => i.lic === l.id).length} / ${l.max}` },
        { key: "updates", label: "Updates until", sort: true, cls: "mono", render: (l) => fmtDate(l.updates) },
        { key: "svc", label: "WHMCS", sort: true, cls: "mono", render: (l) => `#${l.svc}` },
      ],
      empty: list.length ? emptyState("No matching licences", "Try another search or clear the filters.", `<button class="btn" data-action="clear-lic">Clear filters</button>`)
        : emptyState("No licences", "Licences appear when WHMCS provisions a module order.", canAct() ? `<button class="btn primary" data-action="new-licence">${ic("plus")}New licence</button>` : ""),
    });
  }
  function licenceList() {
    const D = data(), f = state.lic;
    return `
      <div class="page-head"><div><span class="eyebrow accent">Manage</span><h1 class="h1" tabindex="-1">Licences</h1><p class="lede">Keys are stored only as hashes; WHMCS keeps the plaintext for the customer. Suspend, reissue and regenerate here or from the WHMCS service.</p></div>
        ${canAct() ? `<button class="btn primary" data-action="new-licence" aria-keyshortcuts="N L">${ic("plus")}New licence</button>` : ""}</div>
      ${state.lab === "denied" ? `<section class="panel">${deniedState()}</section>` : ""}
      <section class="panel" aria-label="Licence list">
        <div class="toolbar" role="search">
          <label class="field-inline" for="lic-q">${ic("search")}<span class="sr-only">Search licences</span><input id="lic-q" data-filter="lic:q" value="${esc(f.q)}" placeholder="Search key, #id, WHMCS service, customer…" autocomplete="off"></label>
          <label class="sr-only" for="f-lstatus">Status</label><select class="sel" id="f-lstatus" data-filter="lic:status"><option value="">Status: all</option>${["active", "suspended", "terminated"].map((s) => `<option value="${s}"${f.status === s ? " selected" : ""}>${s[0].toUpperCase() + s.slice(1)}</option>`).join("")}</select>
          <label class="sr-only" for="f-lp">Product</label><select class="sel" id="f-lp" data-filter="lic:p"><option value="">Product: all</option>${Object.values(PRODUCTS).map((p) => `<option value="${p.key}"${f.p === p.key ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select>
          <span class="count" id="lic-count"></span>
        </div>
        <div id="lic-table">${labBody(() => licTable(D.licences))}</div>
      </section>`;
  }
  function licenceDetail(id, tab) {
    const l = LICENCES.find((x) => x.id === id);
    if (!l) return notFound("licence");
    const P = PRODUCTS[l.p];
    const inst = INSTALLS.filter((i) => i.lic === l.id);
    const tabs = [["overview", "Overview"], ["activations", "Activations"], ["entitlements", "Entitlements"], ["events", "Events"], ["updates", "Updates"], ["audit", "Audit log"]];
    const body = {
      overview: () => `<div class="grid-2"><section class="panel"><div class="panel-head"><h2 class="h2">Licence</h2></div><div class="panel-body"><dl class="kv">
          <dt>Key</dt><dd class="mono">${esc(l.hint)} <span class="muted">(full key lives in WHMCS)</span></dd><dt>Status</dt><dd>${licStatus(l.status)}</dd>
          <dt>Product</dt><dd>${prodDot(l.p)}</dd><dt>Customer</dt><dd>${esc(l.client)}</dd><dt>WHMCS service</dt><dd class="mono">#${l.svc}</dd>
          <dt>Activations</dt><dd class="mono">${inst.length} / ${l.max}</dd><dt>Updates until</dt><dd>${fmtDate(l.updates)}</dd><dt>Subscription</dt><dd>Governed by WHMCS — suspends when an invoice goes unpaid</dd></dl></div></section>
        <section class="panel"><div class="panel-head"><h2 class="h2">Why is it in this state?</h2></div><div class="panel-body" style="display:grid;gap:10px;font-size:13px">
          ${l.status === "active" ? `<p>${status("ok", "Active")} The WHMCS service is active, so the server issues <b>active</b> entitlements to its ${inst.length} installation${inst.length === 1 ? "" : "s"}.</p>` : l.status === "suspended" ? `<p>${status("warn", "Suspended")} WHMCS service #${l.svc} is pending payment. Installs receive a <b>signed suspended</b> status and hold their queues.</p>` : `<p>${status("idle", "Terminated")} WHMCS service #${l.svc} was terminated or cancelled. It cannot activate anywhere.</p>`}
          <p class="muted">Only a validly signed negative status switches an install off. Network trouble never does.</p></div></section></div>`,
      activations: () => inst.length ? table({ id: "acts", caption: "Activations", rows: inst, rowHref: (i) => `#/installations/${i.id}`, cols: [
          { key: "d", label: "Domain", cls: "strong", render: (i) => esc(i.domain) }, { key: "dir", label: "Directory", cls: "mono", render: (i) => esc(i.dir) },
          { key: "v", label: "Version", cls: "mono", render: (i) => esc(i.ver) }, { key: "h", label: "Last heartbeat", cls: "mono", render: (i) => rel(i.hb) },
          { key: "a", label: "Action", render: (i) => canAct() ? `<button class="btn sm danger" data-action="revoke-activation" data-id="${i.id}">Remove</button>` : "—" }] })
        : emptyState("Not activated anywhere", "Enter the key in the module's settings on the customer's WHMCS to activate it."),
      entitlements: () => `<div class="panel-body">${inspectorHtml(l, inst[0])}</div>`,
      events: () => { const ev = EVENTS.filter((e) => e.lic === l.id); return ev.length ? `<div class="stream">${ev.map(evRow).join("")}</div>` : emptyState("No events", "Nothing recorded for this licence yet."); },
      updates: () => { const r = RELEASES.find((x) => x.p === l.p); const ok = l.status === "active" && l.updates && new Date(l.updates) > new Date(SNAP);
        return `<div class="panel-body" style="display:grid;gap:12px"><dl class="kv"><dt>Latest release</dt><dd class="mono">${esc(P.name)} ${esc(r.version)} · ${esc(r.size)}</dd><dt>SHA-256</dt><dd class="mono">${esc(r.sha)}…</dd><dt>Eligibility</dt><dd>${ok ? status("ok", "Eligible · updates until " + fmtDate(l.updates)) : status("warn", "Not eligible — licence not active or updates expired")}</dd><dt>Installed</dt><dd>${inst.map((i) => `${esc(i.domain)} ${esc(i.ver)}`).join(" · ") || "—"}</dd></dl>
          <div class="actions"><button class="btn" data-action="download" data-id="${l.id}"${ok ? "" : " disabled"}>${ic("release")}Issue one-time download link</button></div></div>`; },
      audit: () => table({ id: "aud", caption: "Audit log", rows: [
          [T(8, 14, 39), "license_adopted", "Existing key registered from WHMCS service #" + l.svc, "whmcs"],
          ...EVENTS.filter((e) => e.lic === l.id && e.k !== "license_adopted").map((e) => [e.t, e.k, e.d, e.k.startsWith("license") ? "whmcs" : "install"]),
        ], cols: [{ key: "t", label: "When", cls: "mono", render: (r) => fmtTime(r[0], true) }, { key: "k", label: "Event", cls: "mono strong", render: (r) => esc(r[1]) }, { key: "d", label: "Detail", render: (r) => esc(r[2]) }, { key: "a", label: "Actor", cls: "mono", render: (r) => esc(r[3]) }] }),
    };
    return `
      <nav aria-label="Breadcrumb" class="mono muted" style="font-size:12px"><a href="#/licences">Licences</a> / #${l.id}</nav>
      <div class="page-head"><div><span class="eyebrow accent">Licence #${l.id} · ${esc(P.name)}</span><h1 class="h1 mono" tabindex="-1">${esc(l.hint)}</h1><p class="lede">${esc(l.client)} · WHMCS service #${l.svc} · ${inst.length} / ${l.max} activations</p></div>
        <div class="actions">${licStatus(l.status)}${canAct() && l.status !== "terminated" ? `<button class="btn" data-action="reissue" data-id="${l.id}">Reissue</button><button class="btn" data-action="regenerate" data-id="${l.id}">Regenerate key</button>${l.status === "active" ? `<button class="btn danger" data-action="suspend" data-id="${l.id}">Suspend</button>` : `<button class="btn" data-action="unsuspend" data-id="${l.id}">Unsuspend</button>`}` : ""}</div></div>
      <nav class="tabs" aria-label="Licence sections">${tabs.map(([k, n]) => `<a href="#/licences/${l.id}/${k}"${k === tab ? ' aria-current="page"' : ""}>${n}</a>`).join("")}</nav>
      <section class="panel" aria-label="${esc(tabs.find((t) => t[0] === tab)?.[1] || "")}">${(body[tab] || body.overview)()}</section>`;
  }

  /* ── Products ── */
  VIEWS.products = () => `
    <div class="page-head"><div><span class="eyebrow accent">Manage</span><h1 class="h1" tabindex="-1">Products &amp; Plans</h1><p class="lede">Each licensing product maps to one or more WHMCS products. WHMCS decides status, dates and seats; this server records and signs them.</p></div></div>
    ${labBody(() => `<div class="grid-3">${Object.values(PRODUCTS).map((p) => {
      const ls = LICENCES.filter((l) => l.p === p.key);
      return `<section class="panel card" aria-labelledby="p-${p.key}">
        <div class="card-top"><span class="tile" style="background:color-mix(in srgb, var(--p-${p.key}) 16%, transparent);color:var(--p-${p.key})">${ic(p.icon)}</span><div style="min-width:0"><h2 class="h2" id="p-${p.key}">${esc(p.name)}</h2><div class="mono muted" style="font-size:11.5px;overflow-wrap:anywhere">${esc(p.slug)}</div></div></div>
        <div class="mini"><div><span>Active</span><b style="color:var(--success)">${ls.filter((l) => l.status === "active").length}</b></div><div><span>Suspended</span><b>${ls.filter((l) => l.status === "suspended").length}</b></div><div><span>Version</span><b class="mono">${p.version}</b></div></div>
        <dl class="kv"><dt>Key prefix</dt><dd class="mono">${p.prefix}</dd><dt>Seats</dt><dd>1 per licence (WHMCS override allowed)</dd><dt>Token</dt><dd>7 d + 14 d grace</dd></dl>
        <div><span class="eyebrow">WHMCS plans</span><ul style="margin:8px 0 0;padding-left:18px;display:grid;gap:4px;font-size:12.5px">${p.plans.map((pl) => `<li><span class="mono">${pl[0]}</span> ${esc(pl[1])} <span class="muted">· ${esc(pl[2])}</span></li>`).join("")}</ul></div>
      </section>`;
    }).join("")}</div>`)}`;

  /* ── Releases ── */
  VIEWS.releases = () => `
    <div class="page-head"><div><span class="eyebrow accent">Manage</span><h1 class="h1" tabindex="-1">Releases</h1><p class="lede">Uploads are hashed and their manifest signed. Installs only offer an update whose signature and SHA-256 both verify. Versions are immutable.</p></div>
      ${canAct() ? `<button class="btn primary" data-action="publish">${ic("release")}Publish release</button>` : ""}</div>
    <section class="panel hud" aria-labelledby="pipe-h"><div class="panel-head"><div><span class="eyebrow">Last publish · WhatsApp Manager 2.0</span><h2 class="h2" id="pipe-h">Signing pipeline</h2></div>${status("ok", "Signed · verified")}</div>
      <div class="pipe"><span class="st">UPLOAD<small>zip · 529 KB · 105 files</small></span><span class="arr" aria-hidden="true">→</span><span class="st">SHA-256<small>a46c01fc2940…</small></span><span class="arr" aria-hidden="true">→</span><span class="st">MANIFEST<small>min PHP 7.4 · stable</small></span><span class="arr" aria-hidden="true">→</span><span class="st">ED25519<small>kid shl-2026-09</small></span><span class="arr" aria-hidden="true">→</span><span class="st">PUBLISHED<small>immutable · one-time links</small></span></div></section>
    ${labBody(() => `<div class="grid-3">${RELEASES.map((r) => {
      const inst = INSTALLS.filter((i) => i.p === r.p), on = inst.filter((i) => i.ver === r.version).length, pct = inst.length ? Math.round((on / inst.length) * 100) : 0;
      return `<section class="panel card" aria-label="${esc(PRODUCTS[r.p].name)} ${r.version}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div><span class="eyebrow">${esc(PRODUCTS[r.p].name)}</span><div class="ver" style="margin-top:6px">${r.version}</div></div><div class="actions"><span class="chip accent">Stable</span><span class="chip ok">${ic("sig")}Signed</span></div></div>
        <div><div style="display:flex;justify-content:space-between;font-size:12px"><span class="muted">Adoption</span><b class="num">${on}/${inst.length} · ${pct}%</b></div><span class="meter" style="margin-top:6px" aria-hidden="true"><span class="ok" style="width:${pct}%"></span></span></div>
        <div class="mini"><div><span>Failures</span><b>0%</b></div><div><span>Size</span><b>${r.size}</b></div><div><span>Channel</span><b>Stable</b></div></div>
        <dl class="kv"><dt>SHA-256</dt><dd class="mono">${r.sha}…</dd><dt>Released</dt><dd>${r.at}</dd></dl>
        ${canAct() ? `<div class="actions"><button class="btn sm" disabled title="Already on the stable channel">Promote</button><button class="btn sm" disabled title="No earlier signed release to roll back to">Rollback</button><button class="btn sm danger" data-action="deprecate" data-p="${r.p}">Withdraw</button></div>` : ""}
      </section>`;
    }).join("")}</div>`)}`;

  /* ── Signing keys ── */
  VIEWS.keys = () => `
    <div class="page-head"><div><span class="eyebrow accent">Configure</span><h1 class="h1" tabindex="-1">Signing Keys</h1><p class="lede">Public keys ship inside every module — there is no live key fetch an attacker could substitute. Private keys never appear in this console.</p></div>
      ${canAct() ? `<button class="btn danger" data-action="rotate">${ic("key")}Rotate to shl-2027-03</button>` : ""}</div>
    <div class="grid-2">${KEYS.map((k) => `<section class="panel card${k.role === "active" ? " hud" : ""}" aria-labelledby="k-${k.kid}">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><span class="eyebrow">Signing key</span><h2 class="h2 mono" id="k-${k.kid}" style="margin-top:6px;font-size:18px">${k.kid}</h2></div>${k.role === "active" ? status("ok", "Active signer") : status("idle", "Standby · next")}</div>
      <div class="mini"><div><span>Algorithm</span><b>Ed25519</b></div><div><span>Used by</span><b>${k.role === "active" ? "6 installs" : "—"}</b></div><div><span>Licences</span><b>${k.role === "active" ? "5 active" : "—"}</b></div></div>
      <dl class="kv"><dt>Fingerprint</dt><dd class="fp">${k.fp}</dd><dt>Public key</dt><dd class="mono" style="font-size:12px">${k.pub} <button class="btn sm ghost" data-action="copy" data-copy="${k.pub}" aria-label="Copy public key">${ic("copy")}</button></dd>
        <dt>Created</dt><dd>${k.created}</dd><dt>Last used</dt><dd>${k.lastUsed ? `${fmtTime(k.lastUsed, true)} · ${rel(k.lastUsed)}` : "Never"}</dd>
        <dt>Rotation policy</dt><dd>${k.role === "active" ? "Keep trusted 21 days after rotating (7 d token + 14 d grace)" : "Bundled in all modules; becomes signer after rotation"}</dd></dl>
    </section>`).join("")}</div>
    <section class="panel" aria-labelledby="rot-h"><div class="panel-head"><div><span class="eyebrow">Rotation readiness</span><h2 class="h2" id="rot-h">Safe to rotate once rehearsed</h2></div><span class="chip warn">${ic("warn")}Rehearsal open</span></div>
      <div class="panel-body rot-grid">
        <div class="gauge" style="--v:100" role="img" aria-label="6 of 6 installations carry the next key"><div><b>6/6</b><span>installs trust<br>shl-2027-03</span></div></div>
        <ul class="checklist">
          <li><span class="tk done">${ic("check")}</span><span><b>Next key generated offline</b> — private copy kept outside Vercel</span></li>
          <li><span class="tk done">${ic("check")}</span><span><b>Public key bundled</b> in WhatsApp Manager, Smart Gateway Fees and Social Proof</span></li>
          <li><span class="tk done">${ic("check")}</span><span><b>Published</b> in LICENSE_PUBLIC_KEYS and /api/keys</span></li>
          <li><span class="tk todo">4</span><span><b>Rehearse</b> — sign with shl-2027-03 on a preview deployment and verify from one install</span></li>
          <li><span class="tk todo">5</span><span><b>Switch signer</b>, keep shl-2026-09 trusted for 21 days</span></li>
        </ul></div></section>`;

  /* ── Access ── */
  VIEWS.access = () => `
    <div class="page-head"><div><span class="eyebrow accent">Configure</span><h1 class="h1" tabindex="-1">Access</h1><p class="lede">Who can operate this console, where they are signed in, and the one machine credential WHMCS uses.</p></div></div>
    <section class="panel" aria-labelledby="ops-h"><div class="panel-head"><h2 class="h2" id="ops-h">Operators</h2>${canAct() ? `<button class="btn sm" data-action="invite">Invite operator</button>` : ""}</div>
      ${table({ id: "ops", caption: "Operators", rows: [["Priyanshu Shroti", "Owner", "Required", "Not enabled yet"]], cols: [
        { key: "n", label: "Name", cls: "strong", render: (r) => esc(r[0]) }, { key: "r", label: "Role", render: (r) => `<span class="chip violet">${esc(r[1])}</span>` },
        { key: "a", label: "Authenticator", render: (r) => status("info", r[2]) }, { key: "s", label: "Sign-in", render: (r) => status("idle", r[3]) }] })}</section>
    <section class="panel" aria-labelledby="ses-h"><div class="panel-head"><h2 class="h2" id="ses-h">Sessions</h2></div>
      ${emptyState("No active sessions", "Operator sign-in is not enabled on the server yet. Sessions will list here with device, location and expiry.")}</section>
    <section class="panel" aria-labelledby="api-h"><div class="panel-head"><h2 class="h2" id="api-h">Machine credentials</h2>${canAct() ? `<button class="btn sm" data-action="rotate-secret">Rotate secret</button>` : ""}</div>
      ${table({ id: "api", caption: "Admin API credentials", rows: [["WHMCS · portal.shrotihost.in", "shl_ak_…", "HMAC-SHA256 + nonce · ±300 s", "Today"]], cols: [
        { key: "c", label: "Caller", cls: "strong", render: (r) => esc(r[0]) }, { key: "k", label: "Key ID", cls: "mono", render: (r) => esc(r[1]) },
        { key: "s", label: "Signing", cls: "mono", render: (r) => esc(r[2]) }, { key: "u", label: "Last used", render: (r) => esc(r[3]) }] })}</section>`;

  /* ── Settings ── */
  VIEWS.settings = () => {
    const seg = (name, cur, opts) => `<div class="seg" role="group" aria-label="${esc(name)}">${opts.map(([v, l]) => `<button type="button" data-set="${name}:${v}" aria-pressed="${cur === v}">${esc(l)}</button>`).join("")}</div>`;
    return `
      <div class="page-head"><div><span class="eyebrow accent">Configure</span><h1 class="h1" tabindex="-1">Settings</h1><p class="lede">Preferences are stored in this browser only.</p></div></div>
      <section class="panel" aria-labelledby="pref-h"><div class="panel-head"><h2 class="h2" id="pref-h">Display</h2></div>
        <div class="setting"><div><b>Theme</b><p>System follows your operating system. Shortcut: <span class="kbd">⌘/Ctrl ⇧ L</span></p></div>${seg("theme", state.theme, [["dark", "Dark"], ["light", "Light"], ["system", "System"]])}</div>
        <div class="setting"><div><b>Motion</b><p>Reduced turns off the orbit, radar sweep, scans and transitions. Status colours and text stay.</p></div>${seg("motion", state.motion, [["system", "System"], ["reduce", "Reduced"], ["full", "Full"]])}</div>
        <div class="setting"><div><b>Times</b><p>Indian Standard Time by default. Switch to UTC to match the server's own logs.</p></div>${seg("time", state.time, [["ist", "IST"], ["utc", "UTC"]])}</div>
      </section>
      <section class="panel" aria-labelledby="lab-h"><div class="panel-head"><div><span class="eyebrow">Design review</span><h2 class="h2" id="lab-h">State preview</h2></div></div>
        <div class="setting"><div><b>Preview a system state</b><p>Shows how every page behaves while loading, empty, degraded, offline, failing, under maintenance or without permission. Resets when you reload.</p></div>
          <div><label class="sr-only" for="lab">State</label><select class="sel" id="lab" data-set-select="lab">${[["normal", "Normal"], ["loading", "Loading"], ["empty", "Empty"], ["degraded", "Degraded"], ["offline", "Offline"], ["error", "Error"], ["maintenance", "Maintenance"], ["denied", "Permission denied"]].map(([v, l]) => `<option value="${v}"${state.lab === v ? " selected" : ""}>${l}</option>`).join("")}</select></div></div>
      </section>
      <section class="panel" aria-labelledby="infra-h"><div class="panel-head"><h2 class="h2" id="infra-h">Infrastructure</h2></div><div class="panel-body"><dl class="kv">
        <dt>Server</dt><dd class="mono">licensing.shrotihost.in</dd><dt>Region</dt><dd class="mono">fra1 (Frankfurt)</dd><dt>Database</dt><dd>Neon Postgres · free plan</dd>
        <dt>Hosting plan</dt><dd>${status("warn", "Vercel Hobby — non-commercial terms; upgrade to Pro")}</dd><dt>Source</dt><dd class="mono">github.com/priyanshu-shroti01/shrotihost-licensing</dd></dl></div></section>
      <section class="panel" aria-labelledby="kb-h"><div class="panel-head"><h2 class="h2" id="kb-h">Keyboard shortcuts</h2></div>${shortcutsGrid()}</section>`;
  };
  const SHORTCUTS = [["⌘/Ctrl K", "Search everything"], ["?", "Keyboard shortcuts"], ["G O", "Overview"], ["G I", "Installations"], ["G S", "Security"], ["G L", "Licences"], ["G P", "Products & Plans"], ["G R", "Releases"], ["G K", "Signing keys"], ["G A", "Access"], ["G ,", "Settings"], ["N L", "New licence"], ["⌘/Ctrl ⇧ L", "Toggle theme"], ["Esc", "Close panel or dialog"]];
  const shortcutsGrid = () => `<div class="kb-grid">${SHORTCUTS.map(([k, d]) => `<div><span>${esc(d)}</span><span class="kbd">${esc(k)}</span></div>`).join("")}</div>`;

  function notFound(what) {
    return `<div class="page-head"><div><h1 class="h1" tabindex="-1">Not found</h1></div></div><section class="panel">${emptyState(`No such ${what}`, "It may have been removed, or the link is wrong.", `<a class="btn" href="#/overview">Go to overview</a>`)}</section>`;
  }

  /* ═══════════════════════════════ token inspector ═══════════════════════════════ */
  const b64u = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const SIG = "Mq3v9yQ0Zp1n7sKcR2dWvT8xLbE4uHjF6gN0aYiC5oP3mDkS1rV9tZwX2eQ7lB8cA4fU6hJ0yG3iO5nM1pKqRw";
  const pretty = (o) => esc(JSON.stringify(o, null, 2)).replace(/&quot;([^&]+)&quot;:/g, '<span class="jk">"$1"</span>:').replace(/: &quot;(.*?)&quot;/g, ': <span class="jv">"$1"</span>').replace(/: (\d+|true|false)/g, ': <span class="jn">$1</span>');
  const STEPS = [["Split into header · payload · signature", "3 parts"], ["Key ID is bundled in this module", "shl-2026-09"], ["Ed25519 signature over header.payload", "64 bytes"], ["Issuer and product match", "iss · aud"], ["Bound to this install", "instance_id"], ["Inside validity window", "exp · grace"]];
  function inspectorHtml(l, i) {
    return `<div style="display:grid;gap:10px" data-inspector="${l.id}" data-inst="${i ? i.id : ""}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span class="eyebrow">Entitlement inspector${i ? " · " + esc(i.domain) : ""}</span><label class="switch"><input type="checkbox" data-action="tamper"> Tamper one byte</label></div>
      <div class="jws" data-jws></div><div class="json" data-claims tabindex="0" aria-label="Decoded token"></div>
      <ol class="steps" data-steps>${STEPS.map((s) => `<li><span class="st"></span><span>${s[0]}</span><code>${s[1]}</code></li>`).join("")}</ol>
      <div data-verdict aria-live="polite"></div>
      <div><button class="btn" data-action="verify">${ic("sig")}Verify as a module would</button></div></div>`;
  }
  function inspectorInit(root) {
    const l = LICENCES.find((x) => x.id === Number(root.dataset.inspector));
    const i = INSTALLS.find((x) => x.id === root.dataset.inst);
    const iat = Math.floor((i ? i.hb : SNAP) / 1000);
    const header = { alg: "EdDSA", kid: "shl-2026-09", typ: "shl-entitlement+jwt" };
    const claims = { iss: "licensing.shrotihost.in", aud: PRODUCTS[l.p].slug, sub: "lic_" + l.id, iat, nbf: iat - 60, exp: iat + 7 * 86400, grace_until: iat + 21 * 86400, jti: "r7Kq2Wf9sX1bN4cT8vYp3A", status: l.status === "active" ? "active" : l.status, plan: "recurring", bind: { domain: i ? i.domain : "—", install_dir: i ? i.dir : "—", instance_id: i ? i.inst : "—" }, support_valid: l.status === "active", updates_valid: l.status === "active", license_hint: l.hint };
    const h = b64u(header), p = b64u(claims);
    const tampered = () => $("[data-action=tamper]", root).checked;
    const paint = () => {
      const t = tampered(), at = 40;
      $("[data-jws]", root).innerHTML = `<span class="h">${h}</span>.<span class="p">${t ? `${p.slice(0, at)}<span class="flip">${p[at] === "A" ? "B" : "A"}</span>${p.slice(at + 1)}` : p}</span>.<span class="s">${SIG}</span>`;
      $("[data-claims]", root).innerHTML = `<span class="jc">// header</span>\n${pretty(header)}\n<span class="jc">// payload</span>\n${pretty(claims)}`;
    };
    root._run = async () => {
      const lis = $$("[data-steps] li", root), t = tampered();
      lis.forEach((li) => { li.className = ""; li.querySelector(".st").innerHTML = ""; });
      $("[data-verdict]", root).innerHTML = "";
      for (let k = 0; k < lis.length; k++) {
        lis[k].className = "run"; await wait(220);
        if (t && k === 2) {
          lis[k].className = "bad"; lis[k].querySelector(".st").innerHTML = ic("x");
          lis.slice(k + 1).forEach((li) => (li.className = "skip"));
          $("[data-verdict]", root).innerHTML = `<div class="verdict bad">${ic("bad")}Rejected — the signature no longer matches. The module treats this licence as invalid, never active.</div>`;
          return;
        }
        lis[k].className = "ok"; lis[k].querySelector(".st").innerHTML = ic("check");
      }
      $("[data-verdict]", root).innerHTML = `<div class="verdict ok">${ic("ok")}Verified offline — signed status: ${esc(claims.status)}. No server call needed.</div>`;
    };
    paint(); root._paint = paint; root._run();
  }

  /* ═══════════════════════════════ drawer, dialogs, toasts ═══════════════════════════════ */
  let lastFocus = null;
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';
  function trap(e, box) {
    if (e.key !== "Tab") return;
    const f = $$(FOCUSABLE, box).filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
  function openDrawer(html) {
    lastFocus = document.activeElement;
    const d = $("#drawer"); d.innerHTML = html; d.hidden = false; $("#scrim").hidden = false;
    $$("[data-inspector]", d).forEach(inspectorInit);
    ($("[data-close]", d) || d).focus();
  }
  function closeDrawer() {
    if ($("#drawer").hidden) return;
    $("#drawer").hidden = true; $("#scrim").hidden = true; lastFocus?.focus?.();
  }
  function licenceDrawer(id) {
    const l = LICENCES.find((x) => x.id === id); if (!l) return;
    const inst = INSTALLS.filter((i) => i.lic === l.id);
    openDrawer(`<div class="drawer-head"><div><span class="eyebrow">Licence #${l.id}</span><h2 class="h2 mono" id="drawer-title" style="margin-top:6px">${esc(l.hint)}</h2></div><button class="btn icon ghost" data-close aria-label="Close">${ic("x")}</button></div>
      <div class="drawer-body">
        <div class="actions">${licStatus(l.status)}<span class="chip">WHMCS #${l.svc}</span></div>
        <dl class="kv"><dt>Product</dt><dd>${prodDot(l.p)}</dd><dt>Customer</dt><dd>${esc(l.client)}</dd><dt>Updates until</dt><dd>${fmtDate(l.updates)}</dd><dt>Activations</dt><dd class="mono">${inst.length} / ${l.max}</dd></dl>
        ${inst.length ? inspectorHtml(l, inst[0]) : ""}
        <div class="actions"><a class="btn primary" href="#/licences/${l.id}">Open full details${ic("arrow")}</a>${canAct() && l.status === "active" ? `<button class="btn danger" data-action="suspend" data-id="${l.id}">Suspend</button>` : ""}</div>
      </div>`);
  }

  let dialogResolve = null;
  function dialog({ title, intro, impact = [], preflight = [], confirm = "Confirm", danger = false, body = "", ack = null }) {
    lastFocus = document.activeElement;
    const d = $("#dialog");
    d.className = "dialog" + (danger ? " danger-edge" : "");
    d.innerHTML = `<div class="dialog-body"><h2 id="dialog-title">${esc(title)}</h2>${intro ? `<p class="secondary" style="font-size:13px">${intro}</p>` : ""}
      ${impact.length ? `<div><span class="eyebrow">This operation affects</span><ul class="impact" style="margin-top:6px">${impact.map((x) => `<li>${x}</li>`).join("")}</ul></div>` : ""}
      ${preflight.length ? `<div><span class="eyebrow">Preflight</span><ul class="preflight" style="margin-top:6px">${preflight.map(([ok, t]) => `<li>${status(ok ? "ok" : "warn", "")}${esc(t)}</li>`).join("")}</ul></div>` : ""}
      ${body}${ack ? `<label class="switch"><input type="checkbox" id="dlg-ack"> ${esc(ack)}</label>` : ""}</div>
      <div class="dialog-foot"><button class="btn" data-dlg="cancel">Cancel</button><button class="btn ${danger ? "danger" : "primary"}" data-dlg="ok"${ack ? " disabled" : ""}>${esc(confirm)}</button></div>`;
    d.hidden = false; $("#dialog-scrim").hidden = false;
    if (ack) $("#dlg-ack").addEventListener("change", (e) => { $("[data-dlg=ok]", d).disabled = !e.target.checked; });
    ($("input, select", d) || $("[data-dlg=cancel]", d)).focus();
    return new Promise((res) => { dialogResolve = res; });
  }
  async function closeDialog(ok) {
    const d = $("#dialog"); if (d.hidden) return;
    const btn = $("[data-dlg=ok]", d);
    if (ok) {
      const vals = Object.fromEntries($$("input, select", d).map((el) => [el.id, el.type === "checkbox" ? el.checked : el.value]));
      btn.disabled = true; btn.innerHTML = `<span class="spin" aria-hidden="true"></span>Working…`;
      await wait(650);
      d.hidden = true; $("#dialog-scrim").hidden = true; lastFocus?.focus?.();
      dialogResolve?.(vals);
    } else { d.hidden = true; $("#dialog-scrim").hidden = true; lastFocus?.focus?.(); dialogResolve?.(null); }
    dialogResolve = null;
  }

  function toast(kind, text) {
    const icon = { ok: "ok", warn: "warn", bad: "bad", info: "info" }[kind];
    const el = document.createElement("div");
    el.className = `toast ${kind}`; el.setAttribute("role", kind === "bad" ? "alert" : "status");
    el.innerHTML = `<span class="s-${kind}">${ic(icon)}</span><span>${text}</span><button class="x" aria-label="Dismiss">${ic("x")}</button>`;
    $("#toasts").appendChild(el);
    const kill = () => el.remove();
    el.querySelector(".x").addEventListener("click", kill);
    setTimeout(kill, kind === "bad" ? 9000 : 5000);
  }
  const PREVIEW = " <span class='muted'>— preview, nothing changed</span>";

  /* ═══════════════════════════════ actions ═══════════════════════════════ */
  const ACTIONS = {
    async suspend(el) {
      const l = LICENCES.find((x) => x.id === Number(el.dataset.id)); const inst = INSTALLS.filter((i) => i.lic === l.id);
      const r = await dialog({ title: "Suspend licence?", danger: true, confirm: "Suspend licence",
        intro: `<b class="mono">${esc(l.hint)}</b> · ${esc(PRODUCTS[l.p].name)} · ${esc(l.client)}`,
        impact: [`<b>${inst.length}</b> installation${inst.length === 1 ? "" : "s"} will receive a signed <b>suspended</b> status on their next heartbeat (within a day)`, ...inst.map((i) => `<span class="mono">${esc(i.domain)}</span>`), "WHMCS service #" + l.svc + " is not changed — suspend it there to stop billing"] });
      if (r) toast("ok", `Licence #${l.id} suspended${PREVIEW}`);
    },
    async unsuspend(el) { const l = LICENCES.find((x) => x.id === Number(el.dataset.id)); const r = await dialog({ title: "Unsuspend licence?", confirm: "Unsuspend", intro: `WHMCS service #${l.svc} is still pending. Unsuspending here does not collect payment.`, impact: ["Installs receive an active entitlement on their next heartbeat"] }); if (r) toast("ok", `Licence #${l.id} active${PREVIEW}`); },
    async reissue(el) {
      const l = LICENCES.find((x) => x.id === Number(el.dataset.id)); const inst = INSTALLS.filter((i) => i.lic === l.id);
      const r = await dialog({ title: "Reissue licence?", danger: true, confirm: "Reissue licence", intro: "Releases every installation so the key can be activated somewhere new.",
        impact: [`<b>${inst.length}</b> installation${inst.length === 1 ? "" : "s"} must activate again: ${inst.map((i) => `<span class="mono">${esc(i.domain)}</span>`).join(", ") || "none"}`, "Counts as 1 reissue for the customer (3 included, then ₹100 each)"] });
      if (r) toast("ok", `Licence #${l.id} reissued${PREVIEW}`);
    },
    async regenerate(el) {
      const l = LICENCES.find((x) => x.id === Number(el.dataset.id)); const inst = INSTALLS.filter((i) => i.lic === l.id);
      const r = await dialog({ title: "Regenerate licence key?", danger: true, confirm: "Regenerate key", ack: "I understand the current key stops working immediately",
        impact: ["The current key <b>stops working immediately</b>", `<b>${inst.length}</b> installation${inst.length === 1 ? "" : "s"} must be activated again with the new key`, "The customer is emailed the new key"] });
      if (r) toast("ok", `New key issued for licence #${l.id}${PREVIEW}`);
    },
    async "revoke-activation"(el) {
      const i = INSTALLS.find((x) => x.id === el.dataset.id);
      const r = await dialog({ title: "Remove installation from licence?", danger: true, confirm: "Remove installation", impact: [`<span class="mono">${esc(i.domain)}</span> · ${esc(PRODUCTS[i.p].name)} stops working until it activates again`, `Frees 1 seat on licence #${i.lic}`] });
      if (r) toast("ok", `${esc(i.domain)} removed from licence #${i.lic}${PREVIEW}`);
    },
    async rotate() {
      const r = await dialog({ title: "Rotate signing key?", danger: true, confirm: "Rotate signing key", ack: "Rotate without the rehearsal",
        impact: ["<b>18</b> licences", "<b>6</b> installations", "<b>3</b> products"],
        preflight: [[true, "Next key shl-2027-03 bundled in all 3 modules (6/6 installs)"], [true, "Trust chain valid — both keys published at /api/keys"], [true, "Overlap window configured — shl-2026-09 stays trusted 21 days"], [false, "Rotation rehearsal not recorded"]] });
      if (r) toast("info", `Signing key rotation scheduled${PREVIEW}`);
    },
    async deprecate(el) {
      const P = PRODUCTS[el.dataset.p]; const rel = RELEASES.find((x) => x.p === el.dataset.p);
      const r = await dialog({ title: "Withdraw release?", danger: true, confirm: "Withdraw release", intro: `${esc(P.name)} ${rel.version}`, impact: ["Installs already on this version keep running", "It is no longer offered as an update or download", "Customers see no newer version until you publish one"] });
      if (r) toast("warn", `${esc(P.name)} ${rel.version} withdrawn${PREVIEW}`);
    },
    async publish() {
      const r = await dialog({ title: "Publish release", confirm: "Sign & publish", body: `<div class="field"><label class="eyebrow" for="pub-p">Product</label><select id="pub-p">${Object.values(PRODUCTS).map((p) => `<option value="${p.key}">${esc(p.name)}</option>`).join("")}</select></div>
        <div class="field"><label class="eyebrow" for="pub-v">Version</label><input id="pub-v" placeholder="e.g. 2.0.1" required></div><div class="field"><label class="eyebrow" for="pub-f">Package (zip, under 3 MB)</label><input id="pub-f" type="file" accept=".zip"></div>`,
        preflight: [[true, "Signed with shl-2026-09"], [true, "Versions are immutable once published"]] });
      if (r) toast("ok", `Release ${esc(r["pub-v"] || "draft")} signed and published${PREVIEW}`);
    },
    async "new-licence"() {
      if (!canAct()) return toast("bad", "Your role cannot create licences.");
      const r = await dialog({ title: "Issue licence", confirm: "Issue licence", intro: "Usually WHMCS does this when an order is accepted. Use this for internal or replacement licences.",
        body: `<div class="field"><label class="eyebrow" for="nl-p">Product</label><select id="nl-p">${Object.values(PRODUCTS).map((p) => `<option value="${p.key}">${esc(p.name)}</option>`).join("")}</select></div>
          <div class="field"><label class="eyebrow" for="nl-s">WHMCS service ID (optional)</label><input id="nl-s" inputmode="numeric" placeholder="e.g. 390"></div>
          <div class="field"><label class="eyebrow" for="nl-n">Installations allowed</label><input id="nl-n" inputmode="numeric" value="1"></div>` });
      if (r) toast("ok", `Licence issued for ${esc(PRODUCTS[r["nl-p"]].name)}${PREVIEW}`);
    },
    async download(el) { toast("ok", `One-time download link for licence #${esc(el.dataset.id)} issued — valid 15 minutes${PREVIEW}`); },
    async invite() { const r = await dialog({ title: "Invite operator", confirm: "Send invite", body: `<div class="field"><label class="eyebrow" for="inv-e">Email</label><input id="inv-e" type="email" placeholder="name@shrotihost.in"></div><div class="field"><label class="eyebrow" for="inv-r">Role</label><select id="inv-r"><option>Viewer</option><option>Operator</option></select></div>` }); if (r) toast("ok", `Invite sent${PREVIEW}`); },
    async "rotate-secret"() { const r = await dialog({ title: "Rotate admin API secret?", danger: true, confirm: "Rotate secret", impact: ["WHMCS stops reaching the licensing server until the new secret is saved in Addons → ShrotiHost Licensing"] }); if (r) toast("warn", `New secret generated — save it in WHMCS${PREVIEW}`); },
    copy(el) { navigator.clipboard?.writeText(el.dataset.copy).then(() => toast("ok", "Public key copied"), () => toast("bad", "Copy failed — select the key and copy it manually")); },
    retry(el) { el.innerHTML = `<span class="spin" aria-hidden="true"></span>Retrying…`; el.disabled = true; setTimeout(() => { render(); toast("bad", "Still unreachable — showing the last snapshot"); }, reduceMotion() ? 0 : 900); },
    "clear-inst"() { Object.assign(state.inst, { q: "", p: "", ver: "", php: "", whmcs: "", status: "" }); render(); },
    "clear-lic"() { Object.assign(state.lic, { q: "", status: "", p: "" }); render(); },
    "sec-select"(el) { state.secSel = el.dataset.id; render(); $("#ev-" + el.dataset.id)?.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" }); },
    shortcuts() { closeMenu(); dialog({ title: "Keyboard shortcuts", confirm: "Done", body: shortcutsGrid() }); },
    verify(el) { el.closest("[data-inspector]")._run(); },
    tamper(el) { const r = el.closest("[data-inspector]"); r._paint(); r._run(); },
    "verify-sample"() { licenceDrawer(3); },
    async replay(el) {
      if (state.lab !== "normal") return toast("info", "Replay runs on the normal state only.");
      el.disabled = true;
      const core = $("#core-panel"); core.dataset.core = "processing";
      const acts = EVENTS.filter((e) => e.inst);
      for (const e of acts) {
        const row = $$(`#stream .ev`).find((r) => Number(r.dataset.t) === e.t && r.textContent.includes(`#${e.lic}`));
        if (row) { row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash"); row.scrollIntoView({ block: "nearest" }); }
        await signal(e.inst);
      }
      core.dataset.core = "success"; toast("ok", "Switch-over replayed · 6 installs activated · all signatures verified");
      setTimeout(() => { core.dataset.core = "idle"; el.disabled = false; }, reduceMotion() ? 0 : 1000);
    },
  };

  /* Signal propagation: install → host → core, only while replaying. */
  function signal(instId) {
    return new Promise((res) => {
      const svg = $("#topo"); if (!svg || reduceMotion()) return res();
      const i = INSTALLS.find((x) => x.id === instId);
      const node = $(`a[href="#/installations/${instId}"] circle`, svg);
      const hx = i.domain.startsWith("portal") ? 128 : 512;
      const pts = [[+node.getAttribute("cx"), +node.getAttribute("cy")], [hx, 150], [320, 150]];
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("r", "3.4"); dot.setAttribute("fill", `var(--p-${i.p})`);
      $("#sigs", svg).appendChild(dot);
      const t0 = performance.now(), dur = 520;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur), seg = k < 0.4 ? 0 : 1, kk = seg ? (k - 0.4) / 0.6 : k / 0.4;
        const [a, b] = [pts[seg], pts[seg + 1]];
        dot.setAttribute("cx", a[0] + (b[0] - a[0]) * kk); dot.setAttribute("cy", a[1] + (b[1] - a[1]) * kk);
        if (k < 1) requestAnimationFrame(step); else { dot.remove(); res(); }
      };
      requestAnimationFrame(step);
    });
  }

  /* ═══════════════════════════════ command palette ═══════════════════════════════ */
  const INDEX = () => withIds([
    ...LICENCES.map((l) => ({ g: "Licences", t: l.hint, s: `#${l.id} · ${PRODUCTS[l.p].name} · ${l.client} · WHMCS #${l.svc} · ${l.status}`, k: `#${l.id}`, go: () => licenceDrawer(l.id), terms: [l.hint, "#" + l.id, String(l.svc), l.client, PRODUCTS[l.p].name] })),
    ...INSTALLS.map((i) => ({ g: "Installations", t: i.domain, s: `${PRODUCTS[i.p].name} ${i.ver} · ${i.ip} · ${i.inst}`, k: PRODUCTS[i.p].short, go: () => nav(`#/installations/${i.id}`), terms: [i.domain, i.ip, i.inst, i.ver, i.dir] })),
    ...Object.values(PRODUCTS).map((p) => ({ g: "Products", t: p.name, s: `${p.slug} · version ${p.version}`, k: p.short, go: () => nav("#/products"), terms: [p.slug, p.prefix, p.version] })),
    ...KEYS.map((k) => ({ g: "Keys", t: k.kid, s: k.fp, k: k.role, go: () => nav("#/keys"), terms: [k.fp, k.pub] })),
    { g: "Actions", t: "Create licence", s: "Issue a licence outside WHMCS", k: "N L", go: () => ACTIONS["new-licence"](), terms: ["new", "issue"] },
    { g: "Actions", t: "Reissue licence #3", s: "portal.shrotihost.in · WhatsApp Manager", k: "", go: () => ACTIONS.reissue({ dataset: { id: "3" } }), terms: ["reissue"] },
    { g: "Actions", t: "Suspend licence #3", s: "Shows the impact before anything changes", k: "", go: () => ACTIONS.suspend({ dataset: { id: "3" } }), terms: ["suspend"] },
    { g: "Actions", t: "Rotate signing key", s: "shl-2026-09 → shl-2027-03", k: "", go: () => ACTIONS.rotate(), terms: ["rotate", "key"] },
    { g: "Actions", t: "Toggle theme", s: "Dark ↔ Light", k: "⌘⇧L", go: () => toggleTheme(), terms: ["dark", "light", "theme"] },
    { g: "Actions", t: "Keyboard shortcuts", s: "", k: "?", go: () => ACTIONS.shortcuts(), terms: ["help", "keys"] },
    ...[["Overview", "overview"], ["Installations", "installations"], ["Security", "security"], ["Licences", "licences"], ["Products & Plans", "products"], ["Releases", "releases"], ["Signing Keys", "keys"], ["Access", "access"], ["Settings", "settings"]]
      .map(([t, r]) => ({ g: "Go to", t, s: "", k: "", go: () => nav("#/" + r), terms: [r] })),
  ]);
  const withIds = (list) => list.map((x) => ({ ...x, id: x.g + "|" + x.t }));
  let palItems = [], palSel = 0;
  function palRender() {
    const q = $("#pal-q").value.trim().toLowerCase();
    const all = INDEX();
    let items;
    if (!q) {
      const rec = state.recents.map((r) => all.find((x) => x.id === r)).filter(Boolean).map((x) => ({ ...x, g: "Recent" }));
      items = [...rec, ...all.filter((x) => x.g === "Actions" || x.g === "Go to")];
    } else {
      items = all.filter((x) => [x.t, x.s, ...(x.terms || [])].join(" ").toLowerCase().includes(q));
    }
    palItems = items.slice(0, 40); palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
    let html = "", g = "";
    palItems.forEach((x, n) => {
      if (x.g !== g) { g = x.g; html += `<div class="pal-group" role="presentation">${esc(g)}</div>`; }
      html += `<button class="pal-item" role="option" id="po-${n}" data-n="${n}" aria-selected="${n === palSel}"><span class="t"><b>${esc(x.t)}</b>${x.s ? `<span>${esc(x.s)}</span>` : ""}</span><span class="k">${esc(x.k)}</span></button>`;
    });
    $("#pal-list").innerHTML = html || `<div class="pal-empty">No licence, installation, product or key matches “${esc(q)}”.</div>`;
    $("#pal-q").setAttribute("aria-activedescendant", palItems.length ? `po-${palSel}` : "");
    $(`#po-${palSel}`)?.scrollIntoView({ block: "nearest" });
  }
  function openPalette() { lastFocus = document.activeElement; $("#palette").hidden = false; $("#pal-scrim").hidden = false; $("#pal-q").value = ""; palSel = 0; palRender(); $("#pal-q").focus(); }
  function closePalette() { if ($("#palette").hidden) return; $("#palette").hidden = true; $("#pal-scrim").hidden = true; lastFocus?.focus?.(); }
  function palChoose(n) {
    const x = palItems[n]; if (!x) return;
    state.recents = [x.id, ...state.recents.filter((r) => r !== x.id)].slice(0, 5);
    store.set("recents", state.recents);
    $("#palette").hidden = true; $("#pal-scrim").hidden = true;
    x.go();
  }

  /* ═══════════════════════════════ theme & motion ═══════════════════════════════ */
  function applyTheme(pref, persist = true) {
    state.theme = pref;
    if (persist) { store.set("themePref", pref); try { localStorage.setItem("shl.theme", pref); } catch (e) { /* storage unavailable */ } }
    const r = document.documentElement;
    if (pref === "system") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", pref);
    $$("[data-theme-set]").forEach((b) => { const on = b.dataset.themeSet === pref; b.setAttribute(b.getAttribute("role") === "menuitemradio" ? "aria-checked" : "aria-pressed", String(on)); });
    $$('[data-set^="theme:"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.set === "theme:" + pref)));
  }
  const effectiveDark = () => { const a = document.documentElement.getAttribute("data-theme"); return a ? a === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
  function toggleTheme() { applyTheme(effectiveDark() ? "light" : "dark"); toast("info", `Theme: ${state.theme}`); }
  function applyMotion(pref, persist = true) {
    state.motion = pref;
    if (persist) { store.set("motionPref", pref); try { localStorage.setItem("shl.motion", pref); } catch (e) { /* storage unavailable */ } }
    const reduce = pref === "reduce" || (pref === "system" && matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (reduce) document.documentElement.setAttribute("data-motion", "reduce"); else document.documentElement.removeAttribute("data-motion");
  }

  /* ═══════════════════════════════ router & render ═══════════════════════════════ */
  const TITLES = { overview: "Overview", installations: "Installations", security: "Security", licences: "Licences", products: "Products & Plans", releases: "Releases", keys: "Signing Keys", access: "Access", settings: "Settings" };
  const nav = (h) => { if (location.hash === h) render(); else location.hash = h; };
  function parse() {
    const [path, qs] = (location.hash.replace(/^#/, "") || "/overview").split("?");
    const parts = path.split("/").filter(Boolean);
    return { view: parts[0] || "overview", id: parts[1] || null, tab: parts[2] || null, q: new URLSearchParams(qs || "") };
  }
  function render() {
    const r = parse();
    if (r.view === "login") { showLogin(); return; }
    $("#login").hidden = true; $("#shell").hidden = false;
    const view = VIEWS[r.view] ? r.view : "overview";
    if (r.q.get("event")) state.secSel = r.q.get("event");
    const main = $("#main");
    const banner = `<div class="banner" role="note"><span class="tag">Preview</span>Design preview — a snapshot of the live licensing server taken ${fmtTime(SNAP, true)}. Actions show their real confirmations but change nothing.${state.lab !== "normal" ? ` <b>State preview: ${esc(state.lab)}.</b> <button class="linkbtn" data-set="lab:normal">Back to normal</button>` : ""}</div>`;
    main.innerHTML = banner + VIEWS[view](r.id, r.tab);
    main.dataset.view = view;
    $$(".nav").forEach((a) => a.dataset.route === view ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    $("#crumb").textContent = TITLES[view] + (r.id ? " / " + r.id : "");
    document.title = `${TITLES[view]} · ShrotiHost Licensing`;
    const ss = systemStatus();
    $("#sysstat").innerHTML = `${status(ss.lv, "")}<span class="lbl">${esc(ss.text)}</span><small>as of ${hhmm(SNAP)}</small>`;
    $("#sysstat").setAttribute("aria-label", `System ${ss.text}, as of ${fmtTime(SNAP)}`);
    $("#snap-label").textContent = hhmm(SNAP);
    $$("[data-inspector]", main).forEach(inspectorInit);
    closeRail();
    if (view === "security" && state.secSel) $("#ev-" + state.secSel)?.scrollIntoView({ block: "center" });
    if (r.q.get("focus") === "health") $("#health")?.scrollIntoView({ block: "start" });
    else if (!r.q.get("event")) window.scrollTo(0, 0);
    if (r.q.get("new") === "1" && view === "licences") { history.replaceState(null, "", "#/licences"); ACTIONS["new-licence"](); return; }
    const h1 = $("h1", main); if (h1 && renderCount++ > 0) h1.focus({ preventScroll: true });
  }
  let renderCount = 0;

  /* Partial re-render of filtered tables so the search box keeps focus. */
  function refreshTable(which) {
    if (which === "inst") $("#inst-table").innerHTML = instTable(data().installs);
    if (which === "lic") $("#lic-table").innerHTML = licTable(data().licences);
  }

  /* ═══════════════════════════════ login ═══════════════════════════════ */
  function showLogin() {
    $("#shell").hidden = true; $("#login").hidden = false; document.title = "Sign in · ShrotiHost Licensing";
    $("#boot").hidden = true; $("#lg-submit").disabled = false;
    $("#lg-email").focus();
  }
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = [["lg-email", (v) => /.+@.+\..+/.test(v), "Enter your email address."], ["lg-pass", (v) => v.length >= 8, "Enter your password (8+ characters)."], ["lg-otp", (v) => /^\d{6}$/.test(v), "Enter the 6-digit code from your authenticator app."]];
    let bad = null;
    f.forEach(([id, ok, msg]) => { const el = $("#" + id), er = $("#" + id + "-err"), v = el.value.trim(); const good = ok(v); el.setAttribute("aria-invalid", String(!good)); er.hidden = good; er.textContent = good ? "" : msg; if (!good && !bad) bad = el; });
    if (bad) { bad.focus(); return; }
    const btn = $("#lg-submit"); btn.disabled = true; btn.innerHTML = `<span class="spin" aria-hidden="true"></span>Authenticating…`;
    const boot = $("#boot"); boot.hidden = false; boot.innerHTML = "";
    for (const [a, b] of [["uplink · licensing.shrotihost.in (fra1)", "ok"], ["signing core · shl-2026-09", "self-test ok"], ["trust set · 2 keys", "ok"], ["session · owner", "12 h"]]) { boot.innerHTML += `&gt; ${a} <span class="okw">… ${b}</span>\n`; await wait(200); }
    btn.innerHTML = `${ic("lock")}Authenticate`;
    $("#login-form").reset(); $$(".fld input").forEach((i) => i.removeAttribute("aria-invalid"));
    location.hash = "#/overview"; toast("ok", "Authenticated — design preview session");
  });

  /* ═══════════════════════════════ rail & menu ═══════════════════════════════ */
  const closeRail = () => { $("#rail").classList.remove("open"); $("#menu-btn").setAttribute("aria-expanded", "false"); $("#scrim").hidden = $("#drawer").hidden; };
  $("#menu-btn").addEventListener("click", () => { const o = $("#rail").classList.toggle("open"); $("#menu-btn").setAttribute("aria-expanded", String(o)); $("#scrim").hidden = !o; if (o) $(".nav", $("#rail")).focus(); });
  const closeMenu = () => { $("#user-menu").hidden = true; $("#user-btn").setAttribute("aria-expanded", "false"); };
  $("#user-btn").addEventListener("click", (e) => { e.stopPropagation(); const m = $("#user-menu"); m.hidden = !m.hidden; $("#user-btn").setAttribute("aria-expanded", String(!m.hidden)); if (!m.hidden) $("[role^=menuitem]", m).focus(); });

  /* ═══════════════════════════════ global events ═══════════════════════════════ */
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#user-menu, #user-btn")) closeMenu();
    const t = e.target;
    const themeBtn = t.closest("[data-theme-set]"); if (themeBtn) { applyTheme(themeBtn.dataset.themeSet); closeMenu(); return; }
    const set = t.closest("[data-set]"); if (set) {
      const [k, v] = set.dataset.set.split(":");
      if (k === "theme") applyTheme(v); else if (k === "motion") applyMotion(v); else if (k === "time") { state.time = v; store.set("timePref", v); } else if (k === "lab") state.lab = v;
      render(); return;
    }
    const sortBtn = t.closest("[data-sort]"); if (sortBtn) {
      const [tbl, key] = sortBtn.dataset.sort.split(":"); const s = (tbl === "inst" ? state.inst : state.lic).sort;
      s.dir = s.key === key ? -s.dir : 1; s.key = key; refreshTable(tbl); $(`[data-sort="${tbl}:${key}"]`)?.focus(); return;
    }
    const act = t.closest("[data-action]"); if (act && ACTIONS[act.dataset.action]) { if (act.tagName === "INPUT") { ACTIONS[act.dataset.action](act); return; } e.preventDefault(); ACTIONS[act.dataset.action](act); return; }
    const dlg = t.closest("[data-dlg]"); if (dlg) { closeDialog(dlg.dataset.dlg === "ok"); return; }
    if (t.closest("[data-close]")) { closeDrawer(); return; }
    if (t.id === "scrim") { closeDrawer(); closeRail(); return; }
    if (t.id === "dialog-scrim") { closeDialog(false); return; }
    if (t.id === "pal-scrim") { closePalette(); return; }
    const po = t.closest(".pal-item"); if (po) { palChoose(Number(po.dataset.n)); return; }
    const row = t.closest("tr[data-href]"); if (row && !t.closest("a, button, input, select")) {
      const href = row.dataset.href;
      if (href.startsWith("#/licences/") && !href.split("/")[3] && window.innerWidth > 719 && $("#main").dataset.view === "licences") { licenceDrawer(Number(href.split("/")[2])); return; }
      nav(href);
    }
  });
  document.addEventListener("input", (e) => {
    const f = e.target.dataset?.filter; if (!f) return;
    const [tbl, key] = f.split(":"); (tbl === "inst" ? state.inst : state.lic)[key] = e.target.value; refreshTable(tbl);
  });
  document.addEventListener("change", (e) => {
    if (e.target.dataset?.setSelect === "lab") { state.lab = e.target.value; render(); $("#lab")?.focus(); }
  });

  let gAt = 0, nAt = 0;
  const G = { o: "overview", i: "installations", s: "security", l: "licences", p: "products", r: "releases", k: "keys", a: "access", ",": "settings" };
  document.addEventListener("keydown", (e) => {
    const inField = e.target.closest?.("input, textarea, select");
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "l") { e.preventDefault(); toggleTheme(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#palette").hidden ? openPalette() : closePalette(); return; }
    if (!$("#palette").hidden) {
      if (e.key === "Escape") { e.preventDefault(); closePalette(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); palSel = Math.min(palSel + 1, palItems.length - 1); palRender(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); palSel = Math.max(palSel - 1, 0); palRender(); }
      else if (e.key === "Enter") { e.preventDefault(); palChoose(palSel); }
      else trap(e, $("#palette"));
      return;
    }
    if (!$("#dialog").hidden) { if (e.key === "Escape") closeDialog(false); else trap(e, $("#dialog")); return; }
    if (!$("#drawer").hidden) { if (e.key === "Escape") closeDrawer(); else trap(e, $("#drawer")); return; }
    if (e.key === "Escape") { closeMenu(); closeRail(); return; }
    const tr = e.target.closest?.("tr[data-href]"); if (tr && e.key === "Enter") { tr.click(); return; }
    if (inField || e.metaKey || e.ctrlKey || e.altKey || !$("#login").hidden) return;
    if (e.key === "?") { e.preventDefault(); ACTIONS.shortcuts(); return; }
    const k = e.key.toLowerCase(), now = Date.now();
    if (now - gAt < 1200 && G[k]) { gAt = 0; nav("#/" + G[k]); return; }
    if (now - nAt < 1200 && k === "l") { nAt = 0; ACTIONS["new-licence"](); return; }
    if (k === "g") gAt = now; else if (k === "n") nAt = now;
  });

  $("#search-btn").addEventListener("click", openPalette);
  $("#search-btn-sm").addEventListener("click", openPalette);
  $("#pal-q").addEventListener("input", () => { palSel = 0; palRender(); });
  window.addEventListener("hashchange", render);
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", () => applyMotion(state.motion));
  document.addEventListener("visibilitychange", () => document.documentElement.classList.toggle("paused", document.hidden));

  /* ═══════════════════════════════ boot ═══════════════════════════════ */
  const qp = new URLSearchParams(location.search);
  applyTheme(qp.get("theme") || state.theme, !qp.get("theme"));
  applyMotion(qp.get("motion") || state.motion, !qp.get("motion"));
  if (qp.get("lab")) state.lab = qp.get("lab");
  render();
})();
