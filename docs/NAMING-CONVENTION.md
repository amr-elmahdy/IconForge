# Naming convention

| Source variant | File |
|---|---|
| `default` | `<slug>.svg` |
| `mono` | `<slug>-mono.svg` |
| `wordmarkLight` | `<slug>-wordmark-light.svg` |
| `iconDark` | `<slug>-icon-dark.svg` |
| `16` | `<slug>-16.svg` |

Variant names are converted camelCase → lowercase kebab-case (`[^a-z0-9]` → `-`). The original variant name is kept in metadata (`variant`).
Slugs must match `^[a-z0-9][a-z0-9._-]*$` (otherwise the icon is rejected as unsafe).
Collisions (e.g. slug `foo` + variant `mono` vs slug `foo-mono`) are detected: the first one keeps the name, the others are reported as `FILENAME_COLLISION` and skipped. Names owned by earlier runs are respected.
Variants observed in the live registry include `default, mono, light, dark, color, wordmark, wordmarkLight, wordmarkDark, icon, iconDark, line, refresh` and numeric ones (`16, 32, 64`); IconForge does not assume any of them exists.
