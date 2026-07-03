#!/usr/bin/env node
// validate.mjs — static linter for a skill-html-to-presentation deck.
//
// Encodes the deck rules from SKILL.md as programmatic checks. The palette,
// spacing, emoji, and branding rules are the same contract skill-style-guide
// enforces; the slide-structure rules (ids, single style/script block,
// bullet budget) are deck-specific. Run after every edit and before
// reporting done.
//
// Usage:
//   node validate.mjs                      # ./presentation.html
//   node validate.mjs ./deck.html          # explicit target
//   node validate.mjs --json               # machine-readable JSON output
//   node validate.mjs --quiet              # silence warnings, only errors
//
// Exit codes: 0 clean, 1 errors found, 2 target missing.

import fs from 'fs';
import path from 'path';

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

const args = process.argv.slice(2);
const flags = {
  json:  args.includes('--json'),
  quiet: args.includes('--quiet') || args.includes('-q'),
  help:  args.includes('--help')  || args.includes('-h'),
};
const target = args.find((a) => !a.startsWith('-')) || './presentation.html';

if (flags.help) {
  console.log('Usage: node validate.mjs [path] [--json] [--quiet]');
  console.log('  Lints a presentation.html against the skill-html-to-presentation rules.');
  console.log('  Exit 0 if clean, 1 if errors found, 2 if the target is missing.');
  process.exit(0);
}

if (!fs.existsSync(target)) {
  console.error(`validate.mjs: target not found: ${target}`);
  process.exit(2);
}

const rawHtml = fs.readFileSync(target, 'utf8');
// Strip HTML comments before scanning so rules don't fire on documentation
// text. Replace each comment with same-length whitespace (preserving
// newlines) so line numbers in emoji errors stay accurate.
const html = rawHtml.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
const errors = [];
const warnings = [];
const err  = (rule, msg) => errors.push({ rule, msg });
const warn = (rule, msg) => warnings.push({ rule, msg });

// -----------------------------------------------------------------------------
// Rules
// -----------------------------------------------------------------------------

// ----- single-file: no stray .css/.js siblings next to the deck --------------

{
  const dir = path.dirname(path.resolve(target));
  const whitelist = new Set([
    'extract.mjs', 'validate.mjs', 'slides-shot.mjs',
    'screenshot.mjs', 'a11y.mjs', 'run-evals.mjs', '_launch.mjs',
  ]);
  const stray = fs.readdirSync(dir).filter((f) => {
    if (whitelist.has(f)) return false;
    return /\.(css|js|mjs|cjs|ts|jsx|tsx)$/.test(f);
  });
  if (stray.length) {
    err('single-file', `unexpected sibling files alongside ${path.basename(target)}: ${stray.join(', ')}`);
  }
}

// ----- structural skeleton ----------------------------------------------------

if (!/<!doctype\s+html>/i.test(rawHtml))              err('doctype',       'missing <!doctype html>');
if (!/<meta\s+charset\s*=/i.test(html))               err('meta-charset',  'missing <meta charset>');
if (!/<meta\s+name\s*=\s*"viewport"/i.test(html))     err('meta-viewport', 'missing viewport meta');
if (!/<title>[^<]+<\/title>/i.test(html))             err('title',         'missing or empty <title>');
if (!/<meta\s+name\s*=\s*"description"/i.test(html))  err('meta-description', 'missing <meta name="description">');
if (!/<html[^>]*\blang\s*=/i.test(html))              warn('html-lang',    'missing lang attribute on <html>');

// ----- light default: data-theme="light" in static markup ---------------------

if (/<html[^>]*\bdata-theme\s*=\s*"dark"/i.test(html)) {
  err('light-default', 'static <html> starts in dark mode; light must be the default');
} else if (!/<html[^>]*\bdata-theme\s*=\s*"light"/i.test(html)) {
  err('light-default', 'missing data-theme="light" on the static <html> element');
}

// ----- one style block, one script block, everything inline -------------------

{
  const styleCount = (html.match(/<style\b/gi) || []).length;
  if (styleCount !== 1) err('one-style-block', `expected exactly 1 <style> block, found ${styleCount}`);
  const scriptTags = [...html.matchAll(/<script\b[^>]*>/gi)];
  if (scriptTags.length !== 1) err('one-script-block', `expected exactly 1 <script> block, found ${scriptTags.length}`);
  for (const [tag] of scriptTags) {
    if (/\bsrc\s*=/i.test(tag)) err('no-cdn-script', `external <script src> is not allowed — inline all JS: ${tag}`);
  }
}

// ----- emoji -------------------------------------------------------------------
// Conservative range — catches typical pictographs/symbols, spares ™ © ® ° etc.

const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}]/u;
html.split('\n').forEach((line, i) => {
  if (emoji.test(line)) {
    const ch = line.match(emoji)[0];
    err('no-emoji', `line ${i + 1}: emoji "${ch}" in output — replace with a Lucide SVG`);
  }
});

