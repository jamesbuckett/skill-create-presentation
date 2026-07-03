---
name: skill-html-to-presentation
description: Use when the user wants an existing single-file HTML page turned into a slide deck — "turn this page into slides", "create a presentation from this HTML", "index.html to deck", "make a slide deck from this page", or any request to convert an index.html (or other single-file HTML page) into a presentation, even when this skill isn't named. Takes ./index.html as input and generates ./presentation.html — a self-contained single-file 16:9 HTML deck on James Buckett's style-guide tokens (Noto Sans, exactly one accent, light default with dark-mode toggle, inline Lucide icons) with keyboard navigation, deep-linkable slides, speaker notes, an overview grid, and a one-slide-per-page print layout — verified by the bundled extractor, validator, and Playwright per-slide screenshot harness. Skip only if the user wants PowerPoint, Keynote, or PDF output.
---

# HTML to Presentation

This skill converts a single `index.html` page into `presentation.html` — a self-contained, single-file HTML slide deck — and verifies it visually, slide by slide.

The constraints — one file, a fixed 16:9 stage, the style guide's palette and spacing tokens, hard bullet budgets, mandatory per-slide screenshots — are deliberate. They keep the deck portable (double-click to present), faithful to the source page (nothing invented, nothing reordered), and resistant to the two ways generated decks usually fail: prose dumped onto slides, and content silently overflowing the stage.

## When to use this skill

Use whenever the user wants:
- An existing `index.html` (or any single-file HTML page) turned into slides, a deck, or a presentation
- "turn this page into slides", "create a presentation from this HTML", "index.html to deck", "make a slide deck from this page" — or any phrasing with the same intent, even without naming this skill

