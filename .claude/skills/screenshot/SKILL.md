---
name: screenshot
description: >-
  Capture a real headless-browser screenshot of this app to verify UI work
  visually (layout, arrows/overlays, responsive breakpoints) when you cannot
  otherwise see the rendered result. Use when asked to "screenshot", "look at",
  "see", "verify visually", "check how it looks", or to confirm a CSS / layout /
  ArrowOverlay / ReconLoopOverlay / DeepDive change renders correctly — and
  especially to reproduce a width-specific bug from a user's screenshot. Works
  around the web-session network sandbox that blocks the normal Chromium
  download. Trigger words: screenshot, screen shot, render, visual, look, see,
  how it looks, responsive, mobile width, overlay, arrows, layout regression.
---

# Screenshotting this app (web-session friendly)

You **can** screenshot in Claude Code web sessions, despite the network sandbox.
This skill captures the React app with a real headless Chromium and hands you a
PNG you can open with the `Read` tool.

## Why the obvious paths fail (don't waste time on them)

The environment's network policy allows the **npm registry** but returns **403**
for the browser-binary CDNs, so:

- `npx playwright install chromium` → **fails** (downloads from `cdn.playwright.dev`
  / `playwright.azureedge.net` / `storage.googleapis.com`, all 403/400).
- `puppeteer` (full) → **fails** for the same reason (post-install CDN download).
- `apt-get install chromium` → installs a **snap shim** that errors with
  "requires the chromium snap to be installed"; `chromium-browser` is unusable.

**What works:** [`@sparticuz/chromium`](https://www.npmjs.com/package/@sparticuz/chromium)
ships the Chromium binary *inside the npm package*, so the registry serves it and
no CDN is touched. Drive it with `puppeteer-core`.

(If a future session's network policy is more permissive and `npx playwright`
works, that's fine too — but the steps below work regardless.)

## Setup (once per session, ~5s)

Install into a scratch dir so the project's `package.json` / `node_modules` stay
untouched, and copy this skill's capture script next to the deps:

```bash
mkdir -p /tmp/shot && cd /tmp/shot
npm i @sparticuz/chromium puppeteer-core
cp "$OLDPWD/.claude/skills/screenshot/shot.cjs" /tmp/shot/   # run from repo root
```

(If `$OLDPWD` isn't the repo root, use the absolute path to
`.claude/skills/screenshot/shot.cjs`.)

## Capture

1. Start the dev server (background) and wait for it:

   ```bash
   (npm run dev >/tmp/dev.log 2>&1 &) ; sleep 4
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/   # expect 200
   ```

2. Run the script (see `shot.cjs` header for all flags). It navigates a no-router
   SPA by **clicking elements by text**, then captures the viewport or one element:

   ```bash
   cd /tmp/shot && node shot.cjs --width 600 \
     --click '.tab-btn@@deep' --click '.event-card@@systemd' \
     --clip '.deep-dive-canvas' --out /tmp/shot/out.png
   ```

3. View it: `Read` the PNG path (e.g. `/tmp/shot/out.png`). To show the user, use
   `SendUserFile`.

4. Kill the server when done: `pkill -f vite`.

### `--click 'SELECTOR@@REGEX'`
Clicks the first element matching `SELECTOR` whose text matches `REGEX`
(case-insensitive). Repeatable; clicked in order. Drop `@@REGEX` to click the
first match. The app has **no URL routing**, so this is how you reach any view.

## App navigation cheatsheet

| Goal | clicks |
|---|---|
| Overview tab | `--click '.tab-btn@@overview'` |
| Packet Flow tab | `--click '.tab-btn@@packet'` |
| Deep Dive tab (index) | `--click '.tab-btn@@deep'` |
| Open a deep dive | `… --click '.event-card@@systemd'` (or `@@linux`, `@@hcp`) |
| Switch topic / flow / event | the new pickers are `ObjectSelect`: `--click '.obj-select-trigger@@…'` then `--click '.obj-select-option@@…'` |
| Pick an Overview event (gallery) | `--click '.tab-btn@@packet' --click '.event-card@@<name>'` |

Useful `--clip` targets: `.deep-dive-canvas`, `.overview-canvas`,
`.deep-dive` (whole tab), or omit `--clip` for the full viewport.

## Verifying responsive / width-specific bugs

Layout changes at the **640px** CSS breakpoint, and zones reflow (e.g. the
systemd cgroup vs. Kernel-Reality boxes go side-by-side → stacked). When a user's
screenshot shows an overlap/clipping bug, **reproduce it by width** before
changing anything — capture at several widths and compare:

```bash
for w in 420 600 1280; do
  node shot.cjs --width $w --click '.tab-btn@@deep' --click '.event-card@@systemd' \
    --clip '.deep-dive-canvas' --out /tmp/shot/recon-$w.png
done
```

Then iterate: edit → re-capture → `Read` → compare, at both a narrow and a wide
width, since a fix for one can regress the other (this is how the
ReconLoopOverlay step-3/5 chip placement was tuned).

## Gotchas

- `@sparticuz/chromium` is imported as `.default` (`require('@sparticuz/chromium').default`);
  `.args` must be spread into `puppeteer.launch({ args: [...chromium.args, '--no-sandbox'] })`.
- Use `deviceScaleFactor: 2` (the `--scale` default) — 1x text is hard to read.
- Give overlays a beat to measure DOM rects after a click (`--wait`, default 900ms);
  ArrowOverlay / ReconLoopOverlay position via `getBoundingClientRect` on rAF.
- A `net::ERR_CERT_AUTHORITY_INVALID` console line for the Vite client is harmless.
