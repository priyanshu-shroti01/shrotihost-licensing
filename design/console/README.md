# Licensing console — design prototype

The operator dashboard design for licensing.shrotihost.in, as a single static page
built from `shell.html` + `styles.css` + `app.js` (`python3 build.py` → `index.html`).
Data is a real snapshot of the server (19 Sep 2026 14:01 IST); actions show their
confirmations but change nothing. Published at https://shrotihost.in/licensing-console/.

QA: `npm i playwright-core` then `CHROME=<chromium> node qa.mjs` — every route in both
themes at 320–1920 px, all system states, keyboard/dialog/palette interactions, and
text-contrast checks. It must report `PROBLEMS (0)`.
