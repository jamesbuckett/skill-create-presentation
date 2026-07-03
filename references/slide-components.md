# Slide Components

Copy-paste-ready snippets for every slide shape the deck template supports. The chassis in `assets/deck.html` already ships the CSS for the core shapes (title, agenda, bullets, closing) — for those, copy the HTML only. The specialised shapes (two-column, table, code, section divider, image) ship their CSS here; paste it into the deck's `<style>` block immediately **before** the `/* Print */` banner comment, so the reduced-motion override stays last.

All snippets reuse the tokens from `assets/deck.html` (`--bg`, `--surface`, `--text`, `--text-muted`, `--border`, `--border-strong`, `--accent`, `--accent-soft`, `--space-1`..`--space-9`, `--radius`, `--radius-lg`, `--fs-deck-*`, `--transition`). **Do not introduce new colour values.** If a shape needs more visual weight, change border thickness or background tint, not the palette. Slides are laid out in a fixed 1280×720 design space that the engine scales as one unit — size in px against that space, never in viewport units.

Every slide, whatever its shape, keeps the same envelope:

```html
<section class="slide" id="slide-N" data-title="Short label for the overview grid">
  <!-- shape-specific content -->
  <aside class="notes">
    <p>Speaker notes — hidden in the deck, toggled with N, optionally appended in print.</p>
  </aside>
</section>
```

`id` values must run `slide-1` … `slide-N` in document order — the hash router (`#/slide-n`), the overview grid, and `validate.mjs` all key off them.

## Title slide

CSS ships in `assets/deck.html` (`.slide-title-page`, `.deck-lede`, `.deck-meta`, `.branding`). The lede comes from the source page's meta description or hero lede — never a newly invented thesis. Keep the full labelled branding row here (the compact header badges don't replace it).

```html
<section class="slide slide-title-page" id="slide-1" data-title="Title">
  <h1>Deck Title From the Source h1</h1>
  <p class="deck-lede">The source page's one-sentence summary.</p>
  <p class="deck-meta">James Buckett &middot; July 2026</p>
  <ul class="branding" aria-label="Personal links">
    <li><a href="https://github.com/jamesbuckett" rel="noopener noreferrer" target="_blank"><!-- Lucide: github --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>GitHub</a></li>
    <li><a href="https://twitter.com/jamesbuckett" rel="noopener noreferrer" target="_blank"><!-- Lucide: twitter (x glyph) --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4l11.733 16h4.267l-11.733 -16z"/><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"/></svg>Twitter / X</a></li>
    <li><a href="https://www.linkedin.com/in/jamesbuckett" rel="noopener noreferrer" target="_blank"><!-- Lucide: linkedin --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>LinkedIn</a></li>
  </ul>
  <aside class="notes"><p>Opening beat.</p></aside>
</section>
```

## Agenda slide

CSS ships in `assets/deck.html` (`ol.agenda`). One item per h2 section, in source order — the agenda is a table of contents, not a rewrite. With seven or more sections, add `agenda-2col` and let the grid balance the columns.

```html
<section class="slide" id="slide-2" data-title="Agenda">
  <p class="slide-kicker">Agenda</p>
  <h2 class="slide-title">What this deck covers</h2>
  <div class="slide-body">
    <ol class="agenda">
      <li><span class="agenda-num">01</span> First section heading</li>
      <li><span class="agenda-num">02</span> Second section heading</li>
      <li><span class="agenda-num">03</span> Third section heading</li>
    </ol>
  </div>
  <aside class="notes"><p>Optional: name the one section to pay attention to.</p></aside>
</section>
```

## Bullet slide

CSS ships in `assets/deck.html` (`ul.bullets` and `ol.bullets`). The workhorse shape: kicker names the h2 section, title carries the point, bullets carry the evidence. Maximum six bullets, roughly eighty words — past that, split into a continuation slide and suffix the titles `(1/2)`, `(2/2)`. One level of nesting is available for grouped h3 content; nested items render smaller and muted. For ordered source lists use `<ol class="bullets">`, and carry the numbering across continuation slides with `start="N"` so step 6 stays step 6.

