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

import { type AssTrack, type AssEvent } from "../ass-parser"
import { convertTagsToHtml, stripTags, tokenizeText } from "../ass-tags"
import { type SrtEntry, writeSrt, mergeduplicates, reindex } from "../srt-writer"

export interface NormalSrtOptions {
    useHtmlTags: boolean
    mergeDuplicates: boolean
    stripEmptyLines: boolean
}

export const DEFAULT_NORMAL_OPTIONS: NormalSrtOptions = {
    useHtmlTags: true,
    mergeDuplicates: true,
    stripEmptyLines: true
}

/**
 * Heuristic to detect if an event is likely Typesetting (Sign) vs Dialogue.
 * Signs should appear before dialogue in merged SRT blocks (so dialogue stays at the bottom).
 */
function isLikelySign(event: AssEvent, track: AssTrack): boolean {
    // 1. Check for "complex" tags that almost always imply typesetting
    const segments = tokenizeText(event.Text)
    const tags = segments.flatMap(s => s.tags || [])

    if (tags.some(t => ["pos", "move", "clip", "iclip", "p"].includes(t.name.toLowerCase()))) {
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
    const style = track.styles.find(s => s.Name === event.Style)
    if (style && style.Alignment >= 4) {
        return true
    }

    // 5. Fallback to common style name keywords
    const name = event.Style.toLowerCase()
    const keywords = ["sign", "ts", "typeset", "op", "ed", "song"]
    if (keywords.some(k => name.includes(k))) {
        return true
    }

    return false
}

export function convertNormalSrt(track: AssTrack, options: NormalSrtOptions = DEFAULT_NORMAL_OPTIONS): string {
    let entries: SrtEntry[] = []

    // Sort events by start time, then sign-ness, then layer, then end time
    // Signs first so they appear at the top of merged SRT blocks (dialogue at bottom)
    const dialogues = track.events
        .filter(e => e.type === "Dialogue")
        .sort((a, b) => {
            if (a.Start !== b.Start) return a.Start - b.Start

            const aIsSign = isLikelySign(a, track)
            const bIsSign = isLikelySign(b, track)

            if (aIsSign !== bIsSign) {
                return aIsSign ? -1 : 1
            }

            if (a.Layer !== b.Layer) return a.Layer - b.Layer
            return a.End - b.End
        })

    for (const event of dialogues) {
        let text: string

        if (options.useHtmlTags) {
            const style = track.styles.find(s => s.Name === event.Style)
            text = convertTagsToHtml(event.Text, true, {
                // b: style?.Bold, // Ignored per user request, only inline {\b1} will trigger <b>
                i: style?.Italic,
                u: style?.Underline,
                s: style?.StrikeOut
            })
        } else {
            text = stripTags(event.Text)
        }

        // Clean up
        text = text.trim()
        if (options.stripEmptyLines && !text) continue

        entries.push({
            index: entries.length + 1,
            startMs: event.Start,
            endMs: event.End,
            text
        })
    }

    if (options.mergeDuplicates) {
        entries = mergeduplicates(entries)
    }

    entries = reindex(entries)

    return writeSrt(entries)
}
