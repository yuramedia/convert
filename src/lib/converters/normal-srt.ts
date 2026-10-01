/**
 * Mode 1: Normal SRT Conversion (Subtitle Edit style)
 *
 * - Maps \b1→<b>, \i1→<i>, \u1→<u>, \s1→<s> (and closing tags)
 * - Strips all other ASS override tags
 * - Converts timestamps H:MM:SS.CC → HH:MM:SS,mmm
 * - Handles \N → newline, \n → space, \h → nbsp
 * - Strips drawing commands (\p1...\p0)
 * - Filters out Comment lines
 */

import { type AssTrack, type AssStyle } from "../ass-parser"
import { convertTagsToHtml, stripTags, tokenizeText, type TextSegment } from "../ass-tags"
import { type SrtEntry, writeSrt, mergeduplicates, reindex } from "../srt-writer"

export interface NormalSrtOptions {
    useHtmlTags?: boolean
    /** Merge consecutive identical subtitle lines. Default false. */
    mergeDuplicates?: boolean
    stripEmptyLines?: boolean
    /** Strip typesetting/sign lines from output. Default false.
     *  Signs use \pos, \clip, etc. which SRT doesn't support,
     *  so they are useless in plain SRT. Use Keep-TS mode instead. */
    stripSigns?: boolean
    /** Convert sign/typesetting text to UPPERCASE. Default false. */
    uppercaseSigns?: boolean
    /** Merge sign/typesetting lines with overlapping dialogue. Default false.
     *  When enabled, sign text is wrapped in (parentheses) and prepended above
     *  the dialogue text. If uppercaseSigns is also enabled, signs are uppercased
     *  without parentheses (uppercase alone is sufficient distinction). */
    mergeSignLines?: boolean
    /** Preserve \an alignment tags in SRT output. Default true.
     *  When enabled, injects {\anN} for non-default alignments
     *  (from inline overrides or style defaults), matching .ass behavior.
     *  Useful for libass-based players (mpv, VLC) that render ASS tags in SRT. */
    keepAlignment?: boolean
    /** Enable Frame Gap & De-FrameGap timing adjustments. Default false. */
    enableFrameGap?: boolean
    /** Adjustment mode: 'both', 'frame-gap' (Min Gap), or 'de-framegap' (Snap). Default 'both'. */
    frameGapMode?: "both" | "frame-gap" | "de-framegap"
    /** Snap threshold value (De-FrameGap). Default 2. */
    snapThreshold?: number
    /** Unit for snap threshold: 'ms' or 'frames'. Default 'frames'. */
    snapUnit?: "ms" | "frames"
    /** Minimum gap value (Frame Gap). Default 2. */
    minGap?: number
    /** Unit for minimum gap: 'ms' or 'frames'. Default 'frames'. */
    gapUnit?: "ms" | "frames"
    /** FPS for frame calculations. Default 23.976023976 (24000/1001). */
    fps?: number
}

export const DEFAULT_NORMAL_OPTIONS: Required<NormalSrtOptions> = {
    useHtmlTags: true,
    mergeDuplicates: false,
    stripEmptyLines: true,
    stripSigns: false,
    uppercaseSigns: false,
    mergeSignLines: false,
    keepAlignment: true,
    enableFrameGap: false,
    frameGapMode: "frame-gap",
    snapThreshold: 2,
    snapUnit: "frames",
    minGap: 2,
    gapUnit: "frames",
    fps: 23.976023976 // Accurate 24000/1001
}

const SIGN_TAGS = new Set(["pos", "move", "clip", "iclip"])
const ALIGN_TAGS = new Set(["an", "a"])
/**
 * Regex patterns for style names that indicate typesetting.
 * - "sign", "typeset" match anywhere (catches TopSign, SignTS, etc.)
 * - "ts", "op", "ed" require word boundaries to avoid false positives
 *   (Defaults, Closed, Proper won't match)
 */
const SIGN_KEYWORD_RE = /sign|typeset(?:ting)?|(?:\bts\b)|(?:\bop\b)|(?:\bed\b)/i

/**
 * Heuristic to detect if an event is likely Typesetting (Sign) vs Dialogue.
 * Signs should appear before dialogue in merged SRT blocks (so dialogue stays at the bottom).
 */