```html
<section class="slide" id="slide-3" data-title="Why it matters">
  <p class="slide-kicker">Section name</p>
  <h2 class="slide-title">Heading from the source h2</h2>
  <div class="slide-body">
    <ul class="bullets">
      <li>One claim per bullet, condensed from a source paragraph.</li>
      <li>Keep the source's key terms; drop its connective prose.</li>
      <li><strong>Grouped h3 heading:</strong> lead bullet for a small subsection.
        <ul>
          <li>Supporting detail from the h3's own list.</li>
          <li>Second supporting detail.</li>
        </ul>
      </li>
    </ul>
  </div>
  <aside class="notes"><p>The prose you condensed away goes here.</p></aside>
</section>
```

## Two-column slide

Paste-in CSS. For content that is genuinely parallel — two h3 subsections under one h2, a before/after, a compare-and-contrast. Don't force unrelated bullets into columns for variety.

```css
/* Two-column slide */
.cols-2 {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-7);
  align-content: start;
}
.cols-2 .col h3 {
  font-size: var(--fs-deck-h3);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border);
}
```

```html
<section class="slide" id="slide-4" data-title="Two concepts side by side">
  <p class="slide-kicker">Section name</p>
  <h2 class="slide-title">Heading from the source h2</h2>
  <div class="slide-body">
    <div class="cols-2">
      <div class="col">
        <h3>First h3 heading</h3>
        <ul class="bullets">
          <li>Point from the first subsection.</li>
          <li>Second point.</li>
        </ul>
      </div>
      <div class="col">
        <h3>Second h3 heading</h3>
        <ul class="bullets">
          <li>Point from the second subsection.</li>
          <li>Second point.</li>
        </ul>
      </div>
    </div>
  </div>
  <aside class="notes"><p>Name the relationship between the columns.</p></aside>
</section>
```

## Table slide

Paste-in CSS — the style guide's comparison table resized for the 1280×720 stage. A table always gets its own slide. Keep it to **five columns and six body rows**; wider tables split into two table slides by column group (repeat the row-label column on each), longer tables split by rows with `(1/2)`, `(2/2)` titles.

```css
/* Table slide */
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  align-self: stretch;
}
table.compare {
  width: 100%;
  border-collapse: collapse;
  font-size: 20px;
}
table.compare th,
table.compare td {
  text-align: left;
  padding: var(--space-3) var(--space-4);
  vertical-align: top;
  border-bottom: 1px solid var(--border);
}
table.compare thead th {
  font-size: 15px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  background: var(--bg);
}
table.compare tbody tr:last-child th,
table.compare tbody tr:last-child td { border-bottom: 0; }
table.compare th[scope="row"] {
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
}
table.compare td { color: var(--text-muted); }
```

```html
<section class="slide" id="slide-5" data-title="Comparison">
  <p class="slide-kicker">Section name</p>
  <h2 class="slide-title">Table caption or source h2</h2>
  <div class="slide-body">
    <div class="table-wrap">
      <table class="compare">
        <thead>
          <tr><th scope="col">Variant</th><th scope="col">Property A</th><th scope="col">Property B</th></tr>
        </thead>
        <tbody>
          <tr><th scope="row">Option 1</th><td>Value</td><td>Value</td></tr>
          <tr><th scope="row">Option 2</th><td>Value</td><td>Value</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <aside class="notes"><p>Say what the table shows; don't read it aloud.</p></aside>
</section>
```

## Code slide

Paste-in CSS. A code block always gets its own slide. Keep it to **14 lines and ~70 columns**; trim setup noise rather than shrinking the font, and split longer listings across continuation slides at a logical seam. `pre-wrap` is a safety net for one long line, not a licence for wide code.

```css
/* Code slide */
pre.code-block {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: var(--space-5);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  font-size: var(--fs-deck-mono);
  line-height: 1.5;
  white-space: pre-wrap;
  overflow: hidden;
}
.code-caption {
  font-family: var(--font-mono);
  font-size: 16px;
  color: var(--text-muted);
}
```

