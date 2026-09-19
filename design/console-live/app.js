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

  /* ═══════════════════════════════ live data ═══════════════════════════════
     Everything the console shows comes from GET /api/console/snapshot. Times and
     ages are "as of" the server time of the last successful load (SNAP); the
     console reloads every minute and marks the data stale if a reload fails. */
  let SNAP = Date.now();
  const DAY = 86400000;
  const REFRESH_MS = 60000;

  /* What the database does not hold: short labels, icons and the WHMCS plans each product is sold as. */
  const PRODUCT_META = {
    wa:  { short: "WA", name: "WhatsApp Manager", icon: "pulse",
           plans: [["#63", "ShrotiHost WhatsApp Manager WHMCS", "Recurring · annual"], ["#64", "WhatsApp Manager Trial", "Trial · 7 days"]] },
    sgf: { short: "SGF", name: "Smart Gateway Fees", icon: "cube",
           plans: [["#62", "Smart Gateway Fees And Gateway Allocator", "Recurring · annual"], ["#65", "Smart Gateway Fees (trial, hidden)", "Recurring"]] },
    sp:  { short: "SP", name: "Social Proof Premium", icon: "grid",
           plans: [["#59", "Social Proof Premium – Real-Time Sales Notification", "Recurring · annual"], ["#60", "Social Proof Premium – Open Source", "No licences issued"]] },
  };
  const P_ORDER = ["wa", "sgf", "sp"];

  let PRODUCTS = {}, LICENCES = [], INSTALLS = [], RELEASES = [], ALL_RELEASES = [], KEYS = [], EVENTS = [], SECURITY = [];
  let HEALTH_ROWS = [], ATTENTION = [], OPERATORS = [], SIGNER = "—", REGION = "fra1";
  let ME = null;            /* the signed-in operator */
  let loaded = false;       /* at least one snapshot has arrived */
  let lastError = null;     /* the last failed reload, while the data is stale */

  function load(snap) {
    SNAP = snap.server_time; SIGNER = snap.signer; REGION = snap.region;
    const rank = (k) => (P_ORDER.includes(k) ? P_ORDER.indexOf(k) : 99);
    ALL_RELEASES = snap.releases;
    RELEASES = P_ORDER.concat(snap.products.map((p) => p.key).filter((k) => !P_ORDER.includes(k)))
      .map((k) => snap.releases.find((r) => r.p === k && r.published)).filter(Boolean);
    PRODUCTS = {};
    [...snap.products].sort((x, y) => rank(x.key) - rank(y.key)).forEach((p) => {
      const m = PRODUCT_META[p.key] || { short: p.key.slice(0, 3).toUpperCase(), name: p.name, icon: "cube", plans: [] };
      PRODUCTS[p.key] = { ...m, key: p.key, slug: p.slug, prefix: p.prefix, ttlH: p.token_ttl_hours || 168, graceH: p.grace_hours || 336,
        version: RELEASES.find((r) => r.p === p.key)?.version || "—" };
    });
    LICENCES = snap.licences; INSTALLS = snap.installs; KEYS = snap.keys; EVENTS = snap.events; SECURITY = snap.security;
    HEALTH_ROWS = snap.health; ATTENTION = snap.attention; OPERATORS = snap.operators || [];
    loaded = true;
  }
  const productOf = (k) => PRODUCTS[k] || { key: k, short: String(k).toUpperCase(), name: k, icon: "cube", plans: [], ttlH: 168, graceH: 336, version: "—", slug: k, prefix: "" };

  /* Same-origin JSON calls. State-changing requests carry the header the server's CSRF check expects. */
  async function api(method, path, body) {
    const init = { method, credentials: "same-origin", cache: "no-store", headers: {} };
    if (method !== "GET") { init.headers["content-type"] = "application/json"; init.headers["x-shl-console"] = "1"; init.body = JSON.stringify(body || {}); }
    let res;
    try { res = await fetch(path, init); } catch (e) { const err = new Error("Could not reach the licensing server. Check your connection."); err.status = 0; throw err; }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
    if (!res.ok) {
      const err = new Error(data?.error?.message || `The server answered HTTP ${res.status}.`);
      err.status = res.status; err.code = data?.error?.code || `http_${res.status}`;
      throw err;
    }
    return data;
  }

  /* ═══════════════════════════════ state ═══════════════════════════════ */
  const state = {
    theme: store.get("themePref", null) ?? (() => { try { return localStorage.getItem("shl.theme") || "dark"; } catch (e) { return "dark"; } })(),
    motion: store.get("motionPref", "system"),
    time: store.get("timePref", "ist"),
    lab: "loading",
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
  const prodDot = (p) => `<span class="pd"><i style="background:var(--p-${p})" aria-hidden="true"></i>${esc(productOf(p).name)}</span>`;

  /* ═══════════════════════════════ derived state ═══════════════════════════════
     state.lab is the page's data state: loading (first load), error (first load failed),
     stale (a reload failed; the last snapshot stays on screen) or normal. */
  const data = () => ({ licences: LICENCES, installs: INSTALLS, events: EVENTS, security: SECURITY });
  const HEALTH = () => (state.lab === "error"
    ? ["API", "Database", "Licensing engine", "Signing service", "Telemetry", "Update service"].map((name) => ({ name, detail: "no response", lv: "bad", text: "Unreachable", pct: 0, metric: "—" }))
    : HEALTH_ROWS);
  const systemStatus = () => {
    if (state.lab === "error") return { lv: "bad", text: "Unreachable" };
    const h = HEALTH();
    if (h.some((x) => x.lv === "bad")) return { lv: "bad", text: "Outage" };
    if (h.some((x) => x.lv === "warn")) return { lv: "warn", text: "Degraded" };
    return { lv: "ok", text: "Operational" };
  };
  const instHealth = (i) => (SNAP - i.hb > 3 * DAY ? ["bad", "Silent"] : SNAP - i.hb > DAY ? ["warn", "Late"] : ["ok", "Healthy"]);

  /* ═══════════════════════════════ reusable blocks ═══════════════════════════════ */
  const emptyState = (title, body, action = "") => `<div class="empty"><h3>${esc(title)}</h3><div class="rule" aria-hidden="true"></div><p>${esc(body)}</p>${action}</div>`;
  const errorState = (title, body, code) => `<div class="error" role="alert"><h3>${esc(title)}</h3><p>${esc(body)}</p>
    <div class="meta">${esc(code)}</div>
    <div class="actions" style="justify-content:center"><button class="btn primary" data-action="refresh">Retry</button></div></div>`;
  const deniedState = () => `<div class="empty"><h3>View-only access</h3><div class="rule" aria-hidden="true"></div><p>Your role (Viewer) can see licences but not change them. Ask the owner for the Operator role.</p></div>`;
  const skeleton = (rows = 4) => `<div class="sk-block" aria-hidden="true">${Array.from({ length: rows }, (_, i) => `<div class="sk" style="width:${[92, 64, 80, 48, 72][i % 5]}%"></div>`).join("")}</div><span class="sr-only">Loading…</span>`;
  const labBody = (fn) => {
    if (state.lab === "loading") return skeleton();
    if (state.lab === "error") return errorState("Could not load licensing data", lastError?.message || "The licensing service did not answer.", lastError?.code || "unavailable");
    return fn();
  };
  const canAct = () => !!ME && ME.role !== "viewer";

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
    const secW = D.security.filter((x) => x.sev !== "bad").length, secC = D.security.length - secW;
    const coreState = { ok: "idle", warn: "warning", bad: "critical", info: "processing" }[ss.lv];
    const attn = ATTENTION;
    const attnWarn = attn.filter((x) => x.lv !== "info").length;
    const active = KEYS.find((k) => k.role === "active"), next = KEYS.find((k) => k.role !== "active");
    const shown = D.events.slice(-40);
    const sample = LICENCES.find((l) => INSTALLS.some((i) => i.lic === l.id));

    return `
      <div class="page-head">
        <div><span class="eyebrow accent">Control plane · overview</span><h1 class="h1" tabindex="-1">${state.lab === "loading" ? "Loading licensing state…" : ss.lv === "ok" ? "All systems operational" : ss.lv === "warn" ? "Service degraded — check system health" : "Licensing service unreachable"}</h1>
          <p class="lede">${loaded ? `State as of ${fmtTime(SNAP, true)}. ${D.installs.length} installation${D.installs.length === 1 ? "" : "s"} reporting, ${secW} security warning${secW === 1 ? "" : "s"} and ${secC} critical event${secC === 1 ? "" : "s"} in the last 7 days.` : "Reading licences, installations and events from the licensing server."}</p></div>
        <div class="actions"><button class="btn" data-action="refresh">${ic("pulse")}Refresh</button><a class="btn primary" href="#/licences">${ic("licence")}Licences</a></div>
      </div>

      ${metricsRail(D)}

      <div class="grid-2">
        <section class="panel" aria-labelledby="attn-h">
          <div class="panel-head"><div><span class="eyebrow">Operations</span><h2 class="h2" id="attn-h">Needs attention</h2></div>${attnWarn ? `<span class="chip warn">${ic("warn")}${attnWarn} warning${attnWarn === 1 ? "" : "s"}</span>` : ""}</div>
          ${labBody(() => attn.length ? `<ul class="attn">${attn.map((x) => `<li><span class="ico ${x.lv}${x.lv === "bad" ? " active" : ""}">${ic(x.lv)}</span><div><b>${esc(x.title)}</b>${x.body ? `<p>${esc(x.body)}</p>` : ""}${x.meta ? `<div class="meta">${esc(x.meta)}</div>` : ""}</div><a class="btn sm" href="${esc(x.to)}">${esc(x.cta)}</a></li>`).join("")}</ul>`
            : emptyState("Nothing needs attention", "No warnings, expiries or failed activations right now."))}
        </section>

        <section class="panel hud" aria-labelledby="health-h" id="health">
          <div class="panel-head"><div><span class="eyebrow">Node status</span><h2 class="h2" id="health-h">System health</h2></div>${status(ss.lv, ss.text)}</div>
          ${state.lab === "loading" ? skeleton(6) : `<ul class="health">${HEALTH().map((h) => `<li><span class="name">${esc(h.name)}<small>${esc(h.detail)}</small></span><span class="bar" aria-hidden="true"><span class="${h.lv === "ok" || h.lv === "info" ? "" : h.lv}" style="width:${h.pct}%"></span></span><span style="display:grid;justify-items:end;gap:2px">${status(h.lv, h.text)}<span class="mono muted" style="font-size:11px">${esc(h.metric)}</span></span></li>`).join("")}</ul>`}
          <div class="panel-foot mono">${loaded ? `Checked ${fmtTime(SNAP)} · region ${esc(REGION)} · measured by this request` : "Waiting for the first check"}</div>
        </section>
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
            <div><span class="eyebrow">Signing infrastructure</span><h2 class="h2" id="core-h" style="margin-top:6px">Every entitlement is signed by <span class="mono">${esc(SIGNER)}</span></h2></div>
            ${status(ss.lv, ss.lv === "ok" ? "Operational" : ss.text)}
          </div>
          <dl class="facts">
            <div><dt>Algorithm</dt><dd>Ed25519<small>compact JWS · EdDSA</small></dd></div>
            <div><dt>Active key</dt><dd>${esc(active?.kid || "—")}<small>${active ? esc(active.fp.replace("SHA256:", "").slice(0, 11) + "…" + active.fp.slice(-5)) : ""}</small></dd></div>
            <div><dt>Next key</dt><dd>${esc(next?.kid || "—")}<small>${next ? "bundled in every module" : "none published"}</small></dd></div>
            <div><dt>Tokens · 24 h</dt><dd>${active ? active.issued24h : 0}<small>issued by the active key</small></dd></div>
          </dl>
          <div class="actions"><a class="btn" href="#/keys">${ic("key")}View signing keys</a>${sample ? `<button class="btn ghost" data-action="verify-sample" data-id="${sample.id}">${ic("sig")}How installs verify</button>` : ""}</div>
        </div>
      </section>

      <section class="panel" aria-labelledby="lanes-h">
        <div class="panel-head"><div><span class="eyebrow">Entitlements · to scale</span><h2 class="h2" id="lanes-h">Token lifecycle per installation</h2></div>
          <div class="legend"><span><i style="background:var(--success)"></i>valid</span><span><i style="background:var(--warning)"></i>offline grace</span><span><i style="background:var(--text)"></i>now</span></div></div>
        ${labBody(() => D.installs.length ? lanes(D.installs) : emptyState("No active installations", "Telemetry is waiting for the first authenticated heartbeat.", `<a class="btn" href="#/products">View products</a>`))}
      </section>

      <div class="grid-2">
        <section class="panel" aria-labelledby="topo-h">
          <div class="panel-head"><div><span class="eyebrow">Topology</span><h2 class="h2" id="topo-h">Installations → signing core</h2></div>
            <div class="legend"><span><i style="background:var(--p-wa)"></i>WhatsApp</span><span><i style="background:var(--p-sgf)"></i>Gateway Fees</span><span><i style="background:var(--p-sp)"></i>Social Proof</span></div></div>
          ${labBody(() => D.installs.length ? topology() : emptyState("No installations", "Nodes appear here once a module activates."))}
        </section>
        <section class="panel" aria-labelledby="stream-h">
          <div class="panel-head"><div><span class="eyebrow">Telemetry</span><h2 class="h2" id="stream-h">Recorded events</h2></div>${D.events.length ? `<span class="chip">latest ${shown.length} of ${D.events.length} · 30 d</span>` : ""}</div>
          ${labBody(() => shown.length ? `<div class="stream" id="stream" role="log" aria-label="Recorded licensing events">${shown.map(evRow).join("")}</div>` : emptyState("No events recorded", "Events appear as installs activate, check in and receive updates."))}
        </section>
      </div>

      <section class="panel" aria-labelledby="raster-h">
        <div class="panel-head"><div><span class="eyebrow">Signal</span><h2 class="h2" id="raster-h">Check-ins · 24 hours to ${loaded ? hhmm(SNAP) : "now"}</h2></div><span class="chip">One cell per hour · filled = signed token issued</span></div>
        ${labBody(() => D.installs.length ? raster(D.installs) : emptyState("No heartbeats", "Nothing has checked in yet."))}
      </section>`;
  };

  /* ── Telemetry rail: one continuous instrument across the top of the overview ──
     Every number and every chart below is derived from the live snapshot.
     data-state: live · loading · empty (nothing issued yet) · stale (a reload failed, or the first load did). */
  const RAIL_NAME = new Proxy({ wa: "WhatsApp", sgf: "Gateway Fees", sp: "Social Proof" }, { get: (o, k) => o[k] ?? productOf(k).name });
  function metricsRail(D) {
    const lab = state.lab;
    const railState = lab === "loading" ? "loading" : ["error", "stale"].includes(lab) ? "stale" : !D.licences.length && !D.installs.length ? "empty" : "live";
    const H = 40, TOP = 5, BASE = 35;
    const sy = (v, max) => (max ? BASE - (v / max) * (BASE - TOP) : BASE);
    const sx = (t, t0, t1) => Math.max(0, Math.min(100, ((t - t0) / (t1 - t0)) * 100));
    const n = (v) => +v.toFixed(2);
    const svg = (tone, inner) => `<svg class="metric-chart" data-tone="${tone}" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${inner}</svg>`;
    const line = (d) => `<path class="mc-line" d="${d}" vector-effect="non-scaling-stroke"/>`;
    const dot = (x, y) => `<path class="mc-dot" d="M${n(x)} ${n(y)}h0" vector-effect="non-scaling-stroke"/>`;
    const flat = (tone) => svg(tone, `<path class="mc-line mc-empty" d="M0 ${BASE}H100" vector-effect="non-scaling-stroke"/>`);
    /* Cumulative step line: each timestamp adds one. */
    const steps = (times, t0, t1, max) => {
      let v = times.filter((t) => t <= t0).length, d = `M0 ${n(sy(v, max))}`;
      [...new Set(times.filter((t) => t > t0 && t <= t1))].sort((a, b) => a - b).forEach((t) => {
        v += times.filter((x) => x === t).length;
        d += `H${n(sx(t, t0, t1))}V${n(sy(v, max))}`;
      });
      return { d: d + "H100", end: sy(v, max) };
    };
    const HOUR = 3600000;

    /* 1 · licences */
    const act = D.licences.filter((l) => l.status === "active");
    const term = D.licences.filter((l) => l.status === "terminated").length;
    const susp = D.licences.filter((l) => l.status === "suspended").length;
    const licLine = steps(act.map((l) => l.created), SNAP - 30 * DAY, SNAP, act.length);

    /* 2 · installs */
    const domains = new Set(D.installs.map((i) => i.domain)).size;
    const silent = D.installs.filter((i) => SNAP - i.hb > 3 * DAY).length;
    const instLine = steps(D.installs.map((i) => i.created), SNAP - 30 * DAY, SNAP, D.installs.length);

    /* 3 · heartbeats: 24 hourly buckets of signed check-ins, oldest first */
    const beat = D.installs.filter((i) => SNAP - i.hb <= DAY);
    const buckets = Array.from({ length: 24 }, (_, k) => D.installs.reduce((sum, i) => sum + ((i.beats || [])[23 - k] || 0), 0));
    const bMax = Math.max(1, ...buckets), bw = 100 / 24, HB = 27;
    let ecg = `M0 ${HB}`;
    buckets.forEach((c, k) => {
      if (!c) return;
      const end = (k + 1) * bw, w = Math.max(bw, 10), x = end - w, amp = (c / bMax) * (HB - TOP);
      ecg += `L${n(x + w * 0.1)} ${HB}L${n(x + w * 0.3)} ${HB + 3}L${n(x + w * 0.5)} ${n(HB - amp)}L${n(x + w * 0.68)} ${HB + 6}L${n(x + w * 0.85)} ${HB}`;
    });
    ecg += `L100 ${HB}`;
    const api = HEALTH()[0]?.metric || "—";

    /* 4 · security: 7 daily buckets */
    const days = Array.from({ length: 7 }, (_, k) => { const a = SNAP - (7 - k) * DAY; return D.security.filter((s) => s.t > a && s.t <= a + DAY).length; });
    const dMax = Math.max(1, ...days);
    const secPts = days.map((c, k) => `${n((k / 6) * 100)} ${n(sy(c, dMax))}`);
    const retries = D.security.filter((s) => /^activation_/.test(s.code)).length;
    const authFail = D.security.filter((s) => /auth_failure|login_failed/.test(s.code)).length;
    const otherSec = D.security.length - retries - authFail;

    /* 5 · releases: adoption of each release across that product's installs */
    const rels = RELEASES;
    const adopt = rels.map((r) => { const all = D.installs.filter((i) => i.p === r.p); return all.length ? all.filter((i) => i.ver === r.version).length / all.length : 0; });
    const gap = 6, rw = (100 - gap * (rels.length - 1)) / Math.max(1, rels.length);
    const relBars = rels.map((r, k) => { const x = k * (rw + gap); return `<rect class="mc-track" x="${n(x)}" y="29" width="${n(rw)}" height="6"/><rect class="mc-bar" x="${n(x)}" y="29" width="${n(rw * adopt[k])}" height="6"/>`; }).join("");
    const pctTxt = (a) => `${Math.round(a * 100)}%`;
    const relAdoptTxt = adopt.length && adopt.every((a) => a === adopt[0]) ? `each on ${pctTxt(adopt[0])} of its installs` : rels.map((r, k) => `${RAIL_NAME[r.p]} on ${pctTxt(adopt[k])}`).join(", ");
    const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs.join(""));
    const plural = (c, one, many = one + "s") => `${c} ${c === 1 ? one : many}`;
    /* Context lines: short items never split and a "·" never starts a line. Wrapping uses nowrap spans,
       so textContent stays plain ("of 18 · 12 terminated · 1 suspended"). An item may be [soft, hard]:
       the line may break after "soft" but never inside "hard". */
    const nw = (t) => `<span class="nw">${t}</span>`;
    const ctx = (xs) => xs.map((x, k) => {
      const sep = k < xs.length - 1 ? " ·" : "";
      if (Array.isArray(x)) return `${esc(x[0])} ${nw(esc(x[1]) + sep)}`;
      if (x.length <= 17) return nw(esc(x) + sep);
      const cut = x.lastIndexOf(" ");
      return `${esc(x.slice(0, cut))} ${nw(esc(x.slice(cut + 1)) + sep)}`;
    }).join(" ");
    const relItems = rels.map((r, k) => {
      const name = RAIL_NAME[r.p], sp = name.indexOf(" ");
      return sp > 0 && k < rels.length - 1 ? [name.slice(0, sp), `${name.slice(sp + 1)} ${r.version}`] : `${name} ${r.version}`;
    });

    const empty = railState === "empty";
    const cells = [
      { id: "licences", href: "#/licences", label: "Active licences", value: act.length,
        ctx: empty ? "No licences issued yet" : ctx([`of ${D.licences.length}`, `${term} terminated`, `${susp} suspended`]),
        aria: empty ? "Active licences: 0. No licences issued yet." : `Active licences: ${act.length} of ${D.licences.length}. ${term} terminated, ${susp} suspended.`,
        chart: empty ? flat("neutral") : svg("neutral", line(licLine.d) + dot(100, licLine.end)) },
      { id: "installs", href: "#/installations", label: "Live installs", value: D.installs.length,
        ctx: empty ? "No installations reporting" : ctx([plural(domains, "domain"), `${silent} silent > 3 d`]),
        aria: empty ? "Live installs: 0. No installations reporting." : `Live installs: ${D.installs.length} across ${plural(domains, "domain")}. ${silent ? plural(silent, "install") + " silent" : "None silent"} for more than 3 days.`,
        chart: empty ? flat("healthy") : svg("healthy", `<path class="mc-area" d="${instLine.d}V${H}H0Z"/>` + line(instLine.d)) },
      { id: "heartbeats", href: "#/installations", label: "Heartbeats · 24 h", value: beat.length,
        ctx: empty ? `No heartbeats in the last ${nw("24 h")}` : ctx([`${beat.length} of ${D.installs.length} installs checked in`, `API ${api}`]),
        aria: empty ? "Heartbeats in the last 24 hours: 0. No installations reporting." : `Heartbeats in the last 24 hours: ${beat.length} of ${D.installs.length} installs checked in. API response ${esc(api)}.`,
        chart: empty ? flat("neutral") : svg("neutral", line(ecg)) },
      { id: "security", href: "#/security", label: "Security · 7 d", value: D.security.length, warn: D.security.length > 0,
        ctx: empty ? `No security events in ${nw("7 days")}` : (D.security.length ? ctx([retries && plural(retries, "refused activation"), authFail && plural(authFail, "auth failure"), otherSec && plural(otherSec, "other event")].filter(Boolean)) : ctx(["No warnings", "0 critical"])),
        aria: empty ? "Security events in the last 7 days: 0." : `Security events in the last 7 days: ${D.security.length}.${D.security.length ? " " + list([retries && plural(retries, "refused activation"), authFail && plural(authFail, "authentication failure"), otherSec && plural(otherSec, "other event")].filter(Boolean)) + "." : ""}`,
        chart: empty ? flat("warning") : svg("warning", line(`M${secPts.join("L")}`)) },
      { id: "releases", href: "#/releases", label: "Latest releases", value: rels.length,
        ctx: empty ? "No releases published yet" : ctx(relItems),
        aria: empty ? "Latest releases: 0. No releases published yet." : `Latest releases: ${rels.length}. ${list(rels.map((r) => `${RAIL_NAME[r.p]} ${r.version}`))}, ${relAdoptTxt}.`,
        chart: empty ? flat("brand") : svg("brand", relBars) },
    ];
    const staleNote = railState === "stale" ? ` Last synced ${hhmm(SNAP)}; figures may be out of date.` : "";
    const sk = (w, h, extra = "") => `<span class="sk" style="width:${w}%;height:${h}px${extra}"></span>`;
    const cell = (c) => railState === "loading"
      ? `<a class="metric-cell" href="${c.href}" data-metric="${c.id}" aria-label="${esc(c.label)}: loading."><span class="metric-label">${esc(c.label)}</span>
          <span class="metric-sk" aria-hidden="true">${sk(38, 40)}${sk(86, 12)}${sk(58, 12)}</span><span class="metric-sk metric-sk-chart" aria-hidden="true">${sk(100, 6)}</span></a>`
      : `<a class="metric-cell" href="${c.href}" data-metric="${c.id}" aria-label="${esc(c.aria + staleNote)}"><span class="metric-label">${esc(c.label)}</span>
          <span class="metric-value${c.warn ? " is-warning" : ""}">${c.value}</span><span class="metric-context">${c.ctx}</span>${c.chart}</a>`;
    return `<section class="dashboard-metrics-rail" data-state="${railState}" aria-label="Licensing telemetry"${railState === "loading" ? ' aria-busy="true"' : ""}>
        ${railState === "stale" ? `<span class="rail-stale"><b>Stale</b> · last sync ${hhmm(SNAP)}</span>` : ""}${cells.map(cell).join("")}</section>`;
  }

  function lanes(installs) {
    const from = SNAP - DAY, to = SNAP + 22 * DAY, span = to - from;
    const pct = (t) => Math.max(0, Math.min(100, ((t - from) / span) * 100));
    const day = (t) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ().tz });
    const rows = installs.map((i) => {
      const P = productOf(i.p), exp = i.hb + P.ttlH * 3600000, grace = exp + P.graceH * 3600000;
      return `<div class="lane"><div class="who"><b>${esc(i.domain)}</b><span>${esc(P.short)} ${esc(i.ver)} · #${i.lic}</span></div>
        <div class="track" role="img" aria-label="${esc(i.domain)} ${esc(P.name)}: valid to ${day(exp)}, grace to ${day(grace)}">
          <span class="seg-valid" style="left:${pct(i.hb)}%;width:${pct(exp) - pct(i.hb)}%"></span><span class="seg-grace" style="left:${pct(exp)}%;width:${pct(grace) - pct(exp)}%"></span><span class="now-mark" style="left:${pct(SNAP)}%"></span>
        </div><div class="left">${Math.max(0, Math.round((exp - SNAP) / DAY))} d left</div></div>`;
    }).join("");
    const ticks = [0, 7, 14, 21].map((d) => `<span style="left:${pct(SNAP + d * DAY)}%">${d ? "+" + d + " d" : "now"}</span>`).join("");
    return `<div class="lanes">${rows}<div class="lane axis"><div></div><div class="ticks">${ticks}</div><div></div></div>
      <p class="muted" style="font-size:12px">Each green bar starts at the install's last check-in. Installs refresh daily, so the bar restarts long before it ends. If this server went dark, installs keep working through the amber window before they hold their queues.</p></div>`;
  }

  function raster(installs) {
    const endH = localHour(SNAP);
    const hours = Array.from({ length: 24 }, (_, k) => (endH - 23 + k + 24) % 24);
    const lastHour = installs.filter((i) => (i.beats || [])[0] > 0).length;
    const rows = installs.map((i) => `<div class="rrow"><div class="who"><b>${esc(i.domain)}</b><span>${esc(productOf(i.p).short)}</span></div><div class="cells">${hours.map((h, k) => {
      const n = (i.beats || [])[23 - k] || 0;
      return `<span class="cell${n ? " on" : ""}" title="${String(h).padStart(2, "0")}:00 ${TZ().name} · ${n ? `${n} check-in${n === 1 ? "" : "s"}` : "no check-in"}"></span>`;
    }).join("")}</div></div>`).join("");
    return `<div class="raster" role="img" aria-label="${lastHour} of ${installs.length} installations checked in during the current hour; hover a cell for its count.">${rows}<div class="rrow"><div></div><div class="rlabels">${hours.map((h) => `<span>${String(h).padStart(2, "0")}</span>`).join("")}</div></div></div>`;
  }

  /* Events from the last 12 hours show the time; older ones the date and time. */
  const evTime = (t) => (SNAP - t < DAY / 2 ? fmtTime(t).slice(0, 8) : fmtTime(t, true).replace(/ (IST|UTC)$/, ""));
  const evRow = (e) => `<div class="ev" data-t="${e.t}"><time>${evTime(e.t)}</time><span class="k ${e.lv}">${esc(e.k)}</span><span class="d">${esc(e.d)}</span></div>`;

  function topology() {
    const W = 640, H = 300, core = { x: 320, y: 150 };
    const names = [...new Set(INSTALLS.map((i) => i.domain))];
    /* Hosts sit on an ellipse around the core: two hosts land left and right, more spread around. */
    const hosts = {};
    names.forEach((n, k) => {
      const a = names.length === 1 ? Math.PI : Math.PI + (k * 2 * Math.PI) / names.length;
      hosts[n] = { x: core.x + Math.cos(a) * 192, y: core.y + Math.sin(a) * 96 };
    });
    const pos = {};
    names.forEach((n) => {
      const h = hosts[n], mine = INSTALLS.filter((i) => i.domain === n);
      const out = Math.atan2(h.y - core.y, h.x - core.x);
      mine.forEach((i, k) => {
        const a = out + (mine.length === 1 ? 0 : (k - (mine.length - 1) / 2) * (1.7 / Math.max(1, mine.length - 1)));
        pos[i.id] = { x: h.x + Math.cos(a) * 64, y: h.y + Math.sin(a) * 64, h };
      });
    });
    const links = Object.values(hosts).map((h) => `<line class="ln dash" x1="${h.x}" y1="${h.y}" x2="${core.x}" y2="${core.y}"/>`).join("");
    const spokes = INSTALLS.map((i) => `<line class="ln" x1="${pos[i.id].x}" y1="${pos[i.id].y}" x2="${pos[i.id].h.x}" y2="${pos[i.id].h.y}"/>`).join("");
    const nodes = INSTALLS.map((i) => `<a href="#/installations/${i.id}" aria-label="${esc(i.domain)} · ${esc(productOf(i.p).name)} · ${instHealth(i)[1].toLowerCase()}"><circle class="n" cx="${pos[i.id].x}" cy="${pos[i.id].y}" r="7" style="stroke:var(--p-${i.p})"/></a>`).join("");
    const hostEls = Object.entries(hosts).map(([n, h]) => `<circle class="host" cx="${h.x}" cy="${h.y}" r="13"/><text class="lbl" x="${h.x}" y="${Math.min(H - 6, h.y + 92)}" text-anchor="middle">${esc(n)}</text>`).join("");
    const summary = names.map((n) => `${INSTALLS.filter((i) => i.domain === n).length} on ${n}`).join(" and ");
    return `<svg class="topo" id="topo" viewBox="0 0 ${W} ${H}" role="group" aria-label="Topology: ${esc(summary)}, all connected to the signing core">
      <circle class="rng" cx="${core.x}" cy="${core.y}" r="60"/><circle class="rng" cx="${core.x}" cy="${core.y}" r="110"/>
      ${links}${spokes}${hostEls}${nodes}
      <circle class="core-c" cx="${core.x}" cy="${core.y}" r="20"/><text class="core-t" x="${core.x}" y="${core.y + 3.5}" text-anchor="middle">CORE</text>
      <text class="lbl sm" x="${core.x}" y="${core.y + 44}" text-anchor="middle">licensing.shrotihost.in · ${esc(REGION)}</text></svg>`;
  }

  /* ── Installations ── */
  VIEWS.installations = (id) => {
    if (id) return installationDetail(id);
    const D = data();
    const f = state.inst;
    const uniq = (xs) => [...new Set(xs.filter((x) => x && x !== "—"))].sort().map((v) => [v, v]);
    const opts = (key, label, values) => `<label class="sr-only" for="f-${key}">${label}</label><select class="sel" id="f-${key}" data-filter="inst:${key}"><option value="">${label}: all</option>${values.map((v) => `<option value="${esc(v[0])}"${f[key] === v[0] ? " selected" : ""}>${esc(v[1])}</option>`).join("")}</select>`;
    return `
      <div class="page-head"><div><span class="eyebrow accent">Monitor</span><h1 class="h1" tabindex="-1">Installations</h1><p class="lede">Every WHMCS that has activated a licence. A copy seen on another domain is told to re-activate and never counts as the original.</p></div></div>
      <section class="panel" aria-label="Installations list">
        <div class="toolbar" role="search">
          <label class="field-inline" for="inst-q">${ic("search")}<span class="sr-only">Search installations</span><input id="inst-q" data-filter="inst:q" value="${esc(f.q)}" placeholder="Search domain, instance, licence, IP…" autocomplete="off"></label>
          ${opts("p", "Product", Object.values(PRODUCTS).map((p) => [p.key, p.name]))}
          ${opts("ver", "Version", uniq(D.installs.map((i) => i.ver)))}
          ${opts("php", "PHP", uniq(D.installs.map((i) => i.php)))}
          ${opts("whmcs", "WHMCS", uniq(D.installs.map((i) => i.whmcs)))}
          ${opts("status", "Health", [["healthy", "Healthy"], ["late", "Late (1–3 d)"], ["silent", "Silent (> 3 d)"]])}
          <span class="count" id="inst-count"></span>
        </div>
        <div id="inst-table">${labBody(() => instTable(D.installs))}</div>
      </section>`;
  };
  function instFiltered(list) {
    const f = state.inst, q = f.q.trim().toLowerCase();
    return sortRows(list.filter((i) => (!q || [i.domain, i.inst, "#" + i.lic, i.ip, productOf(i.p).name, i.dir].join(" ").toLowerCase().includes(q))
      && (!f.p || i.p === f.p) && (!f.ver || i.ver === f.ver) && (!f.php || i.php === f.php) && (!f.whmcs || i.whmcs === f.whmcs) && (!f.status || instHealth(i)[1].toLowerCase() === f.status)),
      f.sort, { product: (i) => productOf(i.p).name, heartbeat: (i) => -i.hb });
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
        { key: "health", label: "Health", render: (i) => status(...instHealth(i)) },
        { key: "heartbeat", label: "Last heartbeat", sort: true, cls: "mono", render: (i) => `${rel(i.hb)} <span class="muted">· ${fmtTime(i.hb).slice(0, 5)}</span>` },
      ],
      empty: list.length ? emptyState("No matching installations", "Try another search or clear the filters.", `<button class="btn" data-action="clear-inst">Clear filters</button>`)
        : emptyState("No active installations", "Telemetry channel is awaiting its first authenticated heartbeat.", `<a class="btn" href="#/products">View products</a>`),
    });
    queueMicrotask(() => { const c = $("#inst-count"); if (c) c.textContent = `${rows.length} of ${list.length}`; });
    return html;
  }

  function installationDetail(id) {
    const i = INSTALLS.find((x) => x.id === id);
    if (!i) return state.lab === "loading" ? skeleton(6) : notFound("installation");
    const lic = LICENCES.find((l) => l.id === i.lic);
    const P = productOf(i.p);
    const evs = EVENTS.filter((e) => e.inst === id);
    const [lv, text] = instHealth(i);
    const exp = i.hb + P.ttlH * 3600000, grace = exp + P.graceH * 3600000;
    return `
      <nav aria-label="Breadcrumb" class="mono muted" style="font-size:12px"><a href="#/installations">Installations</a> / ${esc(i.domain)} · ${esc(P.short)}</nav>
      <div class="page-head"><div><span class="eyebrow accent">Installation ${esc(i.id)}</span><h1 class="h1" tabindex="-1">${esc(i.domain)}</h1><p class="lede">${esc(P.name)} ${esc(i.ver)} · licence <a href="#/licences/${i.lic}">#${i.lic}</a></p></div>
        <div class="actions">${status(lv, text)}<span class="chip ok">${ic("sig")}Signed by ${esc(SIGNER)}</span></div></div>
      ${lv !== "ok" ? `<div class="banner" role="note"><span class="tag">Attention</span>No check-in for ${rel(i.hb).replace(" ago", "")}. The install keeps working until ${fmtTime(grace, true)}, then holds its queue.</div>` : ""}
      <div class="grid-2">
        <section class="panel"><div class="panel-head"><h2 class="h2">Binding</h2></div><div class="panel-body"><dl class="kv">
          <dt>Domain</dt><dd>${esc(i.domain)}</dd><dt>Directory</dt><dd class="mono">${esc(i.dir || "—")}</dd><dt>Instance</dt><dd class="mono">${esc(i.inst)}</dd>
          <dt>Server IP</dt><dd class="mono">${esc(i.ip)}</dd><dt>PHP · WHMCS</dt><dd class="mono">${esc(i.php)} · ${esc(i.whmcs)}</dd><dt>First activated</dt><dd>${i.created ? fmtTime(i.created, true) : "—"}</dd></dl></div></section>
        <section class="panel"><div class="panel-head"><h2 class="h2">Entitlement</h2></div><div class="panel-body"><dl class="kv">
          <dt>Last check-in</dt><dd>${fmtTime(i.hb, true)} · ${rel(i.hb)}</dd><dt>Token expires</dt><dd>${fmtTime(exp, true)}</dd>
          <dt>Grace until</dt><dd>${fmtTime(grace, true)}</dd><dt>Licence</dt><dd>${lic ? `<a href="#/licences/${i.lic}">${esc(lic.hint)}</a> · ${licStatus(lic.status)}` : `#${i.lic}`}</dd><dt>Check-ins · 24 h</dt><dd class="mono">${(i.beats || []).reduce((a, b) => a + b, 0)}</dd></dl></div></section>
      </div>
      <section class="panel"><div class="panel-head"><h2 class="h2">Events for this installation</h2></div>${evs.length ? `<div class="stream">${evs.map(evRow).join("")}</div>` : emptyState("No events", "Nothing recorded for this installation in the last 30 days.")}</section>
      <div class="actions">${canAct() ? `<button class="btn danger" data-action="revoke-activation" data-id="${i.id}">Remove from licence</button>` : ""}<a class="btn" href="#/licences/${i.lic}">Open licence #${i.lic}</a></div>`;
  }

  /* ── Security ── */
  const DETECTORS = [
    ["Signature failure", "Request HMAC did not match", ["signature_failure"]],
    ["Replay detection", "Nonce reused inside the 5-minute window", ["replay_rejected"]],
    ["Clock skew", "Install clock off by more than 300 s", ["clock_skew"]],
    ["Binding move", "Install seen on a new domain or folder", ["binding_mismatch"]],
    ["Blacklist hit", "Blocked key, domain or IP", ["blacklist_hit"]],
    ["Refused activation", "Unknown, suspended or over-limit key", ["activation_failed", "activation_refused", "activation_limit"]],
    ["Unknown install credentials", "Install token matches no activation", ["auth_failure"]],
    ["Admin auth failure", "Admin API credential rejected", ["admin_auth_failure"]],
    ["Console sign-in failure", "Wrong password on this console", ["console_login_failed"]],
  ];
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
          <div class="radar" role="group" aria-label="Threat activity: ${D.security.filter((x) => x.sev !== "bad").length} warnings, ${D.security.filter((x) => x.sev === "bad").length} critical in 7 days. Select a point to open the event.">
            <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="rr" cx="50" cy="50" r="49"/><circle class="rr faint" cx="50" cy="50" r="33"/><circle class="rr faint" cx="50" cy="50" r="17"/><path class="rr faint" d="M50 1v98M1 50h98"/></svg>
            <div class="sweep" aria-hidden="true"></div>
            ${blips}
          </div>
        </div>
        <div class="sec-summary">
          <div><span class="eyebrow">Security status</span><h2 class="h2" id="sec-h" style="margin-top:6px">${status(D.security.some((s) => s.sev === "bad") ? "bad" : "ok", D.security.some((s) => s.sev === "bad") ? "Critical events" : "No critical events")}</h2></div>
          <div class="sec-counts"><div><b style="color:var(--warning)">${D.security.filter((x) => x.sev !== "bad").length}</b><span>Warnings</span></div><div><b${D.security.some((x) => x.sev === "bad") ? ' style="color:var(--danger)"' : ""}>${D.security.filter((x) => x.sev === "bad").length}</b><span>Critical</span></div><div><b>7</b><span>Days</span></div></div>
          <p class="muted" style="font-size:12.5px">Distance from the centre is age; each point is one recorded event.${D.security.length ? " Each one is explained below." : ""}</p>
        </div>
      </section>
      <section class="panel" aria-labelledby="ev-h">
        <div class="panel-head"><div><span class="eyebrow">Last 7 days</span><h2 class="h2" id="ev-h">Security events</h2></div></div>
        ${labBody(() => D.security.length ? `<ul class="events">${D.security.map((s) => `<li id="ev-${s.id}" class="${sel === s.id ? "sel" : ""}"><div class="event">
          <span>${ic(s.sev === "bad" ? "bad" : "warn")}</span>
          <div><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><b>${esc(s.kind)}</b>${status(s.sev === "bad" ? "bad" : "warn", s.sev === "bad" ? "Critical" : "Warning")}<span class="mono muted" style="font-size:12px">${fmtTime(s.t, true)} · ${rel(s.t)}${s.count > 1 ? ` · ×${s.count}` : ""}</span></div>
          <dl><dt>What happened</dt><dd>${esc(s.what)}</dd><dt>Affected licence</dt><dd>${esc(s.licence)}</dd><dt>Affected installation</dt><dd>${esc(s.install)}</dd><dt>Outcome</dt><dd>${esc(s.outcome)}</dd><dt>Recommended action</dt><dd>${esc(s.action)}</dd></dl>
          <div class="actions" style="margin-top:10px">${s.to !== "#/security" ? `<a class="btn sm" href="${esc(s.to)}">Open ${s.to.includes("installations") ? "installation" : s.to.includes("settings") ? "profile" : "access"}</a>` : ""}</div></div></div></li>`).join("")}</ul>`
          : emptyState("No security events", "No refused activations, bad signatures, replays or skewed clocks in the last 7 days."))}
      </section>
      <section class="panel" aria-labelledby="det-h"><div class="panel-head"><div><span class="eyebrow">Coverage</span><h2 class="h2" id="det-h">Detectors</h2></div></div>
        ${table({ id: "det", caption: "Security detectors", rows: DETECTORS.map(([n, w, codes]) => [n, w, D.security.filter((x) => codes.includes(x.code)).length]), cols: [
          { key: "n", label: "Detector", cls: "strong", render: (d) => esc(d[0]) }, { key: "w", label: "Watches for", render: (d) => esc(d[1]) },
          { key: "c", label: "7 days", cls: "mono", render: (d) => d[2] }, { key: "s", label: "State", render: (d) => (d[2] ? status("warn", "Triggered") : status("ok", "Quiet")) }] })}
      </section>`;
  };

  /* ── Licences ── */
  VIEWS.licences = (id, tab) => (id ? licenceDetail(Number(id), tab || "overview") : licenceList());
  function licFiltered(list) {
    const f = state.lic, q = f.q.trim().toLowerCase();
    return sortRows(list.filter((l) => (!q || [l.hint, "#" + l.id, String(l.svc), l.client, productOf(l.p).name].join(" ").toLowerCase().includes(q)) && (!f.status || l.status === f.status) && (!f.p || l.p === f.p)),
      f.sort, { product: (l) => productOf(l.p).name });
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
        : emptyState("No licences", "Licences appear when WHMCS provisions a module order."),
    });
  }
  function licenceList() {
    const D = data(), f = state.lic;
    return `
      <div class="page-head"><div><span class="eyebrow accent">Manage</span><h1 class="h1" tabindex="-1">Licences</h1><p class="lede">Keys are stored only as hashes; WHMCS keeps the plaintext for the customer. New licences and new keys come from the WHMCS service; suspend, unsuspend and reissue work here too.</p></div></div>
      ${ME && !canAct() ? `<section class="panel">${deniedState()}</section>` : ""}
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
    if (!l) return state.lab === "loading" ? skeleton(6) : notFound("licence");
    const P = productOf(l.p);
    const inst = INSTALLS.filter((i) => i.lic === l.id);
    const tabs = [["overview", "Overview"], ["activations", "Activations"], ["entitlements", "Entitlements"], ["events", "Events"], ["updates", "Updates"], ["audit", "Audit log"]];
    const body = {
      overview: () => `<div class="grid-2"><section class="panel"><div class="panel-head"><h2 class="h2">Licence</h2></div><div class="panel-body"><dl class="kv">
          <dt>Key</dt><dd class="mono">${esc(l.hint)} <span class="muted">(full key lives in WHMCS)</span></dd><dt>Status</dt><dd>${licStatus(l.status)}</dd>
          <dt>Product</dt><dd>${prodDot(l.p)}</dd><dt>Customer</dt><dd>${esc(l.client)}</dd><dt>WHMCS service</dt><dd class="mono">#${l.svc}</dd>
          <dt>Activations</dt><dd class="mono">${inst.length} / ${l.max}</dd><dt>Updates until</dt><dd>${fmtDate(l.updates)}</dd><dt>Reissues used</dt><dd class="mono">${l.reissues ?? 0}</dd><dt>Created</dt><dd>${l.created ? fmtTime(l.created, true) : "—"}</dd><dt>Subscription</dt><dd>Governed by WHMCS — suspends when an invoice goes unpaid</dd></dl></div></section>
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
      updates: () => { const r = RELEASES.find((x) => x.p === l.p); const ok = !!r && l.status === "active" && l.updates && new Date(l.updates) > new Date(SNAP);
        if (!r) return emptyState("No published release", `Nothing is published for ${P.name} yet. Upload one from WHMCS → Addons → ShrotiHost Licensing → Releases.`);
        return `<div class="panel-body" style="display:grid;gap:12px"><dl class="kv"><dt>Latest release</dt><dd class="mono">${esc(P.name)} ${esc(r.version)} · ${esc(r.size)}</dd><dt>SHA-256</dt><dd class="mono">${esc(r.sha)}…</dd><dt>Eligibility</dt><dd>${ok ? status("ok", "Eligible · updates until " + fmtDate(l.updates)) : status("warn", "Not eligible — licence not active or updates expired")}</dd><dt>Installed</dt><dd>${inst.map((i) => `${esc(i.domain)} ${esc(i.ver)}`).join(" · ") || "—"}</dd></dl>
          <div class="actions"><button class="btn" data-action="download" data-id="${l.id}"${ok ? "" : " disabled"}>${ic("release")}Issue one-time download link</button></div></div>`; },
      audit: () => { const rows = EVENTS.filter((e) => e.lic === l.id).map((e) => [e.t, e.k, e.d, e.actor || (e.inst ? "install" : "system")]).reverse();
        return rows.length ? table({ id: "aud", caption: "Audit log", rows, cols: [{ key: "t", label: "When", cls: "mono", render: (r) => fmtTime(r[0], true) }, { key: "k", label: "Event", cls: "mono strong", render: (r) => esc(r[1]) }, { key: "d", label: "Detail", render: (r) => esc(r[2]) }, { key: "a", label: "Actor", cls: "mono", render: (r) => esc(r[3]) }] }) : emptyState("No audit entries", "Nothing recorded for this licence in the last 30 days."); },
    };
    return `
      <nav aria-label="Breadcrumb" class="mono muted" style="font-size:12px"><a href="#/licences">Licences</a> / #${l.id}</nav>
      <div class="page-head"><div><span class="eyebrow accent">Licence #${l.id} · ${esc(P.name)}</span><h1 class="h1 mono" tabindex="-1">${esc(l.hint)}</h1><p class="lede">${esc(l.client)} · WHMCS service #${l.svc} · ${inst.length} / ${l.max} activations</p></div>
        <div class="actions">${licStatus(l.status)}${canAct() && l.status !== "terminated" ? `<button class="btn" data-action="reissue" data-id="${l.id}">Reissue</button>${l.status === "active" ? `<button class="btn danger" data-action="suspend" data-id="${l.id}">Suspend</button>` : `<button class="btn" data-action="unsuspend" data-id="${l.id}">Unsuspend</button>`}` : ""}</div></div>
      <nav class="tabs" aria-label="Licence sections">${tabs.map(([k, n]) => `<a href="#/licences/${l.id}/${k}"${k === tab ? ' aria-current="page"' : ""}>${n}</a>`).join("")}</nav>
      <section class="panel" aria-label="${esc(tabs.find((t) => t[0] === tab)?.[1] || "")}">${(body[tab] || body.overview)()}</section>`;
  }

  /* ── Products ── */
  VIEWS.products = () => `
    <div class="page-head"><div><span class="eyebrow accent">Manage</span><h1 class="h1" tabindex="-1">Products &amp; Plans</h1><p class="lede">Each licensing product maps to one or more WHMCS products. WHMCS decides status, dates and seats; this server records and signs them.</p></div></div>
    ${labBody(() => Object.keys(PRODUCTS).length ? `<div class="grid-3">${Object.values(PRODUCTS).map((p) => {
      const ls = LICENCES.filter((l) => l.p === p.key);
      const fmtH = (h) => (h % 24 ? `${h} h` : `${h / 24} d`);
      return `<section class="panel card" aria-labelledby="p-${esc(p.key)}">
        <div class="card-top"><span class="tile" style="background:color-mix(in srgb, var(--p-${esc(p.key)}, var(--accent)) 16%, transparent);color:var(--p-${esc(p.key)}, var(--accent))">${ic(p.icon)}</span><div style="min-width:0"><h2 class="h2" id="p-${esc(p.key)}">${esc(p.name)}</h2><div class="mono muted" style="font-size:11.5px;overflow-wrap:anywhere">${esc(p.slug)}</div></div></div>
        <div class="mini"><div><span>Active</span><b style="color:var(--success)">${ls.filter((l) => l.status === "active").length}</b></div><div><span>Suspended</span><b>${ls.filter((l) => l.status === "suspended").length}</b></div><div><span>Version</span><b class="mono">${esc(p.version)}</b></div></div>
        <dl class="kv"><dt>Key prefix</dt><dd class="mono">${esc(p.prefix || "—")}</dd><dt>Installs</dt><dd>${INSTALLS.filter((i) => i.p === p.key).length} active</dd><dt>Token</dt><dd>${fmtH(p.ttlH)} + ${fmtH(p.graceH)} grace</dd></dl>
        ${p.plans.length ? `<div><span class="eyebrow">WHMCS plans</span><ul style="margin:8px 0 0;padding-left:18px;display:grid;gap:4px;font-size:12.5px">${p.plans.map((pl) => `<li><span class="mono">${pl[0]}</span> ${esc(pl[1])} <span class="muted">· ${esc(pl[2])}</span></li>`).join("")}</ul></div>` : ""}
      </section>`;
    }).join("")}</div>` : `<section class="panel">${emptyState("No products", "Products are created from WHMCS.")}</section>`)}`;

  /* ── Releases ── */
  VIEWS.releases = () => {
    const last = ALL_RELEASES[0];
    return `
    <div class="page-head"><div><span class="eyebrow accent">Manage</span><h1 class="h1" tabindex="-1">Releases</h1><p class="lede">Uploads are hashed and their manifest signed. Installs only offer an update whose signature and SHA-256 both verify. Versions are immutable. Upload new versions from WHMCS → Addons → ShrotiHost Licensing → Releases.</p></div></div>
    ${last ? `<section class="panel hud" aria-labelledby="pipe-h"><div class="panel-head"><div><span class="eyebrow">Last publish · ${esc(productOf(last.p).name)} ${esc(last.version)}</span><h2 class="h2" id="pipe-h">Signing pipeline</h2></div>${last.published ? status("ok", "Signed · published") : status("idle", "Signed · withdrawn")}</div>
      <div class="pipe"><span class="st">UPLOAD<small>zip · ${esc(last.size)}</small></span><span class="arr" aria-hidden="true">→</span><span class="st">SHA-256<small>${esc(last.sha.slice(0, 12))}…</small></span><span class="arr" aria-hidden="true">→</span><span class="st">MANIFEST<small>${esc(last.channel)}</small></span><span class="arr" aria-hidden="true">→</span><span class="st">ED25519<small>signed manifest</small></span><span class="arr" aria-hidden="true">→</span><span class="st">${last.published ? "PUBLISHED" : "WITHDRAWN"}<small>immutable · one-time links</small></span></div></section>` : ""}
    ${labBody(() => ALL_RELEASES.length ? `<div class="grid-3">${ALL_RELEASES.map((r) => {
      const inst = INSTALLS.filter((i) => i.p === r.p), on = inst.filter((i) => i.ver === r.version).length, pct = inst.length ? Math.round((on / inst.length) * 100) : 0;
      return `<section class="panel card" aria-label="${esc(productOf(r.p).name)} ${esc(r.version)}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div><span class="eyebrow">${esc(productOf(r.p).name)}</span><div class="ver" style="margin-top:6px">${esc(r.version)}</div></div><div class="actions"><span class="chip accent">${esc(r.channel[0].toUpperCase() + r.channel.slice(1))}</span>${r.published ? `<span class="chip ok">${ic("sig")}Published</span>` : `<span class="chip">Withdrawn</span>`}${r.is_security ? `<span class="chip warn">Security</span>` : ""}</div></div>
        <div><div style="display:flex;justify-content:space-between;font-size:12px"><span class="muted">Adoption</span><b class="num">${on}/${inst.length} · ${pct}%</b></div><span class="meter" style="margin-top:6px" aria-hidden="true"><span class="ok" style="width:${pct}%"></span></span></div>
        <dl class="kv"><dt>SHA-256</dt><dd class="mono">${esc(r.sha)}…</dd><dt>Size</dt><dd>${esc(r.size)}</dd><dt>Released</dt><dd>${fmtTime(Date.parse(r.at), true)}</dd></dl>
        ${canAct() ? `<div class="actions">${r.published ? `<button class="btn sm danger" data-action="withdraw-release" data-id="${r.id}">Withdraw</button>` : `<button class="btn sm" data-action="publish-release" data-id="${r.id}">Publish again</button>`}</div>` : ""}
      </section>`;
    }).join("")}</div>` : `<section class="panel">${emptyState("No releases", "Upload a package from WHMCS → Addons → ShrotiHost Licensing → Releases.")}</section>`)}`;
  };

  /* ── Signing keys ── */
  VIEWS.keys = () => {
    const nInst = INSTALLS.length, nLic = LICENCES.filter((l) => l.status === "active").length;
    const next = KEYS.find((k) => k.role !== "active");
    return `
    <div class="page-head"><div><span class="eyebrow accent">Configure</span><h1 class="h1" tabindex="-1">Signing Keys</h1><p class="lede">Public keys ship inside every module — there is no live key fetch an attacker could substitute. Private keys never appear in this console.</p></div></div>
    ${labBody(() => `<div class="grid-2">${KEYS.map((k) => `<section class="panel card${k.role === "active" ? " hud" : ""}" aria-labelledby="k-${esc(k.kid)}">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><span class="eyebrow">Signing key</span><h2 class="h2 mono" id="k-${esc(k.kid)}" style="margin-top:6px;font-size:18px">${esc(k.kid)}</h2></div>${k.role === "active" ? status("ok", "Active signer") : status("idle", "Standby · next")}</div>
      <div class="mini"><div><span>Algorithm</span><b>Ed25519</b></div><div><span>Used by</span><b>${k.role === "active" ? `${nInst} install${nInst === 1 ? "" : "s"}` : "—"}</b></div><div><span>Tokens · 24 h</span><b>${k.issued24h}</b></div></div>
      <dl class="kv"><dt>Fingerprint</dt><dd class="fp">${esc(k.fp)}</dd><dt>Public key</dt><dd class="mono" style="font-size:12px;overflow-wrap:anywhere">${esc(k.pub)} <button class="btn sm ghost" data-action="copy" data-copy="${esc(k.pub)}" aria-label="Copy public key">${ic("copy")}</button></dd>
        <dt>Last used</dt><dd>${k.lastUsed ? `${fmtTime(k.lastUsed, true)} · ${rel(k.lastUsed)}` : "Never"}</dd>
        <dt>Rotation policy</dt><dd>${k.role === "active" ? `Keep trusted 21 days after rotating (7 d token + 14 d grace) · signs ${nLic} active licence${nLic === 1 ? "" : "s"}` : "Bundled in all modules; becomes signer after rotation"}</dd></dl>
    </section>`).join("")}</div>`)}
    ${next ? `<section class="panel" aria-labelledby="rot-h"><div class="panel-head"><div><span class="eyebrow">Rotation readiness</span><h2 class="h2" id="rot-h">Safe to rotate once rehearsed</h2></div><span class="chip warn">${ic("warn")}Rehearsal open</span></div>
      <div class="panel-body rot-grid">
        <div class="gauge" style="--v:100" role="img" aria-label="${nInst} of ${nInst} installations carry the next key"><div><b>${nInst}/${nInst}</b><span>installs trust<br>${esc(next.kid)}</span></div></div>
        <ul class="checklist">
          <li><span class="tk done">${ic("check")}</span><span><b>Next key generated offline</b> — private copy kept outside Vercel</span></li>
          <li><span class="tk done">${ic("check")}</span><span><b>Public key bundled</b> in WhatsApp Manager, Smart Gateway Fees and Social Proof</span></li>
          <li><span class="tk done">${ic("check")}</span><span><b>Published</b> in LICENSE_PUBLIC_KEYS and /api/keys</span></li>
          <li><span class="tk todo">4</span><span><b>Rehearse</b> — sign with ${esc(next.kid)} on a preview deployment and verify from one install</span></li>
          <li><span class="tk todo">5</span><span><b>Switch signer</b> by changing LICENSE_SIGNING_KEY in Vercel; keep ${esc(SIGNER)} trusted for 21 days</span></li>
        </ul></div></section>` : ""}`;
  };

  /* ── Access ── */
  VIEWS.access = () => `
    <div class="page-head"><div><span class="eyebrow accent">Configure</span><h1 class="h1" tabindex="-1">Access</h1><p class="lede">Who can operate this console, and the one machine credential WHMCS uses.</p></div></div>
    <section class="panel" aria-labelledby="ops-h"><div class="panel-head"><h2 class="h2" id="ops-h">Operators</h2></div>
      ${table({ id: "ops", caption: "Operators", rows: OPERATORS, cols: [
        { key: "n", label: "Name", cls: "strong", render: (o) => `${esc(o.name || "—")}${ME && o.id === ME.id ? ` <span class="muted">(you)</span>` : ""}` },
        { key: "e", label: "Email", cls: "mono", render: (o) => esc(o.email) },
        { key: "r", label: "Role", render: (o) => `<span class="chip violet">${esc(o.role[0].toUpperCase() + o.role.slice(1))}</span>` },
        { key: "p", label: "Password", render: (o) => (o.must_change_password ? status("warn", "Initial — change it") : status("ok", "Set by operator")) },
        { key: "s", label: "Last sign-in", cls: "mono", render: (o) => (o.last_login_at ? `${fmtTime(o.last_login_at, true)}` : "Never") }],
        empty: emptyState("No operators", "Create one with scripts/seed-operator.mjs.") })}
      <div class="panel-foot">New operators are created on the server with <span class="mono">scripts/seed-operator.mjs</span>; they must change their password at first sign-in.</div></section>
    <section class="panel" aria-labelledby="ses-h"><div class="panel-head"><h2 class="h2" id="ses-h">Your session</h2></div>
      <div class="setting"><div><b>${esc(ME?.email || "")}</b><p>Sessions last 12 hours. Changing your email or password, or signing out everywhere, ends every other session at once.</p></div>
        <div class="actions"><button class="btn" data-action="logout">${ic("logout")}Sign out</button><button class="btn danger" data-action="logout-all">Sign out everywhere</button></div></div></section>
    <section class="panel" aria-labelledby="api-h"><div class="panel-head"><h2 class="h2" id="api-h">Machine credentials</h2></div>
      ${table({ id: "api", caption: "Admin API credentials", rows: [["WHMCS · portal.shrotihost.in", "ADMIN_API_KEY", "HMAC-SHA256 + nonce · ±300 s"]], cols: [
        { key: "c", label: "Caller", cls: "strong", render: (r) => esc(r[0]) }, { key: "k", label: "Credential", cls: "mono", render: (r) => esc(r[1]) },
        { key: "s", label: "Signing", cls: "mono", render: (r) => esc(r[2]) }] })}
      <div class="panel-foot">To rotate: set a new ADMIN_API_SECRET in Vercel, redeploy, then save it in WHMCS → Addons → ShrotiHost Licensing. WHMCS cannot reach the server in between.</div></section>`;

  /* ── Settings ── */
  const pfField = (id, label, type, value, auto, hint = "") => `<div class="fld"><label for="${id}">${esc(label)}</label><input id="${id}" name="${id}" type="${type}" value="${esc(value)}" autocomplete="${auto}"${type === "email" ? ' inputmode="email" autocapitalize="off" spellcheck="false"' : ""}${hint ? ` aria-describedby="${id}-hint"` : ""}>${hint ? `<span class="hint" id="${id}-hint">${esc(hint)}</span>` : ""}<span class="err" id="${id}-err" hidden></span></div>`;
  VIEWS.settings = () => {
    const seg = (name, cur, opts) => `<div class="seg" role="group" aria-label="${esc(name)}">${opts.map(([v, l]) => `<button type="button" data-set="${name}:${v}" aria-pressed="${cur === v}">${esc(l)}</button>`).join("")}</div>`;
    const me = ME || {};
    return `
      <div class="page-head"><div><span class="eyebrow accent">Configure</span><h1 class="h1" tabindex="-1">Settings</h1><p class="lede">Your profile is stored on the licensing server. Display preferences are stored in this browser only.</p></div></div>
      <section class="panel" id="profile" aria-labelledby="prof-h"><div class="panel-head"><div><span class="eyebrow">Account · ${esc(me.role || "")}</span><h2 class="h2" id="prof-h">Profile</h2></div>${me.must_change_password ? `<span class="chip warn">${ic("warn")}Initial password in use</span>` : status("ok", "Password set")}</div>
        <div class="panel-body prof-grid">
          <form class="prof-form" id="pf-account" novalidate aria-labelledby="pf-account-h">
            <h3 class="h3" id="pf-account-h">Name and email</h3>
            ${pfField("pf-name", "Name", "text", me.name || "", "name")}
            ${pfField("pf-email", "Email", "email", me.email || "", "email", "You sign in with this address.")}
            ${pfField("pf-cur1", "Current password", "password", "", "current-password", "Required to save any change.")}
            <p class="form-err" id="pf-account-msg" role="alert" hidden></p>
            <div class="actions"><button class="btn primary" type="submit">Save changes</button></div>
          </form>
          <form class="prof-form" id="pf-password" novalidate aria-labelledby="pf-password-h">
            <h3 class="h3" id="pf-password-h">Password</h3>
            ${pfField("pf-cur2", "Current password", "password", "", "current-password")}
            ${pfField("pf-new", "New password", "password", "", "new-password", "At least 10 characters. Not a common word or your email.")}
            ${pfField("pf-new2", "Repeat new password", "password", "", "new-password")}
            <p class="form-err" id="pf-password-msg" role="alert" hidden></p>
            <div class="actions"><button class="btn primary" type="submit">Change password</button></div>
          </form>
        </div>
        <div class="setting"><div><b>Sessions</b><p>Saving either form signs out every other browser; this one stays signed in.</p></div><div class="actions"><button class="btn" data-action="logout">${ic("logout")}Sign out</button><button class="btn danger" data-action="logout-all">Sign out everywhere</button></div></div>
      </section>
      <section class="panel" aria-labelledby="pref-h"><div class="panel-head"><h2 class="h2" id="pref-h">Display</h2></div>
        <div class="setting"><div><b>Theme</b><p>System follows your operating system. Shortcut: <span class="kbd">⌘/Ctrl ⇧ L</span></p></div>${seg("theme", state.theme, [["dark", "Dark"], ["light", "Light"], ["system", "System"]])}</div>
        <div class="setting"><div><b>Motion</b><p>Reduced turns off the orbit, radar sweep, scans and transitions. Status colours and text stay.</p></div>${seg("motion", state.motion, [["system", "System"], ["reduce", "Reduced"], ["full", "Full"]])}</div>
        <div class="setting"><div><b>Times</b><p>Indian Standard Time by default. Switch to UTC to match the server's own logs.</p></div>${seg("time", state.time, [["ist", "IST"], ["utc", "UTC"]])}</div>
      </section>
      <section class="panel" aria-labelledby="infra-h"><div class="panel-head"><h2 class="h2" id="infra-h">Infrastructure</h2></div><div class="panel-body"><dl class="kv">
        <dt>Server</dt><dd class="mono">licensing.shrotihost.in</dd><dt>Region</dt><dd class="mono">${esc(REGION)}</dd><dt>Signer</dt><dd class="mono">${esc(SIGNER)}</dd><dt>Database</dt><dd>Neon Postgres · free plan</dd>
        <dt>Hosting plan</dt><dd>${status("warn", "Vercel Hobby — non-commercial terms; upgrade to Pro")}</dd><dt>Source</dt><dd class="mono" style="overflow-wrap:anywhere">github.com/priyanshu-shroti01/shrotihost-licensing</dd></dl></div></section>
      <section class="panel" aria-labelledby="kb-h"><div class="panel-head"><h2 class="h2" id="kb-h">Keyboard shortcuts</h2></div>${shortcutsGrid()}</section>`;
  };
  const SHORTCUTS = [["⌘/Ctrl K", "Search everything"], ["?", "Keyboard shortcuts"], ["G O", "Overview"], ["G I", "Installations"], ["G S", "Security"], ["G L", "Licences"], ["G P", "Products & Plans"], ["G R", "Releases"], ["G K", "Signing keys"], ["G A", "Access"], ["G ,", "Settings"], ["⌘/Ctrl ⇧ L", "Toggle theme"], ["Esc", "Close panel or dialog"]];
  const shortcutsGrid = () => `<div class="kb-grid">${SHORTCUTS.map(([k, d]) => `<div><span>${esc(d)}</span><span class="kbd">${esc(k)}</span></div>`).join("")}</div>`;

  function notFound(what) {
    return `<div class="page-head"><div><h1 class="h1" tabindex="-1">Not found</h1></div></div><section class="panel">${emptyState(`No such ${what}`, "It may have been removed, or the link is wrong.", `<a class="btn" href="#/overview">Go to overview</a>`)}</section>`;
  }

  /* ═══════════════════════════════ token inspector ═══════════════════════════════ */
  const b64u = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const SIG = "Mq3v9yQ0Zp1n7sKcR2dWvT8xLbE4uHjF6gN0aYiC5oP3mDkS1rV9tZwX2eQ7lB8cA4fU6hJ0yG3iO5nM1pKqRw";
  const pretty = (o) => esc(JSON.stringify(o, null, 2)).replace(/&quot;([^&]+)&quot;:/g, '<span class="jk">"$1"</span>:').replace(/: &quot;(.*?)&quot;/g, ': <span class="jv">"$1"</span>').replace(/: (\d+|true|false)/g, ': <span class="jn">$1</span>');
  const STEPS = () => [["Split into header · payload · signature", "3 parts"], ["Key ID is bundled in this module", SIGNER], ["Ed25519 signature over header.payload", "64 bytes"], ["Issuer and product match", "iss · aud"], ["Bound to this install", "instance_id"], ["Inside validity window", "exp · grace"]];
  function inspectorHtml(l, i) {
    return `<div style="display:grid;gap:10px" data-inspector="${l.id}" data-inst="${i ? i.id : ""}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span class="eyebrow">Verification walkthrough${i ? " · " + esc(i.domain) : ""}</span><label class="switch"><input type="checkbox" data-action="tamper"> Tamper one byte</label></div>
      <div class="jws" data-jws></div><div class="json" data-claims tabindex="0" aria-label="Decoded token"></div>
      <p class="muted" style="font-size:12px;margin:0">Walkthrough: the claims are rebuilt from this licence's live record and the signature bytes are a placeholder. Installs verify their real token offline with the bundled public key.</p>
      <ol class="steps" data-steps>${STEPS().map((s) => `<li><span class="st"></span><span>${s[0]}</span><code>${s[1]}</code></li>`).join("")}</ol>
      <div data-verdict aria-live="polite"></div>
      <div><button class="btn" data-action="verify">${ic("sig")}Verify as a module would</button></div></div>`;
  }
  function inspectorInit(root) {
    const l = LICENCES.find((x) => x.id === Number(root.dataset.inspector));
    const i = INSTALLS.find((x) => x.id === root.dataset.inst);
    const iat = Math.floor((i ? i.hb : SNAP) / 1000), P = productOf(l.p);
    const header = { alg: "EdDSA", kid: SIGNER, typ: "shl-entitlement+jwt" };
    const claims = { iss: "licensing.shrotihost.in", aud: P.slug, sub: "lic_" + l.id, iat, nbf: iat - 60, exp: iat + P.ttlH * 3600, grace_until: iat + (P.ttlH + P.graceH) * 3600, jti: "(unique per token)", status: l.status === "active" ? "active" : l.status, plan: "recurring", bind: { domain: i ? i.domain : "—", install_dir: i ? i.dir : "—", instance_id: i ? i.inst : "—" }, support_valid: l.status === "active", updates_valid: l.status === "active", license_hint: l.hint };
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
      $("[data-verdict]", root).innerHTML = `<div class="verdict ok">${ic("ok")}Walkthrough passes — signed status: ${esc(claims.status)}. A real install does this offline, with no server call.</div>`;
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
  function dialog({ title, intro, impact = [], preflight = [], confirm = "Confirm", danger = false, body = "", ack = null, noCancel = false }) {
    lastFocus = document.activeElement;
    const d = $("#dialog");
    d.className = "dialog" + (danger ? " danger-edge" : "");
    d.innerHTML = `<div class="dialog-body"><h2 id="dialog-title">${esc(title)}</h2>${intro ? `<p class="secondary" style="font-size:13px">${intro}</p>` : ""}
      ${impact.length ? `<div><span class="eyebrow">This operation affects</span><ul class="impact" style="margin-top:6px">${impact.map((x) => `<li>${x}</li>`).join("")}</ul></div>` : ""}
      ${preflight.length ? `<div><span class="eyebrow">Preflight</span><ul class="preflight" style="margin-top:6px">${preflight.map(([ok, t]) => `<li>${status(ok ? "ok" : "warn", "")}${esc(t)}</li>`).join("")}</ul></div>` : ""}
      ${body}${ack ? `<label class="switch"><input type="checkbox" id="dlg-ack"> ${esc(ack)}</label>` : ""}</div>
      <div class="dialog-foot">${noCancel ? "" : `<button class="btn" data-dlg="cancel">Cancel</button>`}<button class="btn ${danger ? "danger" : "primary"}" data-dlg="ok"${ack ? " disabled" : ""}>${esc(confirm)}</button></div>`;
    d.hidden = false; $("#dialog-scrim").hidden = false;
    if (ack) $("#dlg-ack").addEventListener("change", (e) => { $("[data-dlg=ok]", d).disabled = !e.target.checked; });
    ($("input, select", d) || $("[data-dlg=cancel]", d) || $("[data-dlg=ok]", d)).focus();
    return new Promise((res) => { dialogResolve = res; });
  }
  async function closeDialog(ok) {
    const d = $("#dialog"); if (d.hidden) return;
    const btn = $("[data-dlg=ok]", d);
    if (ok) {
      const vals = Object.fromEntries($$("input, select", d).map((el) => [el.id, el.type === "checkbox" ? el.checked : el.value]));
      btn.disabled = true;
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

  /* ═══════════════════════════════ actions ═══════════════════════════════ */
  const WHMCS_NOTE = "WHMCS stays the authority: its next sync (daily reconcile, or any change to the service) re-applies the service's own status.";
  async function serverAction(action, id, okText, kind = "ok") {
    try {
      const r = await api("POST", "/api/console/actions", { action, id: Number(id) });
      toast(kind, okText);
      await refresh();
      return r.result;
    } catch (e) {
      if (e.status === 401) { signedOut(e.message); return null; }
      toast("bad", esc(e.message));
      return null;
    }
  }
  const licById = (id) => LICENCES.find((x) => x.id === Number(id));
  const ACTIONS = {
    async suspend(el) {
      const l = licById(el.dataset.id); if (!l) return; const inst = INSTALLS.filter((i) => i.lic === l.id);
      const r = await dialog({ title: "Suspend licence?", danger: true, confirm: "Suspend licence",
        intro: `<b class="mono">${esc(l.hint)}</b> · ${esc(productOf(l.p).name)} · ${esc(l.client)}`,
        impact: [`<b>${inst.length}</b> installation${inst.length === 1 ? "" : "s"} will receive a signed <b>suspended</b> status on their next heartbeat (within a day)`, ...inst.map((i) => `<span class="mono">${esc(i.domain)}</span>`), `WHMCS service #${l.svc} is not changed. ${WHMCS_NOTE}`] });
      if (r) await serverAction("suspend", l.id, `Licence #${l.id} suspended`, "warn");
    },
    async unsuspend(el) {
      const l = licById(el.dataset.id); if (!l) return;
      const r = await dialog({ title: "Unsuspend licence?", confirm: "Unsuspend", intro: `Licence #${l.id} · WHMCS service #${l.svc}. Unsuspending here does not collect payment.`, impact: ["Installs receive an active entitlement on their next heartbeat", WHMCS_NOTE] });
      if (r) await serverAction("unsuspend", l.id, `Licence #${l.id} is active again`);
    },
    async reissue(el) {
      const l = licById(el.dataset.id); if (!l) return; const inst = INSTALLS.filter((i) => i.lic === l.id);
      const r = await dialog({ title: "Reissue licence?", danger: true, confirm: "Reissue licence", intro: "Releases every installation so the key can be activated somewhere new. The key itself does not change.",
        impact: [`<b>${inst.length}</b> installation${inst.length === 1 ? "" : "s"} must activate again: ${inst.map((i) => `<span class="mono">${esc(i.domain)}</span>`).join(", ") || "none"}`, "Does not count against the customer's reissue allowance in WHMCS"] });
      if (r) await serverAction("reissue", l.id, `Licence #${l.id} reissued — installs will re-activate`);
    },
    async "revoke-activation"(el) {
      const i = INSTALLS.find((x) => x.id === el.dataset.id); if (!i) return;
      const r = await dialog({ title: "Remove installation from licence?", danger: true, confirm: "Remove installation", impact: [`<span class="mono">${esc(i.domain)}</span> · ${esc(productOf(i.p).name)} stops working until it activates again`, `Frees 1 seat on licence #${i.lic}`] });
      if (r && await serverAction("revoke-activation", i.aid, `${esc(i.domain)} removed from licence #${i.lic}`, "warn") && location.hash.startsWith("#/installations/")) nav("#/installations");
    },
    async "withdraw-release"(el) {
      const rel = ALL_RELEASES.find((x) => x.id === Number(el.dataset.id)); if (!rel) return; const P = productOf(rel.p);
      const r = await dialog({ title: "Withdraw release?", danger: true, confirm: "Withdraw release", intro: `${esc(P.name)} ${esc(rel.version)}`, impact: ["Installs already on this version keep running", "It is no longer offered as an update or download", "You can publish it again later — the signed package is kept"] });
      if (r) await serverAction("withdraw-release", rel.id, `${esc(P.name)} ${esc(rel.version)} withdrawn`, "warn");
    },
    async "publish-release"(el) {
      const rel = ALL_RELEASES.find((x) => x.id === Number(el.dataset.id)); if (!rel) return; const P = productOf(rel.p);
      const r = await dialog({ title: "Publish release again?", confirm: "Publish", intro: `${esc(P.name)} ${esc(rel.version)} · sha256 ${esc(rel.sha)}…`, impact: ["Installs on older versions are offered this update on their next daily check"] });
      if (r) await serverAction("publish-release", rel.id, `${esc(P.name)} ${esc(rel.version)} published`);
    },
    async download(el) {
      const res = await serverAction("download", el.dataset.id, "One-time download link issued");
      if (!res?.url) return;
      dialog({ title: "Download link ready", confirm: "Done", noCancel: true,
        intro: `${esc(productOf(licById(el.dataset.id)?.p).name)} ${esc(res.release?.version || "")} · works once · expires ${fmtTime(Date.parse(res.expires_at))}`,
        body: `<div class="actions"><a class="btn primary" href="${esc(res.url)}" rel="noopener">${ic("release")}Download package</a><button class="btn" type="button" data-action="copy" data-copy="${esc(res.url)}" data-what="Link">${ic("copy")}Copy link</button></div>` });
    },
    copy(el) { const what = el.dataset.what || "Public key"; navigator.clipboard?.writeText(el.dataset.copy).then(() => toast("ok", `${what} copied`), () => toast("bad", "Copy failed — select the text and copy it manually")); },
    async refresh(el) {
      if (el && el.tagName === "BUTTON") { el.disabled = true; }
      await refresh({ announce: true });
      if (el && el.isConnected) el.disabled = false;
    },
    async logout() { closeMenu(); await api("POST", "/api/console/logout", {}).catch(() => null); signedOut("Signed out."); },
    async "logout-all"() {
      const r = await dialog({ title: "Sign out everywhere?", danger: true, confirm: "Sign out everywhere", impact: ["Every browser signed in as this operator is signed out, including this one"] });
      if (!r) return;
      try { await api("POST", "/api/console/logout", { everywhere: true }); } catch (e) { /* the cookie is cleared below either way */ }
      signedOut("Signed out of every session.");
    },
    "clear-inst"() { Object.assign(state.inst, { q: "", p: "", ver: "", php: "", whmcs: "", status: "" }); render(); },
    "clear-lic"() { Object.assign(state.lic, { q: "", status: "", p: "" }); render(); },
    "sec-select"(el) { state.secSel = el.dataset.id; render(); $("#ev-" + el.dataset.id)?.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" }); },
    shortcuts() { closeMenu(); dialog({ title: "Keyboard shortcuts", confirm: "Done", noCancel: true, body: shortcutsGrid() }); },
    verify(el) { el.closest("[data-inspector]")._run(); },
    tamper(el) { const r = el.closest("[data-inspector]"); r._paint(); r._run(); },
    "verify-sample"(el) { licenceDrawer(Number(el.dataset.id)); },
  };

  /* ═══════════════════════════════ command palette ═══════════════════════════════ */
  const INDEX = () => withIds([
    ...LICENCES.map((l) => ({ g: "Licences", t: l.hint, s: `#${l.id} · ${productOf(l.p).name} · ${l.client} · WHMCS #${l.svc} · ${l.status}`, k: `#${l.id}`, go: () => (window.innerWidth > 719 ? licenceDrawer(l.id) : nav(`#/licences/${l.id}`)), terms: [l.hint, "#" + l.id, String(l.svc), l.client, productOf(l.p).name] })),
    ...INSTALLS.map((i) => ({ g: "Installations", t: i.domain, s: `${productOf(i.p).name} ${i.ver} · ${i.ip} · ${i.inst}`, k: productOf(i.p).short, go: () => nav(`#/installations/${i.id}`), terms: [i.domain, i.ip, i.inst, i.ver, i.dir] })),
    ...Object.values(PRODUCTS).map((p) => ({ g: "Products", t: p.name, s: `${p.slug} · version ${p.version}`, k: p.short, go: () => nav("#/products"), terms: [p.slug, p.prefix, p.version] })),
    ...KEYS.map((k) => ({ g: "Keys", t: k.kid, s: k.fp, k: k.role, go: () => nav("#/keys"), terms: [k.fp, k.pub] })),
    { g: "Actions", t: "Refresh data", s: "Reload everything from the licensing server", k: "", go: () => ACTIONS.refresh(), terms: ["reload", "refresh", "sync"] },
    { g: "Actions", t: "Change password", s: "Profile · email, name and password", k: "", go: () => nav("#/settings?profile=1"), terms: ["password", "email", "profile", "account"] },
    { g: "Actions", t: "Toggle theme", s: "Dark ↔ Light", k: "⌘⇧L", go: () => toggleTheme(), terms: ["dark", "light", "theme"] },
    { g: "Actions", t: "Keyboard shortcuts", s: "", k: "?", go: () => ACTIONS.shortcuts(), terms: ["help", "keys"] },
    { g: "Actions", t: "Sign out", s: ME ? ME.email : "", k: "", go: () => ACTIONS.logout(), terms: ["logout", "sign out"] },
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
  function render(opts = {}) {
    const r = parse();
    if (!ME) { showLogin(); return; }
    if (r.view === "login") { location.replace(ME.must_change_password ? "#/settings?profile=1" : "#/overview"); return; }
    $("#login").hidden = true; $("#shell").hidden = false;
    const view = VIEWS[r.view] ? r.view : "overview";
    if (r.q.get("event")) state.secSel = r.q.get("event");
    const main = $("#main"), y = window.scrollY;
    const banners = [];
    if (ME.must_change_password && view !== "settings") banners.push(`<div class="banner" role="note"><span class="tag">Action needed</span><span>You are signed in with the initial password. <a href="#/settings?profile=1">Change it now</a>.</span></div>`);
    if (state.lab === "stale") banners.push(`<div class="banner" role="status"><span class="tag">Stale</span><span>The last refresh failed (${esc(lastError?.message || "no answer")}). Showing data from ${hhmm(SNAP)}. <button class="linkbtn" data-action="refresh">Retry now</button></span></div>`);
    main.innerHTML = banners.join("") + VIEWS[view](r.id, r.tab);
    main.dataset.view = view;
    $$(".nav").forEach((a) => a.dataset.route === view ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    $("#crumb").textContent = TITLES[view] + (r.id ? " / " + r.id : "");
    document.title = `${TITLES[view]} · ShrotiHost Licensing`;
    const ss = systemStatus();
    $("#sysstat").innerHTML = `${status(ss.lv, "")}<span class="lbl">${esc(state.lab === "loading" ? "Loading" : state.lab === "stale" ? "Stale" : ss.text)}</span><small>${loaded ? `as of ${hhmm(SNAP)}` : "connecting"}</small>`;
    $("#sysstat").setAttribute("aria-label", loaded ? `System ${ss.text}, as of ${fmtTime(SNAP)}${state.lab === "stale" ? " (stale)" : ""}` : "Loading system status");
    $("#snap-label").textContent = loaded ? hhmm(SNAP) : "—";
    $("#signer-label").textContent = SIGNER; $("#region-label").textContent = REGION;
    const who = ME.name || ME.email;
    $("#user-name").textContent = who;
    $("#user-initials").textContent = (ME.name ? ME.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("") : ME.email[0]).toUpperCase();
    $("#menu-who").textContent = `${ME.email} · ${ME.role}`;
    $$("[data-inspector]", main).forEach(inspectorInit);
    if (opts.soft) { window.scrollTo(0, y); return; }
    closeRail();
    if (view === "settings" && r.q.get("profile")) {
      $("#profile")?.scrollIntoView({ block: "start" });
      $(ME.must_change_password ? "#pf-cur2" : "#pf-name")?.focus({ preventScroll: true });
      return;
    }
    if (view === "security" && state.secSel) $("#ev-" + state.secSel)?.scrollIntoView({ block: "center" });
    if (r.q.get("focus") === "health") $("#health")?.scrollIntoView({ block: "start" });
    else if (!r.q.get("event")) window.scrollTo(0, 0);
    const h1 = $("h1", main); if (h1 && renderCount++ > 0) h1.focus({ preventScroll: true });
  }
  let renderCount = 0;

  /* Partial re-render of filtered tables so the search box keeps focus. */
  function refreshTable(which) {
    if (which === "inst") $("#inst-table").innerHTML = instTable(data().installs);
    if (which === "lic") $("#lic-table").innerHTML = licTable(data().licences);
  }

  /* ═══════════════════════════════ live refresh ═══════════════════════════════ */
  let refreshing = null, lastLoad = 0;
  /* A background refresh never yanks the page out from under the operator. */
  const busy = () => !$("#dialog").hidden || !$("#drawer").hidden || !$("#palette").hidden || $("#rail").classList.contains("open")
    || !!document.activeElement?.closest?.("#main input, #main select, #main textarea");
  function softRender() { if (ME && !busy()) render({ soft: true }); }
  function refresh({ announce = false } = {}) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        load(await api("GET", "/api/console/snapshot"));
        lastError = null; state.lab = "normal"; lastLoad = Date.now();
        if (announce) toast("ok", `Refreshed · as of ${hhmm(SNAP)}`);
      } catch (e) {
        if (e.status === 401) { signedOut(e.message); return; }
        lastError = e; state.lab = loaded ? "stale" : "error";
        if (announce || !loaded) toast("bad", esc(e.message));
      }
      softRender();
    })().finally(() => { refreshing = null; });
    return refreshing;
  }

  /* ═══════════════════════════════ sign-in & session ═══════════════════════════════ */
  function showLogin(msg = "", tone = "bad") {
    $("#shell").hidden = true; $("#login").hidden = false; document.title = "Sign in · ShrotiHost Licensing";
    $("#boot").hidden = true;
    const btn = $("#lg-submit"); btn.disabled = false; btn.innerHTML = `${ic("lock")}Sign in`;
    const er = $("#lg-err"); er.hidden = !msg; er.textContent = msg; er.className = "form-err" + (tone === "note" ? " note" : "");
    er.setAttribute("role", tone === "note" ? "status" : "alert");
    loginStatus();
    $("#lg-email").focus();
  }
  function signedOut(msg) {
    ME = null; loaded = false; lastError = null; state.lab = "loading";
    PRODUCTS = {}; LICENCES = []; INSTALLS = []; RELEASES = []; ALL_RELEASES = []; KEYS = []; EVENTS = []; SECURITY = []; HEALTH_ROWS = []; ATTENTION = []; OPERATORS = [];
    closeDrawer(); closeDialog(false); closePalette(); closeRail(); closeMenu();
    $("#main").innerHTML = "";
    history.replaceState(null, "", "#/login");
    showLogin(msg, /^Signed out/.test(msg || "") ? "note" : "bad");
  }
  async function loginStatus() {
    const el = $("#lg-status");
    try { await api("GET", "/api/health"); el.className = "status s-ok"; el.innerHTML = `${ic("ok")}Operational`; }
    catch (e) { el.className = "status s-bad"; el.innerHTML = `${ic("bad")}${e.status ? "Degraded" : "Unreachable"}`; }
  }
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = [["lg-email", (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), "Enter your email address."], ["lg-pass", (v) => v.length > 0, "Enter your password."]];
    let bad = null;
    f.forEach(([id, ok, msg]) => { const el = $("#" + id), er = $("#" + id + "-err"); const good = ok(el.value); el.setAttribute("aria-invalid", String(!good)); er.hidden = good; er.textContent = good ? "" : msg; if (!good && !bad) bad = el; });
    if (bad) { bad.focus(); return; }
    const btn = $("#lg-submit"); btn.disabled = true; btn.innerHTML = `<span class="spin" aria-hidden="true"></span>Signing in…`;
    $("#lg-err").hidden = true;
    try {
      ME = (await api("POST", "/api/console/login", { email: $("#lg-email").value.trim(), password: $("#lg-pass").value })).operator;
    } catch (err) {
      showLogin(err.message);
      $("#lg-pass").value = ""; $("#lg-pass").focus();
      return;
    }
    $("#login-form").reset(); $$(".fld input").forEach((i) => i.removeAttribute("aria-invalid"));
    state.lab = "loading"; renderCount = 0;
    const target = ME.must_change_password ? "#/settings?profile=1" : (!location.hash || location.hash === "#/login" ? "#/overview" : location.hash);
    if (location.hash !== target) history.replaceState(null, "", target);
    render();
    toast("ok", `Signed in as ${esc(ME.email)}`);
    await refresh();
    if (ME?.must_change_password) render();
  });

  /* Profile: name and email, or password. Both need the current password. */
  document.addEventListener("submit", async (e) => {
    const form = e.target;
    if (form.id !== "pf-account" && form.id !== "pf-password") return;
    e.preventDefault();
    const msg = $(`#${form.id}-msg`); msg.hidden = true;
    const val = (id) => $("#" + id).value;
    const errs = [];
    const fieldErr = (id, text) => { const el = $("#" + id), er = $("#" + id + "-err"); el.setAttribute("aria-invalid", String(!!text)); er.hidden = !text; er.textContent = text || ""; if (text) errs.push(el); };
    let body;
    if (form.id === "pf-account") {
      const email = val("pf-email").trim();
      fieldErr("pf-name", val("pf-name").trim().length > 120 ? "Use 120 characters or fewer." : "");
      fieldErr("pf-email", /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? "" : "Enter a valid email address.");
      fieldErr("pf-cur1", val("pf-cur1") ? "" : "Enter your current password.");
      body = { current_password: val("pf-cur1"), email, name: val("pf-name").trim() };
    } else {
      const n = val("pf-new");
      fieldErr("pf-cur2", val("pf-cur2") ? "" : "Enter your current password.");
      fieldErr("pf-new", n.length >= 10 ? "" : "Use at least 10 characters.");
      fieldErr("pf-new2", n && n === val("pf-new2") ? "" : "The two passwords do not match.");
      body = { current_password: val("pf-cur2"), new_password: n };
    }
    if (errs.length) { errs[0].focus(); return; }
    const btn = $("button[type=submit]", form), label = btn.textContent;
    btn.disabled = true; btn.innerHTML = `<span class="spin" aria-hidden="true"></span>Saving…`;
    try {
      const r = await api("POST", "/api/console/profile", body);
      const emailChanged = r.operator.email !== ME.email;
      ME = r.operator;
      toast("ok", form.id === "pf-password" ? "Password changed. Every other session was signed out." : emailChanged ? `Email changed to ${esc(ME.email)} — use it next time you sign in.` : "Profile saved.");
      history.replaceState(null, "", "#/settings");
      render();
      $("#prof-h")?.focus?.();
      refresh();
    } catch (err) {
      if (err.status === 401) { signedOut(err.message); return; }
      btn.disabled = false; btn.textContent = label;
      const cur = form.id === "pf-account" ? "pf-cur1" : "pf-cur2";
      const map = { bad_password: cur, invalid_email: "pf-email", email_taken: "pf-email", weak_password: "pf-new", same_password: "pf-new" };
      if (map[err.code]) { fieldErr(map[err.code], err.message); $("#" + map[err.code]).focus(); }
      else { msg.textContent = err.message; msg.hidden = false; }
    }
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
      if (k === "theme") applyTheme(v); else if (k === "motion") applyMotion(v); else if (k === "time") { state.time = v; store.set("timePref", v); }
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

  let gAt = 0;
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
    if (k === "g") gAt = now;
  });

  $("#search-btn").addEventListener("click", openPalette);
  $("#search-btn-sm").addEventListener("click", openPalette);
  $("#pal-q").addEventListener("input", () => { palSel = 0; palRender(); });
  window.addEventListener("hashchange", render);
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", () => applyMotion(state.motion));
  document.addEventListener("visibilitychange", () => {
    document.documentElement.classList.toggle("paused", document.hidden);
    if (!document.hidden && ME && Date.now() - lastLoad > REFRESH_MS) refresh();
  });
  setInterval(() => { if (ME && !document.hidden) refresh(); }, REFRESH_MS);

  /* ═══════════════════════════════ boot ═══════════════════════════════ */
  const qp = new URLSearchParams(location.search);
  applyTheme(qp.get("theme") || state.theme, !qp.get("theme"));
  applyMotion(qp.get("motion") || state.motion, !qp.get("motion"));
  (async () => {
    try { ME = (await api("GET", "/api/console/session")).operator; }
    catch (e) { showLogin(e.status === 401 ? "" : e.message); return; }
    if (ME.must_change_password && !/^#\/settings/.test(location.hash)) history.replaceState(null, "", "#/settings?profile=1");
    render();
    refresh();
  })();
})();
