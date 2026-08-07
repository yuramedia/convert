/**
 * YTT Writer — formats subtitle events into YouTube Timed Text (.ytt) XML
 *
 * The format is undocumented by YouTube. Field names and semantics below are
 * reverse-engineered and verified against arcusmaximus/YTSubConverter (YttDocument.cs),
 * the reference implementation used by most third-party YouTube caption tools.
 */

export interface YttPen {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    /** Font style ID (0=default sans, 1=mono serif, 2=serif, 3=mono sans, 4=casual, 5=cursive, 6=small caps) */
    fs?: number
    /** Text color, "#RRGGBB" */
    fc: string
    /** Text opacity, 0-255 (capped at 254 per YTSubConverter) */
    fo: number
    /** Background box color, "#RRGGBB". Ignored when bo is 0. */
    bc?: string
    /** Background box opacity, 0-255 (0 = no box) */
    bo: number
    /** Edge color, "#RRGGBB" */
    ec?: string
    /** Edge type (4 = outline) */
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
    /** Window foreground opacity, 0-255 */
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
    return `${p.bold ? 1 : 0}|${p.italic ? 1 : 0}|${p.underline ? 1 : 0}|${p.fs || 0}|${p.fc}|${fo}|${bo > 0 ? p.bc || "#000000" : ""}|${bo}|${p.ec || ""}|${p.et || 0}`
}

function positionKey(p: YttPosition): string {
    return `${p.ap}|${p.ah}|${p.av}`
}

function styleKey(s: YttWindowStyle): string {
    const wfo = s.wfo === 255 ? 254 : (s.wfo ?? 0)
    return `${s.ju}|${wfo}`
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

function writePenAttrs(pen: YttPen): string {
    let attrs = ""
    if (pen.bold) attrs += ' b="1"'
    if (pen.italic) attrs += ' i="1"'
    if (pen.underline) attrs += ' u="1"'
    if (pen.fs && pen.fs > 0) attrs += ` fs="${pen.fs}"`
    attrs += ` fc="${pen.fc}"`

    const fo = pen.fo === 255 ? 254 : pen.fo
    attrs += ` fo="${fo}"`

    if (pen.ec) attrs += ` ec="${pen.ec}"`
    if (pen.et) attrs += ` et="${pen.et}"`
    if (pen.bc) attrs += ` bc="${pen.bc}"`

    const bo = pen.bo === 255 ? 254 : pen.bo
    attrs += ` bo="${bo}"`

    return attrs
}

/**
 * Serialize entries into a complete .ytt XML document.
 *
 * Always emits a dummy, invisible wp/ws/pen at id 0 before the real ones:
 * the YouTube iOS app ignores the background color of whichever pen has id 0,
 * so real content is never assigned that id (this mirrors YTSubConverter's workaround).
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

    xmlLines.push('    <ws id="0" wfo="0" ju="2"/>')
    for (const { id, item } of styles.entries()) {
        const wfo = item.wfo === 255 ? 254 : (item.wfo ?? 0)
        xmlLines.push(`    <ws id="${id}" wfo="${wfo}" ju="${item.ju}"/>`)
    }

    xmlLines.push('    <pen id="0" fc="#000000" fo="0" bo="0"/>')
    for (const { id, item } of pens.entries()) {
        xmlLines.push(`    <pen id="${id}"${writePenAttrs(item)}/>`)
    }

    xmlLines.push("  </head>")
    xmlLines.push("  <body>")

    for (const entry of entries) {
        if (entry.spans.length === 0) continue

        let t = Math.round(entry.startMs)
        let d = Math.round(entry.durationMs)
        if (t <= 0) {
            d -= -t + 1
            t = 1
        }
        if (d <= 0) continue

        const wp = positions.idFor(entry.position)
        const ws = styles.idFor(entry.windowStyle)
        const basePenId = pens.idFor(entry.spans[0].pen)

        const hasSpansOrTiming = entry.spans.some(s => pens.idFor(s.pen) !== basePenId || s.timeOffsetMs !== undefined)

        if (!hasSpansOrTiming && entry.spans.length === 1) {
            xmlLines.push(
                `    <p t="${t}" d="${d}" wp="${wp}" ws="${ws}" p="${basePenId}">${escapeYttText(entry.spans[0].text)}</p>`
            )
        } else {
            let inner = ""
            for (const span of entry.spans) {
                const spanPenId = pens.idFor(span.pen)
                let sAttr = ""
                if (spanPenId !== basePenId) sAttr += ` p="${spanPenId}"`
                if (span.timeOffsetMs !== undefined) sAttr += ` t="${span.timeOffsetMs}"`

                if (sAttr.length > 0) {
                    inner += `<s${sAttr}>${escapeYttText(span.text)}</s>`
                } else {
                    inner += escapeYttText(span.text)
                }
            }
            xmlLines.push(`    <p t="${t}" d="${d}" wp="${wp}" ws="${ws}" p="${basePenId}">${inner}</p>`)
        }
    }

    xmlLines.push("  </body>")
    xmlLines.push("</timedtext>")

    return xmlLines.join("\n")
}
