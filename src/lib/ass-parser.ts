/**
 * ASS Parser — follows libass (libass/ass.c) conventions
 *
 * References:
 * - libass/ass_types.h — ASS_Style, ASS_Event, ASS_Track structs
 * - libass/ass.c — string2timecode, process_style, process_event_tail
 * - Format line drives field ordering; Text is always last and consumes remaining
 */

// ─── Types (matching libass ASS_Track, ASS_Style, ASS_Event) ─────────────────

export interface ScriptInfo {
    Title: string
    ScriptType: string
    PlayResX: number
    PlayResY: number
    WrapStyle: number
    ScaledBorderAndShadow: boolean
    Timer: number
    YCbCrMatrix: string
    Kerning: boolean
    LayoutResX: number
    LayoutResY: number
    [key: string]: string | number | boolean
}

export interface AssStyle {
    Name: string
    FontName: string
    FontSize: number
    PrimaryColour: string
    SecondaryColour: string
    OutlineColour: string
    BackColour: string
    Bold: boolean
    Italic: boolean
    Underline: boolean
    StrikeOut: boolean
    ScaleX: number
    ScaleY: number
    Spacing: number
    Angle: number
    BorderStyle: number
    Outline: number
    Shadow: number
    Alignment: number
    MarginL: number
    MarginR: number
    MarginV: number
    Encoding: number
    Blur: number
    Justify: number
    /** Raw fields from file for lossless roundtrip */
    _raw: Record<string, string>
}

export interface AssEvent {
    type: "Dialogue" | "Comment"
    Layer: number
    Start: number // milliseconds
    End: number // milliseconds
    Style: string
    Name: string
    MarginL: number
    MarginR: number
    MarginV: number
    Effect: string
    Text: string
}

export interface AssTrack {
    scriptInfo: ScriptInfo
    styles: AssStyle[]
    events: AssEvent[]
    styleFormat: string[]
    eventFormat: string[]
    trackType: "ASS" | "SSA" | "Unknown"
    /** Raw sections preserved for roundtrip (fonts, graphics, etc.) */
    rawSections: { name: string; lines: string[] }[]
}

// ─── Default formats (from libass ass.c) ─────────────────────────────────────

const DEFAULT_ASS_STYLE_FORMAT =
    "Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding"

const DEFAULT_SSA_STYLE_FORMAT =
    "Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, AlphaLevel, Encoding"

const DEFAULT_ASS_EVENT_FORMAT = "Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"

const DEFAULT_SSA_EVENT_FORMAT = "Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"

// ─── Timestamp parsing (libass string2timecode) ──────────────────────────────

/**
 * Parse ASS timestamp `H:MM:SS.CC` → milliseconds
 * libass: tm = ((h * 60LL + m) * 60 + s) * 1000 + ms * 10LL
 * (the "ms" variable in libass is actually centiseconds)
 */
export function parseTimestamp(str: string): number {
    const match = str.trim().match(/^(-?)(\d+):(\d{2}):(\d{2})\.(\d{2})$/)
    if (!match) return 0
    const sign = match[1] === "-" ? -1 : 1
    const h = parseInt(match[2], 10)
    const m = parseInt(match[3], 10)
    const s = parseInt(match[4], 10)
    const cs = parseInt(match[5], 10)
    return sign * (((h * 60 + m) * 60 + s) * 1000 + cs * 10)
}

/**
 * Format milliseconds → ASS timestamp `H:MM:SS.CC`
 */
export function formatAssTimestamp(ms: number): string {
    const sign = ms < 0 ? "-" : ""
    ms = Math.abs(ms)
    const cs = Math.round(ms / 10) % 100
    const totalSeconds = Math.floor(ms / 1000)
    const s = totalSeconds % 60
    const totalMinutes = Math.floor(totalSeconds / 60)
    const m = totalMinutes % 60
    const h = Math.floor(totalMinutes / 60)
    return `${sign}${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`
}

// ─── Parse bool (libass parse_bool) ──────────────────────────────────────────

function parseBool(str: string): boolean {
    const s = str.trim().toLowerCase()
    return s === "yes" || s === "1" || parseInt(s, 10) > 0
}

// ─── Parse Format line ───────────────────────────────────────────────────────

