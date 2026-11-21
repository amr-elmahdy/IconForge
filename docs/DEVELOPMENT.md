# Development

```bash
npm install
npm run typecheck && npm run lint && npm test && npm run build
npm run dev -- build --dry-run --verbose     # run from sources via tsx
```
- Tests (`tests/`) use fixtures and a mock `fetch` (`tests/helpers.ts`); they never touch the network. Passing them does **not** prove the live source still matches; run `npm run icons` with a small list as a smoke test after dependency or source changes.
- Adding another source: create `src/sources/<name>/` exposing registry loading, name resolution and SVG download, then wire it in `pipeline.ts`. Nothing outside `src/sources/thesvg/` should mention theSVG URLs or field names (config holds the URLs).
- Changing SVG processing behavior: bump `PROCESSING_VERSION` in `src/core/types.ts` so existing outputs are reprocessed.
- Windows/macOS/Linux: paths use `node:path`; file names are lowercase kebab-case with no reserved characters.

## package-lock.json
This archive was assembled in an offline sandbox, so `package-lock.json` could not be generated honestly. Run `npm install` once and **commit the generated `package-lock.json`**; CI uses `npm ci` automatically when it exists.
