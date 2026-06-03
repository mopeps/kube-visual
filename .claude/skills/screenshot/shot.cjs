#!/usr/bin/env node
// Headless-screenshot helper for kube-weird-visualizer. See SKILL.md for the
// "why" — the Playwright / Chrome-for-Testing CDNs are 403-blocked in Claude
// Code web sessions, and Ubuntu's apt `chromium` is only a snap shim. The trick
// is @sparticuz/chromium, which ships the Chromium binary *inside* its npm
// package (the npm registry is reachable), driven by puppeteer-core.
//
// Usage:
//   node shot.cjs --out FILE [options]
//     --url URL              default http://localhost:5173/
//     --width N              viewport width  (default 1280; try 420 / 600 to test responsive)
//     --height N             viewport height (default 2200)
//     --scale N              deviceScaleFactor (default 2 — crisp text)
//     --click 'SEL@@REGEX'   click first element matching SEL whose text matches REGEX
//                            (case-insensitive). Repeatable; clicked in order.
//                            Omit @@REGEX to click the first element matching SEL.
//     --wait MS              pause after each click / before capture (default 900)
//     --clip SEL             screenshot only that element's box (else full viewport)
//     --full                 full-page screenshot (whole scroll height)
//
// Example — systemd deep-dive canvas at phone width:
//   node shot.cjs --width 600 \
//     --click '.tab-btn@@deep' --click '.event-card@@systemd' \
//     --clip '.deep-dive-canvas' --out /tmp/shot/systemd.png

const chromium = require('@sparticuz/chromium').default   // NOTE: .default (ESM interop)
const puppeteer = require('puppeteer-core')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseArgs(argv) {
  const o = { url: 'http://localhost:5173/', width: 1280, height: 2200, scale: 2,
    wait: 900, clicks: [], clip: null, full: false, out: null }
  for (let i = 0; i < argv.length; i++) {
    const v = () => argv[++i]
    switch (argv[i]) {
      case '--url': o.url = v(); break
      case '--width': o.width = +v(); break
      case '--height': o.height = +v(); break
      case '--scale': o.scale = +v(); break
      case '--wait': o.wait = +v(); break
      case '--click': o.clicks.push(v()); break
      case '--clip': o.clip = v(); break
      case '--full': o.full = true; break
      case '--out': o.out = v(); break
      default: throw new Error(`unknown arg: ${argv[i]}`)
    }
  }
  if (!o.out) throw new Error('--out FILE is required')
  return o
}

async function clickByText(page, spec) {
  const [sel, src] = spec.split('@@')
  const h = await page.evaluateHandle((sel, src) => {
    const els = [...document.querySelectorAll(sel)]
    if (!src) return els[0]
    const re = new RegExp(src, 'i')
    return els.find((e) => re.test(e.textContent || ''))
  }, sel, src || '')
  const el = h.asElement()
  if (!el) throw new Error(`click target not found: ${spec}`)
  await el.click()
}

;(async () => {
  const o = parseArgs(process.argv.slice(2))
  chromium.setGraphicsMode = false
  const browser = await puppeteer.launch({
    args: [...chromium.args, '--no-sandbox', '--disable-gpu'],
    defaultViewport: { width: o.width, height: o.height, deviceScaleFactor: o.scale },
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  })
  try {
    const page = await browser.newPage()
    page.on('pageerror', (e) => console.log('PAGEERR:', e.message))
    await page.goto(o.url, { waitUntil: 'networkidle0', timeout: 30000 })
    await sleep(500)
    for (const c of o.clicks) { await clickByText(page, c); await sleep(o.wait) }
    if (o.clip) {
      const el = await page.$(o.clip)
      if (!el) throw new Error(`--clip element not found: ${o.clip}`)
      await el.screenshot({ path: o.out })
    } else {
      await page.screenshot({ path: o.out, fullPage: o.full })
    }
    console.log('OK wrote', o.out)
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