```html
<section class="slide" id="slide-6" data-title="Code example">
  <p class="slide-kicker">Section name</p>
  <h2 class="slide-title">What this listing shows</h2>
  <div class="slide-body">
    <pre class="code-block"><code># exactly as extracted from the source page
kubectl apply -f spire-agent.yaml</code></pre>
    <p class="code-caption">bash &middot; from the source's "Implementation" section</p>
  </div>
  <aside class="notes"><p>Walk the two lines that matter; the rest is context.</p></aside>
</section>
```

## Section divider

Paste-in CSS. Optional punctuation before a section that spans several slides (an h2 with multiple h3 sub-slides or continuation slides). Don't divide every section — a divider per h2 doubles a deck without adding information.

```css
/* Section divider */
.slide-divider {
  justify-content: center;
  gap: var(--space-4);
}
.slide-divider .divider-num {
  font-family: var(--font-mono);
  font-size: 20px;
  color: var(--accent);
}
.slide-divider h2 { font-size: var(--fs-deck-h1); max-width: 18ch; }
```

```html
<section class="slide slide-divider" id="slide-7" data-title="Part 2">
  <p class="divider-num">02</p>
  <h2>Section heading from the source h2</h2>
  <aside class="notes"><p>One breath. Set up what the next slides cover.</p></aside>
</section>
```

## Image slide

Paste-in CSS. For `<img>` references extracted from the source. Small images inline as base64 `data:` URIs so the deck stays a single file; larger ones keep their relative paths — report that to the user, since the deck then only renders next to its assets.

```css
/* Image slide */
figure.slide-figure {
  flex: 1;
  min-height: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
}
figure.slide-figure img {
  max-width: 100%;
  max-height: 440px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
figure.slide-figure figcaption {
  font-size: var(--fs-deck-small);
  color: var(--text-muted);
}
```

```html
<section class="slide" id="slide-8" data-title="Diagram">
  <p class="slide-kicker">Section name</p>
  <h2 class="slide-title">What the figure shows</h2>
  <div class="slide-body">
    <figure class="slide-figure">
      <img src="data:image/png;base64,..." alt="Alt text carried over from the source page">
      <figcaption>Caption from the source figure, or the image's alt text.</figcaption>
    </figure>
  </div>
  <aside class="notes"><p>Point at the one region of the figure that matters.</p></aside>
</section>
```

## Closing slide

CSS ships in `assets/deck.html` (`.slide-closing`, `.deck-lede`, `.branding`). The lede restates the source's conclusion — its final section or summary, not a new claim. Branding row required, same as the title slide.

```html
<section class="slide slide-closing" id="slide-9" data-title="Closing">
  <p class="slide-kicker">Thanks</p>
  <h2>Thank you</h2>
  <p class="deck-lede">One-line takeaway from the source's conclusion.</p>
  <ul class="branding" aria-label="Personal links">
    <li><a href="https://github.com/jamesbuckett" rel="noopener noreferrer" target="_blank"><!-- Lucide: github --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>GitHub</a></li>
    <li><a href="https://twitter.com/jamesbuckett" rel="noopener noreferrer" target="_blank"><!-- Lucide: twitter (x glyph) --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4l11.733 16h4.267l-11.733 -16z"/><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"/></svg>Twitter / X</a></li>
    <li><a href="https://www.linkedin.com/in/jamesbuckett" rel="noopener noreferrer" target="_blank"><!-- Lucide: linkedin --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>LinkedIn</a></li>
  </ul>
  <aside class="notes"><p>Closing beat and the ask, if there is one.</p></aside>
</section>
```

## Semantic state and categorical colour

The style guide's two palette exceptions carry over unchanged. If the source content genuinely conveys state (PASS/FAIL rows, deprecated vs recommended), introduce `--state-ok` / `--state-warn` / `--state-bad` in `:root` and use them on the affected cell and icon only — never on chrome, titles, or kickers. If a slide carries a chart or multi-series diagram, use the smallest contiguous slice of `--cat-1`..`--cat-7` for the series. No genuine state, no data series: neither namespace appears in the deck.
