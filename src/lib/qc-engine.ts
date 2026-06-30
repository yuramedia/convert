/**
 * QC Engine — Subtitle Quality Check
 *
 * Matches SubtitleEdit's "Fix Common Errors" default rule set.
 * Detects and auto-fixes common subtitle issues across:
 * - Text (empty lines, double spaces, whitespace, line breaks, short lines, long lines)
 * - Punctuation (double punctuation, spacing, ellipsis, double apostrophes, dialogue)
 * - Timing (short/long duration, overlapping, short gaps)
 * - Formatting (unmatched ASS override tags)
 * - Casing (uppercase after paragraph, period, colon)
 *
 * The engine never mutates the input track. It returns a list of issues
 * and a cloned, fixed track with all auto-fixable issues applied.
 */

import { type AssTrack, type AssEvent } from "./ass-parser"

// ─── Types ───────────────────────────────────────────────────────────────────

export type QcSeverity = "error" | "warning" | "info"
export type QcCategory = "text" | "punctuation" | "timing" | "formatting" | "casing"

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

export interface QcRule {
    id: string
    name: string
    description: string
    category: QcCategory
    severity: QcSeverity
    enabled: boolean
    example?: string
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

export interface QcOptions {
    maxLineLength: number
    maxDurationMs: number
    minDurationMs: number
    minGapMs: number
    convertEllipsis: boolean
    enabledRules: Set<string>
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

// ─── Default Options ─────────────────────────────────────────────────────────

export const DEFAULT_QC_OPTIONS: QcOptions = {
    maxLineLength: 42,
    maxDurationMs: 10_000,
    minDurationMs: 500,
    minGapMs: 24,
    convertEllipsis: true,
    enabledRules: new Set(QC_RULES.filter(r => r.enabled).map(r => r.id))
}

// ─── Utility: strip ASS override tags for text analysis ──────────────────────

/**
 * Strip ASS override tags `{...}` from text for measuring visible content.
 * Preserves `\N` line breaks.
 */
export function stripOverrideTags(text: string): string {
    return text.replace(/\{[^}]*\}/g, "")
}

/**
 * Split text by ASS line breaks `\N` into visible lines.
 */
function splitLines(text: string): string[] {
    return text.split("\\N")
}

// ─── Individual Rule Checkers ────────────────────────────────────────────────

function checkEmptyLines(event: AssEvent, index: number): QcIssue | null {
    const visible = stripOverrideTags(event.Text).replace(/\\N/g, "").trim()
    if (visible.length === 0 && event.Text.length > 0) {
        return {
            id: `empty-${index}`,
            lineIndex: index,
            ruleId: "remove-empty-lines",
            severity: "error",
            category: "text",
            message: "Empty subtitle line with no visible text",
            original: event.Text,
            fixed: "" // signals removal
        }
    }
    return null
}

function checkDoubleSpaces(event: AssEvent, index: number): QcIssue | null {
    // Only check outside override tags
    const hasDoubleSpace = /\{[^}]*\}/.test(event.Text)
        ? stripOverrideTags(event.Text).includes("  ")
        : event.Text.includes("  ")