export function isLikelySign(segments: TextSegment[], style?: AssStyle): boolean {
    for (let i = 0; i < segments.length; i++) {
        const segTags = segments[i].tags
        if (!segTags) continue

        for (let j = 0; j < segTags.length; j++) {
            const t = segTags[j]
            const nameLower = t.name.toLowerCase()

            // 1. Check for "complex" tags that almost always imply typesetting
            if (SIGN_TAGS.has(nameLower)) return true

            // 2. Check for drawing mode (\p1 or higher)
            if (nameLower === "p" && parseInt(t.value, 10) > 0) return true

            // NOTE: Alignment tags removed from sign detection.
            // Many regular dialogues use top/middle alignment (\an8, \an5, etc.),
            // so alignment alone is not a reliable sign indicator.
            // Signs are better detected by positioning tags (\pos, \move, \clip)
            // or style name keywords.
        }
    }

    // NOTE: Style default alignment also removed from sign detection
    // for the same reason - not a reliable indicator alone.

    // Fallback to common style name keywords (word-boundary match)
    if (style && SIGN_KEYWORD_RE.test(style.Name)) {
        return true
    }

    return false
}

const MIN_SUBTITLE_DURATION_MS = 200

export function convertNormalSrt(track: AssTrack, options: NormalSrtOptions = DEFAULT_NORMAL_OPTIONS): string {
    // Merge provided options with defaults
    const fullOptions = { ...DEFAULT_NORMAL_OPTIONS, ...options }

    // 1. Create a style map for O(1) lookups
    const styleMap = new Map(track.styles.map(s => [s.Name, s]))

    // 2. Pre-calculate metadata to avoid redundant expensive calls
    // Use flatMap to filter and map in one pass (Dialogue only)
    let eventWithMetadata = track.events.flatMap(event => {
        if (event.type !== "Dialogue") return []

        const segments = tokenizeText(event.Text)
        const style = styleMap.get(event.Style)
        const isSign = isLikelySign(segments, style)

        // Filter out sign/TS lines when stripSigns is enabled
        // (stripSigns takes priority over mergeSignLines)
        if (fullOptions.stripSigns && isSign) return []

        return [
            {
                event,
                segments,
                style,
                isSign
            }
        ]
    })

    // 2b. Collapse frame-by-frame sign events when mergeSignLines is enabled
    if (fullOptions.mergeSignLines) {
        eventWithMetadata = collapseFrameByFrame(eventWithMetadata, fullOptions)
    }

    // 3. Sort events by start time, then sign-ness, then layer, then end time
    // Signs first so they appear at the top of merged SRT blocks (dialogue at bottom)
    eventWithMetadata.sort((a, b) => {
        if (a.event.Start !== b.event.Start) return a.event.Start - b.event.Start

        if (a.isSign !== b.isSign) {
            return a.isSign ? -1 : 1
        }

        if (a.event.Layer !== b.event.Layer) return a.event.Layer - b.event.Layer
        return a.event.End - b.event.End
    })

    // Separate sign and dialogue metadata for merge step
    const signMeta: Array<{ startMs: number; endMs: number; text: string }> = []
    let entries: SrtEntry[] = []

    for (const { event, segments, style, isSign } of eventWithMetadata) {
        // Uppercase text content BEFORE HTML conversion if this is a sign
        // When mergeSignLines is enabled, signs are always plain text (prepended above dialogue),
        // so uppercasing applies regardless of useHtmlTags.
        // Without mergeSignLines, only uppercase when HTML tags are disabled (legacy behavior).
        const shouldUppercase =
            isSign && fullOptions.uppercaseSigns && (fullOptions.mergeSignLines || !fullOptions.useHtmlTags)
        const processedSegments = shouldUppercase
            ? segments.map(seg => ({
                  ...seg,
                  content: seg.type === "text" ? seg.content.toUpperCase() : seg.content
              }))
            : segments

        let text: string

        // Signs do not use HTML tags (styling like \b1 or \i1 in ASS is typesetting-specific)
        if (fullOptions.useHtmlTags && !isSign) {
            text = convertTagsToHtml(processedSegments, true, {
                // b: style?.Bold, // Ignored per user request, only inline {\b1} will trigger <b>
                i: style?.Italic,
                u: style?.Underline,
                s: style?.StrikeOut
            })
        } else {
            text = stripTags(processedSegments)
        }

        text = text.trim()
        if (fullOptions.stripEmptyLines && !text) continue

        // When mergeSignLines is enabled, collect sign entries separately for merge
        if (fullOptions.mergeSignLines && isSign) {
            signMeta.push({ startMs: event.Start, endMs: event.End, text })
            continue
        }

        // Inject {\anN} alignment tag when keepAlignment is enabled
        if (fullOptions.keepAlignment) {
            const alignment = resolveAlignment(segments, style)
            // Only inject for non-default alignment (\an2 is the SRT/libass default)
            if (alignment !== 2) {
                text = `{\\an${alignment}}${text}`
            }
        }

        entries.push({
            index: entries.length + 1,
            startMs: event.Start,
            endMs: event.End,
            text
        })
    }

    // 3b. Merge sign lines with overlapping dialogue when mergeSignLines is enabled
    if (fullOptions.mergeSignLines && signMeta.length > 0) {
        entries = mergeSignsWithDialogue(entries, signMeta, fullOptions)
    }

    if (fullOptions.mergeDuplicates) {
        entries = mergeduplicates(entries)
    }

    // 4. Apply Timing Adjustments (Snap and Min Gap)
    // Following logic from polo.FrameGap.lua
    const fps = Math.max(0.001, fullOptions.fps || DEFAULT_NORMAL_OPTIONS.fps)
    const msPerFrame = 1000 / fps

    // Backwards compatibility guard: if options has snapThreshold/minGap but no unit, default to 'ms'
    const snapUnit =
        options.snapThreshold !== undefined && options.snapUnit === undefined ? "ms" : fullOptions.snapUnit || "ms"
    const gapUnit = options.minGap !== undefined && options.gapUnit === undefined ? "ms" : fullOptions.gapUnit || "ms"

    // Resolve frameGapMode with compatibility logic:
    // If not explicitly provided, detect based on which parameters were supplied.
    const resolvedFrameGapMode =
        options.frameGapMode !== undefined
            ? options.frameGapMode
            : options.snapThreshold !== undefined && options.minGap === undefined
              ? "de-framegap"
              : options.minGap !== undefined && options.snapThreshold === undefined
                ? "frame-gap"
                : options.snapThreshold !== undefined && options.minGap !== undefined
                  ? "both"
                  : fullOptions.frameGapMode || "frame-gap"

    const snapMs =
        resolvedFrameGapMode === "frame-gap"
            ? 0
            : snapUnit === "frames"
              ? (fullOptions.snapThreshold || 0) * msPerFrame
              : fullOptions.snapThreshold || 0
    const minGapMs =
        resolvedFrameGapMode === "de-framegap"
            ? 0
            : gapUnit === "frames"
              ? (fullOptions.minGap || 0) * msPerFrame
              : fullOptions.minGap || 0

    const enableFrameGap =
        options.enableFrameGap !== undefined
            ? options.enableFrameGap
            : (options.snapThreshold !== undefined && options.snapThreshold > 0) ||
                (options.minGap !== undefined && options.minGap > 0)
              ? true
              : (fullOptions.enableFrameGap ?? false)

    if (enableFrameGap && (snapMs > 0 || minGapMs > 0)) {
        // Must be sorted by start time (already sorted)
        for (let i = 0; i < entries.length - 1; i++) {
            const current = entries[i]
            const next = entries[i + 1]
            const gap = next.startMs - current.endMs

            // Skip overlapping entries — snap/gap only applies to sequential gaps
            if (gap < 0) continue

            // Option 1: Snap (extend current to meet next)
            // Only if gap is positive and within threshold
            if (snapMs > 0 && gap > 0 && gap <= snapMs) {
                current.endMs = next.startMs
            }
            // Option 2: Min Gap (shorten current to ensure space)
            // Only if gap is less than minGap (can be 0 or negative after snapping)
            else if (minGapMs > 0) {
                const currentGap = next.startMs - current.endMs
                if (currentGap < minGapMs) {
                    const newEnd = next.startMs - minGapMs
                    // Safety: don't shorten subtitle below minimum duration
                    if (newEnd - current.startMs >= MIN_SUBTITLE_DURATION_MS) {
                        current.endMs = newEnd
                    }
                }
            }
        }
    }

    entries = reindex(entries)

    return writeSrt(entries)
}

