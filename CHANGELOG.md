# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: SemVer.

## [1.0.0] - 2026-11-21
### Added
- `iconforge build | validate | info | clean-cache | help` with `--verbose --dry-run --force --no-optimize --input`.
- theSVG source adapter (registry + SVG download with mirror fallback, retry/timeout/rate-limit handling, cached-registry fallback).
- SVG pipeline: XML parsing, structure validation, color analysis, normalization, safe sanitization, conservative SVGO, final validation, SHA-256.
- Flat `output/icons/`, `output/metadata/icons.json`, `output/metadata/manifest.json` (schema version 1).
- Per-run reports in `reports/runs/<run-id>/`, never overwritten.
- Hash-based skip logic, atomic writes, never-delete policy.
