# Convert ASS

## Core ASS Parsing Rules

- Follows `libass/ass.c` logic.
- Fields in `[V4+ Styles]` and `[Events]` are ordered by the preceding `Format:` line.
- The `Text` field in an event is ALWAYS the last field and consumes all remaining text (including commas).
- Timestamps: `H:MM:SS.CC` (CC is centiseconds).
- Colors: `&HAABBGGRR` (note: libass byteswaps these).

## Tag Overrides

- Tags are enclosed in `{...}` and prefixed with `\`.
- Unknown text inside `{}` (not starting with `\`) is ignored (useful for comments).
- Coordinate tags use parentheses: `\pos(x,y)`, `\move(x1,y1,x2,y2)`.

## Modes

1. **Normal SRT**: Converts basic tags (`\b`, `\i`, `\u`, `\s`) to HTML (`<b>`, etc.). Strips all other tags.
2. **Keep TS**: Preserves ALL override tags (e.g., `{\pos(10,10)\c&HFFFFFF&}`) verbatim into the SRT output. Ensures `{\anN}` is present. Intended for libass players (like mpv) that can render ASS tags from SRT.
3. **Resample TS**: Rescales all coordinate-based tags (`\pos`, `\clip`, `\fs`, `\bord`, margins) based on source vs target resolution (`PlayResX/Y`). Outputs `.ass` or `.srt`.
