/**
 * Mode 2: Keep Typesetting (rcombs' keep_unknown_ass_markup)
 *
 * Converts ASS → SRT while PRESERVING all ASS override tags inside {} blocks.
 * - ALL override tag blocks pass through verbatim
 * - Alignment tag {\anN} is always emitted at start
 * - Style reset {\rStyleName} is preserved
 * - Unknown/complex tags pass through (srt_unknown_tag_cb)
 * - ALL lines kept — dialogue, signs, TS, karaoke — nothing filtered
 *
 * Output is SRT with embedded ASS override tags, renderable by mpv/VLC (libass).
 */

import { type AssTrack } from "../ass-parser"
import { tokenizeText, type AssTag } from "../ass-tags"
import { type SrtEntry, writeSrt, reindex } from "../srt-writer"

export function convertKeepTs(track: AssTrack): string {
    const entries: SrtEntry[] = []

    // Sort events by start time, then layer, then end time (preserves render stacking order)
    const dialogues = track.events
        .filter(e => e.type === "Dialogue")
        .sort((a, b) => a.Start - b.Start || a.Layer - b.Layer || a.End - b.End)

    for (const event of dialogues) {
        // Find the style to get default alignment
        const style = track.styles.find(s => s.Name === event.Style)
        const defaultAlignment = style?.Alignment ?? 2

        // Process text — preserve all override tags, just handle \N/\n/\h
        let text = processTextKeepTags(event.Text, defaultAlignment)

        text = text.trim()
        if (!text) continue

        entries.push({
            index: entries.length + 1,
            startMs: event.Start,
            endMs: event.End,
            text
        })
    }

    return writeSrt(reindex(entries))
}

/**
 * Process ASS text while preserving all override tags.
 * - Inserts {\anN} alignment if not already present
 * - Preserves all {} blocks verbatim
 * - Converts \N → newline, \n → newline, \h → hard space in text segments
 */
function processTextKeepTags(text: string, defaultAlignment: number): string {
    const segments = tokenizeText(text)
    let result = ""
    let hasAlignment = false
    let inDrawing = false

    // Check if alignment is already specified in the first tag block
    if (segments.length > 0 && segments[0].type === "tags" && segments[0].tags) {
        hasAlignment = segments[0].tags.some((t: AssTag) => ["an", "a"].includes(t.name.toLowerCase()))
    }

    // If no alignment tag, inject one
    // Merge into first tag block if possible, otherwise prepend standalone
    // \an2 is the global default — only inject if alignment differs
    let needAlignment = !hasAlignment && defaultAlignment !== 2
    let isFirstTagBlock = true

    for (const seg of segments) {
        if (seg.type === "tags") {
            if (needAlignment && isFirstTagBlock) {
                // Inject \anN right after the opening { of the first tag block
                result += `{\\an${defaultAlignment}` + seg.content.slice(1)
                needAlignment = false
            } else {
                // Preserve the entire tag block verbatim
                result += seg.content
            }
            isFirstTagBlock = false

            // Track drawing state
            if (seg.tags) {
                for (const tag of seg.tags) {
                    if (tag.name.toLowerCase() === "p") {
                        inDrawing = parseInt(tag.value, 10) > 0
                    }
                }
            }
        } else if (seg.type === "text") {
            // If first segment is text and we still need alignment, prepend standalone
            if (needAlignment) {
                result += `{\\an${defaultAlignment}}`
                needAlignment = false
            }
            if (inDrawing) {
                // Preserve drawing commands verbatim for libass-based players
                result += seg.content
            } else {
                // Process text commands but keep everything else
                let processedText = seg.content
                processedText = processedText.replace(/\\N/g, "\n")
                processedText = processedText.replace(/\\n/g, "\n")
                processedText = processedText.replace(/\\h/g, "\u00A0")
                result += processedText
            }
        }
    }

    return result
}