// ----- external resources: only Google Fonts allowed --------------------------

const externals = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)\s*=\s*"([^"]+)"/gi)];
const allowedHosts = ['fonts.googleapis.com', 'fonts.gstatic.com'];
for (const [, url] of externals) {
  if (url.startsWith('#') || url.startsWith('/') || url.startsWith('./') || url.startsWith('mailto:')) continue;
  if (allowedHosts.some((h) => url.includes(h))) continue;
  if (/tailwindcss|tailwind\.css/i.test(url))           err('no-framework', `Tailwind CDN: ${url}`);
  else if (/bootstrap(\.min)?\.(?:js|css)/i.test(url))  err('no-framework', `Bootstrap: ${url}`);
  else if (/jquery/i.test(url))                          err('no-framework', `jQuery: ${url}`);
  else if (/unpkg\.com\/lucide|cdn\.jsdelivr\.net\/.*lucide/i.test(url))
    err('no-framework', `Lucide CDN — inline the SVG instead: ${url}`);
  else err('external-resource', `external resource beyond Google Fonts: ${url}`);
}

// ----- CSS analysis ------------------------------------------------------------

const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
const css = styleMatch ? styleMatch[1] : '';
const cssLive = css.replace(/\/\*[\s\S]*?\*\//g, '');

if (!css) err('style-block', 'no <style> block found');

// ----- one-accent: exactly one uncommented --accent declaration ----------------

const accentCount = (cssLive.match(/--accent\s*:/g) || []).length;
if (accentCount === 0)      err('one-accent', 'no --accent variable defined');
else if (accentCount > 1)   err('one-accent', `--accent declared ${accentCount} times (must be exactly one uncommented)`);

// ----- focus-visible defined ----------------------------------------------------

if (!/:focus-visible/.test(cssLive)) {
  err('focus-visible', 'no :focus-visible style defined — focus rings are required for keyboard navigation');
}

// ----- prefers-reduced-motion respected -----------------------------------------

if (/transition\s*:/i.test(cssLive) && !/prefers-reduced-motion\s*:\s*reduce/i.test(cssLive)) {
  warn('reduced-motion', 'transitions are defined but no @media (prefers-reduced-motion: reduce) override');
}

// ----- transition budget: nothing above 250ms -----------------------------------

for (const m of cssLive.matchAll(/(?:^|[;{\s])(--)?transition[a-z-]*\s*:\s*([^;}]+)/gi)) {
  const value = m[2];
  for (const d of value.matchAll(/(\d*\.?\d+)(ms|s)\b/g)) {
    const ms = d[2] === 's' ? parseFloat(d[1]) * 1000 : parseFloat(d[1]);
    if (ms > 250) warn('transition-budget', `transition duration ${d[0]} exceeds the 250ms budget: "${value.trim()}"`);
  }
}

// ----- print stylesheet present --------------------------------------------------

if (!/@media\s+print/.test(cssLive)) {
  warn('print-styles', 'no @media print block — one-slide-per-page print layout is part of the deck contract');
}

// ----- palette-vars: hex codes only inside :root or [data-theme="dark"] ---------

const paletteAllowed = new Set(['#fff', '#ffffff', '#000', '#000000']); // text-on-accent fallbacks
for (const [, body] of cssLive.matchAll(/(?::root|\[data-theme\s*=\s*"dark"\])\s*(?:,\s*(?::root|\[data-theme\s*=\s*"dark"\])\s*)*\{([^}]*)\}/g)) {
  for (const m of body.matchAll(/#[0-9a-f]{3,8}/gi)) paletteAllowed.add(m[0].toLowerCase());
}

const offendingHex = new Map();
for (const m of cssLive.matchAll(/#[0-9a-f]{3,8}/gi)) {
  const hex = m[0].toLowerCase();
  if (paletteAllowed.has(hex)) continue;
  offendingHex.set(hex, (offendingHex.get(hex) || 0) + 1);
}
for (const [hex, count] of offendingHex) {
  err('palette-vars', `hex ${hex} used in component CSS (${count}x) — bind it to a variable in :root`);
}

// ----- spacing-scale: margin/padding/gap values must be on the scale -------------

const spacingScale = new Set([0, 4, 8, 12, 16, 24, 32, 48, 64, 96]);
const spacingPropRe = /^(margin|padding|gap|row-gap|column-gap)(-[a-z-]+)?$/;
const offendingSpacing = new Map();
for (const m of cssLive.matchAll(/(?:^|\s|;|\{)([a-z-]+)\s*:\s*([^;}]+)/gi)) {
  const prop = m[1];
  const value = m[2];
  if (!spacingPropRe.test(prop)) continue;
  if (value.includes('var(') || value.includes('calc(') || value.includes('clamp(')) continue;
  for (const pxm of value.matchAll(/(-?\d+(?:\.\d+)?)px/g)) {
    const n = Math.abs(Number(pxm[1]));
    if (!spacingScale.has(n)) {
      const key = `${pxm[0]} on "${prop}"`;
      offendingSpacing.set(key, (offendingSpacing.get(key) || 0) + 1);
    }
  }
}
for (const [key, count] of offendingSpacing) {
  err('spacing-scale', `${key} (${count}x) — not on the 4/8/12/16/24/32/48/64/96 scale (use --space-* tokens)`);
}

// ----- slides: ids on the hash scheme, sequential, unique ------------------------

const slideTags = [...html.matchAll(/<section\b[^>]*>/gi)]
  .filter(([tag]) => /class\s*=\s*"[^"]*\bslide\b[^"]*"/i.test(tag));

if (slideTags.length < 2) {
  err('slides', `found ${slideTags.length} .slide section(s) — a deck needs at least a title and one content slide`);
}

const slideIds = slideTags.map(([tag]) => {
  const m = tag.match(/\bid\s*=\s*"([^"]*)"/i);
  return m ? m[1] : null;
});
{
  const seen = new Set();
  slideIds.forEach((id, i) => {
    if (!id) { err('slide-ids', `slide ${i + 1} has no id — hash navigation (#/slide-n) needs id="slide-${i + 1}"`); return; }
    if (!/^slide-\d+$/.test(id)) { err('slide-ids', `slide id "${id}" doesn't match the slide-<n> hash scheme`); return; }
    if (seen.has(id)) { err('slide-ids', `duplicate slide id "${id}"`); return; }
    seen.add(id);
    if (id !== `slide-${i + 1}`) err('slide-ids', `slide ${i + 1} has id "${id}" — ids must run slide-1..slide-N in document order`);
  });
}

// ----- per-slide bullet budget (warn) and speaker notes (warn) --------------------

if (slideTags.length) {
  const positions = slideTags.map(([tag]) => html.indexOf(tag));
  const endOfDeck = html.search(/<\/main/i) !== -1 ? html.search(/<\/main/i) : html.length;
  slideTags.forEach(([tag], i) => {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : endOfDeck;
    let segment = html.slice(start, end);
    const label = slideIds[i] || `slide ${i + 1}`;
    const hasNotes = /<aside[^>]*class\s*=\s*"[^"]*\bnotes\b[^"]*"/i.test(segment);
    if (!hasNotes) warn('speaker-notes', `${label} has no <aside class="notes"> — every slide carries speaker notes`);
    segment = segment.replace(/<aside[^>]*class\s*=\s*"[^"]*\bnotes\b[^"]*"[\s\S]*?<\/aside>/gi, '');
    const bullets = (segment.match(/<li\b/gi) || []).length;
    if (bullets > 6) warn('bullet-budget', `${label} carries ${bullets} list items — the budget is 6 per slide; split into a continuation slide`);
  });
}

// ----- branding: GitHub + Twitter/X + LinkedIn links to jamesbuckett -------------

if (!/github\.com\/jamesbuckett/i.test(html))
  err('branding', 'missing GitHub link (github.com/jamesbuckett)');
if (!/(?:twitter|x)\.com\/jamesbuckett/i.test(html))
  err('branding', 'missing Twitter/X link (twitter.com/jamesbuckett or x.com/jamesbuckett)');
if (!/linkedin\.com\/in\/jamesbuckett/i.test(html))
  err('branding', 'missing LinkedIn link (linkedin.com/in/jamesbuckett)');

// -----------------------------------------------------------------------------
// Report
// -----------------------------------------------------------------------------

const ok = errors.length === 0;
const report = { target, ok, slides: slideTags.length, errors, warnings };

if (flags.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const RED   = '\x1b[31m';
  const YEL   = '\x1b[33m';
  const GRN   = '\x1b[32m';
  const DIM   = '\x1b[2m';
  const RESET = '\x1b[0m';
  const useColor = process.stdout.isTTY;
  const c = (code, s) => (useColor ? `${code}${s}${RESET}` : s);

  console.log(`${c(DIM, 'target:')} ${target} ${c(DIM, `(${slideTags.length} slides)`)}`);
  if (ok && warnings.length === 0) {
    console.log(c(GRN, '✓ clean — no rule violations'));
  } else {
    if (errors.length) {
      console.log(`\n${c(RED, `${errors.length} error${errors.length === 1 ? '' : 's'}:`)}`);
      for (const { rule, msg } of errors) console.log(`  ${c(RED, '✗')} ${c(DIM, rule.padEnd(18))} ${msg}`);
    }
    if (warnings.length && !flags.quiet) {
      console.log(`\n${c(YEL, `${warnings.length} warning${warnings.length === 1 ? '' : 's'}:`)}`);
      for (const { rule, msg } of warnings) console.log(`  ${c(YEL, '!')} ${c(DIM, rule.padEnd(18))} ${msg}`);
    }
  }
}

process.exit(ok ? 0 : 1);
