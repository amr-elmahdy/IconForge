# Reports

Each run creates `reports/runs/<YYYYMMDD-HHMMSS>-<8 hex>/` (UTC time + random suffix; created with a non-recursive `mkdir`, so an existing folder is never reused).
- `summary.md` – human summary: time, duration, requested/found/downloaded/processed/validated/failed counts, warnings, final status, source revision.
- `report.json` – full run data incl. every file (`new | updated | unchanged | failed`, whether it was downloaded, notes).
- `errors.json` – `{ code, stage, icon, variant, message, recoverable }` per error.
- `changes.json` – new/updated/unchanged files, stale variants, metadata changes, whether metadata/manifest were rewritten.
- `validation.json` – results of the output validation (SVG, `icons.json`, `manifest.json`, hashes, orphan files); `{skipped: true}` for dry runs.

A report is written even when the run fails fatally (status `failed`, exit code 3). Reports are never modified or deleted by IconForge.
Statuses: `success`, `completed_with_warnings`, `completed_with_errors`, `failed`.
Error codes you may see: `ICON_NOT_FOUND, ALIAS_AMBIGUOUS, HTTP_<status>, NETWORK, NOT_SVG, SVG_PARSE_ERROR, SVG_FORBIDDEN_ELEMENT, SVG_EXTERNAL_REFERENCE, SVG_JS_URL, SVG_VISUAL_DRIFT, SVG_INVALID, SVG_TOO_LARGE, FILENAME_COLLISION, UNSAFE_SLUG, REGISTRY_*, INPUT_*, OUTPUT_VALIDATION_FAILED`.
