# input/

`icons.txt` is the only file you normally edit.

- One icon name per line (theSVG **slug**, or an alias that points to exactly one slug).
- `#` starts a comment line. Empty lines and extra spaces are ignored.
- Duplicates are detected and ignored with a warning (with line numbers).
- Unknown names are reported as errors with their line number; the rest of the list is still processed.
- IconForge never modifies this file.

Use another file with `iconforge build --input path/to/list.txt`.
