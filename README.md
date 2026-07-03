# Skill HTML to Presentation

[![License](https://img.shields.io/github/license/jamesbuckett/skill-create-presentation)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/jamesbuckett/skill-create-presentation?style=social)](https://github.com/jamesbuckett/skill-create-presentation/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/jamesbuckett/skill-create-presentation)](https://github.com/jamesbuckett/skill-create-presentation/commits)
[![Open issues](https://img.shields.io/github/issues/jamesbuckett/skill-create-presentation)](https://github.com/jamesbuckett/skill-create-presentation/issues)

> Claude Code skill that turns an HTML page into a single-file slide deck, validated with Playwright.

## About

Takes an `index.html` — typically a [`skill-style-guide`](https://github.com/jamesbuckett/skill-style-guide) build — and generates `presentation.html`: a self-contained 16:9 deck with keyboard navigation, deep-linkable slides (`#/slide-n`), an overview grid, speaker notes, a dark-mode toggle, and a one-slide-per-page print layout. Reuses the style guide's design contract verbatim: Noto Sans typography, the 4/8/12/16/24/32/48/64/96 spacing scale, inline Lucide icons, exactly one accent colour, light theme by default. Ships a zero-dependency extractor and linter plus a Playwright harness that screenshots every slide in light and dark and drives the keyboard navigation end to end.

## Quick Start

```bash
# Direct install (recommended)
git clone https://github.com/jamesbuckett/skill-create-presentation.git ~/.claude/skills/skill-html-to-presentation

# Or: symlink from a working copy (for active development)
git clone https://github.com/jamesbuckett/skill-create-presentation.git ~/projects/skill-create-presentation
ln -s ~/projects/skill-create-presentation ~/.claude/skills/skill-html-to-presentation
```

Then, inside any repo that has an `index.html`, ask Claude to invoke the skill by its trigger phrase.

## Usage

Inside a project with an `index.html`, open Claude Code and prompt:

```text
> turn this page into slides
```

Claude extracts an outline from the page, writes a slide plan, populates the bundled deck template as `presentation.html`, then runs the validators:

```bash
node ~/.claude/skills/skill-html-to-presentation/scripts/extract.mjs ./index.html
node ~/.claude/skills/skill-html-to-presentation/scripts/validate.mjs ./presentation.html
node ~/.claude/skills/skill-html-to-presentation/scripts/slides-shot.mjs ./presentation.html
```

`extract.mjs` and `validate.mjs` have zero dependencies. `slides-shot.mjs` needs Playwright — one-time setup inside the skill repo (`npm install playwright && npx playwright install chromium`), or nothing at all when `skill-style-guide` is installed with its harness, since the script reuses that skill's `node_modules` automatically. `validate.mjs` is exit-coded so it can back a `PostToolUse` hook in `.claude/settings.json` that re-lints `presentation.html` after every edit. See [`SKILL.md`](SKILL.md) for the full workflow, the slide content rules, and Chromium fallbacks (Ubuntu ARM64 notes included).

## Project Structure

```text
.
├── SKILL.md       # Skill definition: triggers, workflow, slide rules
├── assets/        # deck.html — starter deck (chassis CSS + navigation JS)
├── scripts/       # extract.mjs, validate.mjs, slides-shot.mjs
├── references/    # slide-components.md — copy-paste slide shapes
└── evals/         # Skill eval suite + fixture pages
```

## Contributing

Issues and pull requests welcome. Please open an issue first to discuss substantial changes.

## License

[MIT](LICENSE) © 2026 James Buckett
