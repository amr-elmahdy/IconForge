# Security Policy

## Supported versions
Only the latest release receives fixes.

## Reporting a vulnerability
Please do not open a public issue. Use GitHub's private vulnerability reporting ("Security" tab → "Report a vulnerability") on the repository.
Include the affected version, a description, and a reproduction (for SVG-handling issues, a minimal SVG file).

## Scope notes
IconForge downloads third-party SVG files and sanitizes them: scripts, event handlers and external links are removed (and logged);
`foreignObject`, external resource references, `javascript:` URLs and entity declarations cause the file to be rejected.
It does not execute SVG content. It makes network requests only to the configured source hosts and an optional GitHub commit lookup.
