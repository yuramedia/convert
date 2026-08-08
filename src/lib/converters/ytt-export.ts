import { type AssTrack, type AssStyle } from "../ass-parser"
import { tokenizeText, parseCoords } from "../ass-tags"
import {
    writeYtt,
    type YttEntry,
    type YttPen,
    type YttPosition,
    type YttWindowStyle,
    type YttSpan
} from "../ytt-writer"

export interface YttExportOptions {
    /** Background box opacity override: 0 = use style-derived value, >0 = force this opacity on all pens (default: 0) */
    wfo: number
    /** Convert pure white (#FFFFFF) to off-white (#FEFEFE) for YouTube Android compatibility (default: true) */
    useOffWhite: boolean
    /** Convert ASS \k karaoke tags to inline timed spans <s> (default: true) */
    convertKaraoke: boolean
    /** Convert ASS alignment (\an) and position (\pos) tags to window positions <wp> (default: true) */
    convertPositioning: boolean
    /**
     * Step size in ms used to simulate \move animation, since YTT has no native tweened
     * position — a \move is instead split into a burst of static <p> snapshots at this
     * interval, each with its own interpolated <wp>, mirroring YTSubConverter's approach
     * of stepping the animation forward a couple of video frames at a time (default: 100)
     */
    moveStepMs: number
    /** Apply YouTube player enhancement workarounds (italic prefetch, dark text hack, etc.) per YTSubConverter (default: true) */
    applyEnhancements: boolean
}

export const DEFAULT_YTT_OPTIONS: YttExportOptions = {
    wfo: 0,
    useOffWhite: true,
    convertKaraoke: true,
    convertPositioning: true,
    moveStepMs: 100,
    applyEnhancements: true
}

// ─── Reference Resolution ────────────────────────────────────────────────────
// YTSubConverter uses a fixed 1280×720 reference resolution for all coordinate
// calculations. ASS pixel positions are first scaled from PlayRes to this
// reference, then converted to YouTube percentage coordinates.
const YTT_REF_WIDTH = 1280
const YTT_REF_HEIGHT = 720

// ─── Color Parsing ───────────────────────────────────────────────────────────

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

/**
 * Parse a standalone ASS alpha tag value (e.g. from \1a, \3a, \4a).
 * Format: &HXX& where XX is the alpha byte. Returns opacity 0-254.
 */
function parseAssAlpha(alphaStr: string): number {
    if (!alphaStr) return 254
    const clean = alphaStr.replace(/^&H/i, "").replace(/&$/i, "").trim()
    const alpha = parseInt(clean, 16) || 0
    let opacity = Math.max(0, Math.min(255, 255 - alpha))
    if (opacity === 255) opacity = 254
    return opacity
}

// ─── Position Coordinate Conversion ──────────────────────────────────────────
// YTSubConverter counteracts YouTube's built-in position shifting.
// YouTube moves subtitles towards the center: realPos = 2 + youtubePos * 0.96
// To get our desired position, we must reverse: youtubePos = (percentage - 2) / 0.96

/**
 * Convert a pixel coordinate (in the 1280×720 reference space) to a YouTube
 * position attribute (0-100), applying the anti-adjustment formula from
 * YTSubConverter's GetYouTubeCoord.
 */
function getYouTubeCoord(pixelCoord: number, maxValue: number): number {
    let percentage = (pixelCoord / maxValue) * 100
    percentage = (percentage - 2) / 0.96
    percentage = Math.max(percentage, 0)
    percentage = Math.min(percentage, 100)
    return Math.round(percentage)
}

// ─── Alignment → Anchor/Position Mapping ─────────────────────────────────────
// ASS \an alignment (numpad) maps to YTT anchor point (ap) and justification (ju).
// Default pixel positions are at 2%/50%/98% of the reference resolution (1280×720).
// These pixel positions then go through the GetYouTubeCoord anti-adjustment.