Skip when the user wants PowerPoint, Keynote, or PDF output — different artifact, different tooling. (A PDF *print* of the deck is fine; the deck's print stylesheet exists for exactly that.)

## Composition with other skills

This skill is the **presentation architecture** — how a page becomes slides. `skill-style-guide` remains the visual authority. When both apply (they almost always do — the input page is usually a style-guide build), use this composition rule:

- `skill-style-guide` wins on **palette, typography, spacing, icons, components, and validation discipline**. Those rules are referenced here, not re-authored: Noto Sans / Noto Sans Mono via the Google Fonts link, the `--space-1`…`--space-9` scale (4/8/12/16/24/32/48/64/96), the `--bg` / `--surface` / `--text` / `--text-muted` / `--border` / `--accent` variable contract, exactly one accent, light theme by default with the dark-mode toggle, inline Lucide SVG icons only, no emoji, no gradients, no CSS frameworks, no CDN scripts.
- This skill wins on **presentation architecture**: slide segmentation, content condensation rules, the navigation model, aspect-ratio handling, speaker notes, and print layout.
- This precedence holds whenever both skills apply to the same deck, regardless of which skill the user named.

One reciprocal note: the style guide's starter template (`assets/index.html` over there) is **not** the starting point here. This skill ships its own deck template — `assets/deck.html` — which is token-compatible with the style guide's palette and spacing contract but built around a scaled 16:9 stage instead of a scrolling page. Starting a deck from the page template is a failure mode, not a shortcut.

## Workflow

All bundled scripts run **in place from the skill directory** — nothing is copied into the consumer project. Commands assume the standard install path `~/.claude/skills/skill-html-to-presentation`; substitute the skill's actual base directory if it lives elsewhere.

### 1. Extract

```bash
node ~/.claude/skills/skill-html-to-presentation/scripts/extract.mjs ./index.html
```

This writes `./outline.json`: the document title (h1 preferred), meta description, the lede, and ordered sections keyed off `h1`–`h3`, each holding its paragraphs, lists, tables, code blocks, and image references, with per-section word/bullet counts for split planning. It ignores `nav`, `footer`, `script`, `style`, SVG, buttons, aria-hidden elements, and the personal-branding row.

Read the outline (or the printed summary) before planning. **Never invent content that isn't in the source** — the outline is the complete inventory of what the deck may say.

### 2. Plan the deck

Write the slide plan as a visible list *before* generating any HTML. The skeleton is fixed:

1. **Title slide** — source h1, lede from the meta description or hero lede, author + date, branding row.
2. **Agenda** — one item per h2 section, in source order.
3. **One slide per h2 section**, in source order. `h3` subsections become their own sub-slides when they carry two or more content blocks (or any table/code block); otherwise they fold into the parent slide as a grouped bullet with nested items.
4. **Closing slide** — one-line takeaway from the source's final/summary section, branding row.

Splitting rules:
- A slide that would exceed **6 bullets or ~80 words** splits into continuation slides; suffix the titles `(1/3)`, `(2/3)`, `(3/3)`.
- **Tables and code blocks always get their own slides.** Tables wider than 5 columns split into two table slides by column group, repeating the row-label column on each; tables longer than 6 body rows split by rows with `(1/2)` titles. Code listings longer than ~14 lines are trimmed of setup noise or split at a logical seam.
- A **section divider** is optional punctuation before a section spanning three or more slides — never one per h2 by default.
- Preserve the source's heading hierarchy as the deck's information hierarchy; **never reorder sections**.

### 3. Generate

Copy the deck template and populate it:

```bash
cp ~/.claude/skills/skill-html-to-presentation/assets/deck.html ./presentation.html
```

- Replace the `<title>`, meta description, header `.deck-name`, and the placeholder slides between the `SLIDES:BEGIN` / `SLIDES:END` comments with the planned deck. Keep one `<style>` block and one `<script>` block; everything stays inline.
- Slide `id`s must run `slide-1` … `slide-N` in document order — the hash router (`#/slide-n`), overview grid, and validator all key off them.
- Every slide keeps an `<aside class="notes">`; move the prose you condensed away into the notes rather than deleting it.
- HTML shapes and paste-in CSS for every slide type (title, agenda, bullets, two-column, table, code, section divider, image, closing) live in `references/slide-components.md` — copy what you need rather than re-authoring it. Paste specialised CSS immediately before the `/* Print */` banner in the style block.
- The only permitted external request is the Google Fonts `<link>` already in the template.
- Images from the source: inline as base64 `data:` URIs when small (the encoded URI under ~100 KB), otherwise keep the relative path **and report to the user** that the deck only renders next to its assets.

### 4. Validate

```bash
node ~/.claude/skills/skill-html-to-presentation/scripts/validate.mjs ./presentation.html
node ~/.claude/skills/skill-html-to-presentation/scripts/slides-shot.mjs ./presentation.html
```

`validate.mjs` is the exit-coded static linter (structure, palette, spacing, slide ids, bullet budget, branding). `slides-shot.mjs` captures every slide and drives the keyboard navigation — see the iteration loop below. A blocked screenshot step is a **reported limitation, never a silent pass**.

## The deck engine (what assets/deck.html provides)

- **Aspect ratio.** Slides are laid out in a fixed 1280×720 design space; the engine scales the stage as one unit to fit the viewport and letterboxes mismatched windows. Readable at 1440×900, usable at 768px. Header, controls, overview, and notes are unscaled chrome. Never size slide content in viewport units — it fights the stage scaling.
- **Navigation.** Left/Right arrows, Space (Shift+Space back), PageUp/PageDown, Home/End. On-screen prev/next buttons with visible `:focus-visible` rings and a "4 / 12" counter. Every slide is deep-linkable at `#/slide-n`.
- **Overview.** `O` or `Escape` toggles a keyboard-accessible grid of slide cards (number + title); Enter jumps, Escape closes.
- **Speaker notes.** `N` toggles a bottom panel showing the current slide's `<aside class="notes">`, rendered unscaled for readability.
- **Theme.** The header carries the style guide's dark-mode toggle — same `data-theme` + `localStorage` + `prefers-color-scheme` bootstrap as the page template — plus the three personal-branding links (GitHub, Twitter/X, LinkedIn) as Lucide icon badges. The title and closing slides additionally carry the full labelled branding row.
- **Print.** One slide per page at 16:9, chrome hidden, light palette forced. With notes mode on (`N` before printing), notes append below each slide.
- **Motion.** The slide fade is 200ms; nothing exceeds 250ms; everything dies under `prefers-reduced-motion: reduce`. No entrance animations.

## Content rules

- **Condense prose to slide bullets** — maximum 6 per slide, no full paragraphs on slides. A bullet keeps the source claim and its key terms; the connective prose moves to the speaker notes.
- **The ~80-word budget** covers everything visible on the slide except the kicker and title.
- **Preserve the source's heading hierarchy** as the deck's information hierarchy. Never reorder sections, never merge sections to save slides, never invent transitions, claims, or examples the page doesn't contain.
- **Semantic state colours** (`--state-ok` / `--state-warn` / `--state-bad`) and the `--cat-1`…`--cat-7` categorical scale follow exactly the style guide's exceptions: state only for genuine state (PASS/FAIL, deprecated/recommended), categorical only for data-viz series — never for chrome, titles, or kickers. No genuine state, no data series: neither namespace appears.

## Screenshot iteration loop

`slides-shot.mjs` is the load-bearing verification step — per-slide capture is how overflow, contrast failures, and layout bugs get caught. Do not skip it for efficiency.

### Setup (once per machine)

```bash
# In the skill repo, not the consumer project
cd ~/.claude/skills/skill-html-to-presentation
npm install playwright
npx playwright install chromium
```

If `skill-style-guide` is installed with its Playwright harness, setup is already done — `slides-shot.mjs` automatically resolves Playwright from that skill's `node_modules` when this repo has none.

### When Chromium won't launch

The launcher uses the same fallback chain as `skill-style-guide/scripts/_launch.mjs`: Google Chrome (channel), then Playwright-bundled Chromium, then `/snap/bin/chromium` and `/usr/bin/chromium[-browser]`, then `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. It allows 120s per launch attempt — a snap-confined chromium's first start after boot can blow well past Playwright's 30s default, and on failure it prints why each path failed. The known-broken combination is **Ubuntu ARM64** (and other ARM64 Linux distros Playwright hasn't tagged), where `npx playwright install chromium` exits with `Playwright does not support chromium on <platform>` — `sudo snap install chromium` is the usual rescue (hand the sudo command to the user). **Snap caveat:** snap-confined chromium cannot read files outside your home directory — keep the project under `$HOME` or `file://` loads fail. As a last resort, start any Chromium-based browser with `--remote-debugging-port=9222 --headless=new` and adapt the launcher to `connectOverCDP`.

If no browser is possible in this session, hand the exact install command to the user, run `validate.mjs` (which covers every static rule), and report which visual checks were skipped. **A blocked screenshot is a known limitation, not a passed check.**

### One iteration cycle

1. **Capture.** Run `slides-shot.mjs` — the full run captures every slide (light + dark desktop at 1440×900), the title and one content slide at mobile 375×812 (light + dark), the overview grid, and the notes panel, and drives the keyboard checks. Use `--only=N` while iterating on a single slide.
2. **Look.** Read the screenshots with the Read tool. Critique: typography hierarchy (kicker/title/body ramp), spacing rhythm, **overflow** (content clipped at the stage edge, tables or code spilling), contrast in both themes, and drift toward generic AI aesthetics (gradients, rounded-card spam, decoration without information).
3. **Pick the top 2–3 changes** by visual impact. Apply them by editing `presentation.html` only.
4. **Re-capture and compare.** State explicitly what improved and what regressed.

**Stopping rule:** up to 3 cycles, or earlier when the deck meets the rules. After 3, stop and report what's left.

## Verify before reporting done

Confirm all of these before telling the user the deck is complete:

1. `node ~/.claude/skills/skill-html-to-presentation/scripts/validate.mjs ./presentation.html` exits clean — structure, palette, spacing, slide ids, branding, bullet budget.
2. The static markup defaults to light (`<html … data-theme="light">`); the runtime bootstrap honouring a stored/OS dark preference is by design, not a violation.
3. The dark set (`slide-*-dark.png`) was captured and **inspected** — dark palette applied throughout, no light values leaking from hex hard-coded outside the variable blocks.
4. Per-slide screenshots exist in `./screenshots/` for every slide, plus `overview.png`, `notes.png`, and the mobile pair, and they reflect the content rules above.
5. Keyboard navigation was exercised — `slides-shot.mjs` reports PASS for first → last, Home/End, buttons, overview open/close, and notes toggle. (It exits non-zero and prints the failing check otherwise.)
6. The final report names anything skipped and why — a blocked browser, an unsplittable table, images left as relative paths.

## Failure modes to avoid

- **Paragraph dumping** — source prose pasted onto slides. Slides carry claims; notes carry prose.
- **Silent overflow** — a seventh bullet, a 10-row table, or a 20-line listing pushed past the 720px stage. The validator warns on bullet counts; the screenshots are what actually catch overflow. Split instead of shrinking fonts.
- **Reordering or "improving" the source** — the deck is a faithful projection of the page, not a remix. Same sections, same order, same claims.
- **Inventing content** — new stats, new examples, a punchier conclusion. If it isn't in `outline.json`, it isn't in the deck.
- **Starting from the page template** — the style guide's starter is a scrolling page; decks start from `assets/deck.html`.
- **Viewport units inside slides** — `vw`/`vh` sizing fights the stage scaling; size in px against the 1280×720 design space.
- **A second accent, rainbow chrome, emoji bullets** — the style guide's palette discipline applies unchanged; state and categorical colours only under their genuine exceptions.
- **Skipping or silently bypassing the harness** — a blocked screenshot step is reported as a limitation, never passed over (see the iteration loop).

## Bundled resources

- `assets/deck.html` — the deck template: chassis CSS (stage scaling, slides, overview, notes, print) + navigation JS on the style guide's tokens. **Start here every time.**
- `scripts/extract.mjs` — input page → `outline.json`. Zero dependencies, exit-coded.
- `scripts/validate.mjs` — static linter encoding the deck rules. Zero dependencies, exit-coded; run after every edit.
- `scripts/slides-shot.mjs` — Playwright per-slide capture + keyboard-navigation exercise, with the shared Chromium launch fallback chain.
- `references/slide-components.md` — copy-paste HTML + paste-in CSS for every slide shape, all keyed to the shared tokens.
- `evals/evals.json` — skill eval suite (with `evals/fixtures/` input pages).
