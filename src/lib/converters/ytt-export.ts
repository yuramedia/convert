import { type AssTrack, type AssStyle } from "../ass-parser"
import { tokenizeText } from "../ass-tags"
import {
    writeYtt,
    type YttEntry,
    type YttPen,
    type YttPosition,
    type YttWindowStyle,
    type YttSpan
} from "../ytt-writer"

export interface YttExportOptions {
    /** Window Foreground Opacity: 0 for transparent background box, 255 for opaque box (default: 0) */
    wfo: number
    /** Convert pure white (#FFFFFF) to off-white (#FEFEFE) for YouTube Android compatibility (default: true) */
    useOffWhite: boolean
    /** Convert ASS \k karaoke tags to inline timed spans <s> (default: true) */
    convertKaraoke: boolean
    /** Convert ASS alignment (\an) and position (\pos) tags to window positions <wp> (default: true) */
    convertPositioning: boolean
}

export const DEFAULT_YTT_OPTIONS: YttExportOptions = {
    wfo: 0,
    useOffWhite: true,
    convertKaraoke: true,
    convertPositioning: true
}

interface ParsedColor {
    hex: string
    opacity: number
}

function parseAssColor(colorStr: string, useOffWhite: boolean = true): ParsedColor {
    if (!colorStr) return { hex: useOffWhite ? "#FEFEFE" : "#FFFFFF", opacity: 254 }

    let clean = colorStr.replace(/^&H/i, "").replace(/&$/i, "").trim()
    if (clean.length === 0) return { hex: useOffWhite ? "#FEFEFE" : "#FFFFFF", opacity: 254 }

    while (clean.length < 6) clean = "0" + clean

    let alphaHex = "00"
    let bHex = "FF"
    let gHex = "FF"
    let rHex = "FF"

    if (clean.length >= 8) {
        alphaHex = clean.substring(0, 2)
        bHex = clean.substring(2, 4)
        gHex = clean.substring(4, 6)
        rHex = clean.substring(6, 8)
    } else {
        bHex = clean.substring(0, 2)
        gHex = clean.substring(2, 4)
        rHex = clean.substring(4, 6)
    }

    const r = parseInt(rHex, 16) || 0
    const g = parseInt(gHex, 16) || 0
    const b = parseInt(bHex, 16) || 0
    const alpha = parseInt(alphaHex, 16) || 0

    let opacity = Math.max(0, Math.min(255, 255 - alpha))
    if (opacity === 255) opacity = 254

    let hex = `#${r.toString(16).padStart(2, "0").toUpperCase()}${g.toString(16).padStart(2, "0").toUpperCase()}${b.toString(16).padStart(2, "0").toUpperCase()}`

    if (useOffWhite && hex === "#FFFFFF") {
        hex = "#FEFEFE"
    }

    return { hex, opacity }
}

interface AlignmentInfo {
    ap: number
    ah: number
    av: number
    ju: number
}

function getAlignmentInfo(an: number): AlignmentInfo {
    switch (an) {
        case 1:
            return { ap: 6, ah: 0, av: 100, ju: 0 }
        case 2:
            return { ap: 7, ah: 50, av: 100, ju: 2 }
        case 3:
            return { ap: 8, ah: 100, av: 100, ju: 1 }
        case 4:
            return { ap: 3, ah: 0, av: 50, ju: 0 }
        case 5:
            return { ap: 4, ah: 50, av: 50, ju: 2 }
        case 6:
            return { ap: 5, ah: 100, av: 50, ju: 1 }
        case 7:
            return { ap: 0, ah: 0, av: 0, ju: 0 }
        case 8:
            return { ap: 1, ah: 50, av: 0, ju: 2 }
        case 9:
            return { ap: 2, ah: 100, av: 0, ju: 1 }
        default:
            return { ap: 7, ah: 50, av: 100, ju: 2 }
    }
}

function getYouTubeFontStyleId(fontName: string): number {
    if (!fontName) return 0
    const lower = fontName.toLowerCase()
    if (lower.includes("courier") || lower.includes("consolas") || lower.includes("monaco") || lower.includes("mono")) {
        return 3
    }
    if (lower.includes("times") || lower.includes("georgia") || lower.includes("garamond") || lower.includes("serif")) {
        return 2
    }
    if (lower.includes("comic") || lower.includes("casual") || lower.includes("chalkboard")) {
        return 4
    }
    if (lower.includes("script") || lower.includes("corsiva") || lower.includes("brush") || lower.includes("cursive")) {
        return 5
    }
    if (lower.includes("caps") || lower.includes("small")) {
        return 6
    }
    return 0
}

interface EventChunk {
    spans: { text: string; penStyle: YttPen; timeOffsetMs?: number }[]
    alignment: number
    posX?: number
    posY?: number
}

