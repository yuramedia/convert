/**
 * YTT Writer — formats subtitle events into YouTube Timed Text (.ytt) XML
 *
 * The format is undocumented by YouTube. Field names and semantics below are
 * reverse-engineered and verified against arcusmaximus/YTSubConverter (YttDocument.cs),
 * the reference implementation used by most third-party YouTube caption tools.
 */

/** Zero-width space used as workaround for YouTube multi-section pen bug */
const ZERO_WIDTH_SPACE = "\u200B"

export interface YttPen {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    /** Font style ID (0=default/Roboto, 1=Courier New, 2=Times New Roman, 3=Lucida Console, 5=Comic Sans, 6=Monotype Corsiva, 7=Carrois Gothic SC) */
    fs?: number
    /** Font size scale (YouTube's sz attribute). Default 100. */
    sz?: number
    /** Text color, "#RRGGBB" */
    fc: string
    /** Text opacity, 0-255 (capped at 254 per YTSubConverter) */
    fo: number
    /** Background box color, "#RRGGBB". Only written when bo > 0. */
    bc?: string
    /** Background box opacity, 0-255 (0 = no box) */
    bo: number
    /** Edge color, "#RRGGBB" */
    ec?: string
    /** Edge type: 1=hard shadow, 2=bevel, 3=glow (outline), 4=soft shadow */
    et?: number
}

export interface YttPosition {
    /** Anchor point on a 3x3 grid, row-major: 0=top-left ... 4=center ... 8=bottom-right */
    ap: number
    /** Horizontal position, 0-100 */
    ah: number
    /** Vertical position, 0-100 */
    av: number
}

export interface YttWindowStyle {
    /** Justification: 0 = left, 1 = right, 2 = center */
    ju: number
    /** Print direction: 0=LTR horizontal, 1=RTL horizontal, 2=vertical positioned, 3=vertical rotated */
    pd?: number
    /** Scroll direction */
    sd?: number
    /** Window foreground opacity — always 0 per YTSubConverter */
    wfo?: number
}

export interface YttSpan {
    text: string
    pen: YttPen
    timeOffsetMs?: number
}

export interface YttEntry {
    startMs: number
    durationMs: number
    position: YttPosition
    windowStyle: YttWindowStyle
    spans: YttSpan[]
}



/** Escape text for placement inside XML element content (attribute values aren't used for text). */
export function escapeYttText(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
}

function penKey(p: YttPen): string {
    const fo = p.fo === 255 ? 254 : p.fo
    const bo = p.bo === 255 ? 254 : p.bo
    return `${p.bold ? 1 : 0}|${p.italic ? 1 : 0}|${p.underline ? 1 : 0}|${p.fs || 0}|${p.sz ?? 100}|${p.fc}|${fo}|${bo > 0 ? p.bc || "#000000" : ""}|${bo}|${p.ec || ""}|${p.et || 0}`
}

function positionKey(p: YttPosition): string {
    return `${p.ap}|${p.ah}|${p.av}`
}

function styleKey(s: YttWindowStyle): string {
    return `${s.ju}|${s.pd ?? 0}|${s.sd ?? 0}`
}

/** Assigns stable incremental ids (starting at 1) to unique items, in first-seen order. Id 0 is reserved for a dummy entry. */
class IdTable<T> {
    private keyToId = new Map<string, number>()
    private items: T[] = []

    constructor(private toKey: (item: T) => string) {}

    idFor(item: T): number {
        const key = this.toKey(item)
        let id = this.keyToId.get(key)
        if (id === undefined) {
            id = this.items.length + 1
            this.keyToId.set(key, id)
            this.items.push(item)
        }
        return id
    }

    entries(): { id: number; item: T }[] {
        return this.items.map((item, i) => ({ id: i + 1, item }))
    }
}

/**
 * Write pen attributes in the order matching YTSubConverter's WritePen:
 * fs, sz, b, i, u, fc, fo, bc, bo, et, ec
 */
function writePenAttrs(pen: YttPen): string {
    let attrs = ""

    // Font style ID — only written if non-zero (YTSubConverter: "if (fontStyleId != 0)")
    if (pen.fs && pen.fs > 0) attrs += ` fs="${pen.fs}"`

    // Font size scale — YTSubConverter always writes this ("sz" attribute)
    const sz = pen.sz ?? 100
    attrs += ` sz="${sz}"`

    // Bold/Italic/Underline — only written when true
    if (pen.bold) attrs += ' b="1"'
    if (pen.italic) attrs += ' i="1"'
    if (pen.underline) attrs += ' u="1"'

    // Foreground color — always written
    attrs += ` fc="${pen.fc}"`

    // Foreground opacity — capped at 254, always written
    const fo = pen.fo === 255 ? 254 : pen.fo
    attrs += ` fo="${fo}"`

    // Background color — only written when bo > 0 (YTSubConverter: "if (format.BackColor.A > 0)")
    const bo = pen.bo === 255 ? 254 : pen.bo
    if (bo > 0 && pen.bc) attrs += ` bc="${pen.bc}"`

    // Background opacity — always written
    attrs += ` bo="${bo}"`

    // Edge type and color — shadow/outline
    if (pen.et && pen.et > 0) {
        attrs += ` et="${pen.et}"`
        // ec is only written when explicitly set (see YTSubConverter's WritePen comment
        // about YouTube's inconsistent handling of shadow transparency)
        if (pen.ec) attrs += ` ec="${pen.ec}"`
    }

    return attrs
}

