import { type AssTrack, type AssStyle } from "../ass-parser"
import { convertTagsToHtml, stripTags, tokenizeText, type TextSegment } from "../ass-tags"

export interface CsvExportOptions {
    useHtmlTags: boolean
    stripSigns?: boolean
    showIndex: boolean
    showStart: boolean
    showEnd: boolean
    showDuration: boolean
    showActor: boolean
    showStyle: boolean
    showLayer: boolean
    showText: boolean
}

export const DEFAULT_CSV_OPTIONS: Required<CsvExportOptions> = {
    useHtmlTags: true,
    stripSigns: false,
    showIndex: true,
    showStart: true,
    showEnd: true,
    showDuration: true,
    showActor: true,
    showStyle: false,
    showLayer: false,
    showText: true
}

const SIGN_TAGS = new Set(["pos", "move", "clip", "iclip"])
const ALIGN_TAGS = new Set(["an", "a"])
const SIGN_KEYWORDS = ["sign", "ts", "typeset", "op", "ed"]

function isLikelySign(segments: TextSegment[], style?: AssStyle): boolean {
    for (let i = 0; i < segments.length; i++) {
        const segTags = segments[i].tags
        if (!segTags) continue

        for (let j = 0; j < segTags.length; j++) {
            const t = segTags[j]
            const nameLower = t.name.toLowerCase()

            if (SIGN_TAGS.has(nameLower)) return true
            if (nameLower === "p" && parseInt(t.value, 10) > 0) return true

            if (ALIGN_TAGS.has(nameLower)) {
                const align = parseInt(t.value, 10)
                if (nameLower === "a") {
                    if (align === 5 || align === 6 || align === 7 || align === 9 || align === 10 || align === 11)
                        return true
                } else {
                    if (align >= 4 && align <= 9) return true
                }
            }
        }
    }

    if (style && style.Alignment >= 4 && style.Alignment <= 9) {
        return true
    }

    if (style) {
        const name = style.Name.toLowerCase()
        for (let i = 0; i < SIGN_KEYWORDS.length; i++) {
            if (name.includes(SIGN_KEYWORDS[i])) {
                return true
            }
        }
    }

    return false
}

function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const milliseconds = ms % 1000

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`
}

function escapeCsvField(field: string): string {
    if (!field) return ""
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

        const row: string[] = []
        if (fullOptions.showIndex) row.push(String(index))
        if (fullOptions.showStart) row.push(formatTime(event.Start))
        if (fullOptions.showEnd) row.push(formatTime(event.End))
        if (fullOptions.showDuration) row.push(formatTime(event.End - event.Start))
        if (fullOptions.showActor) row.push(event.Name)
        if (fullOptions.showStyle) row.push(event.Style)
        if (fullOptions.showLayer) row.push(String(event.Layer))
        if (fullOptions.showText) row.push(text)

        rows.push(row)
        index++
    }

    return rows.map(row => row.map(escapeCsvField).join(",")).join("\n")
}
