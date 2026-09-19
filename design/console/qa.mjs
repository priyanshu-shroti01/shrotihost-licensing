// Automated QA for the licensing console: every route × theme × width, then interactions.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const PAGE = "file://" + new globalThis.URL("./index.html", import.meta.url).pathname;
const SHOTS = new globalThis.URL("./shots/", import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ["--no-sandbox"] });
const problems = [];
const log = (m) => console.log(m);

const routes = ["overview", "installations", "installations/i1", "security", "licences", "licences/3", "licences/3/entitlements", "licences/5/activations", "products", "releases", "keys", "access", "settings", "login"];
const widths = [320, 375, 768, 1024, 1440, 1920];

async function page(width, theme, extra = "") {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => problems.push(`pageerror ${width} ${theme}: ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error" && !/fonts\.g/.test(m.text())) problems.push(`console ${width} ${theme}: ${m.text()}`); });
  await p.goto(`${PAGE}?theme=${theme}${extra}#/overview`);
  return { ctx, p };
}

/* 1. Layout sweep */
for (const theme of ["dark", "light"]) {
  for (const w of widths) {
    const { ctx, p } = await page(w, theme);
    for (const r of routes) {
      await p.evaluate((h) => (location.hash = "#/" + h), r);
      await p.waitForTimeout(80);
      const o = await p.evaluate(() => {
        const sw = document.scrollingElement.scrollWidth, iw = window.innerWidth;
        const offenders = sw > iw ? [...document.querySelectorAll("body *")].filter((el) => { const b = el.getBoundingClientRect(); return b.right > iw + 1 && b.width > 0 && !el.closest(".table-wrap, .stream, .json, .jws, .tabs, .pal-list, .rail"); }).slice(0, 3).map((el) => el.className || el.tagName) : [];
        return { sw, iw, offenders, h1: !!document.querySelector("main h1, #login h1") };
      });
      if (o.sw > o.iw + 1) problems.push(`overflow ${theme} ${w}px #/${r}: scrollWidth ${o.sw} > ${o.iw} · ${o.offenders.join(" | ")}`);
      if (!o.h1) problems.push(`no h1 on #/${r} @${w}`);
      if ((w === 1440 || w === 375) && ["overview", "installations", "security", "licences/3/entitlements", "keys", "login", "releases"].includes(r)) {
        await p.screenshot({ path: `${SHOTS}${theme}-${w}-${r.replace(/\//g, "_")}.png`, fullPage: r === "overview" });
      }
    }
    await ctx.close();
  }
}
log("layout sweep done");

/* 2. States */
for (const lab of ["loading", "empty", "degraded", "offline", "error", "maintenance", "denied"]) {
  const { ctx, p } = await page(1440, "dark", `&lab=${lab}`);
  for (const r of ["overview", "installations", "licences", "security", "releases"]) { await p.evaluate((h) => (location.hash = "#/" + h), r); await p.waitForTimeout(60); }
  await p.evaluate(() => (location.hash = "#/overview"));
  await p.waitForTimeout(60);
  if (["degraded", "offline", "empty"].includes(lab)) await p.screenshot({ path: `${SHOTS}state-${lab}.png` });
  const stat = await p.textContent("#sysstat");
  log(`state ${lab}: header "${stat.replace(/\s+/g, " ").trim()}"`);
  await ctx.close();
}

/* 3. Interactions */
{
  const { ctx, p } = await page(1440, "dark");
  const check = (c, m) => { if (!c) problems.push("interaction: " + m); else log("  ✓ " + m); };
  // palette
  await p.keyboard.press("Control+k");
  check(await p.isVisible("#palette"), "Ctrl+K opens the palette");
  check((await p.textContent("#pal-list")).includes("Go to"), "empty query shows actions and navigation");
  await p.keyboard.type("codemarket");
  const n = await p.locator(".pal-item").count();
  check(n >= 3, `search 'codemarket' finds installations (${n})`);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(80);
  check((await p.evaluate(() => location.hash)).startsWith("#/installations/"), "Enter opens the installation");
  await p.keyboard.press("Control+k"); await p.keyboard.type("141.95");
  check((await p.locator(".pal-item").count()) >= 1, "search by IP works");
  await p.keyboard.press("Escape");
  check(await p.isHidden("#palette"), "Esc closes the palette");
  await p.keyboard.press("Control+k");
  check((await p.textContent("#pal-list")).includes("Recent"), "recent searches listed");
  await p.keyboard.press("Escape");
  // g-shortcuts
  await p.click("body", { position: { x: 5, y: 890 } }).catch(() => {});
  await p.keyboard.press("g"); await p.keyboard.press("s"); await p.waitForTimeout(60);
  check((await p.evaluate(() => location.hash)) === "#/security", "G S goes to Security");
  await p.keyboard.press("g"); await p.keyboard.press("l"); await p.waitForTimeout(60);
  check((await p.evaluate(() => location.hash)) === "#/licences", "G L goes to Licences");
  // radar blip selects event
  await p.evaluate(() => (location.hash = "#/security")); await p.waitForTimeout(60);
  await p.click(".blip >> nth=2");
  check(await p.isVisible("#ev-s3.sel"), "radar blip selects its event");
  // licences: search, sort, drawer, focus trap
  await p.evaluate(() => (location.hash = "#/licences")); await p.waitForTimeout(60);
  await p.fill("#lic-q", "SGF");
  check((await p.textContent("#lic-count")).startsWith("7 of 18"), `licence search 'SGF' → ${await p.textContent("#lic-count")}`);
  check((await p.evaluate(() => document.activeElement.id)) === "lic-q", "search keeps focus while filtering");
  await p.fill("#lic-q", "");
  await p.click('[data-sort="lic:status"]');
  check((await p.getAttribute('th:has([data-sort="lic:status"])', "aria-sort")) === "ascending", "sort sets aria-sort");
  await p.click('tr[data-href="#/licences/3"]');
  check(await p.isVisible("#drawer"), "row opens the quick-view drawer");
  for (let k = 0; k < 25; k++) await p.keyboard.press("Tab");
  check(await p.evaluate(() => document.getElementById("drawer").contains(document.activeElement)), "focus stays trapped in the drawer");
  await p.keyboard.press("Escape");
  check(await p.isHidden("#drawer"), "Esc closes the drawer");
  check(await p.evaluate(() => !!document.activeElement.closest('tr[data-href="#/licences/3"]')), "focus returns to the row");
  // destructive dialog with impact
  await p.evaluate(() => (location.hash = "#/licences/3")); await p.waitForTimeout(80);
  await p.click('button[data-action="suspend"]');
  check((await p.textContent("#dialog")).includes("1 installation"), "suspend dialog previews impact");
  await p.click('[data-dlg="ok"]'); await p.waitForTimeout(800);
  check((await p.textContent("#toasts")).includes("suspended"), "confirm shows a success toast");
  // rotation requires acknowledgement
  await p.evaluate(() => (location.hash = "#/keys")); await p.waitForTimeout(60);
  await p.click('button[data-action="rotate"]');
  check(await p.isDisabled('[data-dlg="ok"]'), "rotation disabled until acknowledged");
  check((await p.textContent("#dialog")).includes("Rotation rehearsal not recorded"), "rotation preflight lists the open check");
  await p.check("#dlg-ack");
  check(await p.isEnabled('[data-dlg="ok"]'), "acknowledging enables rotation");
  await p.keyboard.press("Escape");
  // tamper test
  await p.evaluate(() => (location.hash = "#/licences/3/entitlements")); await p.waitForTimeout(60);
  await p.check("[data-action=tamper]"); await p.waitForTimeout(300);
  check((await p.textContent("[data-verdict]")).includes("Rejected"), "tampered token is rejected in the inspector");
  // theme
  await p.keyboard.press("Control+Shift+L"); await p.waitForTimeout(50);
  check((await p.getAttribute("html", "data-theme")) === "light", "Ctrl+Shift+L switches to light");
  await p.evaluate(() => (location.hash = "#/settings")); await p.waitForTimeout(60);
  await p.click('[data-set="theme:system"]');
  check((await p.getAttribute("html", "data-theme")) === null, "System mode removes the explicit theme");
  // shortcuts
  await p.evaluate(() => (location.hash = "#/overview")); await p.waitForTimeout(60);
  await p.keyboard.press("Shift+?");
  check((await p.textContent("#dialog")).includes("Keyboard shortcuts"), "? opens the shortcuts panel");
  await p.keyboard.press("Escape");
  // n l
  await p.keyboard.press("n"); await p.keyboard.press("l");
  check((await p.textContent("#dialog-title")) === "Issue licence", "N L opens New licence");
  await p.keyboard.press("Escape");
  // login validation
  await p.evaluate(() => (location.hash = "#/login")); await p.waitForTimeout(60);
  check((await p.inputValue("#lg-email")) === "" && (await p.inputValue("#lg-pass")) === "", "login fields start empty");
  await p.click("#lg-submit");
  check(await p.isVisible("#lg-email-err"), "empty submit shows field errors");
  await p.fill("#lg-email", "support@shrotihost.in"); await p.fill("#lg-pass", "correct horse battery"); await p.fill("#lg-otp", "123456");
  await p.click("#lg-submit"); await p.waitForTimeout(1200);
  check((await p.evaluate(() => location.hash)) === "#/overview", "valid sign-in enters the console");
  await ctx.close();
}

/* 4. Mobile interactions */
{
  const { ctx, p } = await page(375, "light");
  await p.click("#menu-btn");
  const railOpen = await p.evaluate(() => document.getElementById("rail").classList.contains("open"));
  if (!railOpen) problems.push("mobile: menu button does not open navigation"); else log("  ✓ mobile menu opens navigation");
  await p.click('.nav[data-route="licences"]'); await p.waitForTimeout(80);
  log(`  ✓ mobile nav → ${await p.evaluate(() => location.hash)}`);
  await p.click("#search-btn-sm");
  log(`  ✓ mobile search opens palette: ${await p.isVisible("#palette")}`);
  await p.keyboard.press("Escape");
  await p.click('tr[data-href="#/licences/3"]'); await p.waitForTimeout(80);
  log(`  ✓ mobile row → ${await p.evaluate(() => location.hash)} (full page on phones)`);
  await p.screenshot({ path: `${SHOTS}mobile-licence.png`, fullPage: false });
  await ctx.close();
}

/* 5. Contrast of text tokens against their surfaces */
{
  const { ctx, p } = await page(1440, "dark");
  for (const theme of ["dark", "light"]) {
    await p.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    const res = await p.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const hex = (n) => cs.getPropertyValue(n).trim();
      const lum = (h) => { const m = h.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
      const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((u, v) => v - u); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
      const out = {};
      for (const fg of ["--text", "--text-secondary", "--text-muted", "--accent", "--success", "--warning", "--danger", "--info", "--violet"])
        for (const bg of ["--bg", "--surface", "--surface-2"]) out[`${fg} on ${bg}`] = cr(hex(fg), hex(bg));
      out["--on-accent on --accent"] = cr(hex("--on-accent"), hex("--accent"));
      return out;
    });
    const low = Object.entries(res).filter(([, v]) => v < 4.5);
    log(`contrast ${theme}: min ${Math.min(...Object.values(res))} · below 4.5: ${low.map(([k, v]) => k + " " + v).join(", ") || "none"}`);
    low.forEach(([k, v]) => problems.push(`contrast ${theme} ${k} = ${v}`));
  }
  await ctx.close();
}

await browser.close();
console.log("\nPROBLEMS (" + problems.length + ")");
[...new Set(problems)].forEach((x) => console.log(" - " + x));
