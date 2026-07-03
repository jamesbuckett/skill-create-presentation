#!/usr/bin/env node
// extract.mjs — parses a single-file index.html into outline.json, the
// deterministic input for planning a slide deck.
//
// Zero dependencies. The parser is a small quote-aware tokenizer plus a
// stack-based tree builder — enough for well-formed single-file pages (the
// skill-style-guide shape), not a general-purpose HTML5 parser.
//
// What it captures: document title (h1 preferred), meta description, the
// lede (content between h1 and the first h2), and one section per h2 with
// h3 subsections — each holding paragraphs, lists, tables, code blocks,
// blockquotes, and image references, in source order.
//
// What it ignores: nav, footer, script, style, svg, buttons, form controls,
// aria-hidden elements, and the personal-branding row. It never invents
// content — everything in outline.json is verbatim-extracted (inline markup
// flattened, inline <code> kept as backticks).
//
// Usage:
//   node extract.mjs                 # ./index.html -> ./outline.json
//   node extract.mjs ./page.html     # explicit input
//   node extract.mjs --out=./o.json  # explicit output path
//   node extract.mjs --json          # also print the JSON to stdout
//   node extract.mjs --quiet         # suppress the human summary
//
// Exit codes: 0 outline written, 1 nothing extractable, 2 input missing.

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
const outFlag = args.find((a) => a.startsWith('--out='));
const target = args.find((a) => !a.startsWith('-')) || './index.html';
const outPath = outFlag ? outFlag.slice('--out='.length) : './outline.json';

if (flags.help) {
  console.log('Usage: node extract.mjs [path] [--out=outline.json] [--json] [--quiet]');
  console.log('  Parses a single-file HTML page into a JSON slide outline.');
  console.log('  Exit 0 on success, 1 if nothing extractable, 2 if the input is missing.');
  process.exit(0);
}

if (!fs.existsSync(target)) {
  console.error(`extract.mjs: input not found: ${target}`);
  process.exit(2);
}

const rawHtml = fs.readFileSync(target, 'utf8');

// -----------------------------------------------------------------------------
// Entities
// -----------------------------------------------------------------------------

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', middot: '·',
  copy: '©', reg: '®', trade: '™', deg: '°',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  times: '×', rarr: '→', larr: '←', bull: '•',
};

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

// -----------------------------------------------------------------------------
// Tokenizer — quote-aware tag scanner; script/style contents skipped raw.
// -----------------------------------------------------------------------------

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
const RAW_TEXT = new Set(['script', 'style']);

function tokenize(html) {
  const src = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<!doctype[^>]*>/gi, '');
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt === -1) { tokens.push({ type: 'text', text: src.slice(i) }); break; }
    if (lt > i) tokens.push({ type: 'text', text: src.slice(i, lt) });

    let j = lt + 1;
    const closing = src[j] === '/';
    if (closing) j++;
    let name = '';
    while (j < src.length && /[a-zA-Z0-9-]/.test(src[j])) name += src[j++];
    if (!name) { // stray "<" in text
      tokens.push({ type: 'text', text: '<' });
      i = lt + 1;
      continue;
    }
    let attrText = '';
    let quote = null;
    while (j < src.length) {
      const ch = src[j];
      if (quote) {
        if (ch === quote) quote = null;
        attrText += ch; j++;
      } else if (ch === '"' || ch === "'") {
        quote = ch; attrText += ch; j++;
      } else if (ch === '>') {
        break;
      } else {
        attrText += ch; j++;
      }
    }
    i = j + 1;
    const lower = name.toLowerCase();

    if (!closing && RAW_TEXT.has(lower)) {
      // Skip raw content entirely — scripts and styles never carry deck content.
      const closeRe = new RegExp(`</${lower}\\s*>`, 'i');
      const rest = src.slice(i);
      const m = closeRe.exec(rest);
      i = m ? i + m.index + m[0].length : src.length;
      continue;
    }
    tokens.push({
      type: closing ? 'close' : 'open',
      name: lower,
      attrText,
      selfClosing: /\/\s*$/.test(attrText),
    });
  }
  return tokens;
}

function parseAttrs(attrText) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(attrText)) !== null) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

// -----------------------------------------------------------------------------
// Tree builder — forgiving stack with the common implicit-close rules.
// -----------------------------------------------------------------------------

const CLOSES_P = new Set([
  'p', 'ul', 'ol', 'table', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5',
  'h6', 'div', 'section', 'article', 'figure', 'dl', 'header', 'footer',
  'nav', 'aside', 'main',
]);

