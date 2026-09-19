import { chromium } from "../v3/node_modules/playwright-core/index.mjs";
const BASE = process.env.BASE || "http://localhost:8791";
const EXE = "/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const problems = [], ok = (c, m) => { console.log(`  ${c ? "✓" : "✗"} ${m}`); if (!c) problems.push(m); };
const ONLY = process.env.ONLY;
const DEVICES0 = [
  { name: "iphone-se", viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
  { name: "small-320", viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "pixel-7", viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6 },
  { name: "phone-landscape", viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "tablet", viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "desktop", viewport: { width: 1440, height: 900 } },
];
const DEVICES = DEVICES0.filter((d) => !ONLY || ONLY.split(",").includes(d.name));
const ROUTES = ["overview", "installations", "installations/a1", "security", "licences", "licences/3", "licences/3/activations", "licences/3/entitlements", "licences/3/audit", "licences/3/updates", "products", "releases", "keys", "access", "settings"];
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const overflow = (page) => page.evaluate(() => {
  const W = innerWidth, bad = [];
  if (document.scrollingElement.scrollWidth > W + 1) bad.push(`page scrollWidth ${document.scrollingElement.scrollWidth} > ${W}`);
  for (const el of document.querySelectorAll("#main *, .topbar *, #login *")) {
    if (el.closest(".table-wrap, .stream, .pipe, .raster, .json, .jws, .tabs, svg, .sr-only, [hidden]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width && r.right > W + 1 && getComputedStyle(el).position !== "fixed") { bad.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} right=${Math.round(r.right)}`); if (bad.length > 4) break; }
  }
  return bad;
});
for (const d of DEVICES) {
  console.log(`\n[${d.name} ${d.viewport.width}×${d.viewport.height}]`);
  // reset mock state per device
  const ctx = await browser.newContext({ viewport: d.viewport, isMobile: d.isMobile, hasTouch: d.hasTouch, deviceScaleFactor: d.deviceScaleFactor || 1, userAgent: d.ua, colorScheme: "dark" });
  await fetch(BASE + "/__reset");
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => m.type() === "error" && !/401|403|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  await page.goto(BASE + "/console", { waitUntil: "networkidle" });
  ok(await page.isVisible("#login-form"), "login shown when signed out");
  ok(!(await page.isVisible("#lg-otp")), "no authenticator field");
  let o = await overflow(page); ok(!o.length, "login: no overflow " + o.join(" | "));
  if (d.name === "iphone-se") await page.screenshot({ path: `shots/live-${d.name}-login.png` });
  await page.fill("#lg-email", "support@shrotihost.in"); await page.fill("#lg-pass", "wrong");
  await page.click("#lg-submit"); await page.waitForSelector("#lg-err:not([hidden])");
  ok((await page.textContent("#lg-err")).includes("incorrect"), "wrong password shows server error");
  const pw = d.pw || "password";
  await page.fill("#lg-email", "support@shrotihost.in"); await page.fill("#lg-pass", global.PW || pw);
  await page.click("#lg-submit");
  await page.waitForSelector("#shell:not([hidden]) .h1");
  await page.waitForFunction(() => !document.querySelector(".sk-block"));
  const h = await page.evaluate(() => location.hash);
  if (!global.PW) ok(h.startsWith("#/settings"), `must-change lands on profile (${h})`);
  for (const r of ROUTES) {
    await page.evaluate((r) => (location.hash = "#/" + r), r);
    await page.waitForTimeout(120);
    o = await overflow(page);
    ok(!o.length, `${r}: no overflow ${o.join(" | ")}`);
    if (["iphone-se", "desktop", "small-320"].includes(d.name) && ["overview", "installations", "security", "licences", "licences/3", "releases", "keys", "access", "settings"].includes(r))
      await page.screenshot({ path: `shots/live-${d.name}-${r.replace(/\//g, "_")}.png`, fullPage: true });
  }
  if (d.isMobile && d.viewport.width < 1024) {
    await page.evaluate(() => (location.hash = "#/overview")); await page.waitForTimeout(100);
    await page.tap("#menu-btn"); await page.waitForTimeout(250);
    ok(await page.evaluate(() => document.querySelector("#rail").classList.contains("open")), "menu opens");
    await page.tap('#rail .nav[data-route="licences"]'); await page.waitForTimeout(200);
    ok((await page.evaluate(() => location.hash)) === "#/licences", "menu nav works by tap");
    const tgt = await page.evaluate(() => [...document.querySelectorAll("#main button, #main a.btn, .topbar button")].filter((b) => b.offsetParent && b.getBoundingClientRect().width > 2 && !(b.closest("thead") && b.closest("thead").getBoundingClientRect().height <= 1)).map((b) => ({ r: b.getBoundingClientRect(), d: `${b.className}:${Math.round(b.getBoundingClientRect().height)}:${b.textContent.trim().slice(0, 14)}` })).filter((x) => x.r.height < 32).map((x) => x.d));
    ok(tgt.length === 0, `tap targets ≥ 32px high (${tgt.join(", ")})`);
    const fs = await page.evaluate(() => { location.hash = "#/settings"; return new Promise((r) => setTimeout(() => r([...document.querySelectorAll("#main input:not([type=checkbox])")].map((i) => parseFloat(getComputedStyle(i).fontSize)).filter((s) => s < 16).concat([location.hash, innerWidth, matchMedia("(pointer: coarse)").matches]).join(",")), 600)); });
    ok(/^#/.test(fs), `inputs are 16px on phones (${fs})`);
  }
  // actions
  await page.evaluate(() => (location.hash = "#/licences/3")); await page.waitForTimeout(150);
  await page.click('[data-action="suspend"]'); await page.waitForSelector("#dialog:not([hidden])");
  ok((await page.textContent("#dialog")).includes("WHMCS"), "suspend dialog explains WHMCS sync");
  o = await overflow(page); ok(!(await page.evaluate(() => { const r = document.querySelector("#dialog").getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; })), "dialog fits viewport");
  await page.click("[data-dlg=ok]"); await page.waitForSelector(".toast");
  ok((await page.textContent("#toasts")).includes("suspended"), "suspend calls server and toasts");
  await page.evaluate(() => (location.hash = "#/licences/3/updates")); await page.waitForTimeout(150);
  const dl = await page.$('[data-action="download"]:not([disabled])');
  if (dl) { await dl.click(); await page.waitForSelector("#dialog:not([hidden]) a.btn"); ok(true, "download link dialog"); await page.click("[data-dlg=ok]"); }
  ok(!errors.length, "no page errors " + errors.slice(0, 3).join(" | "));
  await ctx.close();
}
// profile flow + stale on desktop-sized phone
{
  console.log("\n[profile + session flow · 375]");
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/console", { waitUntil: "networkidle" });
  await page.fill("#lg-email", "support@shrotihost.in"); await page.fill("#lg-pass", "password"); await page.click("#lg-submit");
  await page.waitForSelector("#pf-password");
  ok(await page.evaluate(() => document.activeElement?.id === "pf-cur2"), "focus lands on current password");
  await page.evaluate(() => (location.hash = "#/overview")); await page.waitForTimeout(150);
  ok((await page.textContent("#main")).includes("initial password"), "must-change banner on other pages");
  await page.evaluate(() => (location.hash = "#/settings?profile=1")); await page.waitForTimeout(150);
  await page.fill("#pf-cur2", "password"); await page.fill("#pf-new", "short"); await page.fill("#pf-new2", "short");
  await page.click("#pf-password button[type=submit]");
  ok(!(await page.isHidden("#pf-new-err")), "short password rejected client-side");
  await page.fill("#pf-new", "Tr1cky-Horse-Battery"); await page.fill("#pf-new2", "Tr1cky-Horse-Batterx");
  await page.click("#pf-password button[type=submit]");
  ok((await page.textContent("#pf-new2-err")).includes("match"), "mismatch rejected");
  await page.fill("#pf-cur2", "nope"); await page.fill("#pf-new2", "Tr1cky-Horse-Battery");
  await page.click("#pf-password button[type=submit]"); await page.waitForSelector("#pf-cur2-err:not([hidden])");
  ok((await page.textContent("#pf-cur2-err")).includes("incorrect"), "wrong current password shown on the field");
  await page.fill("#pf-cur2", "password"); await page.click("#pf-password button[type=submit]");
  await page.waitForFunction(() => document.querySelector("#toasts")?.textContent.includes("Password changed"));
  ok(true, "password change succeeds");
  await page.waitForTimeout(300);
  ok(!(await page.textContent("#main")).includes("Initial password in use"), "must-change chip cleared");
  await page.fill("#pf-email", "ops@shrotihost.in"); await page.fill("#pf-cur1", "Tr1cky-Horse-Battery");
  await page.click("#pf-account button[type=submit]");
  await page.waitForFunction(() => document.querySelector("#toasts")?.textContent.includes("Email changed"));
  ok((await page.textContent("#menu-who")).includes("ops@shrotihost.in"), "email change reflected in menu");
  await page.screenshot({ path: "shots/live-iphone-se-profile-after.png", fullPage: true });
  await page.tap("#user-btn"); await page.tap('#user-menu [data-action="logout"]');
  await page.waitForSelector("#login-form:not([hidden]), #login:not([hidden])");
  ok((await page.textContent("#lg-err")).includes("Signed out"), "sign out returns to login with a note");
  await page.fill("#lg-email", "ops@shrotihost.in"); await page.fill("#lg-pass", "Tr1cky-Horse-Battery"); await page.click("#lg-submit");
  await page.waitForSelector("#shell:not([hidden])");
  ok((await page.evaluate(() => location.hash)).startsWith("#/overview"), "re-login with new email → overview");
  ok(!errors.length, "no page errors " + errors.join(" | "));
  await ctx.close();
}
await browser.close();
console.log(`\nPROBLEMS (${problems.length})\n` + problems.map((p) => " - " + p).join("\n"));
process.exit(problems.length ? 1 : 0);