function parseEventContent(text: string, baseStyle: AssStyle, options: YttExportOptions): EventChunk {
    const segments = tokenizeText(text)

    let currentFontName = baseStyle.FontName
    let currentBold = baseStyle.Bold
    let currentItalic = baseStyle.Italic
    let currentUnderline = baseStyle.Underline
    let currentColor = baseStyle.PrimaryColour
    let currentOutlineColor = baseStyle.OutlineColour
    let currentBackColor = baseStyle.BackColour
    let currentAlignment = baseStyle.Alignment
    let posX: number | undefined = undefined
    let posY: number | undefined = undefined
    let activeOffsetMs = 0
    let pendingDurationMs = 0
    let hasSeenKaraoke = false

    const spans: { text: string; penStyle: YttPen; timeOffsetMs?: number }[] = []

    for (const seg of segments) {
        if (seg.type === "tags" && seg.tags) {
            for (const tag of seg.tags) {
                const name = tag.name.toLowerCase()
                const val = tag.value.trim()

                if (name === "fn") {
                    currentFontName = val.length > 0 ? val : baseStyle.FontName
                } else if (name === "b") {
                    currentBold = val === "1" || val === "true" || (val === "" && tag.raw === "\\b")
                } else if (name === "i") {
                    currentItalic = val === "1" || val === "true" || (val === "" && tag.raw === "\\i")
                } else if (name === "u") {
                    currentUnderline = val === "1" || val === "true" || (val === "" && tag.raw === "\\u")
                } else if (name === "c" || name === "1c") {
                    currentColor = val.length > 0 ? val : baseStyle.PrimaryColour
                } else if (name === "3c") {
                    currentOutlineColor = val.length > 0 ? val : baseStyle.OutlineColour
                } else if (name === "4c") {
                    currentBackColor = val.length > 0 ? val : baseStyle.BackColour
                } else if (name === "an") {
                    const parsedAn = parseInt(val, 10)
                    if (parsedAn >= 1 && parsedAn <= 9) {
                        currentAlignment = parsedAn
                    }
                } else if (name === "pos" && options.convertPositioning) {
                    const match = val.match(/^\(?\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)?$/)
                    if (match) {
                        posX = parseFloat(match[1])
                        posY = parseFloat(match[2])
                    }
                } else if ((name === "k" || name === "kf" || name === "ko" || name === "k") && options.convertKaraoke) {
                    hasSeenKaraoke = true
                    const durationCs = parseInt(val, 10) || 0
                    pendingDurationMs += durationCs * 10
                }
            }
        } else if (seg.type === "text" && seg.content) {
            const cleanText = seg.content
                .replace(/\\N/g, "\n")
                .replace(/\\n/g, "\n")
                .replace(/  +/g, m => "\u00A0".repeat(m.length))

            if (cleanText.length > 0) {
                const fc = parseAssColor(currentColor, options.useOffWhite)
                const ec = parseAssColor(currentOutlineColor, options.useOffWhite)
                const bc = parseAssColor(currentBackColor, options.useOffWhite)
                const fsId = getYouTubeFontStyleId(currentFontName)

                let bo = 0
                if (options.wfo > 0) {
                    bo = options.wfo === 255 ? 254 : options.wfo
                } else if (currentBackColor !== baseStyle.BackColour && currentBackColor !== "") {
                    bo = bc.opacity === 255 ? 254 : bc.opacity
                }

                const penStyle: YttPen = {
                    bold: currentBold,
                    italic: currentItalic,
                    underline: currentUnderline,
                    fs: fsId > 0 ? fsId : undefined,
                    fc: fc.hex,
                    fo: fc.opacity,
                    ec: ec.hex,
                    et: baseStyle.Outline > 0 ? 4 : undefined,
                    bc: bc.hex || "#000000",
                    bo
                }

                let spanOffset: number | undefined = undefined
                if (hasSeenKaraoke) {
                    spanOffset = activeOffsetMs
                    activeOffsetMs += pendingDurationMs
                    pendingDurationMs = 0
                }

                spans.push({
                    text: cleanText,
                    penStyle,
                    timeOffsetMs: spanOffset
                })
            }
        }
    }

    return {
        spans,
        alignment: currentAlignment,
        posX,
        posY
    }
}

/**
 * Convert AssTrack to YTT XML format string
 */
export function convertToYtt(track: AssTrack, options: Partial<YttExportOptions> = {}): string {
    const opts: YttExportOptions = { ...DEFAULT_YTT_OPTIONS, ...options }

    const playResX = track.scriptInfo.PlayResX || 1920
    const playResY = track.scriptInfo.PlayResY || 1080

    const styleMap = new Map<string, AssStyle>()
    for (const style of track.styles) {
        styleMap.set(style.Name, style)
    }

    const defaultStyle: AssStyle = track.styles[0] || {
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
        Shadow: 1,
        Alignment: 2,
        MarginL: 10,
        MarginR: 10,
        MarginV: 10,
        Encoding: 1,
        Blur: 0,
        Justify: 0,
        _raw: {}
    }

    const dialogues = track.events.filter(e => e.type === "Dialogue")
    const entries: YttEntry[] = []

    for (const event of dialogues) {
        if (event.End <= event.Start) continue

        const style = styleMap.get(event.Style) || defaultStyle
        const parsed = parseEventContent(event.Text, style, opts)

        if (parsed.spans.length === 0) continue

        const alignInfo = getAlignmentInfo(parsed.alignment)

        let ap = alignInfo.ap
        let ah = alignInfo.ah
        let av = alignInfo.av

        if (parsed.posX !== undefined && parsed.posY !== undefined) {
            ah = Math.max(0, Math.min(100, Math.round((parsed.posX / playResX) * 100)))
            av = Math.max(0, Math.min(100, Math.round((parsed.posY / playResY) * 100)))
        }

        const wfoVal = opts.wfo === 255 ? 254 : opts.wfo
        const position: YttPosition = { ap, ah, av }
        const windowStyle: YttWindowStyle = { ju: alignInfo.ju, wfo: wfoVal }

        const entrySpans: YttSpan[] = parsed.spans.map(s => ({
            text: s.text,
            pen: s.penStyle,
            timeOffsetMs: s.timeOffsetMs
        }))

        entries.push({
            startMs: event.Start,
            durationMs: event.End - event.Start,
            position,
            windowStyle,
            spans: entrySpans
        })
    }

    return writeYtt(entries)
}