    if (hasDoubleSpace) {
        // Fix: replace multiple spaces with single, but preserve spaces inside override tags
        const fixed = fixOutsideTags(event.Text, t => t.replace(/ {2,}/g, " "))
        return {
            id: `dblspace-${index}`,
            lineIndex: index,
            ruleId: "fix-double-spaces",
            severity: "error",
            category: "text",
            message: "Multiple consecutive spaces found",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkLeadingTrailingWhitespace(event: AssEvent, index: number): QcIssue | null {
    const lines = splitLines(event.Text)
    let needsFix = false

    for (const line of lines) {
        // Strip override tags at start to check for leading whitespace after tags
        const afterTags = line.replace(/^(\{[^}]*\})+/, "")
        if (afterTags !== afterTags.trimStart() || line !== line.trimEnd()) {
            needsFix = true
            break
        }
    }

    if (needsFix) {
        const fixedLines = lines.map(line => {
            // Preserve leading override tags, trim the rest
            const tagMatch = line.match(/^((?:\{[^}]*\})*)(.*)$/)
            if (tagMatch) {
                return tagMatch[1] + tagMatch[2].trim()
            }
            return line.trim()
        })
        const fixed = fixedLines.join("\\N")

        if (fixed !== event.Text) {
            return {
                id: `ws-${index}`,
                lineIndex: index,
                ruleId: "fix-leading-trailing-whitespace",
                severity: "error",
                category: "text",
                message: "Leading or trailing whitespace detected",
                original: event.Text,
                fixed
            }
        }
    }
    return null
}

function checkEllipsis(event: AssEvent, index: number, convert: boolean): QcIssue | null {
    if (!convert) return null

    const hasThreeDots = stripOverrideTags(event.Text).includes("...")
    if (hasThreeDots) {
        const fixed = fixOutsideTags(event.Text, t => t.replace(/\.{3}/g, "…"))
        return {
            id: `ellipsis-${index}`,
            lineIndex: index,
            ruleId: "fix-ellipsis",
            severity: "info",
            category: "punctuation",
            message: "Three dots (...) can be replaced with ellipsis (…)",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkDoublePunctuation(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text)
    // Match repeated punctuation (but not "..." which is handled by ellipsis rule, and not "…")
    const hasDouble = /(?<!\.)\.\.(?!\.)|,,|!!|\?\?/.test(text)

    if (hasDouble) {
        const fixed = fixOutsideTags(event.Text, t => {
            return t
                .replace(/(?<!\.)\.\.(?!\.)/g, ".")
                .replace(/,,+/g, ",")
                .replace(/!!+/g, "!")
                .replace(/\?\?+/g, "?")
        })
        return {
            id: `dblpunct-${index}`,
            lineIndex: index,
            ruleId: "fix-double-punctuation",
            severity: "error",
            category: "punctuation",
            message: "Duplicate punctuation marks detected",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkSpaceBeforePunctuation(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text)
    const hasSpaceBefore = / +[.,!?;:]/.test(text) && !/ +\.\.\./.test(text) && !/ +…/.test(text)

    if (hasSpaceBefore) {
        const fixed = fixOutsideTags(event.Text, t => {
            return t.replace(/ +([.,!?;:])/g, "$1")
        })

        if (fixed !== event.Text) {
            return {
                id: `spbefore-${index}`,
                lineIndex: index,
                ruleId: "fix-space-before-punctuation",
                severity: "error",
                category: "punctuation",
                message: "Space before punctuation mark",
                original: event.Text,
                fixed
            }
        }
    }
    return null
}

function checkMissingSpaceAfterPunctuation(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text)
    const hasMissing = /[.,!?][A-Za-zÀ-ÿ]/.test(text) && !/\d[.,]\d/.test(text)

    if (hasMissing) {
        const fixed = fixOutsideTags(event.Text, t => {
            return t.replace(/([.,!?])([A-Za-zÀ-ÿ])/g, (match, punct, letter) => {
                const idx = t.indexOf(match)
                if (idx > 0 && /\d/.test(t[idx - 1]) && (punct === "." || punct === ",")) {
                    return match
                }
                return `${punct} ${letter}`
            })
        })

        if (fixed !== event.Text) {
            return {
                id: `spafter-${index}`,
                lineIndex: index,
                ruleId: "fix-missing-space-after-punctuation",
                severity: "warning",
                category: "punctuation",
                message: "Missing space after punctuation",
                original: event.Text,
                fixed
            }
        }
    }
    return null
}

function checkCommas(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text)
    // Fix comma at start of line, comma-dash or dash-comma issues
    const hasCommaIssue = text.startsWith(",") || /,-/.test(text) || /-,/.test(text)

    if (hasCommaIssue) {
        const fixed = fixOutsideTags(event.Text, t => {
            return t
                .replace(/^,\s*/, "") // Remove leading comma
                .replace(/,-/g, " -") // comma-dash → space-dash
                .replace(/-,/g, "-") // dash-comma → dash
        })

        if (fixed !== event.Text) {
            return {
                id: `comma-${index}`,
                lineIndex: index,
                ruleId: "fix-commas",
                severity: "error",
                category: "punctuation",
                message: "Comma issue detected",
                original: event.Text,
                fixed
            }
        }
    }
    return null
}

function checkDoubleApostrophes(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text)
    if (text.includes("''")) {
        const fixed = fixOutsideTags(event.Text, t => t.replace(/''/g, '"'))
        return {
            id: `dblapost-${index}`,
            lineIndex: index,
            ruleId: "fix-double-apostrophes",
            severity: "info",
            category: "punctuation",
            message: "Double apostrophes ('') found — converted to quote (\")",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkSplitDialogOnOneLine(event: AssEvent, index: number): QcIssue | null {
    const lines = splitLines(event.Text)
    // Only process single-line subtitles
    if (lines.length !== 1) return null

    const text = stripOverrideTags(event.Text)
    // Pattern: "- text - text" on a single line (two speakers)
    // Match starts with dash, followed by text, then space, then second speaker starting with dash
    const dialogMatch = text.match(/^([-–—])\s*(.+?)\s+([-–—]\s+.+)/)
    if (!dialogMatch) return null

    const firstDash = dialogMatch[1]
    const firstText = dialogMatch[2]
    const secondSpeaker = dialogMatch[3]

    // Construct the parts
    const firstPart = `${firstDash} ${firstText}`
    const secondPart = secondSpeaker

    // Preserve any leading override tags
    const tagPrefix = event.Text.match(/^((?:\{[^}]*\})*)/)?.[1] || ""
    const fixed = tagPrefix + firstPart + "\\N" + secondPart

    return {
        id: `splitdlg-${index}`,
        lineIndex: index,
        ruleId: "split-dialog-on-one-line",
        severity: "info",
        category: "punctuation",
        message: "Two-speaker dialog on single line — split into two lines",
        original: event.Text,
        fixed
    }
}

function checkThreePlusLines(event: AssEvent, index: number): QcIssue | null {
    const lineCount = splitLines(event.Text).length
    if (lineCount >= 3) {
        return {
            id: `3lines-${index}`,
            lineIndex: index,
            ruleId: "fix-three-plus-lines",
            severity: "warning",
            category: "text",
            message: `Subtitle has ${lineCount} lines (recommended max: 2)`,
            original: event.Text,
            fixed: null
        }
    }
    return null
}

function checkLongLines(event: AssEvent, index: number, maxLength: number): QcIssue | null {
    const lines = splitLines(event.Text)
    for (const line of lines) {
        const visible = stripOverrideTags(line).trim()
        if (visible.length > maxLength) {
            return {
                id: `longline-${index}`,
                lineIndex: index,
                ruleId: "fix-long-lines",
                severity: "warning",
                category: "text",
                message: `Line has ${visible.length} characters (max: ${maxLength})`,
                original: event.Text,
                fixed: null
            }
        }
    }
    return null
}

function checkMergeShortLines(event: AssEvent, index: number, maxLength: number): QcIssue | null {
    const lines = splitLines(event.Text)
    if (lines.length < 2) return null

    // Don't merge dialog lines (lines starting with dash)
    const visibleLines = lines.map(l => stripOverrideTags(l).trim())
    const isDialog = visibleLines.some(l => /^[-–—]/.test(l))
    if (isDialog) return null

    // Check if merged text would fit on one line
    const mergedVisible = visibleLines.join(" ")
    if (mergedVisible.length <= maxLength) {
        // Merge lines by replacing \N with space
        const fixed = fixOutsideTags(event.Text, t => t.replace(/\\N/g, " "))
        if (fixed !== event.Text) {
            return {
                id: `mergeshort-${index}`,
                lineIndex: index,
                ruleId: "merge-short-lines",
                severity: "info",
                category: "text",
                message: `Short lines can be merged (${mergedVisible.length} chars, max: ${maxLength})`,
                original: event.Text,
                fixed
            }
        }
    }
    return null
}

function checkLongDuration(event: AssEvent, index: number, maxMs: number): QcIssue | null {
    const duration = event.End - event.Start
    if (duration > maxMs) {
        const seconds = (duration / 1000).toFixed(1)
        return {
            id: `longdur-${index}`,
            lineIndex: index,
            ruleId: "fix-long-duration",
            severity: "warning",
            category: "timing",
            message: `Duration is ${seconds}s (max: ${(maxMs / 1000).toFixed(1)}s)`,
            original: `${formatMs(event.Start)} → ${formatMs(event.End)}`,
            fixed: null
        }
    }
    return null
}

function checkShortDuration(event: AssEvent, index: number, minMs: number): QcIssue | null {
    const duration = event.End - event.Start
    if (duration > 0 && duration < minMs) {
        return {
            id: `shortdur-${index}`,
            lineIndex: index,
            ruleId: "fix-short-duration",
            severity: "warning",
            category: "timing",
            message: `Duration is ${duration}ms (min: ${minMs}ms)`,
            original: `${formatMs(event.Start)} → ${formatMs(event.End)}`,
            fixed: null
        }
    }
    return null
}

function checkOverlappingTimes(events: AssEvent[], index: number): QcIssue | null {
    if (index >= events.length - 1) return null

    const current = events[index]
    const next = events[index + 1]

    if (current.type !== "Dialogue" || next.type !== "Dialogue") return null

    if (current.End > next.Start) {
        const overlapMs = current.End - next.Start
        return {
            id: `overlap-${index}`,
            lineIndex: index,
            ruleId: "fix-overlapping-times",
            severity: "warning",
            category: "timing",
            message: `Overlaps with next subtitle by ${overlapMs}ms`,
            original: `End: ${formatMs(current.End)} > Next start: ${formatMs(next.Start)}`,
            fixed: null
        }
    }
    return null
}

function checkShortGaps(events: AssEvent[], index: number, minGapMs: number): QcIssue | null {
    if (index >= events.length - 1) return null

    const current = events[index]
    const next = events[index + 1]

    if (current.type !== "Dialogue" || next.type !== "Dialogue") return null

    const gap = next.Start - current.End
    // Only flag short gaps, not overlaps (those are handled by fix-overlapping-times)
    if (gap >= 0 && gap < minGapMs) {
        return {
            id: `shortgap-${index}`,
            lineIndex: index,
            ruleId: "fix-short-gaps",
            severity: "warning",
            category: "timing",
            message: `Gap to next subtitle is only ${gap}ms (min: ${minGapMs}ms)`,
            original: `End: ${formatMs(current.End)} → Next start: ${formatMs(next.Start)}`,
            fixed: null
        }
    }
    return null
}

function checkLineBreakIssues(event: AssEvent, index: number): QcIssue | null {
    const text = event.Text
    const hasIssue = text.startsWith("\\N") || text.endsWith("\\N") || text.includes("\\N\\N")

    if (hasIssue) {
        let fixed = text
        while (fixed.startsWith("\\N")) {
            fixed = fixed.slice(2)
        }
        while (fixed.endsWith("\\N")) {
            fixed = fixed.slice(0, -2)
        }
        fixed = fixed.replace(/(?:\\N){2,}/g, "\\N")

        if (fixed !== text) {
            return {
                id: `linebreak-${index}`,
                lineIndex: index,
                ruleId: "fix-line-break-issues",
                severity: "error",
                category: "text",
                message: "Line break issues (leading, trailing, or double \\N)",
                original: event.Text,
                fixed
            }
        }
    }
    return null
}

function checkUnmatchedTags(event: AssEvent, index: number): QcIssue | null {
    const text = event.Text
    const tagBlocks = text.match(/\{[^}]*\}/g)
    if (!tagBlocks) return null

    const toggleTags = ["b", "i", "u", "s"]
    const openTags: string[] = []

    for (const block of tagBlocks) {
        const inner = block.slice(1, -1)
        for (const tag of toggleTags) {
            const openRe = new RegExp(`\\\\${tag}1`)
            const closeRe = new RegExp(`\\\\${tag}0`)

            if (openRe.test(inner)) {
                openTags.push(tag)
            }
            if (closeRe.test(inner)) {
                const idx = openTags.lastIndexOf(tag)
                if (idx !== -1) {
                    openTags.splice(idx, 1)
                }
            }
        }
    }

    if (openTags.length > 0) {
        return {
            id: `unmatch-${index}`,
            lineIndex: index,
            ruleId: "fix-unmatched-tags",
            severity: "warning",
            category: "formatting",
            message: `Unmatched override tags: ${openTags.map(t => `\\${t}1`).join(", ")}`,
            original: event.Text,
            fixed: null
        }
    }
    return null
}

function checkMissingDialogueDash(event: AssEvent, index: number): QcIssue | null {
    const lines = splitLines(event.Text)
    if (lines.length !== 2) return null

    const firstVisible = stripOverrideTags(lines[0]).trim()
    const secondVisible = stripOverrideTags(lines[1]).trim()

    if (/^[-–—]/.test(firstVisible) && !/^[-–—]/.test(secondVisible) && secondVisible.length > 0) {
        const dashMatch = firstVisible.match(/^([-–—])\s*/)
        const dash = dashMatch ? dashMatch[1] : "-"

        const tagMatch = lines[1].match(/^((?:\{[^}]*\})*)(.*)$/)
        let fixedLine2: string
        if (tagMatch) {
            fixedLine2 = tagMatch[1] + dash + " " + tagMatch[2].trim()
        } else {
            fixedLine2 = dash + " " + lines[1].trim()
        }

        const fixed = lines[0] + "\\N" + fixedLine2
        return {
            id: `dash-${index}`,
            lineIndex: index,
            ruleId: "fix-missing-dialogue-dash",
            severity: "info",
            category: "punctuation",
            message: "Second dialogue line missing leading dash",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkUppercaseAfterParagraph(event: AssEvent, index: number): QcIssue | null {
    const lines = splitLines(event.Text)
    let needsFix = false

    const fixedLines = lines.map(line => {
        // Get the text after any override tags
        const tagMatch = line.match(/^((?:\{[^}]*\})*)(.*)$/)
        if (!tagMatch) return line

        const prefix = tagMatch[1]
        const content = tagMatch[2]

        // Check if first non-whitespace, non-dash character is lowercase
        const textStart = content.match(/^([\s\-–—]*)([a-zà-ÿ])(.*)$/)
        if (textStart) {
            needsFix = true
            return prefix + textStart[1] + textStart[2].toUpperCase() + textStart[3]
        }
        return line
    })

    if (needsFix) {
        const fixed = fixedLines.join("\\N")
        if (fixed !== event.Text) {
            return {
                id: `ucpara-${index}`,
                lineIndex: index,
                ruleId: "fix-uppercase-after-paragraph",
                severity: "info",
                category: "casing",
                message: "Line starts with lowercase letter",
                original: event.Text,
                fixed
            }
        }
    }
    return null
}

function checkUppercaseAfterPeriod(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text)
    // Match: period/exclamation/question + space + lowercase letter
    const hasLowerAfterPeriod = /[.!?]\s+[a-zà-ÿ]/.test(text)

    if (hasLowerAfterPeriod) {
        const fixed = fixOutsideTags(event.Text, t => {
            return t.replace(/([.!?]\s+)([a-zà-ÿ])/g, (_, before, letter) => {
                return before + letter.toUpperCase()
            })
        })

        if (fixed !== event.Text) {
            return {
                id: `ucperiod-${index}`,
                lineIndex: index,
                ruleId: "fix-uppercase-after-period",
                severity: "info",
                category: "casing",
                message: "Lowercase letter after period/exclamation/question mark",
                original: event.Text,
                fixed
            }
        }
    }
    return null
}

function checkUppercaseAfterColon(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text)
    // Match: colon/semicolon + space + lowercase letter
    const hasLowerAfterColon = /[:;]\s+[a-zà-ÿ]/.test(text)

    if (hasLowerAfterColon) {
        const fixed = fixOutsideTags(event.Text, t => {
            return t.replace(/([:;]\s+)([a-zà-ÿ])/g, (_, before, letter) => {
                return before + letter.toUpperCase()
            })
        })

        if (fixed !== event.Text) {
            return {
                id: `uccolon-${index}`,
                lineIndex: index,
                ruleId: "fix-uppercase-after-colon",
                severity: "info",
                category: "casing",
                message: "Lowercase letter after colon/semicolon",
                original: event.Text,
                fixed
            }
        }
    }
    return null
}

function checkHyphensRemoveDashSingleLine(event: AssEvent, index: number): QcIssue | null {
    const lines = splitLines(event.Text)
    if (lines.length !== 1) return null
    const visible = stripOverrideTags(event.Text).trim()
    if (/^[-–—]\s+/.test(visible)) {
        const fixed = fixOutsideTags(event.Text, t => t.replace(/^[-–—]\s+/, ""))
        return {
            id: `remdash-${index}`,
            lineIndex: index,
            ruleId: "fix-hyphens-remove-dash-single-line",
            severity: "info",
            category: "punctuation",
            message: "Unnecessary dialogue dash on single line",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkRemoveDialogFirstLine(event: AssEvent, index: number): QcIssue | null {
    const lines = splitLines(event.Text)
    if (lines.length !== 2) return null
    const firstVisible = stripOverrideTags(lines[0]).trim()
    const secondVisible = stripOverrideTags(lines[1]).trim()
    if (/^[-–—]/.test(firstVisible) && !/^[-–—]/.test(secondVisible)) {
        const fixedLine1 = fixOutsideTags(lines[0], t => t.replace(/^[-–—]\s*/, ""))
        const fixed = fixedLine1 + "\\N" + lines[1]
        return {
            id: `remdash2-${index}`,
            lineIndex: index,
            ruleId: "remove-dialog-first-line-in-non-dialogs",
            severity: "info",
            category: "punctuation",
            message: "Dialogue dash on first line of non-dialogue subtitle",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkDoubleGreaterThan(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text)
    if (text.includes(">>")) {
        const fixed = fixOutsideTags(event.Text, t => t.replace(/>>/g, ">"))
        return {
            id: `dblgt-${index}`,
            lineIndex: index,
            ruleId: "fix-double-greater-than",
            severity: "warning",
            category: "punctuation",
            message: "Double greater-than (>>) found (OCR artifact)",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkMusicNotation(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text).trim()
    const hasHashOrAsterisk = /^[#*]/.test(text) || /[#*]$/.test(text)
    if (hasHashOrAsterisk) {
        const fixed = fixOutsideTags(event.Text, t => {
            return t.replace(/^[#*]\s*/g, "♪ ").replace(/\s*[#*]$/g, " ♪")
        })
        return {
            id: `music-${index}`,
            lineIndex: index,
            ruleId: "fix-music-notation",
            severity: "info",
            category: "punctuation",
            message: "Convert text markers to music symbols (♪)",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkMissingOpenBracket(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text).trim()
    const hasCloseOnly = /[)\]}]/.test(text) && !/[([{]/.test(text)
    if (hasCloseOnly) {
        let fixed = event.Text
        if (text.endsWith(")")) fixed = prependToVisibleText(event.Text, "(")
        else if (text.endsWith("]")) fixed = prependToVisibleText(event.Text, "[")
        else if (text.endsWith("}")) fixed = prependToVisibleText(event.Text, "{")
        return {
            id: `openbr-${index}`,
            lineIndex: index,
            ruleId: "fix-missing-open-bracket",
            severity: "warning",
            category: "formatting",
            message: "Missing opening bracket",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkMissingCloseBracket(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text).trim()
    const hasOpenOnly = /[([{]/.test(text) && !/[)\]}]/.test(text)
    if (hasOpenOnly) {
        let fixed = event.Text
        if (text.startsWith("(")) fixed = appendToVisibleText(event.Text, ")")
        else if (text.startsWith("[")) fixed = appendToVisibleText(event.Text, "]")
        else if (text.startsWith("{")) fixed = appendToVisibleText(event.Text, "}")
        return {
            id: `closebr-${index}`,
            lineIndex: index,
            ruleId: "fix-missing-close-bracket",
            severity: "warning",
            category: "formatting",
            message: "Missing closing bracket",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkUnnecessaryLeadingDots(event: AssEvent, index: number): QcIssue | null {
    const lines = splitLines(event.Text)
    let needsFix = false
    const fixedLines = lines.map(line => {
        const visible = stripOverrideTags(line).trim()
        if (/^\.{1,2}(?!\.)\s*[A-Za-z]/.test(visible)) {
            needsFix = true
            return fixOutsideTags(line, t => t.replace(/^\.{1,2}\s*/, ""))
        }
        return line
    })
    if (needsFix) {
        return {
            id: `leaddots-${index}`,
            lineIndex: index,
            ruleId: "fix-unnecessary-leading-dots",
            severity: "info",
            category: "punctuation",
            message: "Unnecessary leading dots at start of sentence",
            original: event.Text,
            fixed: fixedLines.join("\\N")
        }
    }
    return null
}

function checkRemoveSpaceBetweenNumbers(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text)
    if (/\d\s+\d/.test(text)) {
        const fixed = fixOutsideTags(event.Text, t => {
            return t.replace(/(\d)\s+(\d)/g, "$1$2")
        })
        if (fixed !== event.Text) {
            return {
                id: `spnum-${index}`,
                lineIndex: index,
                ruleId: "remove-space-between-numbers",
                severity: "info",
                category: "text",
                message: "Unnecessary spaces between numbers",
                original: event.Text,
                fixed
            }
        }
    }
    return null
}

function checkContinuationStyle(event: AssEvent, index: number): QcIssue | null {
    const lines = splitLines(event.Text)
    if (lines.length !== 2) return null
    const first = stripOverrideTags(lines[0]).trim()
    const second = stripOverrideTags(lines[1]).trim()
    if ((first.endsWith("...") || first.endsWith("…")) && (second.startsWith("...") || second.startsWith("…"))) {
        const fixedLine2 = fixOutsideTags(lines[1], t => t.replace(/^(\.{3}|…)\s*/, ""))
        const fixed = lines[0] + "\\N" + fixedLine2
        return {
            id: `contin-${index}`,
            lineIndex: index,
            ruleId: "fix-continuation-style",
            severity: "info",
            category: "punctuation",
            message: "Redundant ellipsis at start of continuation line",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkNormalizeStrings(event: AssEvent, index: number): QcIssue | null {
    const text = event.Text
    const hasGarbledCombo = /[!?]{2,}/.test(text) || /[\u200E\u200F\u202A-\u202E]/.test(text)
    if (hasGarbledCombo) {
        const fixed = text
            .replace(/\u200E|\u200F|[\u202A-\u202E]/g, "")
            .replace(/!\?!/g, "!?")
            .replace(/\?!\?/g, "?!")
            .replace(/\?!+/g, "?!")
            .replace(/!\?+/g, "!?")
            .replace(/\?{3,}/g, "???")
            .replace(/!{3,}/g, "!!!")
        if (fixed !== text) {
            return {
                id: `normstr-${index}`,
                lineIndex: index,
                ruleId: "normalize-strings",
                severity: "info",
                category: "text",
                message: "Non-standard string markers found",
                original: event.Text,
                fixed
            }
        }
    }
    return null
}

function checkAloneLowercaseI(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text)
    if (/(?:\b)i(?:\b)/.test(text)) {
        const fixed = fixOutsideTags(event.Text, t => {
            return t.replace(/\bi\b/g, "I")
        })
        return {
            id: `alonei-${index}`,
            lineIndex: index,
            ruleId: "fix-alone-lowercase-i",
            severity: "info",
            category: "casing",
            message: "Lowercase standalone 'i' should be capitalized",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkTurkishAnsi(event: AssEvent, index: number): QcIssue | null {
    const text = event.Text
    const needsFix = /[ÝýþÞðÐ]/.test(text)
    if (needsFix) {
        const fixed = text
            .replace(/Ý/g, "İ")
            .replace(/ý/g, "ı")
            .replace(/þ/g, "ş")
            .replace(/Þ/g, "Ş")
            .replace(/ð/g, "ğ")
            .replace(/Ð/g, "Ğ")
        return {
            id: `turkansi-${index}`,
            lineIndex: index,
            ruleId: "fix-turkish-ansi",
            severity: "error",
            category: "text",
            message: "Garbled Turkish ANSI characters detected",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkSpanishInvertedMarks(event: AssEvent, index: number): QcIssue | null {
    const lines = splitLines(event.Text)
    let needsFix = false
    const fixedLines = lines.map(line => {
        const visible = stripOverrideTags(line).trim()
        if (visible.endsWith("?") && !visible.startsWith("¿")) {
            needsFix = true
            return prependToVisibleText(line, "¿")
        }
        if (visible.endsWith("!") && !visible.startsWith("¡")) {
            needsFix = true
            return prependToVisibleText(line, "¡")
        }
        return line
    })
    if (needsFix) {
        return {
            id: `spanmark-${index}`,
            lineIndex: index,
            ruleId: "fix-spanish-inverted-marks",
            severity: "info",
            category: "punctuation",
            message: "Missing Spanish inverted question (¿) or exclamation (¡) mark",
            original: event.Text,
            fixed: fixedLines.join("\\N")
        }
    }
    return null
}

function checkAddMissingQuotes(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text)
    const quoteCount = (text.match(/"/g) || []).length
    if (quoteCount === 1) {
        const fixed = appendToVisibleText(event.Text, '"')
        return {
            id: `missquote-${index}`,
            lineIndex: index,
            ruleId: "add-missing-quotes",
            severity: "warning",
            category: "punctuation",
            message: "Unclosed double quotes found",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkUnneededPeriodAfterAbbreviation(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text)
    const abbrevRegex = /\b(Mr|Mrs|Dr|Ms|Sr|Jr|vs)\.(?=\s+[a-z])/i
    if (abbrevRegex.test(text)) {
        const fixed = fixOutsideTags(event.Text, t => {
            return t.replace(/\b(Mr|Mrs|Dr|Ms|Sr|Jr|vs)\.(?=\s+[a-z])/gi, "$1")
        })
        return {
            id: `abbrevperiod-${index}`,
            lineIndex: index,
            ruleId: "fix-unneeded-period-after-abbreviation",
            severity: "info",
            category: "punctuation",
            message: "Unnecessary period after abbreviation",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkUppercaseIInsideWords(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text)
    if (/[a-z]I[a-z]/.test(text)) {
        const fixed = fixOutsideTags(event.Text, t => {
            return t.replace(/([a-z])I([a-z])/g, "$1i$2")
        })
        return {
            id: `ucinside-${index}`,
            lineIndex: index,
            ruleId: "fix-uppercase-i-inside-words",
            severity: "warning",
            category: "casing",
            message: "Uppercase 'I' inside lowercase word (OCR artifact)",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkMissingPeriodsAtEnd(event: AssEvent, index: number): QcIssue | null {
    const lines = splitLines(event.Text)
    if (lines.length !== 2) return null
    const first = stripOverrideTags(lines[0]).trim()
    const second = stripOverrideTags(lines[1]).trim()
    if (first.length === 0 || second.length === 0) return null

    // Check if first line does NOT end with sentence-ending punctuation (.!?…)
    // And second line starts with an uppercase letter
    const endsWithPunct = /[.!?"”’\])…]$/.test(first)
    const startsWithUpper = /^[A-ZА-Яİ]/.test(second[0])

    if (!endsWithPunct && startsWithUpper) {
        const fixedLine1 = appendToVisibleText(lines[0], ".")
        const fixed = fixedLine1 + "\\N" + lines[1]
        return {
            id: `missperiod-${index}`,
            lineIndex: index,
            ruleId: "fix-missing-periods-at-end",
            severity: "info",
            category: "punctuation",
            message: "Missing period at end of line before uppercase letter",
            original: event.Text,
            fixed
        }
    }
    return null
}

function checkDoubleDash(event: AssEvent, index: number): QcIssue | null {
    const text = stripOverrideTags(event.Text)
    if (text.includes("--")) {
        const fixed = fixOutsideTags(event.Text, t => t.replace(/--/g, "—"))
        return {
            id: `dbldash-${index}`,
            lineIndex: index,
            ruleId: "fix-double-dash",
            severity: "info",
            category: "punctuation",
            message: "Replace double dash (--) with em-dash (—)",
            original: event.Text,
            fixed
        }
    }
    return null
}

// ─── Helper: apply fix only outside ASS override tags ────────────────────────

/**
 * Apply a text transformation function only to text segments outside `{...}` override tags.
 */
function fixOutsideTags(text: string, fn: (segment: string) => string): string {
    const parts = text.split(/(\{[^}]*\})/)
    return parts
        .map(part => {
            if (part.startsWith("{") && part.endsWith("}")) {
                return part
            }
            return fn(part)
        })
        .join("")
}

/**
 * Prepend a character/string right before the first visible text character (outside tags).
 */
function prependToVisibleText(text: string, char: string): string {
    let insideTag = false
    for (let i = 0; i < text.length; i++) {
        if (text[i] === "{") {
            insideTag = true
            continue
        }
        if (text[i] === "}") {
            insideTag = false
            continue
        }
        if (!insideTag) {
            return text.slice(0, i) + char + text.slice(i)
        }
    }
    return char + text
}

/**
 * Append a character/string right after the last visible text character (outside tags).
 */
function appendToVisibleText(text: string, char: string): string {
    let insideTag = false
    for (let i = text.length - 1; i >= 0; i--) {
        if (text[i] === "}") {
            insideTag = true
            continue
        }
        if (text[i] === "{") {
            insideTag = false
            continue
        }
        if (!insideTag) {
            return text.slice(0, i + 1) + char + text.slice(i + 1)
        }
    }
    return text + char
}

/**
 * Format milliseconds as a readable timestamp string for display.
 */
function formatMs(ms: number): string {
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    const s = Math.floor((ms % 60_000) / 1000)
    const cs = Math.floor((ms % 1000) / 10)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`
}

// ─── Deep clone track ────────────────────────────────────────────────────────

function cloneTrack(track: AssTrack): AssTrack {
    return {
        ...track,
        scriptInfo: { ...track.scriptInfo },
        styles: track.styles.map(s => ({ ...s, _raw: { ...s._raw } })),
        events: track.events.map(e => ({ ...e })),
        styleFormat: [...track.styleFormat],
        eventFormat: [...track.eventFormat],
        rawSections: track.rawSections.map(s => ({ ...s, lines: [...s.lines] }))
    }
}

// ─── Main QC Runner ──────────────────────────────────────────────────────────

/**
 * Run quality checks on an AssTrack.
 *
 * Returns all detected issues and a cloned track with auto-fixable issues applied.
 * The input track is never mutated.
 */
export function runQualityCheck(track: AssTrack, options: QcOptions = DEFAULT_QC_OPTIONS): QcResult {
    const issues: QcIssue[] = []
    const fixedTrack = cloneTrack(track)
    const enabled = options.enabledRules

    // Collect all issues first
    for (let i = 0; i < track.events.length; i++) {
        const event = track.events[i]
        if (event.type !== "Dialogue") continue

        // Text rules
        if (enabled.has("remove-empty-lines")) {
            const issue = checkEmptyLines(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-double-spaces")) {
            const issue = checkDoubleSpaces(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-leading-trailing-whitespace")) {
            const issue = checkLeadingTrailingWhitespace(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-line-break-issues")) {
            const issue = checkLineBreakIssues(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-three-plus-lines")) {
            const issue = checkThreePlusLines(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-long-lines")) {
            const issue = checkLongLines(event, i, options.maxLineLength)
            if (issue) issues.push(issue)
        }
        if (enabled.has("merge-short-lines")) {
            const issue = checkMergeShortLines(event, i, options.maxLineLength)
            if (issue) issues.push(issue)
        }

        // Punctuation rules
        if (enabled.has("fix-ellipsis")) {
            const issue = checkEllipsis(event, i, options.convertEllipsis)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-double-punctuation")) {
            const issue = checkDoublePunctuation(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-space-before-punctuation")) {
            const issue = checkSpaceBeforePunctuation(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-missing-space-after-punctuation")) {
            const issue = checkMissingSpaceAfterPunctuation(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-commas")) {
            const issue = checkCommas(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-double-apostrophes")) {
            const issue = checkDoubleApostrophes(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("split-dialog-on-one-line")) {
            const issue = checkSplitDialogOnOneLine(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-missing-dialogue-dash")) {
            const issue = checkMissingDialogueDash(event, i)
            if (issue) issues.push(issue)
        }

        // Timing rules
        if (enabled.has("fix-long-duration")) {
            const issue = checkLongDuration(event, i, options.maxDurationMs)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-short-duration")) {
            const issue = checkShortDuration(event, i, options.minDurationMs)
            if (issue) issues.push(issue)
        }

        // Formatting rules
        if (enabled.has("fix-unmatched-tags")) {
            const issue = checkUnmatchedTags(event, i)
            if (issue) issues.push(issue)
        }

        // Casing rules
        if (enabled.has("fix-uppercase-after-paragraph")) {
            const issue = checkUppercaseAfterParagraph(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-uppercase-after-period")) {
            const issue = checkUppercaseAfterPeriod(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-uppercase-after-colon")) {
            const issue = checkUppercaseAfterColon(event, i)
            if (issue) issues.push(issue)
        }

        // SubtitleEdit Additional Rules
        if (enabled.has("fix-hyphens-remove-dash-single-line")) {
            const issue = checkHyphensRemoveDashSingleLine(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("remove-dialog-first-line-in-non-dialogs")) {
            const issue = checkRemoveDialogFirstLine(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-double-greater-than")) {
            const issue = checkDoubleGreaterThan(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-music-notation")) {
            const issue = checkMusicNotation(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-missing-open-bracket")) {
            const issue = checkMissingOpenBracket(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-missing-close-bracket")) {
            const issue = checkMissingCloseBracket(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-unnecessary-leading-dots")) {
            const issue = checkUnnecessaryLeadingDots(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("remove-space-between-numbers")) {
            const issue = checkRemoveSpaceBetweenNumbers(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-continuation-style")) {
            const issue = checkContinuationStyle(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("normalize-strings")) {
            const issue = checkNormalizeStrings(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-alone-lowercase-i")) {
            const issue = checkAloneLowercaseI(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-turkish-ansi")) {
            const issue = checkTurkishAnsi(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-spanish-inverted-marks")) {
            const issue = checkSpanishInvertedMarks(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("add-missing-quotes")) {
            const issue = checkAddMissingQuotes(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-unneeded-period-after-abbreviation")) {
            const issue = checkUnneededPeriodAfterAbbreviation(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-uppercase-i-inside-words")) {
            const issue = checkUppercaseIInsideWords(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-missing-periods-at-end")) {
            const issue = checkMissingPeriodsAtEnd(event, i)
            if (issue) issues.push(issue)
        }
        if (enabled.has("fix-double-dash")) {
            const issue = checkDoubleDash(event, i)
            if (issue) issues.push(issue)
        }
    }

    // Check overlapping times and short gaps (requires sorted Dialogue events)
    if (enabled.has("fix-overlapping-times") || enabled.has("fix-short-gaps")) {
        const sortedDialogueIndices: number[] = []
        for (let i = 0; i < track.events.length; i++) {
            if (track.events[i].type === "Dialogue") {
                sortedDialogueIndices.push(i)
            }
        }

        for (let j = 0; j < sortedDialogueIndices.length - 1; j++) {
            const idx = sortedDialogueIndices[j]
            const tempEvents = [track.events[sortedDialogueIndices[j]], track.events[sortedDialogueIndices[j + 1]]]

            if (enabled.has("fix-overlapping-times")) {
                const issue = checkOverlappingTimes(tempEvents, 0)
                if (issue) {
                    issues.push({
                        ...issue,
                        id: `overlap-${idx}`,
                        lineIndex: idx
                    })
                }
            }

            if (enabled.has("fix-short-gaps")) {
                const issue = checkShortGaps(tempEvents, 0, options.minGapMs)
                if (issue) {
                    issues.push({
                        ...issue,
                        id: `shortgap-${idx}`,
                        lineIndex: idx
                    })
                }
            }
        }
    }

    // Apply auto-fixes to the cloned track
    const indicesToRemove = new Set<number>()

    for (const issue of issues) {
        if (issue.fixed === null) continue

        if (issue.ruleId === "remove-empty-lines" && issue.fixed === "") {
            indicesToRemove.add(issue.lineIndex)
        } else if (issue.fixed !== null) {
            fixedTrack.events[issue.lineIndex] = {
                ...fixedTrack.events[issue.lineIndex],
                Text: issue.fixed
            }
        }
    }

    if (indicesToRemove.size > 0) {
        fixedTrack.events = fixedTrack.events.filter((_, i) => !indicesToRemove.has(i))
    }

    // Calculate stats
    const stats = {
        errors: issues.filter(i => i.severity === "error").length,
        warnings: issues.filter(i => i.severity === "warning").length,
        info: issues.filter(i => i.severity === "info").length,
        total: issues.length,
        fixable: issues.filter(i => i.fixed !== null).length
    }

    return { issues, fixedTrack, stats }
}
