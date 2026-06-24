/**
 * Quality Control (QC) Checker for Subtitle Files
 *
 * Validates subtitle files against professional standards:
 * - Reading speed (CPS)
 * - Line length
 * - Duration validation
 * - Timing issues
 * - Formatting issues
 */

import { type AssTrack, type AssEvent } from "./ass-parser"

export type QCSeverity = "critical" | "warning" | "info"

export interface QCIssue {
    severity: QCSeverity
    category: string
    line: number
    timestamp: string
    issue: string
    current: string
    recommended: string
    suggestion: string
}

export interface QCReport {
    fileName: string
    totalLines: number
    issues: QCIssue[]
    summary: {
        critical: number
        warning: number
        info: number
    }
}

export interface QCOptions {
    maxCPS?: number // Default: 20
    optimalCPS?: number // Default: 17
    maxLineLength?: number // Default: 42
    optimalLineLength?: number // Default: 38
    minDuration?: number // Default: 800ms
    maxDuration?: number // Default: 7000ms
    minGap?: number // Default: 83ms (2 frames @ 24fps)
    snapThreshold?: number // Default: 200ms
    strict?: boolean // Default: false
    fps?: number // Default: 23.976
}

const DEFAULT_OPTIONS: Required<QCOptions> = {
    maxCPS: 20,
    optimalCPS: 17,
    maxLineLength: 42,
    optimalLineLength: 38,
    minDuration: 800,
    maxDuration: 7000,
    minGap: 83,
    snapThreshold: 200,
    strict: false,
    fps: 23.976023976
}

/**
 * Calculate visual length (ignoring non-spacing marks)
 */
function getVisualLength(text: string): number {
    // Remove ASS override tags first
    let cleaned = text.replace(/\{[^}]*\}/g, "")
    // Remove HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, "")
    // Remove common non-spacing marks (combining diacritics, Thai vowels, etc.)
    cleaned = cleaned.replace(/[̀-ͯัิ-ฺ็-๎]/g, "")
    return cleaned.length
}

/**
 * Calculate characters per second (CPS)
 */
function calculateCPS(text: string, durationMs: number): number {
    const visualLen = getVisualLength(text)
    const durationSec = durationMs / 1000
    return durationSec > 0 ? visualLen / durationSec : 0
}

/**
 * Format timestamp for display
 */
