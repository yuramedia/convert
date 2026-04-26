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

import { type AssTrack } from "../ass-parser"
import { convertTagsToHtml, stripTags } from "../ass-tags"
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

export function convertNormalSrt(track: AssTrack, options: NormalSrtOptions = DEFAULT_NORMAL_OPTIONS): string {
    let entries: SrtEntry[] = []

    // Sort events by start time
    const dialogues = track.events.filter(e => e.type === "Dialogue").sort((a, b) => a.Start - b.Start || a.End - b.End)

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
