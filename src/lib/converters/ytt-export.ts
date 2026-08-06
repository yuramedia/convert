import { type AssTrack, type AssStyle } from "../ass-parser"
import { tokenizeText } from "../ass-tags"

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
    if (!colorStr) return { hex: useOffWhite ? "#FEFEFE" : "#FFFFFF", opacity: 255 }

    let clean = colorStr.replace(/^&H/i, "").replace(/&$/i, "").trim()
    if (clean.length === 0) return { hex: useOffWhite ? "#FEFEFE" : "#FFFFFF", opacity: 255 }

    // Pad if necessary
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
    if (opacity === 255) opacity = 254 // Capped at 254 per YTSubConverter to prevent YouTube server stripping attribute

    let hex = `#${r.toString(16).padStart(2, "0").toUpperCase()}${g.toString(16).padStart(2, "0").toUpperCase()}${b.toString(16).padStart(2, "0").toUpperCase()}`

    if (useOffWhite && hex === "#FFFFFF") {
        hex = "#FEFEFE"
    }

    return { hex, opacity }
}

function xmlEscape(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
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
        return 3 // Monospaced Sans-Serif
    }
    if (lower.includes("times") || lower.includes("georgia") || lower.includes("garamond") || lower.includes("serif")) {
        return 2 // Proportional Serif
    }
    if (lower.includes("comic") || lower.includes("casual") || lower.includes("chalkboard")) {
        return 4 // Casual
    }
    if (lower.includes("script") || lower.includes("corsiva") || lower.includes("brush") || lower.includes("cursive")) {
        return 5 // Cursive
    }
    if (lower.includes("caps") || lower.includes("small")) {
        return 6 // Small Caps
    }
    return 0 // Default Proportional Sans-Serif (Roboto/Arial)
}

interface PenStyle {
    b?: boolean
    i?: boolean
    u?: boolean
    fs?: number
    fc?: string
    fo?: number
    bc?: string
    bo?: number
    ec?: string
    et?: number
}

interface InlineSpan {
    text: string
    penStyle: PenStyle
    timeOffsetMs?: number
}

interface EventChunk {
    spans: InlineSpan[]
    alignment: number
    posX?: number
    posY?: number
}

