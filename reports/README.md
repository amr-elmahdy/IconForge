# reports/

Every `iconforge build` creates a new folder in `runs/` named `<YYYYMMDD-HHMMSS>-<8 hex>` (UTC) containing
`summary.md`, `report.json`, `errors.json`, `changes.json` and `validation.json`.
Existing reports are never modified or deleted. The `runs/` contents are git-ignored by default.