function formatTimestamp(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const centiseconds = Math.floor((ms % 1000) / 10)
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`
}

/**
 * Check reading speed (CPS)
 */
function checkReadingSpeed(event: AssEvent, index: number, options: Required<QCOptions>): QCIssue[] {
    const issues: QCIssue[] = []
    const duration = event.End - event.Start
    const cps = calculateCPS(event.Text, duration)

    if (cps > options.maxCPS) {
        issues.push({
            severity: "critical",
            category: "Reading Speed",
            line: index + 1,
            timestamp: formatTimestamp(event.Start),
            issue: "Reading speed too fast",
            current: `${cps.toFixed(1)} CPS`,
            recommended: `≤ ${options.maxCPS} CPS`,
            suggestion: `Increase duration to ${Math.ceil((getVisualLength(event.Text) / options.maxCPS) * 1000)}ms or split line`
        })
    } else if (options.strict && cps > options.optimalCPS) {
        issues.push({
            severity: "warning",
            category: "Reading Speed",
            line: index + 1,
            timestamp: formatTimestamp(event.Start),
            issue: "Reading speed suboptimal",
            current: `${cps.toFixed(1)} CPS`,
            recommended: `≤ ${options.optimalCPS} CPS`,
            suggestion: `Consider increasing duration for comfortable reading`
        })
    }

    return issues
}

/**
 * Check line length
 */
function checkLineLength(event: AssEvent, index: number, options: Required<QCOptions>): QCIssue[] {
    const issues: QCIssue[] = []
    const lines = event.Text.split(/\\N/g)

    for (let i = 0; i < lines.length; i++) {
        const visualLen = getVisualLength(lines[i])

        if (visualLen > options.maxLineLength) {
            issues.push({
                severity: "critical",
                category: "Line Length",
                line: index + 1,
                timestamp: formatTimestamp(event.Start),
                issue: `Line ${i + 1} too long`,
                current: `${visualLen} characters`,
                recommended: `≤ ${options.maxLineLength} characters`,
                suggestion: "Split into multiple lines or reduce text"
            })
        } else if (options.strict && visualLen > options.optimalLineLength) {
            issues.push({
                severity: "info",
                category: "Line Length",
                line: index + 1,
                timestamp: formatTimestamp(event.Start),
                issue: `Line ${i + 1} longer than optimal`,
                current: `${visualLen} characters`,
                recommended: `≤ ${options.optimalLineLength} characters`,
                suggestion: "Consider splitting for better readability"
            })
        }
    }

    return issues
}

/**
 * Check duration validation
 */
function checkDuration(event: AssEvent, index: number, options: Required<QCOptions>): QCIssue[] {
    const issues: QCIssue[] = []
    const duration = event.End - event.Start

    if (duration < options.minDuration) {
        issues.push({
            severity: "critical",
            category: "Duration",
            line: index + 1,
            timestamp: formatTimestamp(event.Start),
            issue: "Duration too short",
            current: `${duration}ms`,
            recommended: `≥ ${options.minDuration}ms`,
            suggestion: "Increase end time or merge with adjacent subtitle"
        })
    } else if (duration > options.maxDuration) {
        issues.push({
            severity: "warning",
            category: "Duration",
            line: index + 1,
            timestamp: formatTimestamp(event.Start),
            issue: "Duration too long",
            current: `${duration}ms`,
            recommended: `≤ ${options.maxDuration}ms`,
            suggestion: "Consider splitting into multiple subtitles"
        })
    }

    if (duration < 0) {
        issues.push({
            severity: "critical",
            category: "Duration",
            line: index + 1,
            timestamp: formatTimestamp(event.Start),
            issue: "Negative duration (end before start)",
            current: `${duration}ms`,
            recommended: "> 0ms",
            suggestion: "Fix timing: end time must be after start time"
        })
    }

    return issues
}

/**
 * Check timing issues (gaps, overlaps)
 */
function checkTiming(events: AssEvent[], index: number, options: Required<QCOptions>): QCIssue[] {
    const issues: QCIssue[] = []
    if (index >= events.length - 1) return issues

    const current = events[index]
    const next = events[index + 1]
    const gap = next.Start - current.End

    if (gap < 0) {
        issues.push({
            severity: "critical",
            category: "Timing",
            line: index + 1,
            timestamp: formatTimestamp(current.Start),
            issue: "Overlapping with next subtitle",
            current: `${gap}ms overlap`,
            recommended: "No overlap",
            suggestion: `Adjust end time to ${formatTimestamp(next.Start)} or earlier`
        })
    } else if (gap < options.minGap) {
        issues.push({
            severity: "warning",
            category: "Timing",
            line: index + 1,
            timestamp: formatTimestamp(current.Start),
            issue: "Gap too small",
            current: `${gap}ms`,
            recommended: `≥ ${options.minGap}ms`,
            suggestion: "Increase gap between subtitles"
        })
    } else if (options.strict && gap > 0 && gap <= options.snapThreshold) {
        issues.push({
            severity: "info",
            category: "Timing",
            line: index + 1,
            timestamp: formatTimestamp(current.Start),
            issue: "Small gap suggests missing snap",
            current: `${gap}ms gap`,
            recommended: `0ms or > ${options.snapThreshold}ms`,
            suggestion: "Consider snapping to next subtitle (set end = next start)"
        })
    }

    return issues
}

/**
 * Check formatting issues
 */
function checkFormatting(event: AssEvent, index: number): QCIssue[] {
    const issues: QCIssue[] = []
    const text = event.Text

    // Check for unbalanced HTML tags
    const tagMatches = text.match(/<\/?[biusBI]+>/g) || []
    const openTags: string[] = []
    for (const tag of tagMatches) {
        if (tag.startsWith("</")) {
            const tagName = tag.slice(2, -1).toLowerCase()
            const lastOpen = openTags[openTags.length - 1]
            if (lastOpen !== tagName) {
                issues.push({
                    severity: "critical",
                    category: "Formatting",
                    line: index + 1,
                    timestamp: formatTimestamp(event.Start),
                    issue: "Unbalanced HTML tags",
                    current: text.substring(0, 50),
                    recommended: "All tags properly closed",
                    suggestion: `Check for matching opening/closing tags`
                })
                break
            }
            openTags.pop()
        } else {
            openTags.push(tag.slice(1, -1).toLowerCase())
        }
    }

    if (openTags.length > 0) {
        issues.push({
            severity: "critical",
            category: "Formatting",
            line: index + 1,
            timestamp: formatTimestamp(event.Start),
            issue: "Unclosed HTML tags",
            current: openTags.join(", "),
            recommended: "All tags properly closed",
            suggestion: `Add closing tags: ${openTags.map(t => `</${t}>`).join(" ")}`
        })
    }

    // Check for uppercase HTML tags
    if (/<[BI]/.test(text) || /<\/[BI]/.test(text)) {
        issues.push({
            severity: "warning",
            category: "Formatting",
            line: index + 1,
            timestamp: formatTimestamp(event.Start),
            issue: "Uppercase HTML tags",
            current: text.match(/<\/?[BI][^>]*>/g)?.join(", ") || "",
            recommended: "Lowercase tags",
            suggestion: "Use <i>, <b>, not <I>, <B>"
        })
    }

    // Check for double spaces
    if (/  +/.test(text.replace(/\\N/g, ""))) {
        issues.push({
            severity: "info",
            category: "Formatting",
            line: index + 1,
            timestamp: formatTimestamp(event.Start),
            issue: "Double spaces detected",
            current: "Multiple consecutive spaces",
            recommended: "Single spaces",
            suggestion: "Replace multiple spaces with single space"
        })
    }

    return issues
}

/**
 * Main QC check function
 */
export function checkQuality(track: AssTrack, options: QCOptions = {}): QCReport {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    const issues: QCIssue[] = []

    const dialogueEvents = track.events.filter(e => e.type === "Dialogue")

    for (let i = 0; i < dialogueEvents.length; i++) {
        const event = dialogueEvents[i]

        issues.push(...checkReadingSpeed(event, i, opts))
        issues.push(...checkLineLength(event, i, opts))
        issues.push(...checkDuration(event, i, opts))
        issues.push(...checkTiming(dialogueEvents, i, opts))
        issues.push(...checkFormatting(event, i))
    }

    const summary = {
        critical: issues.filter(i => i.severity === "critical").length,
        warning: issues.filter(i => i.severity === "warning").length,
        info: issues.filter(i => i.severity === "info").length
    }

    return {
        fileName: track.scriptInfo.Title || "Untitled",
        totalLines: dialogueEvents.length,
        issues,
        summary
    }
}
