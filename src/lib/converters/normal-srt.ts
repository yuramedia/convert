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
    useHtmlTags: boolean
    mergeDuplicates: boolean
    stripEmptyLines: boolean
    /** Snap threshold value. Default 0 (disabled). */
    snapThreshold?: number
    /** Unit for snap threshold: 'ms' or 'frames'. Default 'ms'. */
    snapUnit?: "ms" | "frames"
    /** Minimum gap value. Default 0 (disabled). */
    minGap?: number
    /** Unit for minimum gap: 'ms' or 'frames'. Default 'ms'. */
    gapUnit?: "ms" | "frames"
    /** FPS for frame calculations. Default 23.976023976 (24000/1001). */
    fps?: number
}

export const DEFAULT_NORMAL_OPTIONS: Required<NormalSrtOptions> = {
    useHtmlTags: true,
    mergeDuplicates: true,
    stripEmptyLines: true,
    snapThreshold: 0,
    snapUnit: "ms",
    minGap: 0,
    gapUnit: "ms",
    fps: 23.976023976 // Accurate 24000/1001
}

/**
 * Heuristic to detect if an event is likely Typesetting (Sign) vs Dialogue.
 * Signs should appear before dialogue in merged SRT blocks (so dialogue stays at the bottom).
 */
function isLikelySign(segments: TextSegment[], style?: AssStyle): boolean {
    // 1. Check for "complex" tags that almost always imply typesetting
    const tags = segments.flatMap(s => s.tags || [])

    if (tags.some(t => ["pos", "move", "clip", "iclip"].includes(t.name.toLowerCase()))) {
        return true
    }

    // 2. Check for drawing mode (\p1 or higher)
    if (tags.some(t => t.name.toLowerCase() === "p" && parseInt(t.value, 10) > 0)) {
        return true
    }

    // 3. Check for Alignment tags (4-9 are middle/top, usually signs or top-subs)
    const anTag = tags.find(t => ["an", "a"].includes(t.name.toLowerCase()))
    if (anTag) {
        let align = parseInt(anTag.value, 10)
        // \a is legacy alignment: 5,6,7 are top; 9,10,11 are middle
        if (anTag.name.toLowerCase() === "a") {
            if ([5, 6, 7, 9, 10, 11].includes(align)) return true
        } else {
            // \an values 4-9 are middle/top
            if (align >= 4) return true
        }
    }

    // 4. Check Style's default alignment if no tag override exists
    if (style && style.Alignment >= 4) {
        return true
    }

    // 5. Fallback to common style name keywords
    if (style) {
        const name = style.Name.toLowerCase()
        const keywords = ["sign", "ts", "typeset", "op", "ed", "song"]
        if (keywords.some(k => name.includes(k))) {
            return true
        }
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
    const eventWithMetadata = track.events
        .filter(e => e.type === "Dialogue")
        .map(event => {
            const segments = tokenizeText(event.Text)
            const style = styleMap.get(event.Style)
            return {
                event,
                segments,
                style,
                isSign: isLikelySign(segments, style)
            }
        })

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

    let entries: SrtEntry[] = []

    for (const { event, segments, style } of eventWithMetadata) {
        let text: string

        if (fullOptions.useHtmlTags) {
            text = convertTagsToHtml(segments, true, {
                // b: style?.Bold, // Ignored per user request, only inline {\b1} will trigger <b>
                i: style?.Italic,
                u: style?.Underline,
                s: style?.StrikeOut
            })
        } else {
            text = stripTags(segments)
        }

        // Clean up
        text = text.trim()
        if (fullOptions.stripEmptyLines && !text) continue

        entries.push({
            index: entries.length + 1,
            startMs: event.Start,
            endMs: event.End,
            text
        })
    }

    if (fullOptions.mergeDuplicates) {
        entries = mergeduplicates(entries)
    }

    // 4. Apply Timing Adjustments (Snap and Min Gap)
    // Following logic from polo.FrameGap.lua
    const fps = Math.max(0.001, fullOptions.fps || DEFAULT_NORMAL_OPTIONS.fps)
    const msPerFrame = 1000 / fps
    const snapMs =
        fullOptions.snapUnit === "frames"
            ? (fullOptions.snapThreshold || 0) * msPerFrame
            : fullOptions.snapThreshold || 0
    const minGapMs = fullOptions.gapUnit === "frames" ? (fullOptions.minGap || 0) * msPerFrame : fullOptions.minGap || 0

    if (snapMs > 0 || minGapMs > 0) {
        // Must be sorted by start time (already sorted)
        for (let i = 0; i < entries.length - 1; i++) {
            const current = entries[i]
            const next = entries[i + 1]
            const gap = next.startMs - current.endMs

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