interface AlignmentInfo {
    /** YTT anchor point (0-8) */
    ap: number
    /** YouTube ah coordinate (after anti-adjustment) */
    ah: number
    /** YouTube av coordinate (after anti-adjustment) */
    av: number
    /** Justification: 0=left, 1=right, 2=center */
    ju: number
}

/**
 * Map ASS \an numpad alignment to YTT anchor point, default position, and justification.
 *
 * Follows YTSubConverter's mapping:
 * - GetAnchorPoint: alignment 1→BottomLeft(6), 2→BottomCenter(7), ..., 9→TopRight(2)
 * - GetJustificationId: Left columns→0, Center→2, Right→1
 * - GetDefaultPosition: uses 2%/50%/98% of reference video dimensions
 * - GetYouTubeCoord: applies (percentage - 2) / 0.96 anti-adjustment
 */
function getAlignmentInfo(an: number): AlignmentInfo {
    // Default pixel positions in the 1280×720 reference space
    const left = YTT_REF_WIDTH * 0.02 // 25.6px
    const centerH = YTT_REF_WIDTH / 2 // 640px
    const right = YTT_REF_WIDTH * 0.98 // 1254.4px
    const top = YTT_REF_HEIGHT * 0.02 // 14.4px
    const centerV = YTT_REF_HEIGHT / 2 // 360px
    const bottom = YTT_REF_HEIGHT * 0.98 // 705.6px

    // Map ASS alignment to anchor point ID, default pixel position, and justification
    // Anchor points: 0=TopLeft, 1=TopCenter, 2=TopRight, 3=MiddleLeft, 4=Center,
    //                5=MiddleRight, 6=BottomLeft, 7=BottomCenter, 8=BottomRight
    switch (an) {
        case 1:
            return {
                ap: 6,
                ah: getYouTubeCoord(left, YTT_REF_WIDTH),
                av: getYouTubeCoord(bottom, YTT_REF_HEIGHT),
                ju: 0
            }
        case 2:
            return {
                ap: 7,
                ah: getYouTubeCoord(centerH, YTT_REF_WIDTH),
                av: getYouTubeCoord(bottom, YTT_REF_HEIGHT),
                ju: 2
            }
        case 3:
            return {
                ap: 8,
                ah: getYouTubeCoord(right, YTT_REF_WIDTH),
                av: getYouTubeCoord(bottom, YTT_REF_HEIGHT),
                ju: 1
            }
        case 4:
            return {
                ap: 3,
                ah: getYouTubeCoord(left, YTT_REF_WIDTH),
                av: getYouTubeCoord(centerV, YTT_REF_HEIGHT),
                ju: 0
            }
        case 5:
            return {
                ap: 4,
                ah: getYouTubeCoord(centerH, YTT_REF_WIDTH),
                av: getYouTubeCoord(centerV, YTT_REF_HEIGHT),
                ju: 2
            }
        case 6:
            return {
                ap: 5,
                ah: getYouTubeCoord(right, YTT_REF_WIDTH),
                av: getYouTubeCoord(centerV, YTT_REF_HEIGHT),
                ju: 1
            }
        case 7:
            return { ap: 0, ah: getYouTubeCoord(left, YTT_REF_WIDTH), av: getYouTubeCoord(top, YTT_REF_HEIGHT), ju: 0 }
        case 8:
            return {
                ap: 1,
                ah: getYouTubeCoord(centerH, YTT_REF_WIDTH),
                av: getYouTubeCoord(top, YTT_REF_HEIGHT),
                ju: 2
            }
        case 9:
            return { ap: 2, ah: getYouTubeCoord(right, YTT_REF_WIDTH), av: getYouTubeCoord(top, YTT_REF_HEIGHT), ju: 1 }
        default:
            return {
                ap: 7,
                ah: getYouTubeCoord(centerH, YTT_REF_WIDTH),
                av: getYouTubeCoord(bottom, YTT_REF_HEIGHT),
                ju: 2
            }
    }
}