/**
 * Resolve the effective alignment for an event.
 * Checks inline override tags first (\an or \a), then falls back to the style default.
 * Clamps to valid ASS numpad range 1-9 (same guard as keep-ts.ts).
 */
function resolveAlignment(segments: TextSegment[], style?: AssStyle): number {
    // Check inline override tags
    for (const seg of segments) {
        if (seg.type !== "tags" || !seg.tags) continue
        for (const tag of seg.tags) {
            if (ALIGN_TAGS.has(tag.name.toLowerCase())) {
                const val = parseInt(tag.value, 10)
                if (val >= 1 && val <= 9) return val
            }
        }
    }

    // Fall back to style default
    const rawAlignment = style?.Alignment ?? 2
    return rawAlignment >= 1 && rawAlignment <= 9 ? rawAlignment : 2
}

// ─── Sign Merge Helpers ──────────────────────────────────────────────────────

interface EventMeta {
    event: {
        type: "Dialogue" | "Comment"
        Layer: number
        Start: number
        End: number
        Style: string
        Name: string
        MarginL: number
        MarginR: number
        MarginV: number
        Effect: string
        Text: string
    }
    segments: TextSegment[]
    style: AssStyle | undefined
    isSign: boolean
}

/**
 * Collapse consecutive frame-by-frame sign events into a single event.
 * Many ASS typesetting workflows generate dozens of events with identical text
 * but slightly different \pos coordinates (one per video frame) to animate motion.
 * This function merges them by extending the time span when:
 * - Both events are signs
 * - They have identical plain text (ignoring tags)
 * - The gap between them is ≤ 1 frame (~42ms at 23.976fps)
 */
