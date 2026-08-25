/**
 * QC rule catalog + default options.
 *
 * Kept separate from the qc-engine implementation so UI shells can render
 * the rule list without pulling the analysis code into the initial bundle.
 */

import type { AssTrack } from "./ass-parser"

export type QcSeverity = "error" | "warning" | "info"
export type QcCategory = "text" | "punctuation" | "timing" | "formatting" | "casing"

export interface QcRule {
    id: string
    name: string
    description: string
    category: QcCategory
    severity: QcSeverity
    enabled: boolean
    example?: string
}

export interface QcIssue {
    id: string
    lineIndex: number
    ruleId: string
    severity: QcSeverity
    category: QcCategory
    message: string
    original: string
    fixed: string | null
}

export interface QcResult {
    issues: QcIssue[]
    fixedTrack: AssTrack
    stats: {
        errors: number
        warnings: number
        info: number
        total: number
        fixable: number
    }
}

// ─── Rule Definitions (matching SubtitleEdit defaults) ───────────────────────
//
// Rules are ordered to match SubtitleEdit's "Fix common errors" dialog.
// The `enabled` field reflects SubtitleEdit's default checked state.

export const QC_RULES: QcRule[] = [
    // ── Text ─────────────────────────────────────────────────────────────────
    {
        id: "remove-empty-lines",
        name: "Remove Empty Lines",
        description: "Detect subtitle lines with no visible text content",
        category: "text",
        severity: "error",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: "Has only one valid line\\N<i></i> → Has only one valid line!"
    },
    {
        id: "fix-double-spaces",
        name: "Remove Unneeded Spaces",
        description: "Replace multiple consecutive spaces with a single space",
        category: "text",
        severity: "error",
        enabled: true
    },
    {
        id: "fix-leading-trailing-whitespace",
        name: "Fix Leading/Trailing Whitespace",
        description: "Remove leading and trailing spaces from each line",
        category: "text",
        severity: "error",
        enabled: true
    },
    {
        id: "fix-line-break-issues",
        name: "Fix Line Break Issues",
        description: "Clean up \\N at start/end of text and double \\N\\N",
        category: "text",
        severity: "error",
        enabled: true
    },
    {
        id: "fix-long-lines",
        name: "Break Long Lines",
        description: "Warn about lines exceeding the maximum character length",
        category: "text",
        severity: "warning",
        enabled: true
    },
    {
        id: "merge-short-lines",
        name: "Merge Short Lines",
        description: "Remove line breaks in short texts (all except dialogs)",
        category: "text",
        severity: "info",
        enabled: true
    },
    {
        id: "fix-three-plus-lines",
        name: "Fix Subtitles With More Than Two Lines",
        description: "Warn about subtitles with three or more lines",
        category: "text",
        severity: "warning",
        enabled: false // SubtitleEdit: UNCHECKED by default
    },

    // ── Punctuation ──────────────────────────────────────────────────────────
    {
        id: "fix-double-punctuation",
        name: "Remove Unneeded Periods",
        description: "Remove duplicate punctuation marks (.. → ., ,, → ,, etc.)",
        category: "punctuation",
        severity: "error",
        enabled: false // SubtitleEdit: UNCHECKED by default
    },
    {
        id: "fix-space-before-punctuation",
        name: "Fix Space Before Punctuation",
        description: "Remove spaces before . , ! ? : ;",
        category: "punctuation",
        severity: "error",
        enabled: true,
        example: "Hey , there. → Hey, there."
    },
    {
        id: "fix-missing-space-after-punctuation",
        name: "Fix Missing Spaces",
        description: "Add missing space after . , ! ? when followed by a word character",
        category: "punctuation",
        severity: "warning",
        enabled: true,
        example: "Hey,You. → Hey, You"
    },
    {
        id: "fix-commas",
        name: "Fix Commas",
        description: "Fix comma-related issues (double commas, misplaced commas)",
        category: "punctuation",
        severity: "error",
        enabled: true,
        example: ",-, → -,-"
    },
    {
        id: "fix-ellipsis",
        name: "Fix Ellipsis",
        description: "Convert three dots (...) to proper ellipsis character (…)",
        category: "punctuation",
        severity: "info",
        enabled: false // Not in SubtitleEdit defaults
    },
    {
        id: "fix-double-apostrophes",
        name: "Fix Double Apostrophes",
        description: "Fix double apostrophe characters ('') to a single quote (')",
        category: "punctuation",
        severity: "info",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: '"Has double single quotes" → "Has single double quote"'
    },
    {
        id: "split-dialog-on-one-line",
        name: "Split Dialogs on One Line",
        description: "Split single-line dialog with two speakers into two lines",
        category: "punctuation",
        severity: "info",
        enabled: true,
        example: "- Hi John! - Hi Ida! → - Hi John!\\N- Hi Ida!"
    },
    {
        id: "fix-missing-dialogue-dash",
        name: "Fix Dash in Dialog",
        description: "Add missing dash on second line when first line starts with a dash",
        category: "punctuation",
        severity: "info",
        enabled: false // SubtitleEdit: UNCHECKED by default
    },
    {
        id: "fix-missing-periods-at-end",
        name: "Add Period After Lines Before Uppercase",
        description: "Add period after lines where next line starts with uppercase letter",
        category: "punctuation",
        severity: "info",
        enabled: true,
        example: "Hello world\\NHello. → Hello world.\\NHello."
    },
    {
        id: "fix-double-dash",
        name: "Fix Double Dash",
        description: "Replace double dashes (--) with em-dashes (—)",
        category: "punctuation",
        severity: "info",
        enabled: true,
        example: "Hello--world → Hello—world"
    },

    // ── Timing ───────────────────────────────────────────────────────────────
    {
        id: "fix-overlapping-times",
        name: "Fix Overlapping Display Times",
        description: "Warn when a subtitle's end time overlaps the next subtitle's start time",
        category: "timing",
        severity: "warning",
        enabled: true
    },
    {
        id: "fix-short-duration",
        name: "Fix Short Display Times",
        description: "Warn about subtitles displayed for less than 500ms",
        category: "timing",
        severity: "warning",
        enabled: true
    },
    {
        id: "fix-long-duration",
        name: "Fix Long Display Times",
        description: "Warn about subtitles displayed for more than 10 seconds",
        category: "timing",
        severity: "warning",
        enabled: true
    },
    {
        id: "fix-short-gaps",
        name: "Fix Short Gaps",
        description: "Warn about gaps between subtitles shorter than the minimum",
        category: "timing",
        severity: "warning",
        enabled: true
    },

    // ── Formatting ───────────────────────────────────────────────────────────
    {
        id: "fix-unmatched-tags",
        name: "Fix Invalid Italic Tags",
        description: "Warn about unmatched ASS override tags (e.g., {\\b1} without {\\b0})",
        category: "formatting",
        severity: "warning",
        enabled: true,
        example: "<i>What do I care.</i> → <i>What do I care.</i>"
    },

    // ── Casing ───────────────────────────────────────────────────────────────
    {
        id: "fix-uppercase-after-paragraph",
        name: "Start With Uppercase After Paragraph",
        description: "Capitalize first letter of each subtitle line",
        category: "casing",
        severity: "info",
        enabled: false,
        example: "p1. Foobar! | p2. foobar → p1. Foobar! | p2. Foobar"
    },
    {
        id: "fix-uppercase-after-period",
        name: "Start With Uppercase After Period",
        description: "Capitalize first letter after a period inside a paragraph",
        category: "casing",
        severity: "info",
        enabled: false,
        example: "Hello there! how are you? → Hello there! How are you?"
    },
    {
        id: "fix-uppercase-after-colon",
        name: "Start With Uppercase After Colon",
        description: "Capitalize first letter after a colon or semicolon",
        category: "casing",
        severity: "info",
        enabled: false,
        example: "Speaker: hello world → Speaker: Hello world"
    },

    // ── SubtitleEdit Additional Rules ────────────────────────────────────────
    {
        id: "fix-hyphens-remove-dash-single-line",
        name: "Remove Dash in Single Line",
        description: "Remove dialogue dashes from single-line subtitles",
        category: "punctuation",
        severity: "info",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: "- Hello. → Hello."
    },
    {
        id: "remove-dialog-first-line-in-non-dialogs",
        name: "Remove Dialog First Line in Non-Dialogs",
        description: "Remove dash from first line if second line has no dash",
        category: "punctuation",
        severity: "info",
        enabled: true, // SubtitleEdit: CHECKED by default
        example: "- Hello.\\NWorld. → Hello.\\NWorld."
    },
    {
        id: "fix-double-greater-than",
        name: "Fix Double Greater-Than (>>)",
        description: "Replace double greater than (>>) with single (>)",
        category: "punctuation",
        severity: "warning",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: ">> Hello → > Hello"
    },
    {
        id: "fix-music-notation",
        name: "Fix Music Notation",
        description: "Convert text music markers to music note symbols (♪)",
        category: "punctuation",
        severity: "info",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: "# Singing # → ♪ Singing ♪"
    },
    {
        id: "fix-missing-open-bracket",
        name: "Fix Missing Open Bracket",
        description: "Add missing opening bracket when a closing one exists",
        category: "formatting",
        severity: "warning",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: "Hello) → (Hello)"
    },
    {
        id: "fix-missing-close-bracket",
        name: "Fix Missing Close Bracket",
        description: "Add missing closing bracket when an opening one exists",
        category: "formatting",
        severity: "warning",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: "[Hello → [Hello]"
    },
    {
        id: "fix-unnecessary-leading-dots",
        name: "Fix Unnecessary Leading Dots",
        description: "Remove unneeded periods at the start of lines",
        category: "punctuation",
        severity: "info",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: ". Hello → Hello"
    },
    {
        id: "remove-space-between-numbers",
        name: "Remove Space Between Numbers",
        description: "Remove spaces between digits in a number",
        category: "text",
        severity: "info",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: "1 000 → 1000"
    },
    {
        id: "fix-continuation-style",
        name: "Fix Continuation Style",
        description: "Fix redundant ellipsis at start of continuation lines",
        category: "punctuation",
        severity: "info",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: "Line 1...\\N...Line 2 → Line 1...\\NLine 2"
    },
    {
        id: "normalize-strings",
        name: "Normalize Strings",
        description: "Clean up non-standard string markers and control chars",
        category: "text",
        severity: "info",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: "Really!?! → Really!?"
    },
    {
        id: "fix-alone-lowercase-i",
        name: "Fix Alone Lowercase 'i'",
        description: "Capitalize standalone 'i' to 'I'",
        category: "casing",
        severity: "info",
        enabled: false, // Disabled by default
        example: "i think → I think"
    },
    {
        id: "fix-turkish-ansi",
        name: "Fix Turkish ANSI",
        description: "Replace legacy Turkish ANSI characters with proper Unicode equivalents",
        category: "text",
        severity: "error",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: "Ýstanbul → İstanbul"
    },
    {
        id: "fix-spanish-inverted-marks",
        name: "Fix Spanish Inverted Marks",
        description: "Prepend inverted question (¿) or exclamation (¡) in Spanish",
        category: "punctuation",
        severity: "info",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: "Hola! → ¡Hola!"
    },
    {
        id: "add-missing-quotes",
        name: "Add Missing Quotes",
        description: "Balance unclosed double quotes",
        category: "punctuation",
        severity: "warning",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: '"Hello → "Hello"'
    },
    {
        id: "fix-unneeded-period-after-abbreviation",
        name: "Fix Period After Abbreviation",
        description: "Remove period after common abbreviations followed by lowercase letter",
        category: "punctuation",
        severity: "info",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: "Mr. smith → Mr smith"
    },
    {
        id: "fix-uppercase-i-inside-words",
        name: "Fix Uppercase 'I' Inside Words",
        description: "Fix lowercase words containing uppercase 'I' (OCR artifact)",
        category: "casing",
        severity: "warning",
        enabled: false, // SubtitleEdit: UNCHECKED by default
        example: "thIs → this"
    }
]

export interface QcOptions {
    maxLineLength: number
    maxDurationMs: number
    minDurationMs: number
    minGapMs: number
    convertEllipsis: boolean
    enabledRules: Set<string>
}

export const DEFAULT_QC_OPTIONS: QcOptions = {
    maxLineLength: 42,
    maxDurationMs: 10_000,
    minDurationMs: 500,
    minGapMs: 24,
    convertEllipsis: true,
    enabledRules: new Set(QC_RULES.filter(r => r.enabled).map(r => r.id))
}