function parseFormatLine(line: string): string[] {
    // Strip "Format:" prefix
    const content = line.replace(/^Format:\s*/i, "")
    return content.split(",").map(f => f.trim())
}

// ─── SSA alignment → numpad alignment (libass numpad2align) ──────────────────

function ssaAlignmentToNumpad(alignment: number): number {
    // SSA uses different alignment values than ASS numpad
    // SSA: 1-3 = bottom, 5-7 = top, 9-11 = middle
    // ASS numpad: 1-3 = bottom, 4-6 = middle, 7-9 = top
    if (alignment >= 1 && alignment <= 3) return alignment // bottom
    if (alignment >= 5 && alignment <= 7) return alignment + 2 // top: 5→7, 6→8, 7→9
    if (alignment >= 9 && alignment <= 11) return alignment - 5 // middle: 9→4, 10→5, 11→6
    // VSFilter compat
    if (alignment === 8) return 3
    if (alignment === 4) return 11
    return alignment
}

// ─── Main Parser ─────────────────────────────────────────────────────────────

export function parseAss(content: string): AssTrack {
    // Handle BOM
    if (content.charCodeAt(0) === 0xfeff) {
        content = content.slice(1)
    }

    const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")

    const track: AssTrack = {
        scriptInfo: {
            Title: "",
            ScriptType: "v4.00+",
            PlayResX: 0,
            PlayResY: 0,
            WrapStyle: 0,
            ScaledBorderAndShadow: false,
            Timer: 100.0,
            YCbCrMatrix: "",
            Kerning: false,
            LayoutResX: 0,
            LayoutResY: 0
        },
        styles: [],
        events: [],
        styleFormat: [],
        eventFormat: [],
        trackType: "Unknown",
        rawSections: []
    }

    let currentSection = ""
    let currentRawSection: { name: string; lines: string[] } | null = null

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()

        // Skip empty lines and comments (lines starting with ;)
        if (trimmed === "" || trimmed.startsWith(";")) {
            if (
                currentRawSection &&
                currentSection !== "[Script Info]" &&
                currentSection !== "[V4+ Styles]" &&
                currentSection !== "[V4 Styles]" &&
                currentSection !== "[Events]"
            ) {
                currentRawSection.lines.push(line)
            }
            continue
        }

        // Section header detection
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            const sectionName = trimmed
            currentSection = sectionName

            if (
                sectionName === "[Script Info]" ||
                sectionName === "[V4+ Styles]" ||
                sectionName === "[V4 Styles]" ||
                sectionName === "[Events]"
            ) {
                if (sectionName === "[V4+ Styles]") track.trackType = "ASS"
                else if (sectionName === "[V4 Styles]") track.trackType = "SSA"
                currentRawSection = null
            } else {
                // Unknown section (Fonts, Graphics, Aegisub, etc.) — preserve raw
                currentRawSection = { name: sectionName, lines: [] }
                track.rawSections.push(currentRawSection)
            }
            continue
        }

        // Parse by section
        switch (currentSection) {
            case "[Script Info]":
                parseScriptInfoLine(trimmed, track)
                break
            case "[V4+ Styles]":
            case "[V4 Styles]":
                parseStylesLine(trimmed, track)
                break
            case "[Events]":
                parseEventsLine(trimmed, track)
                break
            default:
                if (currentRawSection) {
                    currentRawSection.lines.push(line)
                }
                break
        }
    }

    // Apply defaults if format lines were missing
    if (track.styleFormat.length === 0) {
        const defaultFmt = track.trackType === "SSA" ? DEFAULT_SSA_STYLE_FORMAT : DEFAULT_ASS_STYLE_FORMAT
        track.styleFormat = parseFormatLine("Format: " + defaultFmt)
    }
    if (track.eventFormat.length === 0) {
        const defaultFmt = track.trackType === "SSA" ? DEFAULT_SSA_EVENT_FORMAT : DEFAULT_ASS_EVENT_FORMAT
        track.eventFormat = parseFormatLine("Format: " + defaultFmt)
    }

    return track
}

// ─── Script Info parser ──────────────────────────────────────────────────────

