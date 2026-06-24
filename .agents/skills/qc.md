# Quality Control (QC)

Check subtitle files for common quality issues before delivery.

## Checks Performed

### 1. Reading Speed

- **Maximum CPS**: 20 characters per second (Netflix standard)
- **Optimal CPS**: 15-17 CPS
- Flags subtitles that are too fast to read comfortably

### 2. Line Length

- **Maximum visual length**: 42 characters per line
- **Optimal**: 32-38 characters for readability
- Considers non-spacing marks and diacritics

### 3. Duration Validation

- **Minimum duration**: 0.8 seconds (800ms)
- **Maximum duration**: 7 seconds
- Flags too-short or too-long subtitles

### 4. Timing Issues

- **Minimum gap**: 2 frames (83ms @ 24fps)
- **Snap threshold**: Gaps < 200ms suggest missing snap
- Detects overlapping subtitles
- Checks for negative durations

### 5. Formatting Issues

- Unbalanced HTML tags (`<i>` without `</i>`)
- Mixed case in HTML tags (`<I>` vs `<i>`)
- Uppercase HTML tags (should be lowercase)
- Double spaces or excessive whitespace
- Missing punctuation at end of sentences
- Inconsistent ellipsis (`..` vs `...`)

### 6. Typography Issues

- Curly quotes (`"` `"`) instead of straight quotes
- Smart apostrophes (`'` `'`) instead of straight
- Em/en dashes without proper spacing
- Unicode normalization issues

### 7. Content Validation

- Empty subtitle lines
- Subtitles with only whitespace
- Very short subtitles (< 2 characters)
- Subtitles starting/ending with spaces

## Output Format

QC report includes:

- **Critical**: Issues that break playback or readability
- **Warning**: Issues that reduce quality
- **Info**: Style suggestions

Each issue reports:

- Line number
- Timestamp
- Issue description
- Current value vs recommended
- Suggestion for fix

## Usage

Invoke with `/qc` followed by optional parameters:

```
/qc                          # Check current file
/qc --strict                 # Enable stricter thresholds
/qc --cps=18                # Custom CPS limit
/qc --line-length=40        # Custom line length
/qc --export-report         # Generate JSON report
```

## Integration with Fixer

QC checks are based on the same standards as the Thai subtitle fixer:

- Visual length calculation (ignores non-spacing marks)
- Line balancing recommendations
- Reading speed optimization
- Netflix-style formatting standards
