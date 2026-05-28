import * as XLSX from "xlsx"
import { type AssTrack, type AssStyle } from "../ass-parser"
import { convertTagsToHtml, stripTags, tokenizeText, type TextSegment } from "../ass-tags"

export interface XlsxExportOptions {
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

export const DEFAULT_XLSX_OPTIONS: Required<XlsxExportOptions> = {
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

export interface XlsxRow {
    [key: string]: string | number
}

export function convertToXlsxData(track: AssTrack, options: XlsxExportOptions = DEFAULT_XLSX_OPTIONS): XlsxRow[] {
    const fullOptions = { ...DEFAULT_XLSX_OPTIONS, ...options }
    const styleMap = new Map(track.styles.map(s => [s.Name, s]))

    const rows: XlsxRow[] = []
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

        const row: XlsxRow = {}

        if (fullOptions.showIndex) row["No."] = index
        if (fullOptions.showStart) row["Timecode In"] = formatTime(event.Start)
        if (fullOptions.showEnd) row["Timecode Out"] = formatTime(event.End)
        if (fullOptions.showDuration) row["Duration"] = formatTime(event.End - event.Start)
        if (fullOptions.showActor) row["Name"] = event.Name
        if (fullOptions.showStyle) row["Style"] = event.Style
        if (fullOptions.showLayer) row["Layer"] = event.Layer
        if (fullOptions.showText) row["Subtitle"] = text

        rows.push(row)
        index++
    }

    return rows
}

export function convertToXlsxJson(track: AssTrack, options: XlsxExportOptions = DEFAULT_XLSX_OPTIONS): string {
    const rows = convertToXlsxData(track, options)
    return JSON.stringify(rows, null, 2)
}

export function convertToXlsxBuffer(track: AssTrack, options: XlsxExportOptions = DEFAULT_XLSX_OPTIONS): Uint8Array {
    const rows = convertToXlsxData(track, options)

    // Convert data array of objects to sheet
    const worksheet = XLSX.utils.json_to_sheet(rows)

    // Create workbook
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Subtitles")

    // Write to binary buffer
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    return new Uint8Array(excelBuffer)
}
