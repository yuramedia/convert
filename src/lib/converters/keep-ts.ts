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

import { type AssTrack, type AssStyle } from "../ass-parser"
import { tokenizeText } from "../ass-tags"
import { type SrtEntry, writeSrt, reindex } from "../srt-writer"
import { isLikelySign } from "./normal-srt"

export interface KeepTsOptions {
    /** When true, explicitly inject \an2 even though it's the libass global default. Default: false */
    injectAn2: boolean
    /** When true, sort sign/TS entries before dialogue entries in SRT output.
     *  This ensures dialogue renders on top (highest z-order) in libass-based players,
     *  since later SRT entries render above earlier ones. Default: true */
    signFirst?: boolean
}

export const DEFAULT_KEEPTS_OPTIONS: KeepTsOptions = {
    injectAn2: false,
    signFirst: true
}

const ALIGN_TAGS = new Set(["an", "a"])

export function convertKeepTs(track: AssTrack, options: KeepTsOptions = DEFAULT_KEEPTS_OPTIONS): string {
    const entries: SrtEntry[] = []
    const signFirst = options.signFirst ?? true

    // Build style map for O(1) lookups
    const styleMap = new Map(track.styles.map(s => [s.Name, s]))

    // Pre-process: filter Dialogue, detect sign-ness
    const eventsWithMeta = track.events
        .filter(e => e.type === "Dialogue")
        .map(event => {
            const style = styleMap.get(event.Style)
            const segments = tokenizeText(event.Text)
            return {
                event,
                style,
                isSign: isLikelySign(segments, style)
            }
        })

    // Sort events chronologically first (start time → layer → end time)
    eventsWithMeta.sort((a, b) =>
        a.event.Start - b.event.Start || a.event.Layer - b.event.Layer || a.event.End - b.event.End
    )

    // When signFirst is enabled, reorder within overlapping timestamp groups
    // so signs come before dialogue. Non-overlapping entries stay chronological.
    // In SRT, later entries render on top (highest z-order in libass), so putting
    // dialogue after signs ensures dialogue is always visible.
    if (signFirst) {
        const reordered: typeof eventsWithMeta = []
        let i = 0

        while (i < eventsWithMeta.length) {
            // Find the extent of the current overlap group
            let groupMaxEnd = eventsWithMeta[i].event.End
            let j = i + 1

            while (j < eventsWithMeta.length && eventsWithMeta[j].event.Start < groupMaxEnd) {
                groupMaxEnd = Math.max(groupMaxEnd, eventsWithMeta[j].event.End)
                j++
            }

            // Group is [i, j). If single entry or no mixed types, push as-is.
            if (j - i <= 1) {
                reordered.push(eventsWithMeta[i])
            } else {
                // Stable partition: signs first, then dialogue (preserves relative order within each)
                const signs: typeof eventsWithMeta = []
                const dialogues: typeof eventsWithMeta = []
                for (let k = i; k < j; k++) {
                    if (eventsWithMeta[k].isSign) {
                        signs.push(eventsWithMeta[k])
                    } else {
                        dialogues.push(eventsWithMeta[k])
                    }
                }
                reordered.push(...signs, ...dialogues)
            }

            i = j
        }

        eventsWithMeta.length = 0
        eventsWithMeta.push(...reordered)
    }

    for (const { event, style } of eventsWithMeta) {
        // Find the style to get default alignment
        const defaultAlignment = style?.Alignment ?? 2

        // Process text — preserve all override tags, just handle \N/\n/\h
        let text = processTextKeepTags(event.Text, defaultAlignment, options.injectAn2)

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
function processTextKeepTags(text: string, defaultAlignment: number, injectAn2: boolean): string {
    const segments = tokenizeText(text)
    let result = ""
    let hasAlignment = false
    let inDrawing = false

    // Check if alignment is already specified in the first tag block
    if (segments.length > 0 && segments[0].type === "tags" && segments[0].tags) {
        const firstTags = segments[0].tags
        for (let i = 0; i < firstTags.length; i++) {
            if (ALIGN_TAGS.has(firstTags[i].name.toLowerCase())) {
                hasAlignment = true
                break
            }
        }
    }

    // If no alignment tag, inject one
    // Merge into first tag block if possible, otherwise prepend standalone
    // When injectAn2 is false, skip injection for \an2 (it's the libass global default)
    const skipBecauseDefault = !injectAn2 && defaultAlignment === 2
    let needAlignment = !hasAlignment && !skipBecauseDefault
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