function buildTree(tokens) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];

  for (const t of tokens) {
    if (t.type === 'text') {
      top().children.push({ tag: '#text', text: t.text });
      continue;
    }
    if (t.type === 'open') {
      if (t.name === 'li') { if (top().tag === 'li') stack.pop(); }
      if (t.name === 'td' || t.name === 'th') { while (['td', 'th'].includes(top().tag)) stack.pop(); }
      if (t.name === 'tr') { while (['td', 'th', 'tr'].includes(top().tag)) stack.pop(); }
      if (CLOSES_P.has(t.name) && top().tag === 'p') stack.pop();
      const node = { tag: t.name, attrs: parseAttrs(t.attrText), children: [] };
      top().children.push(node);
      if (!VOID_ELEMENTS.has(t.name) && !t.selfClosing) stack.push(node);
      continue;
    }
    // close tag — pop to the matching open if one exists, else ignore
    let k = stack.length - 1;
    while (k > 0 && stack[k].tag !== t.name) k--;
    if (k > 0) stack.length = k;
  }
  return root;
}

// -----------------------------------------------------------------------------
// Text helpers
// -----------------------------------------------------------------------------

const INLINE_IGNORED = new Set(['svg', 'button', 'script', 'style', 'noscript', 'template']);

function textOf(node, opts = {}) {
  const { pre = false, skipNestedLists = false } = opts;
  let out = '';
  const visit = (n, insidePre) => {
    for (const c of n.children ?? []) {
      if (c.tag === '#text') { out += decodeEntities(c.text); continue; }
      if (INLINE_IGNORED.has(c.tag)) continue;
      if (skipNestedLists && (c.tag === 'ul' || c.tag === 'ol')) continue;
      if (c.tag === 'br') { out += insidePre ? '\n' : ' '; continue; }
      if (c.tag === 'code' && !insidePre) {
        out += '`';
        visit(c, insidePre);
        out += '`';
        continue;
      }
      visit(c, insidePre || c.tag === 'pre');
    }
  };
  visit(node, pre);
  if (pre) return out.replace(/^\n+/, '').replace(/\s+$/, '');
  return out.replace(/\s+/g, ' ').trim();
}

function findFirst(node, pred) {
  for (const c of node.children ?? []) {
    if (c.tag === '#text') continue;
    if (pred(c)) return c;
    const hit = findFirst(c, pred);
    if (hit) return hit;
  }
  return null;
}

function findAll(node, pred, acc = []) {
  for (const c of node.children ?? []) {
    if (c.tag === '#text') continue;
    if (pred(c)) acc.push(c);
    findAll(c, pred, acc);
  }
  return acc;
}

function classList(node) {
  return (node.attrs?.class ?? '').split(/\s+/).filter(Boolean);
}

