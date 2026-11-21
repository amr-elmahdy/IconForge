# Using the output in Charmly

IconForge does not read or modify Charmly, and no Charmly contract was assumed. `manifest.json` is a general-purpose entry point:

```jsonc
{
  "schemaVersion": 1,
  "iconsDir": "../icons",
  "icons": [
    { "slug": "react", "title": "React",
      "variants": [ { "variant": "default", "filename": "react.svg", "sha256": "…" },
                    { "variant": "mono",    "filename": "react-mono.svg", "sha256": "…" } ] }
  ]
}
```
Lookup is by **slug + original variant name** (`default`, `mono`, `wordmarkLight`, …).

Suggested hand-off (run in Charmly's repo, adjust paths):
1. Copy `output/icons/` and `output/metadata/manifest.json` (plus `icons.json` if you need colors/licenses) into Charmly, e.g. `data/icons/`.
2. At build time read `manifest.json`, then for each `{slug, variant, filename}` read the SVG file and inline it (Charmly's `build-icons.js` is the natural place).
3. Verify integrity with `sha256` if desired; reject a manifest whose `schemaVersion` you don't know.
4. Check `source.license` / `NOTICE.md` before shipping icons publicly: licenses are mixed and never verified.

Because filenames are stable (`<slug>.svg`, `<slug>-<kebab-variant>.svg`) and hashes only change when content changes, diffs between builds are small and reviewable.
