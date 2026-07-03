#!/usr/bin/env node
// slides-shot.mjs — Playwright capture + keyboard-navigation exercise for a
// skill-html-to-presentation deck.
//
// Captures every slide at desktop 1440x900 in light AND dark themes, plus the
// title slide and one content slide at mobile 375x812 (light and dark), the
// overview grid, and the speaker-notes panel. Then drives the deck with the
// keyboard (first -> last -> overview -> notes) and reports PASS/FAIL for each
// navigation check. Page errors and console errors fail the run.
//
// Output goes to ./screenshots/ as slide-01.png, slide-01-dark.png,
// slide-01-mobile.png, overview.png, notes.png, ...
//
// Usage:
//   node slides-shot.mjs                       # ./presentation.html, full run
//   node slides-shot.mjs ./deck.html           # explicit target
//   node slides-shot.mjs --only=4              # just slide 4, desktop light
//   node slides-shot.mjs --content-slide=5     # pick the mobile content slide
//
// Exit codes: 0 all captures + nav checks passed, 1 failure (launch, nav,
// or page errors), 2 target missing.

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

const positional = [];
const flags = {};
for (const a of process.argv.slice(2)) {
  if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
  else if (a.startsWith('--only=')) flags.only = Number(a.slice('--only='.length));
  else if (a.startsWith('--content-slide=')) flags.contentSlide = Number(a.slice('--content-slide='.length));
  else if (a.startsWith('--')) { console.error(`slides-shot.mjs: unknown flag: ${a}`); printHelp(); process.exit(1); }
  else positional.push(a);
}
const target = positional[0] || path.join(process.cwd(), 'presentation.html');

function printHelp() {
  console.log('Usage: node slides-shot.mjs [path] [--only=N] [--content-slide=N]');
  console.log('');
  console.log('  Defaults to ./presentation.html. Output goes to ./screenshots/.');
  console.log('  Full run: every slide desktop light+dark, title + one content');
  console.log('  slide mobile light+dark, overview + notes captures, and a');
  console.log('  keyboard navigation exercise (arrows, Home/End, O, Escape, N).');
  console.log('');
  console.log('  --only=N           capture just slide N at desktop light (fast iteration)');
  console.log('  --content-slide=N  which slide joins the title in the mobile set (default 3)');
}

if (!fs.existsSync(target)) {
  console.error(`slides-shot.mjs: target not found: ${target}`);
  process.exit(2);
}

const outDir = path.join(process.cwd(), 'screenshots');
fs.mkdirSync(outDir, { recursive: true });
const url = `file://${path.resolve(target)}`;

// -----------------------------------------------------------------------------
// Playwright resolution — this skill repo's node_modules first, then the
// sibling skill-style-guide install (the two skills compose; reusing its
// Playwright avoids a second per-machine setup).
// -----------------------------------------------------------------------------

async function resolvePlaywright() {
  try {
    return await import('playwright');
  } catch {}
  const siblings = [
    path.join(__dirname, '..', '..', 'skill-style-guide'),
    path.join(process.env.HOME ?? '', '.claude', 'skills', 'skill-style-guide'),
  ];
  for (const base of siblings) {
    try {
      const req = createRequire(path.join(base, 'noop.js'));
      const mod = req('playwright');
      console.log(`Playwright: resolved from ${base}/node_modules`);
      return mod;
    } catch {}
  }
  console.error('slides-shot.mjs: playwright not found.');
  console.error('Install it in this skill repo (one-time per machine):');
  console.error('  cd ~/.claude/skills/skill-html-to-presentation && npm install playwright && npx playwright install chromium');
  console.error('or install skill-style-guide\'s harness — this script reuses its node_modules automatically.');
  process.exit(1);
}

// -----------------------------------------------------------------------------
// Browser launch — same fallback chain as skill-style-guide/scripts/_launch.mjs:
// Google Chrome (channel), then Playwright-bundled Chromium, then common
// system paths. On Ubuntu ARM64 / WSL where `npx playwright install chromium`
// errors out, `sudo snap install chromium` and the snap path is the usual
// rescue (keep the project under $HOME — snap-confined chromium cannot read
// outside it). Override via PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.
// -----------------------------------------------------------------------------

const FALLBACK_PATHS = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  '/snap/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

async function launchBrowser(chromium, opts = {}) {
  const candidates = [
    { label: 'Google Chrome', launchOpts: { channel: 'chrome' } },
    { label: 'bundled Chromium', launchOpts: {} },
    ...FALLBACK_PATHS.map((p) => ({ label: p, launchOpts: { executablePath: p } })),
  ];
  const attempts = [];
  for (const { label, launchOpts } of candidates) {
    try {
      // 120s timeout: a snap-confined chromium's first launch after boot can
      // blow well past Playwright's 30s default while AppArmor/font caches warm.
      const browser = await chromium.launch({ timeout: 120000, ...launchOpts, ...opts });
      return { browser, label };
    } catch (e) {
      attempts.push(`  ${label}: ${String(e.message).split('\n')[0]}`);
    }
  }
  throw new Error(
    'No Chrome/Chromium found. Install via `sudo snap install chromium` or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.\nAttempts:\n'
    + attempts.join('\n')
  );
}

// -----------------------------------------------------------------------------
// Harness
// -----------------------------------------------------------------------------

const { chromium } = await resolvePlaywright();
const { browser, label: browserLabel } = await launchBrowser(chromium);
console.log(`Browser: ${browserLabel}`);

const pageProblems = [];
let checksPassed = 0;
let checksFailed = 0;

