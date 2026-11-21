# Architecture

```
input/icons.txt → input/reader → sources/thesvg (registry, discovery, download)
   → processors/svg (xml → analyzer → normalizer → sanitizer → optimizer → validate)
   → processors/metadata → output (naming, writer, manifest) → validators/output-validator
   → reports (report-builder, report-manager)
```
`src/pipeline/pipeline.ts` orchestrates one run; `src/cli/` is a thin layer over it.

| Folder | Responsibility |
|---|---|
| `src/core` | config (zod), context (paths, fetch, logger), errors, types/constants |
| `src/input` | parse the input list |
| `src/sources/thesvg` | **the only code that knows theSVG**: registry schema, HTTP client (timeout/retry/Retry-After), index + alias lookup, discovery, SVG download with CDN fallback |
| `src/processors/svg` | parse (sax), analyze, normalize, sanitize, optimize (SVGO), full per-file pipeline |
| `src/processors/metadata` | zod schemas (`schemaVersion`) and record generation |
| `src/output` | file naming + collision detection, atomic writer, manifest |
| `src/validators` | SVG and on-disk output validation |
| `src/reports` | per-run report folders |
| `src/utils` | hashing, atomic filesystem helpers, concurrency + retry |

## Design decisions (where the spec left room)
- **XML parsing:** `sax` (strict, predefined entities only). No regex is used to parse markup.
- **Source facts only:** `collection` is `null` because the registry has no such field; license is the registry string and never "verified".
- **Skip logic:** fingerprint = hash(registry entry + processing version + optimize flag). Same fingerprint + output present with the recorded hash ⇒ skip with no network. Raw SVGs are cached and reused when the entry is unchanged.
- **Failure isolation:** each file succeeds or fails alone; previous records stay in `icons.json`. Metadata/manifest are rewritten only if their content (ignoring `generatedAt`) changed.
- **Warnings exit code 2:** distinguishes "done but look at the report" from clean success. Use `|| [ $? -eq 2 ]` in scripts that treat warnings as success.
- **Dependencies:** `sax`, `svgo`, `zod` at runtime; TypeScript, Vitest, ESLint (+typescript-eslint), tsx for development.
