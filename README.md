# Skill HTML to Presentation

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/jamesbuckett/skill-create-presentation?style=social)](https://github.com/jamesbuckett/skill-create-presentation/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/jamesbuckett/skill-create-presentation)](https://github.com/jamesbuckett/skill-create-presentation/commits)
[![Open issues](https://img.shields.io/github/issues/jamesbuckett/skill-create-presentation)](https://github.com/jamesbuckett/skill-create-presentation/issues)

> Claude Code skill that turns a single-file HTML page into a self-contained HTML slide deck, validated per slide with Playwright.

## About

Takes an `index.html` (typically a [`skill-style-guide`](https://github.com/jamesbuckett/skill-style-guide) build) and generates `presentation.html` — a single-file 16:9 deck with keyboard navigation, deep-linkable slides (`#/slide-n`), a keyboard-accessible overview grid, speaker notes, a dark-mode toggle, and a one-slide-per-page print layout. The deck reuses the style guide's design contract verbatim: Noto Sans typography, the 4/8/12/16/24/32/48/64/96 spacing scale, inlined Lucide icons, exactly one accent colour, light theme by default. A zero-dependency extractor turns the page into a JSON outline, a zero-dependency linter enforces the deck rules as exit-coded checks, and a Playwright harness screenshots every slide (light and dark, desktop and mobile) and drives the keyboard navigation end to end.

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

The scripts run in place from the skill repo — nothing is copied into consumer projects. `extract.mjs` and `validate.mjs` have zero dependencies. `slides-shot.mjs` needs Playwright — one-time setup per machine, inside the skill repo: `npm install playwright && npx playwright install chromium`. If [`skill-style-guide`](https://github.com/jamesbuckett/skill-style-guide) is installed with its harness, skip the setup: `slides-shot.mjs` resolves Playwright from that skill's `node_modules` automatically. See [`SKILL.md`](SKILL.md) for the full workflow, the slide content rules, and fallbacks when `npx playwright install` fails on your host (Ubuntu ARM64 notes included).

## Hooks (optional)

`validate.mjs` is exit-coded specifically so it can back a Claude Code hook. This `PostToolUse` fragment re-lints the deck after every edit in a consumer project; on violations it exits 2, which feeds the errors back to Claude to self-correct before the next user message. Merge it into the project's `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'if [ -f ./presentation.html ]; then node $HOME/.claude/skills/skill-html-to-presentation/scripts/validate.mjs ./presentation.html 1>&2 || exit 2; fi'"
          }
        ]
      }
    ]
  }
}
```

Projects that also use `skill-style-guide`'s PostToolUse/Stop hooks can keep both — this one only fires when a `presentation.html` exists.

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
