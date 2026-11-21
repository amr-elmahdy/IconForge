# Metadata

`output/metadata/icons.json`: `{ schemaVersion, iconforgeVersion, generatedAt, icons: [...] }`, one record per file, sorted by slug then variant. Schema: `src/processors/metadata/schema.ts`.

| Field | Source |
|---|---|
| `slug, title, aliases, categories, brandColorHex (registry `hex`)` | registry |
| `variant`, `filename` | registry variant / naming rule |
| `collection` | always `null` in v1 (registry has no such field) |
| `source.repository, source.revision` | config / GitHub commit SHA if reachable, else `null` |
| `source.url, source.guidelinesUrl, source.license` | registry (`null` if absent) |
| `source.licenseVerified` | always `false` |
| `source.downloadUrl, source.registrySha256` | the URL that served the file / hash of the registry used |
| `svg.viewBox, width, height, colors, usesCurrentColor` | analysis of the final SVG |
| `file.size, file.sha256`, `originalSha256` | processed file / original download |
| `processing.*` | flags + `processingVersion` + `entryFingerprint` (used for skip logic) |

`manifest.json`: `schemaVersion, iconforgeVersion, generatedAt, source{repository, commitSha, registrySha256, registryTotal}, counts{icons, files, variants}, metadata{icons}, iconsDir, icons[{slug, title, variants[{variant, filename, sha256}]}]`.
Both files are rewritten only when their content (ignoring `generatedAt`) changes. A record keeps the source revision of the run that last (re)processed that file.
Evolving the format: bump `schemaVersion`; consumers should reject unknown major versions.