// ─── Font Style ID ───────────────────────────────────────────────────────────
// Maps font family names (including Microsoft Windows included typefaces)
// to YouTube's fs attribute ID (0-7).
// Reference: https://en.wikipedia.org/wiki/List_of_typefaces_included_with_Microsoft_Windows

function getYouTubeFontStyleId(fontName: string): number {
    if (!fontName) return 0
    const lower = fontName.toLowerCase().trim()

    // 1. Exact match for known typefaces (Windows & standard subtitle fonts)
    switch (lower) {
        // Monospaced Serif (fs=1)
        case "courier new":
        case "courier":
        case "fixedsys":
        case "nimbus mono l":
        case "cutive mono":
            return 1

        // Proportional Serif (fs=2)
        case "times new roman":
        case "times":
        case "georgia":
        case "cambria":
        case "palatino linotype":
        case "garamond":
        case "book antiqua":
        case "century schoolbook":
        case "bookman old style":
        case "constantia":
        case "sylfaen":
        case "ms serif":
        case "pt serif caption":
        case "batang":
        case "mingliu":
        case "simsun":
        case "nsimsun":
            return 2

        // Monospaced Sans-Serif (fs=3)
        case "lucida console":
        case "consolas":
        case "deja vu sans mono":
        case "dejavu sans mono":
        case "monaco":
        case "pt mono":
        case "terminal":
        case "cascadia code":
        case "cascadia mono":
        case "ms gothic":
        case "lucida sans typewriter":
            return 3

        // Casual / Informal (fs=5)
        case "comic sans ms":
        case "impact":
        case "handlee":
        case "ink free":
        case "papyrus":
            return 5

        // Cursive / Script (fs=6)
        case "monotype corsiva":
        case "segoe script":
        case "segoe print":
        case "gabriola":
        case "pristina":
        case "urw chancery l":
        case "apple chancery":
        case "dancing script":
        case "mistral":
        case "viner hand itc":
        case "freestyle script":
        case "edwardian script itc":
        case "kristen itc":
        case "french script mt":
        case "chiller":
        case "curlz mt":
            return 6

        // Small Caps / Display (fs=7)
        case "carrois gothic sc":
        case "copperplate gothic bold":
        case "copperplate gothic light":
        case "copperplate":
        case "castellar":
        case "engravers mt":
        case "felix titling":
            return 7
    }

    // 2. Keyword fallback matching for Windows font variants & sub-families
    if (
        lower.includes("script") ||
        lower.includes("corsiva") ||
        lower.includes("handwriting") ||
        lower.includes("calligraphy")
    ) {
        return 6 // Cursive
    }
    if (
        lower.includes("copperplate") ||
        lower.includes("small caps") ||
        lower.includes("smallcaps") ||
        lower.includes("titling")
    ) {
        return 7 // Small Caps
    }
    if (lower.includes("comic") || lower.includes("casual")) {
        return 5 // Casual
    }
    if (lower.includes("console") || lower.includes("terminal") || lower.includes("typewriter")) {
        return 3 // Monospaced Sans-Serif
    }

    return 0 // Default (Roboto / Proportional Sans-Serif: Arial, Segoe UI, Tahoma, Verdana, Calibri, Trebuchet MS, etc.)
}

// ─── Font Scale & Color Helpers ──────────────────────────────────────────────

/**
 * Maps ASS font size to YouTube font scale (sz), matching YTSubConverter:
 * realScale = fontSize / defaultFontSize
 * yttScale = Math.max(1 + (realScale - 1) * 4, 0)
 * returns yttScale * 100 rounded
 */
function getYouTubeFontScale(fontSize: number, defaultFontSize: number = 48): number {
    const base = defaultFontSize > 0 ? defaultFontSize : 48
    const realScale = fontSize / base
    const yttScale = Math.max(1 + (realScale - 1) * 4, 0)
    return Math.round(yttScale * 100)
}

