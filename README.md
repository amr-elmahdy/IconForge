# IconForge

[![CI](https://github.com/amr-elmahdy/IconForge/actions/workflows/ci.yml/badge.svg)](https://github.com/amr-elmahdy/IconForge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A standalone local CLI that pulls **brand SVG icons from [theSVG](https://thesvg.org)**, cleans them conservatively
(without changing how they look), and writes a stable, flat output folder plus `icons.json` / `manifest.json`
that another project (for example Charmly) can consume.

> No web UI. No dependency on GitHub Actions or a GitHub account. Everything runs from your terminal.

## Requirements
- Node.js **20+** and npm
- Internet access when running `build` (the registry and SVGs are downloaded; a cached registry is used if the network is down)

## Quick start
```bash
npm install

# 1. add icon names (one per line) to input/icons.txt
# 2. build the collection
npm run icons
```
Result: SVGs in `output/icons/`, metadata in `output/metadata/`, and a new report in `reports/runs/<run-id>/`.

Other scripts: `npm test` · `npm run build` (compile to `dist/`) · `npm run typecheck` · `npm run lint`.
After `npm run build` you can also run `node dist/cli/index.js build` (or `npm link` to get an `iconforge` command).

## Input: `input/icons.txt`
```
# Programming Languages
react
typescript

# Tools
github
```
One name per line (a theSVG slug, or an alias that points to exactly one slug); `#` comments, blank lines and spaces are ignored;
duplicates are reported; unknown names are reported **with their line number**; IconForge never edits this file.
You never write URLs, extensions or variant names.

## Commands
| Command | What it does |
|---|---|
| `iconforge build` | Fetch + process everything in the input list, write output, create a report |
| `iconforge validate` | Validate `output/` (SVGs, `icons.json`, `manifest.json`, hashes, orphan files) |
| `iconforge info` | Show manifest summary, number of reports, cache contents |
| `iconforge clean-cache` | Delete `cache/` contents (never `output/` or `reports/`) |
| `iconforge help` | Usage |

Options: `--input <path>` · `--dry-run` · `--force` · `--no-optimize` · `--verbose` · `-h/--help` · `-v/--version`.
- `--dry-run`: downloads and processes in memory, writes nothing to `output/` or `cache/`; a report is still created (flagged `dryRun`).
- `--force`: re-download and reprocess everything requested.
- `--no-optimize`: skip SVGO (normalize + sanitize only).

**Exit codes:** `0` success · `1` some icons failed · `2` completed with warnings · `3` fatal (usage, config, input, registry unavailable).

## Output
```
output/
├── icons/                 # ONE flat folder, no per-icon subfolders
│   ├── react.svg          # default variant
│   ├── react-mono.svg
│   ├── react-wordmark-light.svg
│   └── github.svg
└── metadata/
    ├── icons.json         # full per-file metadata
    └── manifest.json      # light entry point for other tools
```
All variants that **actually exist** for an icon are downloaded; nothing is generated, recolored or converted.
Naming rules: `docs/NAMING-CONVENTION.md`. Metadata/manifest fields: `docs/METADATA.md`.

## Reports
Every run creates `reports/runs/<YYYYMMDD-HHMMSS>-<8hex>/` with `summary.md`, `report.json`, `errors.json`, `changes.json`, `validation.json`.
Old reports are never changed or deleted. Details: `docs/REPORTS.md`.

## Updates, cache and safety
- Unchanged icons are skipped (same source entry + same processing config + intact output file) without any download.
- Writes are atomic; a failed download/processing never overwrites a healthy file or its metadata record.
- IconForge never deletes files. Variants that disappear upstream are listed as *stale* in `changes.json` and kept locally.
- Icons outside the current input list are left untouched in `output/` and `icons.json`.

## Configuration
Defaults live in `config/default.json`. Put overrides in `iconforge.config.json` in the directory you run from (sections `source`, `network`, `processing` are merged key by key):
```json
{ "network": { "concurrency": 2 }, "processing": { "optimize": true } }
```

## Licensing and trademarks
IconForge's code is MIT. The **icons are not**: they have mixed licenses and are trademarks of their owners.
IconForge records the registry's license string as-is and always sets `licenseVerified: false`. Read `NOTICE.md`.

## Using the output in Charmly
See `docs/CHARMLY-INTEGRATION.md`.

## Known limitations (v1)
- Only theSVG is supported (the source is isolated in `src/sources/thesvg/` for future adapters).
- theSVG's registry has no collection field, so `collection` is `null`; AWS/Azure/badge-style slugs trigger a warning but are processed because you asked for them by name.
- Optimization uses SVGO with a deliberately tiny plugin set and is reverted automatically if it changes the icon's structure.