/**
 * Convert ASS dialogue text into styled spans and position overrides.
 */
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

    const spans: InlineSpan[] = []

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
            // Replace ASS line breaks \N or \n with newlines and harden multiple spaces to non-breaking spaces per YTSubConverter spec
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

                const penStyle: PenStyle = {
                    b: currentBold,
                    i: currentItalic,
                    u: currentUnderline,
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
 * Main function: Convert AssTrack to YTT XML format string
 */
export function convertToYtt(track: AssTrack, options: Partial<YttExportOptions> = {}): string {
    const opts: YttExportOptions = { ...DEFAULT_YTT_OPTIONS, ...options }

    const playResX = track.scriptInfo.PlayResX || 1920
    const playResY = track.scriptInfo.PlayResY || 1080

    // Style map for default style lookup
    const styleMap = new Map<string, AssStyle>()
    for (const style of track.styles) {
        styleMap.set(style.Name, style)
    }

    // Default style fallback
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

    // Registries for Pens, Window Styles, and Window Positions
    const penList: { key: string; style: PenStyle }[] = []
    const penKeyToId = new Map<string, number>()

    function getOrCreatePen(style: PenStyle): number {
        const key = JSON.stringify({
            b: !!style.b,
            i: !!style.i,
            u: !!style.u,
            fs: style.fs ?? 0,
            fc: style.fc || "",
            fo: style.fo ?? 254,
            ec: style.ec || "",
            et: style.et ?? 0,
            bc: style.bc || "#000000",
            bo: style.bo ?? 0
        })

        if (penKeyToId.has(key)) {
            return penKeyToId.get(key)!
        }

        const id = penList.length + 1
        penList.push({ key, style })
        penKeyToId.set(key, id)
        return id
    }

    const wsList: { key: string; wfo: number; ju: number }[] = []
    const wsKeyToId = new Map<string, number>()

    function getOrCreateWs(wfo: number, ju: number): number {
        const key = `${wfo}_${ju}`
        if (wsKeyToId.has(key)) {
            return wsKeyToId.get(key)!
        }
        const id = wsList.length + 1
        wsList.push({ key, wfo, ju })
        wsKeyToId.set(key, id)
        return id
    }

    const wpList: { key: string; ap: number; ah: number; av: number }[] = []
    const wpKeyToId = new Map<string, number>()

    function getOrCreateWp(ap: number, ah: number, av: number): number {
        const key = `${ap}_${ah}_${av}`
        if (wpKeyToId.has(key)) {
            return wpKeyToId.get(key)!
        }
        const id = wpList.length + 1
        wpList.push({ key, ap, ah, av })
        wpKeyToId.set(key, id)
        return id
    }

    // Process dialogue events
    const dialogues = track.events.filter(e => e.type === "Dialogue")

    interface GeneratedParagraph {
        startMs: number
        durationMs: number
        penId: number
        wsId: number
        wpId: number
        spans: { text: string; penId?: number; timeOffsetMs?: number }[]
    }

    const paragraphs: GeneratedParagraph[] = []

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
        const wsId = getOrCreateWs(wfoVal, alignInfo.ju)
        const wpId = getOrCreateWp(ap, ah, av)

        // First span pen style forms paragraph default pen
        const basePenId = getOrCreatePen(parsed.spans[0].penStyle)

        const paragraphSpans: { text: string; penId?: number; timeOffsetMs?: number }[] = []

        for (let i = 0; i < parsed.spans.length; i++) {
            const span = parsed.spans[i]
            const spanPenId = getOrCreatePen(span.penStyle)

            paragraphSpans.push({
                text: span.text,
                penId: spanPenId !== basePenId ? spanPenId : undefined,
                timeOffsetMs: span.timeOffsetMs
            })
        }

        paragraphs.push({
            startMs: event.Start,
            durationMs: event.End - event.Start,
            penId: basePenId,
            wsId,
            wpId,
            spans: paragraphSpans
        })
    }

    // Build XML output
    const xmlLines: string[] = []
    xmlLines.push('<?xml version="1.0" encoding="utf-8"?>')
    xmlLines.push('<timedtext format="3">')
    xmlLines.push("  <head>")

    // Dummy elements (id 0) per YTSubConverter iOS/Android player bug workaround
    xmlLines.push('    <wp id="0" ap="7" ah="0" av="0"/>')
    xmlLines.push('    <ws id="0" wfo="0" ju="2"/>')
    xmlLines.push('    <pen id="0" fc="#000000" fo="0" bo="0"/>')

    // Render pens in order of increasing ID
    for (let i = 0; i < penList.length; i++) {
        const id = i + 1
        const p = penList[i].style
        let attrStr = `id="${id}"`

        if (p.b) attrStr += ' b="1"'
        if (p.i) attrStr += ' i="1"'
        if (p.u) attrStr += ' u="1"'
        if (p.fs) attrStr += ` fs="${p.fs}"`
        if (p.fc) attrStr += ` fc="${p.fc}"`
        if (p.fo !== undefined) attrStr += ` fo="${p.fo}"`
        if (p.ec) attrStr += ` ec="${p.ec}"`
        if (p.et) attrStr += ` et="${p.et}"`
        if (p.bc) attrStr += ` bc="${p.bc}"`
        if (p.bo !== undefined) attrStr += ` bo="${p.bo}"`

        xmlLines.push(`    <pen ${attrStr}/>`)
    }

    // Render window styles
    for (let i = 0; i < wsList.length; i++) {
        const id = i + 1
        const ws = wsList[i]
        xmlLines.push(`    <ws id="${id}" wfo="${ws.wfo}" ju="${ws.ju}"/>`)
    }

    // Render window positions
    for (let i = 0; i < wpList.length; i++) {
        const id = i + 1
        const wp = wpList[i]
        xmlLines.push(`    <wp id="${id}" ap="${wp.ap}" ah="${wp.ah}" av="${wp.av}"/>`)
    }

    xmlLines.push("  </head>")
    xmlLines.push("  <body>")

    // Render paragraphs
    for (const p of paragraphs) {
        let pTag = `    <p t="${p.startMs}" d="${p.durationMs}" wp="${p.wpId}" ws="${p.wsId}" p="${p.penId}">`

        // Check if paragraph has multiple spans or inline timing
        const hasSpans = p.spans.some(s => s.penId !== undefined || s.timeOffsetMs !== undefined)

        if (!hasSpans && p.spans.length === 1) {
            xmlLines.push(`${pTag}${xmlEscape(p.spans[0].text)}</p>`)
        } else {
            let innerText = ""
            for (const s of p.spans) {
                let sAttr = ""
                if (s.penId !== undefined) sAttr += ` p="${s.penId}"`
                if (s.timeOffsetMs !== undefined) sAttr += ` t="${s.timeOffsetMs}"`

                if (sAttr.length > 0) {
                    innerText += `<s${sAttr}>${xmlEscape(s.text)}</s>`
                } else {
                    innerText += xmlEscape(s.text)
                }
            }
            xmlLines.push(`${pTag}${innerText}</p>`)
        }
    }

    xmlLines.push("  </body>")
    xmlLines.push("</timedtext>")

    return xmlLines.join("\n")
}