/**
 * Serialize entries into a complete .ytt XML document.
 *
 * Always emits a dummy, invisible wp/ws/pen at id 0 before the real ones:
 * the YouTube iOS app ignores the background color of whichever pen has id 0,
 * so real content is never assigned that id (this mirrors YTSubConverter's workaround).
 *
 * Multi-section lines use per-section `<s>` elements with individual pen IDs,
 * plus a zero-width space workaround after the first section to prevent YouTube's
 * server from stripping the first section's pen ID attribute.
 */
export function writeYtt(entries: YttEntry[]): string {
    const positions = new IdTable<YttPosition>(positionKey)
    const styles = new IdTable<YttWindowStyle>(styleKey)
    const pens = new IdTable<YttPen>(penKey)

    for (const entry of entries) {
        positions.idFor(entry.position)
        styles.idFor(entry.windowStyle)
        for (const span of entry.spans) pens.idFor(span.pen)
    }

    const xmlLines: string[] = []
    xmlLines.push('<?xml version="1.0" encoding="utf-8"?>')
    xmlLines.push('<timedtext format="3">')
    xmlLines.push("  <head>")

    // Dummy entries (id 0) per YTSubConverter iOS/Android player workaround
    xmlLines.push('    <wp id="0" ap="7" ah="0" av="0"/>')
    for (const { id, item } of positions.entries()) {
        xmlLines.push(`    <wp id="${id}" ap="${item.ap}" ah="${item.ah}" av="${item.av}"/>`)
    }

    // Window style — YTSubConverter writes: id, ju, pd, sd, wfo
    xmlLines.push('    <ws id="0" ju="2" pd="0" sd="0" wfo="0"/>')
    for (const { id, item } of styles.entries()) {
        const pd = item.pd ?? 0
        const sd = item.sd ?? 0
        xmlLines.push(`    <ws id="${id}" ju="${item.ju}" pd="${pd}" sd="${sd}" wfo="0"/>`)
    }

    xmlLines.push('    <pen id="0" fc="#000000" fo="0" bo="0"/>')
    for (const { id, item } of pens.entries()) {
        xmlLines.push(`    <pen id="${id}"${writePenAttrs(item)}/>`)
    }

    xmlLines.push("  </head>")
    xmlLines.push("  <body>")

    for (const entry of entries) {
        if (entry.spans.length === 0) continue

        // If we start in negative time, set starting time to 1ms and reduce duration to compensate.
        // (The Android app does not respect positioning of, and sometimes does not display,
        // subtitles that start at 0ms — per YTSubConverter)
        let t = Math.round(entry.startMs)
        let d = Math.round(entry.durationMs)
        if (t <= 0) {
            d -= -t + 1
            t = 1
        }
        if (d <= 0) continue

        const wp = positions.idFor(entry.position)
        const ws = styles.idFor(entry.windowStyle)

        if (entry.spans.length === 1) {
            // Single section: put pen ID on <p> element, plain text content
            const penId = pens.idFor(entry.spans[0].pen)
            xmlLines.push(
                `    <p t="${t}" d="${d}" p="${penId}" wp="${wp}" ws="${ws}">${escapeYttText(entry.spans[0].text)}</p>`
            )
        } else {
            // Multi-section: every <s> gets its own p= attribute.
            // Per YTSubConverter: "The server will remove the 'p' (pen ID) attribute of the
            // first section unless the line has text that's not part of any section.
            // We use a zero-width space after the first section to avoid visual impact."
            let inner = ""
            for (let i = 0; i < entry.spans.length; i++) {
                const span = entry.spans[i]
                const spanPenId = pens.idFor(span.pen)
                let sAttr = ` p="${spanPenId}"`
                if (span.timeOffsetMs !== undefined && span.timeOffsetMs > 0) {
                    sAttr += ` t="${span.timeOffsetMs}"`
                }
                inner += `<s${sAttr}>${escapeYttText(span.text)}</s>`
                if (i === 0) {
                    inner += ZERO_WIDTH_SPACE
                }
            }
            xmlLines.push(`    <p t="${t}" d="${d}" wp="${wp}" ws="${ws}">${inner}</p>`)
        }
    }

    xmlLines.push("  </body>")
    xmlLines.push("</timedtext>")

    return xmlLines.join("\n")
}