function check(name, cond, detail = '') {
  if (cond) { checksPassed++; console.log(`  PASS  ${name}`); }
  else { checksFailed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function newDeckPage(context) {
  const page = await context.newPage();
  page.on('pageerror', (e) => pageProblems.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/favicon/i.test(msg.text())) {
      pageProblems.push(`console.error: ${msg.text()}`);
    }
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  return page;
}

async function showSlide(page, n) {
  await page.evaluate((h) => { location.hash = h; }, `#/slide-${n}`);
  await page.waitForTimeout(250);
}

async function shot(page, filename) {
  const file = path.join(outDir, filename);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`Saved ${path.relative(process.cwd(), file)}`);
}

const pad = (n) => String(n).padStart(2, '0');
// Note: page.$eval/$$eval/evaluate below are Playwright's page-context
// helpers running the fixed inline functions written here — no eval() of
// dynamic strings anywhere in this script.
const counterText = (page) => page.$eval('#slide-counter', (el) => el.textContent.trim());

try {
  // ------------------------------------------------------------------ desktop
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });
  const page = await newDeckPage(desktop);
  const slideIds = await page.$$eval('.slide', (els) => els.map((el) => el.id));
  const N = slideIds.length;
  if (N === 0) {
    console.error('slides-shot.mjs: no .slide sections found in the deck.');
    process.exit(1);
  }
  console.log(`Deck: ${N} slides`);

  if (flags.only) {
    const n = Math.max(1, Math.min(N, flags.only));
    await showSlide(page, n);
    await shot(page, `slide-${pad(n)}.png`);
  } else {
    // Every slide, desktop light.
    for (let i = 1; i <= N; i++) {
      await showSlide(page, i);
      await shot(page, `slide-${pad(i)}.png`);
    }

    // Keyboard navigation exercise: first -> last -> overview -> notes.
    console.log('Keyboard navigation exercise:');
    await page.keyboard.press('Home');
    await page.waitForTimeout(120);
    check('Home reaches slide 1', (await counterText(page)) === `1 / ${N}`);
    for (let i = 1; i < N; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(150);
    check(`ArrowRight x${N - 1} reaches slide ${N}`, (await counterText(page)) === `${N} / ${N}`,
      `counter reads "${await counterText(page)}"`);
    check('hash deep-link updated', await page.evaluate(() => location.hash) === `#/slide-${N}`,
      `hash is "${await page.evaluate(() => location.hash)}"`);
    await page.keyboard.press('Home');
    await page.waitForTimeout(120);
    await page.keyboard.press('End');
    await page.waitForTimeout(120);
    check('End reaches last slide', (await counterText(page)) === `${N} / ${N}`);
    await page.keyboard.press('Home');
    await page.waitForTimeout(120);
    if (N > 1) {
      await page.click('#nav-next');
      await page.waitForTimeout(120);
      check('next button advances', (await counterText(page)) === `2 / ${N}`);
      await page.click('#nav-prev');
      await page.waitForTimeout(120);
      check('prev button returns', (await counterText(page)) === `1 / ${N}`);
    }

    await page.keyboard.press('o');
    await page.waitForTimeout(200);
    check('O opens the overview grid', await page.evaluate(() => document.body.classList.contains('overview-open')));
    await shot(page, 'overview.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check('Escape closes the overview', await page.evaluate(() => !document.body.classList.contains('overview-open')));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check('Escape also toggles it open', await page.evaluate(() => document.body.classList.contains('overview-open')));
    await page.keyboard.press('o');
    await page.waitForTimeout(150);
    check('O closes it again', await page.evaluate(() => !document.body.classList.contains('overview-open')));

    await page.keyboard.press('n');
    await page.waitForTimeout(200);
    check('N opens the speaker-notes panel', await page.evaluate(() => document.body.classList.contains('notes-open')));
    await shot(page, 'notes.png');
    await page.keyboard.press('n');
    await page.waitForTimeout(150);
    check('N closes the speaker-notes panel', await page.evaluate(() => !document.body.classList.contains('notes-open')));
  }
  await desktop.close();

  if (!flags.only) {
    // ------------------------------------------------------------- desktop dark
    const dark = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
    });
    await dark.addInitScript(() => {
      try { localStorage.setItem('theme', 'dark'); } catch {}
    });
    const darkPage = await newDeckPage(dark);
    const darkN = await darkPage.$$eval('.slide', (els) => els.length);
    for (let i = 1; i <= darkN; i++) {
      await showSlide(darkPage, i);
      await shot(darkPage, `slide-${pad(i)}-dark.png`);
    }
    await dark.close();

    // ------------------------------------------------------------------ mobile
    const contentSlide = Math.max(1, Math.min(N, flags.contentSlide ?? Math.min(3, N)));
    const mobileSlides = [...new Set([1, contentSlide])];
    for (const theme of ['light', 'dark']) {
      const mobile = await browser.newContext({
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 3,
        reducedMotion: 'reduce',
      });
      if (theme === 'dark') {
        await mobile.addInitScript(() => {
          try { localStorage.setItem('theme', 'dark'); } catch {}
        });
      }
      const mPage = await newDeckPage(mobile);
      for (const n of mobileSlides) {
        await showSlide(mPage, n);
        await shot(mPage, `slide-${pad(n)}-mobile${theme === 'dark' ? '-dark' : ''}.png`);
      }
      await mobile.close();
    }
  }
} finally {
  await browser.close();
}

// -----------------------------------------------------------------------------
// Report
// -----------------------------------------------------------------------------

if (pageProblems.length) {
  console.error(`\n${pageProblems.length} page problem(s):`);
  for (const p of [...new Set(pageProblems)]) console.error(`  ${p}`);
}
if (!flags.only) {
  console.log(`\nNavigation checks: ${checksPassed} passed, ${checksFailed} failed`);
}
const ok = checksFailed === 0 && pageProblems.length === 0;
process.exit(ok ? 0 : 1);