function isDarkHex(hex: string): boolean {
    if (!hex || !hex.startsWith("#") || hex.length < 7) return false
    const r = parseInt(hex.substring(1, 3), 16) || 0
    const g = parseInt(hex.substring(3, 5), 16) || 0
    const b = parseInt(hex.substring(5, 7), 16) || 0
    return Math.max(r, g, b) < 128
}

function brightenHex(hex: string): string {
    if (!hex || !hex.startsWith("#") || hex.length < 7) return "#FFFFFF"
    const r = Math.max(parseInt(hex.substring(1, 3), 16) || 0, 1)
    const g = Math.max(parseInt(hex.substring(3, 5), 16) || 0, 1)
    const b = Math.max(parseInt(hex.substring(5, 7), 16) || 0, 1)
    const max = Math.max(r, g, b)
    const factor = 255 / max
    const br = Math.min(255, Math.round(r * factor))
    const bg = Math.min(255, Math.round(g * factor))
    const bb = Math.min(255, Math.round(b * factor))
    return `#${br.toString(16).padStart(2, "0").toUpperCase()}${bg.toString(16).padStart(2, "0").toUpperCase()}${bb.toString(16).padStart(2, "0").toUpperCase()}`
}

/**
 * Applies YouTube player workarounds & enhancements per YTSubConverter (ApplyEnhancements):
 * 1. AddItalicPrefetch: preloads italic font rendering if any entry contains italic text
 * 2. MakeInvisibleTextBlack: sets color to black for transparent text (Android fallback)
 * 3. ExpandLineForDarkText: Android dark text hack (adds brightened invisible overlay entry)
 * 4. PreventShadowClipping: prevents shadow truncation across section boundaries
 */
function applyEnhancements(entries: YttEntry[], options: YttExportOptions): YttEntry[] {
    if (!options.applyEnhancements) return entries

    const result: YttEntry[] = []

    // 1. Check if any span is italic for Italic Prefetch
    let hasItalic = false
    for (const entry of entries) {
        for (const span of entry.spans) {
            if (span.pen.italic) {
                hasItalic = true
                break
            }
        }
        if (hasItalic) break
    }

    // 2. Process entries
    for (const entry of entries) {
        // Make invisible text black
        for (const span of entry.spans) {
            if (span.pen.fo === 0) {
                span.pen.fc = "#000000"
            }
        }

        // Prevent shadow clipping between spans
        for (let i = 0; i < entry.spans.length - 1; i++) {
            const curr = entry.spans[i]
            const next = entry.spans[i + 1]
            if (curr.pen.et && curr.pen.et > 0 && !curr.pen.underline) {
                if (!curr.text.endsWith(" ") && next.text.startsWith(" ")) {
                    curr.text += " "
                    next.text = next.text.substring(1)
                }
            }
        }

        result.push(entry)

        // Expand Line for Dark Text (Android Dark Text Hack)
        const hasDarkText = entry.spans.some(s => s.pen.fo > 0 && isDarkHex(s.pen.fc))
        if (hasDarkText) {
            const brightEntry: YttEntry = {
                startMs: entry.startMs,
                durationMs: entry.durationMs,
                position: { ...entry.position },
                windowStyle: { ...entry.windowStyle },
                spans: entry.spans.map(s => {
                    const pen: YttPen = { ...s.pen }
                    if (s.pen.fo > 0 && isDarkHex(s.pen.fc)) {
                        pen.fc = brightenHex(s.pen.fc)
                    }
                    pen.fo = 0
                    pen.bo = 0
                    pen.et = undefined
                    pen.ec = undefined
                    return { ...s, pen }
                })
            }
            result.push(brightEntry)
        }
    }

    // Add Italic Prefetch dummy line if italic text exists
    if (hasItalic) {
        result.push({
            startMs: 5000,
            durationMs: 100,
            position: { ap: 8, ah: 100, av: 100 },
            windowStyle: { ju: 1, pd: 0, sd: 0, wfo: 0 },
            spans: [
                {
                    text: "\u200B",
                    pen: {
                        fc: options.useOffWhite ? "#FEFEFE" : "#FFFFFF",
                        fo: 1,
                        bo: 0,
                        italic: true
                    }
                }
            ]
        })
    }

    return result
}