function slugify(text) {
  return text.toLowerCase().replace(/`/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
}

function countWords(text) {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

// -----------------------------------------------------------------------------
// Block harvesters
// -----------------------------------------------------------------------------

function harvestList(el) {
  const items = [];
  for (const li of el.children ?? []) {
    if (li.tag !== 'li') continue;
    const text = textOf(li, { skipNestedLists: true });
    const sub = [];
    for (const nested of (li.children ?? []).filter((c) => c.tag === 'ul' || c.tag === 'ol')) {
      for (const nestedLi of nested.children ?? []) {
        if (nestedLi.tag === 'li') sub.push(textOf(nestedLi));
      }
    }
    if (text || sub.length) items.push(sub.length ? { text, sub } : { text });
  }
  return { type: 'list', ordered: el.tag === 'ol', items };
}

function harvestTable(el) {
  const headers = [];
  const rows = [];
  const thead = findFirst(el, (n) => n.tag === 'thead');
  const headerRow = thead ? findFirst(thead, (n) => n.tag === 'tr') : null;
  if (headerRow) {
    for (const cell of headerRow.children ?? []) {
      if (cell.tag === 'th' || cell.tag === 'td') headers.push(textOf(cell));
    }
  }
  const allRows = findAll(el, (n) => n.tag === 'tr');
  for (const tr of allRows) {
    if (tr === headerRow) continue;
    const cells = [];
    for (const cell of tr.children ?? []) {
      if (cell.tag === 'th' || cell.tag === 'td') cells.push(textOf(cell));
    }
    if (!headerRow && !rows.length && cells.length &&
        (tr.children ?? []).filter((c) => c.tag === 'th').length === cells.length) {
      headers.push(...cells);
      continue;
    }
    if (cells.some((c) => c)) rows.push(cells);
  }
  return { type: 'table', headers, rows };
}

function harvestCode(el) {
  const codeEl = findFirst(el, (n) => n.tag === 'code');
  const classes = [...classList(el), ...(codeEl ? classList(codeEl) : [])];
  const langClass = classes.find((c) => /^language-/.test(c));
  const lang = langClass ? langClass.replace(/^language-/, '') : (el.attrs?.['data-lang'] ?? null);
  return { type: 'code', lang, text: textOf(codeEl ?? el, { pre: true }) };
}

function harvestFigure(el) {
  const img = findFirst(el, (n) => n.tag === 'img');
  const cap = findFirst(el, (n) => n.tag === 'figcaption');
  if (!img) return null;
  return {
    type: 'img',
    src: img.attrs?.src ?? '',
    alt: img.attrs?.alt ?? '',
    ...(cap ? { caption: textOf(cap) } : {}),
  };
}

function harvestDl(el) {
  const items = [];
  let term = null;
  for (const c of el.children ?? []) {
    if (c.tag === 'dt') term = textOf(c);
    if (c.tag === 'dd') {
      items.push({ text: term ? `${term} — ${textOf(c)}` : textOf(c) });
      term = null;
    }
  }
  return { type: 'list', ordered: false, items };
}

// -----------------------------------------------------------------------------
// Outline walk
// -----------------------------------------------------------------------------

const SUBTREE_IGNORED = new Set([
  'nav', 'footer', 'svg', 'noscript', 'template', 'button', 'iframe',
  'canvas', 'video', 'audio', 'form', 'input', 'select', 'textarea', 'head',
]);

const tree = buildTree(tokenize(rawHtml));

const titleEl = findFirst(tree, (n) => n.tag === 'title');
const metaDesc = findFirst(tree, (n) => n.tag === 'meta' && (n.attrs?.name ?? '').toLowerCase() === 'description');

const outline = {
  source: target,
  title: null,           // h1 preferred, <title> fallback (set below)
  docTitle: titleEl ? textOf(titleEl) : null,
  description: metaDesc ? (metaDesc.attrs?.content ?? null) : null,
  lede: null,            // first paragraph between the h1 and the first h2
  intro: [],             // any further pre-h2 content blocks
  sections: [],
  stats: { sections: 0, words: 0, tables: 0, codeBlocks: 0, images: 0 },
  ignored: { nav: 0, footer: 0, branding: 0, scriptStyle: 0, ariaHidden: 0 },
};

let h1Text = null;
let currentSection = null;
let currentSub = null;
const usedIds = new Set();

function uniqueId(base) {
  let id = base;
  let n = 2;
  while (usedIds.has(id)) id = `${base}-${n++}`;
  usedIds.add(id);
  return id;
}

function currentTarget() {
  if (currentSub) return currentSub;
  if (currentSection) return currentSection;
  return null; // intro
}

function pushBlock(block) {
  if (!block) return;
  const tgt = currentTarget();
  if (tgt) tgt.content.push(block);
  else if (block.type === 'p' && !outline.lede && h1Text) outline.lede = block.text;
  else outline.intro.push(block);

  if (block.type === 'table') outline.stats.tables++;
  if (block.type === 'code') outline.stats.codeBlocks++;
  if (block.type === 'img') outline.stats.images++;
  if (block.type === 'p' || block.type === 'quote') outline.stats.words += countWords(block.text);
  if (block.type === 'list') {
    for (const it of block.items) {
      outline.stats.words += countWords(it.text) + (it.sub ?? []).reduce((a, s) => a + countWords(s), 0);
    }
  }
}

function walk(node, sectionElId) {
  for (const child of node.children ?? []) {
    if (child.tag === '#text') continue;
    if (SUBTREE_IGNORED.has(child.tag)) {
      if (child.tag === 'nav') outline.ignored.nav++;
      if (child.tag === 'footer') outline.ignored.footer++;
      continue;
    }
    if (classList(child).includes('branding')) { outline.ignored.branding++; continue; }
    if ((child.attrs?.['aria-hidden'] ?? '') === 'true') { outline.ignored.ariaHidden++; continue; }

    switch (child.tag) {
      case 'h1': {
        if (!h1Text) h1Text = textOf(child);
        continue;
      }
      case 'h2': {
        const heading = textOf(child);
        currentSection = {
          id: uniqueId(child.attrs?.id || sectionElId || slugify(heading)),
          heading,
          level: 2,
          content: [],
          subsections: [],
        };
        currentSub = null;
        outline.sections.push(currentSection);
        outline.stats.words += countWords(heading);
        continue;
      }
      case 'h3': {
        const heading = textOf(child);
        currentSub = {
          id: uniqueId(child.attrs?.id || slugify(heading)),
          heading,
          level: 3,
          content: [],
        };
        if (currentSection) currentSection.subsections.push(currentSub);
        else {
          // h3 before any h2 — promote to a section so nothing is dropped
          currentSection = { id: currentSub.id, heading, level: 3, content: [], subsections: [] };
          currentSub = null;
          outline.sections.push(currentSection);
        }
        outline.stats.words += countWords(heading);
        continue;
      }
      case 'h4': case 'h5': case 'h6':
        pushBlock({ type: 'p', text: textOf(child) });
        continue;
      case 'p': {
        const text = textOf(child);
        if (text) pushBlock({ type: 'p', text });
        continue;
      }
      case 'ul': case 'ol':
        pushBlock(harvestList(child));
        continue;
      case 'table':
        pushBlock(harvestTable(child));
        continue;
      case 'pre':
        pushBlock(harvestCode(child));
        continue;
      case 'blockquote':
        pushBlock({ type: 'quote', text: textOf(child) });
        continue;
      case 'figure': {
        const fig = harvestFigure(child);
        if (fig) pushBlock(fig);
        else walk(child, sectionElId);
        continue;
      }
      case 'img':
        pushBlock({ type: 'img', src: child.attrs?.src ?? '', alt: child.attrs?.alt ?? '' });
        continue;
      case 'dl':
        pushBlock(harvestDl(child));
        continue;
      case 'section':
        walk(child, child.attrs?.id || sectionElId);
        continue;
      default:
        walk(child, sectionElId);
    }
  }
}

walk(tree, null);

outline.title = h1Text || outline.docTitle || null;
outline.stats.sections = outline.sections.length;

// Per-section stats help the planning step spot slides that need splitting.
for (const s of outline.sections) {
  const collect = (sec) => {
    let words = 0;
    let bullets = 0;
    for (const b of sec.content) {
      if (b.type === 'p' || b.type === 'quote') words += countWords(b.text);
      if (b.type === 'list') {
        bullets += b.items.length;
        for (const it of b.items) words += countWords(it.text) + (it.sub ?? []).reduce((a, x) => a + countWords(x), 0);
      }
    }
    return { words, bullets };
  };
  const own = collect(s);
  const subs = s.subsections.map(collect);
  s.stats = {
    words: own.words + subs.reduce((a, x) => a + x.words, 0),
    bullets: own.bullets + subs.reduce((a, x) => a + x.bullets, 0),
    blocks: s.content.length + s.subsections.reduce((a, x) => a + x.content.length, 0),
  };
}

// -----------------------------------------------------------------------------
// Output
// -----------------------------------------------------------------------------

const nothingExtractable =
  !outline.title && !outline.lede && outline.intro.length === 0 && outline.sections.length === 0;

if (nothingExtractable) {
  console.error('extract.mjs: nothing extractable — no h1/h2/h3 headings or content blocks found.');
  console.error('Is this a content page? The deck workflow needs headed sections to segment slides.');
  process.exit(1);
}

fs.writeFileSync(outPath, JSON.stringify(outline, null, 2) + '\n');

if (flags.json) console.log(JSON.stringify(outline, null, 2));

if (!flags.quiet) {
  const rel = (p) => path.relative(process.cwd(), path.resolve(p)) || '.';
  console.log(`source:  ${rel(target)}`);
  console.log(`outline: ${rel(outPath)}`);
  console.log(`title:   ${outline.title ?? '(none found)'}`);
  console.log(`lede:    ${outline.lede ? 'yes' : 'no'}   description: ${outline.description ? 'yes' : 'no'}`);
  console.log(`sections: ${outline.sections.length}  (words ${outline.stats.words}, tables ${outline.stats.tables}, code ${outline.stats.codeBlocks}, images ${outline.stats.images})`);
  for (const s of outline.sections) {
    const subs = s.subsections.length ? `, ${s.subsections.length} sub` : '';
    console.log(`  - ${s.heading}  [${s.stats.blocks} blocks, ${s.stats.words} words, ${s.stats.bullets} bullets${subs}]`);
  }
  const ig = outline.ignored;
  console.log(`ignored: nav ${ig.nav}, footer ${ig.footer}, branding ${ig.branding}, aria-hidden ${ig.ariaHidden} (script/style always dropped)`);
  if (outline.sections.length === 0) {
    console.log('note: no h2 sections found — the deck plan will need to work from the intro content alone.');
  }
}
