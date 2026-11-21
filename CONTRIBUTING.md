# Contributing

1. Fork and clone, then `npm install`.
2. Create a branch. Keep changes focused.
3. Before opening a PR run: `npm run typecheck && npm run lint && npm test && npm run build`.
4. Add or update tests for behavior changes. Tests must not use the real network (use the mock server in `tests/helpers.ts`).
5. Update `CHANGELOG.md` and the relevant file in `docs/`.

Rules that must keep holding (see `docs/ARCHITECTURE.md`): never change an icon's look, never delete user files, never overwrite old reports, keep source-specific code inside `src/sources/thesvg/`, never invent metadata.
