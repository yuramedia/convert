/**
 * SRT Parser — parses SubRip (SRT) subtitle files into AssTrack
 *
 * Handles:
 * - Standard SRT format (index, timestamp, text blocks separated by blank lines)
 * - HTML tags (<b>, <i>, <u>, <s>) → ASS override tags
 * - Embedded ASS override tags (e.g., from Keep TS mode) — preserved as-is
 * - BOM handling
 * - Flexible timestamp parsing (HH:MM:SS,mmm)
 */

import { type AssTrack, type AssEvent, type AssStyle } from "./ass-parser"

// ─── SRT Timestamp parsing ───────────────────────────────────────────────────

/**
 * Parse SRT timestamp `HH:MM:SS,mmm` → milliseconds
 * Also accepts `.` as decimal separator (common variant)
 */
export function parseSrtTimestamp(str: string): number {
    const match = str.trim().match(/^(-?)(\d+):(\d{2}):(\d{2})[,.](\d{1,3})$/)
    if (!match) return 0
    const sign = match[1] === "-" ? -1 : 1
    const h = parseInt(match[2], 10)
    const m = parseInt(match[3], 10)
    const s = parseInt(match[4], 10)
    // Pad to 3 digits (e.g., "5" → "500", "50" → "500")
    const msStr = match[5].padEnd(3, "0")
    const ms = parseInt(msStr, 10)
    return sign * (((h * 60 + m) * 60 + s) * 1000 + ms)
}

// ─── HTML → ASS tag conversion ───────────────────────────────────────────────

/**
 * Convert HTML formatting tags to ASS override tags.
 * Only converts known safe tags: b, i, u, s.
 * Preserves existing ASS override tags `{...}` as-is.
 */
export function htmlToAssTags(text: string): string {
    return text
        .replace(/<b>/gi, "{\\b1}")
        .replace(/<\/b>/gi, "{\\b0}")
        .replace(/<i>/gi, "{\\i1}")
        .replace(/<\/i>/gi, "{\\i0}")
        .replace(/<u>/gi, "{\\u1}")
        .replace(/<\/u>/gi, "{\\u0}")
        .replace(/<s>/gi, "{\\s1}")
        .replace(/<\/s>/gi, "{\\s0}")
        .replace(/<font[^>]*>/gi, "")
        .replace(/<\/font>/gi, "")
}

// ─── SRT Cue interface ───────────────────────────────────────────────────────

interface SrtCue {
    index: number
    startMs: number
    endMs: number
    text: string
}

// ─── Parse SRT text into cues ────────────────────────────────────────────────

const TIMESTAMP_RE = /^(-?\d+:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(-?\d+:\d{2}:\d{2}[,.]\d{1,3})/

/**
 * Parse raw SRT text into an array of cues.
 */
export function parseSrtCues(content: string): SrtCue[] {
    // Handle BOM
    if (content.charCodeAt(0) === 0xfeff) {
        content = content.slice(1)
    }

    const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")
    const cues: SrtCue[] = []

    let i = 0
    while (i < lines.length) {
        // Skip blank lines
        if (lines[i].trim() === "") {
            i++
            continue
        }

        // Try to find index line (a number on its own line)
        const indexMatch = lines[i].trim().match(/^\d+$/)
        if (!indexMatch) {
            // Not an index line — could be malformed, skip
            i++
            continue
        }
        const cueIndex = parseInt(indexMatch[0], 10)
        i++

        // Next line must be timestamp
        if (i >= lines.length) break
        const tsMatch = lines[i].match(TIMESTAMP_RE)
        if (!tsMatch) {
            // Timestamp line missing, skip this block
            continue
        }
        const startMs = parseSrtTimestamp(tsMatch[1])
        const endMs = parseSrtTimestamp(tsMatch[2])
        i++

        // Collect text lines until blank line or end of file
        const textLines: string[] = []
        while (i < lines.length && lines[i].trim() !== "") {
            textLines.push(lines[i])
            i++
        }

        if (textLines.length > 0) {
            cues.push({
                index: cueIndex,
                startMs,
                endMs,
                text: textLines.join("\n")
            })
        }
    }

    return cues
}

// ─── Main parser: SRT → AssTrack ─────────────────────────────────────────────

/**
 * Parse an SRT file into an AssTrack.
 *
 * - Newlines within a cue become `\N` (ASS hard line break)
 * - HTML tags (<b>, <i>, <u>, <s>) are converted to ASS override tags
 * - Existing ASS override tags (e.g., from Keep TS roundtrip) are preserved
 * - A default style is created
 */
export function parseSrt(content: string): AssTrack {
    const cues = parseSrtCues(content)

    const events: AssEvent[] = cues.map(cue => {
        // Convert newlines to ASS \N, then convert HTML tags
        let text = cue.text.replace(/\n/g, "\\N")
        text = htmlToAssTags(text)

        return {
            type: "Dialogue" as const,
            Layer: 0,
            Start: cue.startMs,
            End: cue.endMs,
            Style: "Default",
            Name: "",
            MarginL: 0,
            MarginR: 0,
            MarginV: 0,
            Effect: "",
            Text: text
        }
    })

    const defaultStyle: AssStyle = {
        Name: "Default",
        FontName: "Arial",
        FontSize: 48,
        PrimaryColour: "&H00FFFFFF",
        SecondaryColour: "&H000000FF",
        OutlineColour: "&H00000000",
        BackColour: "&H00000000",
        Bold: false,
        Italic: false,
        Underline: false,
        StrikeOut: false,
        ScaleX: 100,
        ScaleY: 100,
        Spacing: 0,
        Angle: 0,
        BorderStyle: 1,
        Outline: 2,
        Shadow: 2,
        Alignment: 2,
        MarginL: 10,
        MarginR: 10,
        MarginV: 10,
        Encoding: 1,
        Blur: 0,
        Justify: 0,
        _raw: {}
    }

    return {
        scriptInfo: {
            Title: "SRT Import",
            ScriptType: "v4.00+",
            PlayResX: 1920,
            PlayResY: 1080,
            WrapStyle: 0,
            ScaledBorderAndShadow: true,
            Timer: 100,
            YCbCrMatrix: "",
            Kerning: true,
            LayoutResX: 1920,
            LayoutResY: 1080
        },
        styles: [defaultStyle],
        events,
        styleFormat: [
            "Name",
            "Fontname",
            "Fontsize",
            "PrimaryColour",
            "SecondaryColour",
            "OutlineColour",
            "BackColour",
            "Bold",
            "Italic",
            "Underline",
            "StrikeOut",
            "ScaleX",
            "ScaleY",
            "Spacing",
            "Angle",
            "BorderStyle",
            "Outline",
            "Shadow",
            "Alignment",
            "MarginL",
            "MarginR",
            "MarginV",
            "Encoding"
        ],
        eventFormat: ["Layer", "Start", "End", "Style", "Name", "MarginL", "MarginR", "MarginV", "Effect", "Text"],
        trackType: "ASS",
        rawSections: []
    }
}
