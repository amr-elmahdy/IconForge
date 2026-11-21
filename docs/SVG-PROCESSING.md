# SVG processing

Pipeline per file (`src/processors/svg/process.ts`):
1. **Size guard** (`processing.maxFileBytes`).
2. **XML parse** (sax). Malformed XML, multiple roots, entity declarations ⇒ rejected (`SVG_PARSE_ERROR`).
3. **Structure/visual fingerprint** of the original: counts of shapes/gradients/clip paths/masks/filters, `viewBox`, explicit colors.
4. **Normalize:** add missing `xmlns` on `<svg>`; drop comments, DOCTYPE, XML declaration, insignificant whitespace (text-bearing elements keep theirs). Attribute order and values are preserved.
5. **Sanitize** (non-destructive, logged): removes `<script>`, `on*` handlers, external `<a href>`.
   **Rejects** (never silently alters): `foreignObject`, `iframe/embed/object/audio/video/canvas`, `javascript:` URLs, external `href`/`url(...)`/`@import`, CSS `expression()`, `<set>/<animate>` targeting `href`. Allowed: `#id` refs and `data:image/...` URIs.
6. **Optimize** (SVGO, optional): `removeDoctype, removeXMLProcInst, removeComments, removeMetadata, removeEditorsNSData, cleanupAttrs`; `multipass` off. No path/ID/viewBox/color changes.
7. **Serialize** deterministically; **re-parse** and compare the fingerprint with the original (`SVG_VISUAL_DRIFT` if different). If only the optimizer changed structure it is reverted with a note.
8. **Final validation** (`root=<svg>`, xmlns, viewBox or width+height, ≥1 shape, no script/handlers) and **SHA-256**.

IconForge never converts colors to `currentColor`, never adds fill/stroke, never recolors for light/dark, never derives missing variants.
`svg.colors` lists only colors written explicitly in the file (attributes, inline style, `<style>` declarations); an icon with no explicit fill shows `colors: []` even though it renders black.
