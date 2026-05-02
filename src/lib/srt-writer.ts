/**
 * SRT Writer — formats subtitle events into SubRip (SRT) format
 */

export interface SrtEntry {
    index: number
    startMs: number
    endMs: number
    text: string
}

/**
 * Format milliseconds → SRT timestamp `HH:MM:SS,mmm`
 */
export function formatSrtTimestamp(ms: number): string {
    const sign = ms < 0 ? "-" : ""
    ms = Math.abs(Math.round(ms))
    const milliseconds = ms % 1000
    const totalSeconds = Math.floor(ms / 1000)
    const s = totalSeconds % 60
    const totalMinutes = Math.floor(totalSeconds / 60)
    const m = totalMinutes % 60
    const h = Math.floor(totalMinutes / 60)
    return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`
}

/**
 * Write SRT entries to string
 */
export function writeSrt(entries: SrtEntry[], addBom: boolean = false): string {
    const lines: string[] = []

    if (addBom) {
        lines.push("\uFEFF")
    }

    for (const entry of entries) {
        if (!entry.text.trim()) continue

        lines.push(String(entry.index))
        lines.push(`${formatSrtTimestamp(entry.startMs)} --> ${formatSrtTimestamp(entry.endMs)}`)
        lines.push(entry.text)
        lines.push("")
    }

    return lines.join("\n")
}

/**
 * Merge entries with identical timestamps by joining their text with newlines.
 * If text is identical across multiple lines, it's not duplicated.
 */
export function mergeduplicates(entries: SrtEntry[]): SrtEntry[] {
    const merged: SrtEntry[] = []
    const timeMap = new Map<string, SrtEntry>()

    for (const entry of entries) {
        const key = `${entry.startMs}-${entry.endMs}`
        const existing = timeMap.get(key)

        if (existing) {
            const existingLines = existing.text.split("\n")
            if (!existingLines.includes(entry.text)) {
                existing.text += "\n" + entry.text
            }
        } else {
            const newEntry = { ...entry, index: merged.length + 1 }
            merged.push(newEntry)
            timeMap.set(key, newEntry)
        }
    }

    return merged
}

/**
 * Re-index entries sequentially starting from 1
 */
export function reindex(entries: SrtEntry[]): SrtEntry[] {
    return entries.map((e, i) => ({ ...e, index: i + 1 }))
}
