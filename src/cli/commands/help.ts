export const HELP_TEXT = `IconForge - fetch brand SVG icons from theSVG, clean them conservatively, and emit stable metadata.

Usage:
  iconforge <command> [options]

Commands:
  build        Read input/icons.txt, fetch + process icons, write output/ and a new report
  validate     Validate output/ (SVG files, icons.json, manifest.json, hashes)
  info         Show what is in output/, the last run and the cache
  clean-cache  Delete cached downloads (cache/); output/ and reports/ are never touched
  help         Show this help

Options:
  --input <path>   Use another input file (default: input/icons.txt)
  --dry-run        Preview: nothing is written to output/ or cache/ (a report is still created)
  --force          Re-download and reprocess everything requested
  --no-optimize    Skip SVGO (normalize + sanitize only)
  --verbose        Detailed logs
  -h, --help       Show help
  -v, --version    Show version

Exit codes:
  0 success   1 some icons failed   2 completed with warnings   3 fatal error (input, config, registry, usage)
`;