// ─── Move Animation Helper ───────────────────────────────────────────────────

interface MoveAnim {
    x1: number
    y1: number
    x2: number
    y2: number
    /** ms offset from line start; defaults to 0 when \move only has 4 args */
    t1: number
    /** ms offset from line start; defaults to the full line duration when \move only has 4 args */
    t2?: number
}

// ─── Event Content Parsing ───────────────────────────────────────────────────

interface EventChunk {
    spans: { text: string; penStyle: YttPen; timeOffsetMs?: number }[]
    alignment: number
    posX?: number
    posY?: number
    move?: MoveAnim
}

function parseEventContent(text: string, baseStyle: AssStyle, options: YttExportOptions): EventChunk {
    const segments = tokenizeText(text)

    let currentFontName = baseStyle.FontName
    let currentFontSize = baseStyle.FontSize || 48
    let currentOffset = 1 // 0=subscript, 1=regular, 2=superscript
    let currentBold = baseStyle.Bold
    let currentItalic = baseStyle.Italic
    let currentUnderline = baseStyle.Underline
    let currentColor = baseStyle.PrimaryColour
    let currentForeAlpha: number | undefined = undefined
    let currentOutlineColor = baseStyle.OutlineColour
    let currentOutlineAlpha: number | undefined = undefined
    let currentBackColor = baseStyle.BackColour
    let currentBackAlpha: number | undefined = undefined
    let currentAlignment = baseStyle.Alignment
    let posX: number | undefined = undefined
    let posY: number | undefined = undefined
    let move: MoveAnim | undefined = undefined
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
                } else if (name === "fs") {
                    const fsVal = parseFloat(val)
                    if (!isNaN(fsVal) && fsVal > 0) {
                        currentFontSize = fsVal
                    } else {
                        currentFontSize = baseStyle.FontSize || 48
                    }
                } else if (name === "sub" || name === "ytsub") {
                    currentOffset = 0
                } else if (name === "super" || name === "ytsup") {
                    currentOffset = 2
                } else if (name === "ytsur") {
                    currentOffset = 1
                } else if (name === "b") {
                    if (val === "0") currentBold = false
                    else if (val === "1" || (val === "" && tag.raw === "\\b")) currentBold = true
                    else {
                        const w = parseInt(val, 10)
                        currentBold = !isNaN(w) && w > 0
                    }
                } else if (name === "i") {
                    if (val === "0") currentItalic = false
                    else if (val === "1" || (val === "" && tag.raw === "\\i")) currentItalic = true
                    else currentItalic = val !== "0" && val !== ""
                } else if (name === "u") {
                    if (val === "0") currentUnderline = false
                    else if (val === "1" || (val === "" && tag.raw === "\\u")) currentUnderline = true
                    else currentUnderline = val !== "0" && val !== ""
                } else if (name === "c" || name === "1c") {
                    currentColor = val.length > 0 ? val : baseStyle.PrimaryColour
                    currentForeAlpha = undefined // Reset alpha when color changes
                } else if (name === "3c") {
                    currentOutlineColor = val.length > 0 ? val : baseStyle.OutlineColour
                    currentOutlineAlpha = undefined
                } else if (name === "4c") {
                    currentBackColor = val.length > 0 ? val : baseStyle.BackColour
                    currentBackAlpha = undefined
                } else if (name === "1a") {
                    currentForeAlpha = val.length > 0 ? parseAssAlpha(val) : undefined
                } else if (name === "3a") {
                    currentOutlineAlpha = val.length > 0 ? parseAssAlpha(val) : undefined
                } else if (name === "4a") {
                    currentBackAlpha = val.length > 0 ? parseAssAlpha(val) : undefined
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
                } else if (name === "move" && options.convertPositioning) {
                    // \move(x1,y1,x2,y2[,t1,t2]) — AffectsWholeLine per YTSubConverter, so it's
                    // fine to pick this up wherever it appears in the line.
                    const coords = parseCoords(val)
                    if (coords.length >= 4) {
                        move = {
                            x1: coords[0],
                            y1: coords[1],
                            x2: coords[2],
                            y2: coords[3],
                            t1: coords.length >= 6 ? coords[4] : 0,
                            t2: coords.length >= 6 ? coords[5] : undefined
                        }
                    }
                } else if ((name === "k" || name === "kf" || name === "ko") && options.convertKaraoke) {
                    hasSeenKaraoke = true
                    const durationCs = parseInt(val, 10) || 0
                    pendingDurationMs += durationCs * 10
                }
            }
        } else if (seg.type === "text" && seg.content) {
            const cleanText = seg.content
                .replace(/\\N/g, "\n")
                .replace(/\\n/g, "\n")
                .replace(/\\h/g, "\u00A0")
                .replace(/  +/g, m => "\u00A0".repeat(m.length))

            if (cleanText.length > 0) {
                const fc = parseAssColor(currentColor, options.useOffWhite)
                const outlineC = parseAssColor(currentOutlineColor, options.useOffWhite)
                const backC = parseAssColor(currentBackColor, options.useOffWhite)
                const fsId = getYouTubeFontStyleId(currentFontName)
                const sz = getYouTubeFontScale(currentFontSize, baseStyle.FontSize || 48)

                // Apply alpha overrides if present
                const foreOpacity = currentForeAlpha ?? fc.opacity
                const outlineOpacity = currentOutlineAlpha ?? outlineC.opacity
                const backOpacity = currentBackAlpha ?? backC.opacity

                // Determine edge type and edge color based on ASS style
                // YTSubConverter logic:
                // - BorderStyle == 3 (box): outline → background color (bc/bo)
                // - BorderStyle != 3: outline → glow shadow (et=3, ec)
                // - Shadow > 0: shadow → soft shadow (et=4)
                let et: number | undefined = undefined
                let ec: string | undefined = undefined
                let bc: string | undefined = undefined
                let bo = 0

                // User-controlled background box opacity override
                if (options.wfo > 0) {
                    bo = options.wfo === 255 ? 254 : options.wfo
                    bc = bc || "#080808"
                } else if (baseStyle.BorderStyle === 3) {
                    // Box mode: outline becomes background
                    if (baseStyle.Outline > 0) {
                        bc = outlineC.hex
                        bo = outlineOpacity === 255 ? 254 : outlineOpacity
                    }
                    // Shadow becomes edge
                    if (baseStyle.Shadow > 0 && backOpacity > 0) {
                        et = 4 // SoftShadow
                        ec = backC.hex
                    }
                } else {
                    // Normal mode: outline becomes glow edge
                    if (baseStyle.Outline > 0 && outlineOpacity > 0) {
                        et = 3 // Glow
                        ec = outlineC.hex
                    } else if (baseStyle.Shadow > 0 && backOpacity > 0) {
                        // Shadow becomes soft shadow edge
                        et = 4 // SoftShadow
                        ec = backC.hex
                    }
                }

                const penStyle: YttPen = {
                    bold: currentBold,
                    italic: currentItalic,
                    underline: currentUnderline,
                    fs: fsId > 0 ? fsId : undefined,
                    sz: sz !== 100 ? sz : undefined,
                    of: currentOffset !== 1 ? currentOffset : undefined,
                    fc: fc.hex,
                    fo: foreOpacity,
                    ec,
                    et,
                    bc: bc || undefined,
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
        posY,
        move
    }
}

/**
 * Convert AssTrack to YTT XML format string.
 *
 * Follows YTSubConverter's coordinate system:
 * - Uses a fixed 1280×720 reference resolution for position calculations
 * - Applies YouTube's position anti-adjustment: (percentage - 2) / 0.96
 * - Default positions at 2%/50%/98% of reference dimensions
 */
export function convertToYtt(track: AssTrack, options: Partial<YttExportOptions> = {}): string {
    const opts: YttExportOptions = { ...DEFAULT_YTT_OPTIONS, ...options }

    const playResX = track.scriptInfo.PlayResX || 384
    const playResY = track.scriptInfo.PlayResY || 288

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
            // Convert ASS pixel position from PlayRes space to 1280×720 reference space,
            // then apply YouTube's anti-adjustment formula
            const refX = (parsed.posX / playResX) * YTT_REF_WIDTH
            const refY = (parsed.posY / playResY) * YTT_REF_HEIGHT
            ah = getYouTubeCoord(refX, YTT_REF_WIDTH)
            av = getYouTubeCoord(refY, YTT_REF_HEIGHT)
        }

        const position: YttPosition = { ap, ah, av }
        // YTSubConverter always writes wfo="0" and adds pd/sd for text direction
        const windowStyle: YttWindowStyle = { ju: alignInfo.ju, pd: 0, sd: 0, wfo: 0 }

        const entrySpans: YttSpan[] = parsed.spans.map(s => ({
            text: s.text,
            pen: s.penStyle,
            timeOffsetMs: s.timeOffsetMs
        }))

        const lineDurationMs = event.End - event.Start

        if (parsed.move) {
            // YTT has no native tweened position, so \move is simulated by splitting the
            // line into a burst of static <p> snapshots, each pinned to a different <wp>
            // interpolated along the move's path — same high-level approach YTSubConverter
            // uses (there, stepping 2 video frames at a time instead of a fixed ms interval).
            const toAh = (x: number) => getYouTubeCoord((x / playResX) * YTT_REF_WIDTH, YTT_REF_WIDTH)
            const toAv = (y: number) => getYouTubeCoord((y / playResY) * YTT_REF_HEIGHT, YTT_REF_HEIGHT)

            const { x1, y1, x2, y2 } = parsed.move
            const t1 = Math.max(0, Math.min(lineDurationMs, parsed.move.t1))
            const t2 = Math.max(0, Math.min(lineDurationMs, parsed.move.t2 ?? lineDurationMs))

            if (t2 <= t1) {
                // Degenerate/invalid \move (e.g. t2 <= t1): per YTSubConverter, an invalid
                // move animation is simply dropped, falling back to the line's normal
                // alignment/pos-derived static position instead of x1/y1 or x2/y2.
                entries.push({
                    startMs: event.Start,
                    durationMs: lineDurationMs,
                    position,
                    windowStyle,
                    spans: entrySpans
                })
            } else {
                const pushSnapshot = (fromMs: number, toMs: number, x: number, y: number) => {
                    if (toMs <= fromMs) return
                    entries.push({
                        startMs: event.Start + fromMs,
                        durationMs: toMs - fromMs,
                        position: { ap, ah: toAh(x), av: toAv(y) },
                        windowStyle,
                        spans: entrySpans
                    })
                }

                // Static at the start position before the move begins
                pushSnapshot(0, t1, x1, y1)

                // Stepped interpolation across the move's active window
                const stepMs = Math.max(1, opts.moveStepMs)
                for (let t = t1; t < t2; t += stepMs) {
                    const segEnd = Math.min(t + stepMs, t2)
                    const midT = (t + segEnd) / 2
                    const frac = (midT - t1) / (t2 - t1)
                    pushSnapshot(t, segEnd, x1 + (x2 - x1) * frac, y1 + (y2 - y1) * frac)
                }

                // Static at the end position after the move finishes
                pushSnapshot(t2, lineDurationMs, x2, y2)
            }
        } else {
            entries.push({
                startMs: event.Start,
                durationMs: lineDurationMs,
                position,
                windowStyle,
                spans: entrySpans
            })
        }
    }

    const finalEntries = applyEnhancements(entries, opts)
    return writeYtt(finalEntries)
}