function parseScriptInfoLine(line: string, track: AssTrack): void {
    const colonIdx = line.indexOf(":")
    if (colonIdx < 0) return

    const key = line.substring(0, colonIdx).trim()
    const value = line.substring(colonIdx + 1).trim()
    const keyLower = key.toLowerCase()

    switch (keyLower) {
        case "title":
            track.scriptInfo.Title = value
            break
        case "scripttype":
            track.scriptInfo.ScriptType = value
            if (value.toLowerCase().includes("v4.00+")) track.trackType = "ASS"
            else if (value.toLowerCase().includes("v4.00")) track.trackType = "SSA"
            break
        case "playresx":
            track.scriptInfo.PlayResX = parseInt(value, 10) || 0
            break
        case "playresy":
            track.scriptInfo.PlayResY = parseInt(value, 10) || 0
            break
        case "wrapstyle":
            track.scriptInfo.WrapStyle = parseInt(value, 10) || 0
            break
        case "scaledborderandshadow":
            track.scriptInfo.ScaledBorderAndShadow = parseBool(value)
            break
        case "timer":
            track.scriptInfo.Timer = parseFloat(value) || 100.0
            break
        case "ycbcr matrix":
            track.scriptInfo.YCbCrMatrix = value
            break
        case "kerning":
            track.scriptInfo.Kerning = parseBool(value)
            break
        case "layoutresx":
            track.scriptInfo.LayoutResX = parseInt(value, 10) || 0
            break
        case "layoutresy":
            track.scriptInfo.LayoutResY = parseInt(value, 10) || 0
            break
        default:
            // Store unknown script info fields
            track.scriptInfo[key] = value
            break
    }
}

// ─── Style parser ────────────────────────────────────────────────────────────

function parseStylesLine(line: string, track: AssTrack): void {
    if (line.toLowerCase().startsWith("format:")) {
        track.styleFormat = parseFormatLine(line)
        return
    }

    if (!line.toLowerCase().startsWith("style:")) return

    const content = line.substring(line.indexOf(":") + 1).trim()
    const fields = splitFields(content, track.styleFormat.length)

    const raw: Record<string, string> = {}
    const format =
        track.styleFormat.length > 0
            ? track.styleFormat
            : parseFormatLine(
                  "Format: " + (track.trackType === "SSA" ? DEFAULT_SSA_STYLE_FORMAT : DEFAULT_ASS_STYLE_FORMAT)
              )

    for (let i = 0; i < format.length && i < fields.length; i++) {
        raw[format[i]] = fields[i]
    }

    // Leading asterisks stripped from Name (libass STARREDSTRVAL)
    let name = raw["Name"] || "Default"
    while (name.startsWith("*")) name = name.slice(1)

    const alignment = parseInt(raw["Alignment"] || "2", 10)

    const style: AssStyle = {
        Name: name,
        FontName: raw["Fontname"] || raw["FontName"] || "Arial",
        FontSize: parseFloat(raw["Fontsize"] || raw["FontSize"] || "48"),
        PrimaryColour: raw["PrimaryColour"] || "&H00FFFFFF",
        SecondaryColour: raw["SecondaryColour"] || "&H000000FF",
        OutlineColour: raw["OutlineColour"] || raw["TertiaryColour"] || "&H00000000",
        BackColour: raw["BackColour"] || "&H00000000",
        Bold: !!parseInt(raw["Bold"] || "0", 10),
        Italic: !!parseInt(raw["Italic"] || "0", 10),
        Underline: !!parseInt(raw["Underline"] || "0", 10),
        StrikeOut: !!parseInt(raw["StrikeOut"] || raw["Strikeout"] || "0", 10),
        ScaleX: Math.max(parseFloat(raw["ScaleX"] || "100"), 0),
        ScaleY: Math.max(parseFloat(raw["ScaleY"] || "100"), 0),
        Spacing: Math.max(parseFloat(raw["Spacing"] || "0"), 0),
        Angle: parseFloat(raw["Angle"] || "0"),
        BorderStyle: parseInt(raw["BorderStyle"] || "1", 10),
        Outline: Math.max(parseFloat(raw["Outline"] || "2"), 0),
        Shadow: Math.max(parseFloat(raw["Shadow"] || "2"), 0),
        Alignment: track.trackType === "SSA" ? ssaAlignmentToNumpad(alignment) : alignment,
        MarginL: parseInt(raw["MarginL"] || "10", 10),
        MarginR: parseInt(raw["MarginR"] || "10", 10),
        MarginV: parseInt(raw["MarginV"] || "10", 10),
        Encoding: parseInt(raw["Encoding"] || "1", 10),
        Blur: parseFloat(raw["Blur"] || "0"),
        Justify: parseInt(raw["Justify"] || "0", 10),
        _raw: raw
    }

    track.styles.push(style)
}