function collapseFrameByFrame(events: EventMeta[], options: Required<NormalSrtOptions>): EventMeta[] {
    if (events.length === 0) return events

    const msPerFrame = 1000 / Math.max(0.001, options.fps)
    // Allow 1 frame gap for frame-by-frame events (contiguous or overlapping)
    const maxGap = msPerFrame * 1.5

    // Extract plain text for comparison (cached per event to avoid re-tokenizing)
    const plainTextCache = new Map<EventMeta, string>()
    const getPlainText = (meta: EventMeta): string => {
        let cached = plainTextCache.get(meta)
        if (cached === undefined) {
            cached = stripTags(meta.segments).trim()
            plainTextCache.set(meta, cached)
        }
        return cached
    }

    // Sort signs by start time for sequential collapse
    const signs = events.filter(e => e.isSign)
    const nonSigns = events.filter(e => !e.isSign)

    if (signs.length <= 1) return events

    signs.sort((a, b) => a.event.Start - b.event.Start)

    const collapsed: EventMeta[] = []
    let current = signs[0]

    for (let i = 1; i < signs.length; i++) {
        const next = signs[i]
        const gap = next.event.Start - current.event.End

        if (gap <= maxGap && getPlainText(current) === getPlainText(next)) {
            // Extend current event's time span
            current = {
                ...current,
                event: {
                    ...current.event,
                    End: Math.max(current.event.End, next.event.End)
                }
            }
        } else {
            collapsed.push(current)
            current = next
        }
    }
    collapsed.push(current)

    return [...collapsed, ...nonSigns]
}

/**
 * Wrap sign text in parentheses for SRT output.
 * - If uppercaseSigns is enabled, text is already uppercased → no parentheses needed
 * - If text is already parenthesized, don't double-wrap
 * - Multi-line sign text (\N) is joined with " - " inside parentheses
 */
function parenthesizeSign(text: string, uppercase: boolean): string {
    // Strip any alignment tags that may have been injected — signs in merged output
    // don't need their own alignment since they appear above dialogue
    const cleaned = text.replace(/\{\\an\d\}/g, "").trim()
    if (!cleaned) return ""

    // Flatten multi-line to single line with " - " separator
    const flattened = cleaned.replace(/\n/g, " - ")

    if (uppercase) {
        // Uppercase signs don't need parentheses (uppercase is sufficient distinction)
        return flattened
    }

    // Check if already fully parenthesized
    if (flattened.startsWith("(") && flattened.endsWith(")")) {
        return flattened
    }

    return `(${flattened})`
}

/**
 * Merge sign entries with overlapping dialogue entries.
 * Signs are prepended above dialogue text. Standalone signs (no overlapping dialogue)
 * are emitted as separate cues.
 */
function mergeSignsWithDialogue(
    dialogueEntries: SrtEntry[],
    signMeta: Array<{ startMs: number; endMs: number; text: string }>,
    options: Required<NormalSrtOptions>
): SrtEntry[] {
    // Track which signs were merged into at least one dialogue
    const mergedSigns = new Set<number>()

    // For each dialogue, find overlapping signs and prepend their text
    for (const entry of dialogueEntries) {
        const overlappingSigns: string[] = []

        for (let i = 0; i < signMeta.length; i++) {
            const sign = signMeta[i]
            // Check time overlap: sign.start < dialog.end && sign.end > dialog.start
            if (sign.startMs < entry.endMs && sign.endMs > entry.startMs) {
                const formatted = parenthesizeSign(sign.text, options.uppercaseSigns)
                if (formatted) {
                    overlappingSigns.push(formatted)
                    mergedSigns.add(i)
                }
            }
        }

        if (overlappingSigns.length > 0) {
            // Deduplicate identical sign lines
            const uniqueSigns = [...new Set(overlappingSigns)]
            entry.text = uniqueSigns.join("\n") + "\n" + entry.text
        }
    }

    // Collect standalone signs (not merged into any dialogue)
    const standaloneEntries: SrtEntry[] = []
    for (let i = 0; i < signMeta.length; i++) {
        if (!mergedSigns.has(i)) {
            const sign = signMeta[i]
            const formatted = parenthesizeSign(sign.text, options.uppercaseSigns)
            if (formatted) {
                standaloneEntries.push({
                    index: 0,
                    startMs: sign.startMs,
                    endMs: sign.endMs,
                    text: formatted
                })
            }
        }
    }

    // Combine and re-sort by start time
    const combined = [...dialogueEntries, ...standaloneEntries]
    combined.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
    return combined
}
