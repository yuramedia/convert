import { type AssTrack } from "../ass-parser"
import { convertTagsToHtml, stripTags, tokenizeText } from "../ass-tags"
import { isLikelySign } from "./normal-srt"
import { DEFAULT_CSV_OPTIONS, type CsvExportOptions } from "../export-options"
import { formatTimecode } from "../timecode"

export { DEFAULT_CSV_OPTIONS }
export type { CsvExportOptions }

function escapeCsvField(field: string): string {
    if (!field) return ""
    // Normalize line endings to \n to prevent \r carriage return injection
    field = field.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    // Detect formula injection vulnerability even with leading spaces or tabs
    const trimmedLead = field.trimStart()
    const lead = trimmedLead.charAt(0)
    if (lead === "=" || lead === "+" || lead === "@") {
        field = `'${field}`
    } else if (lead === "-") {
        // A "-" followed by whitespace is a dialogue dash, not a formula — leave it alone
        if (!/^-[\s]/.test(trimmedLead)) {
            field = `'${field}`
        }
    }
    if (field.includes(",") || field.includes('"') || field.includes("\n")) {
        return `"${field.replace(/"/g, '""')}"`
    }
    return field
}

export function convertToCsv(track: AssTrack, options: CsvExportOptions = DEFAULT_CSV_OPTIONS): string {
    const fullOptions = { ...DEFAULT_CSV_OPTIONS, ...options }
    const styleMap = new Map(track.styles.map(s => [s.Name, s]))

    const headers: string[] = []
    if (fullOptions.showIndex) headers.push("No.")
    if (fullOptions.showStart) headers.push("Timecode In")
    if (fullOptions.showEnd) headers.push("Timecode Out")
    if (fullOptions.showDuration) headers.push("Duration")
    if (fullOptions.showActor) headers.push("Name")
    if (fullOptions.showStyle) headers.push("Style")
    if (fullOptions.showLayer) headers.push("Layer")
    if (fullOptions.showText) headers.push("Subtitle")

    const rows: string[][] = [headers]

    let index = 1
    for (const event of track.events) {
        if (event.type !== "Dialogue") continue

        const segments = tokenizeText(event.Text)
        const style = styleMap.get(event.Style)
        const isSign = isLikelySign(segments, style)

        if (fullOptions.stripSigns && isSign) continue

        let text: string
        if (fullOptions.useHtmlTags) {
            text = convertTagsToHtml(segments, true, {
                i: style?.Italic,
                u: style?.Underline,
                s: style?.StrikeOut
            })
        } else {
            text = stripTags(segments)
        }

        text = text.trim()
        if (!text) continue

        const timeFormat = fullOptions.timecodeFormat || "time"
        const fps = fullOptions.fps || DEFAULT_CSV_OPTIONS.fps

        const row: string[] = []
        if (fullOptions.showIndex) row.push(String(index))
        if (fullOptions.showStart) row.push(formatTimecode(event.Start, timeFormat, fps))
        if (fullOptions.showEnd) row.push(formatTimecode(event.End, timeFormat, fps))
        if (fullOptions.showDuration) row.push(formatTimecode(event.End - event.Start, timeFormat, fps))
        if (fullOptions.showActor) row.push(event.Name)
        if (fullOptions.showStyle) row.push(event.Style)
        if (fullOptions.showLayer) row.push(String(event.Layer))
        if (fullOptions.showText) row.push(text)

        rows.push(row)
        index++
    }

    return rows.map(row => row.map(escapeCsvField).join(",")).join("\n")
}