// ─── Event parser ────────────────────────────────────────────────────────────

function parseEventsLine(line: string, track: AssTrack): void {
    if (line.toLowerCase().startsWith("format:")) {
        track.eventFormat = parseFormatLine(line)
        return
    }

    let eventType: "Dialogue" | "Comment"
    if (line.startsWith("Dialogue:")) {
        eventType = "Dialogue"
    } else if (line.startsWith("Comment:")) {
        eventType = "Comment"
    } else {
        return
    }

    const content = line.substring(line.indexOf(":") + 1).trim()
    const format =
        track.eventFormat.length > 0
            ? track.eventFormat
            : parseFormatLine(
                  "Format: " + (track.trackType === "SSA" ? DEFAULT_SSA_EVENT_FORMAT : DEFAULT_ASS_EVENT_FORMAT)
              )

    // Text is always the last field and consumes everything remaining (including commas)
    const textFieldIndex = format.findIndex(f => f.toLowerCase() === "text")
    const numFieldsBeforeText = textFieldIndex >= 0 ? textFieldIndex : format.length - 1

    const fields = splitFieldsWithText(content, numFieldsBeforeText)

    const raw: Record<string, string> = {}
    for (let i = 0; i < format.length && i < fields.length; i++) {
        raw[format[i]] = fields[i]
    }

    const startMs = parseTimestamp(raw["Start"] || "0:00:00.00")
    const endMs = parseTimestamp(raw["End"] || "0:00:00.00")

    // Trim trailing whitespace from Text (libass behavior)
    let text = raw["Text"] || ""
    text = text.replace(/[\r\t ]+$/, "")

    const event: AssEvent = {
        type: eventType,
        Layer: parseInt(raw["Layer"] || raw["Marked"] || "0", 10),
        Start: startMs,
        End: endMs,
        Style: raw["Style"] || "Default",
        Name: raw["Name"] || raw["Actor"] || "",
        MarginL: parseInt(raw["MarginL"] || "0", 10),
        MarginR: parseInt(raw["MarginR"] || "0", 10),
        MarginV: parseInt(raw["MarginV"] || "0", 10),
        Effect: raw["Effect"] || "",
        Text: text
    }

    track.events.push(event)
}

// ─── Field splitting utilities ───────────────────────────────────────────────

/**
 * Split a comma-separated string into N fields
 */
function splitFields(str: string, maxFields: number): string[] {
    const fields: string[] = []
    let start = 0

    for (let i = 0; i < maxFields - 1; i++) {
        const commaIdx = str.indexOf(",", start)
        if (commaIdx < 0) {
            fields.push(str.substring(start).trim())
            start = str.length
            break
        }
        fields.push(str.substring(start, commaIdx).trim())
        start = commaIdx + 1
    }

    // Last field gets everything remaining
    if (start < str.length) {
        fields.push(str.substring(start).trim())
    }

    return fields
}

/**
 * Split fields where Text (last field) consumes everything after N commas
 */
function splitFieldsWithText(str: string, numFieldsBeforeText: number): string[] {
    const fields: string[] = []
    let start = 0

    for (let i = 0; i < numFieldsBeforeText; i++) {
        const commaIdx = str.indexOf(",", start)
        if (commaIdx < 0) {
            fields.push(str.substring(start).trim())
            return fields
        }
        fields.push(str.substring(start, commaIdx).trim())
        start = commaIdx + 1
    }

    // Text field: everything remaining (including commas), no trimming of leading space
    // libass skips leading spaces for most fields but Text preserves the raw content
    const textContent = str.substring(start)
    fields.push(textContent)

    return fields
}
