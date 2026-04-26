import { describe, it, expect } from "vitest"
import { formatSrtTimestamp, writeSrt, mergeduplicates, reindex, type SrtEntry } from "./srt-writer"

// ─── formatSrtTimestamp ─────────────────────────────────────────────────────

describe("formatSrtTimestamp", () => {
    it("formats zero", () => {
        expect(formatSrtTimestamp(0)).toBe("00:00:00,000")
    })

    it("formats standard timestamps", () => {
        expect(formatSrtTimestamp(1000)).toBe("00:00:01,000")
        expect(formatSrtTimestamp(90500)).toBe("00:01:30,500")
        expect(formatSrtTimestamp(3661500)).toBe("01:01:01,500")
    })

    it("formats milliseconds", () => {
        expect(formatSrtTimestamp(1)).toBe("00:00:00,001")
        expect(formatSrtTimestamp(10)).toBe("00:00:00,010")
        expect(formatSrtTimestamp(100)).toBe("00:00:00,100")
        expect(formatSrtTimestamp(999)).toBe("00:00:00,999")
    })

    it("handles large hour values", () => {
        expect(formatSrtTimestamp(36000000)).toBe("10:00:00,000")
    })
})

// ─── writeSrt ───────────────────────────────────────────────────────────────

describe("writeSrt", () => {
    const entries: SrtEntry[] = [
        { index: 1, startMs: 1000, endMs: 5000, text: "Hello" },
        { index: 2, startMs: 5000, endMs: 10000, text: "World" }
    ]

    it("writes standard SRT format", () => {
        const output = writeSrt(entries)
        const lines = output.split("\n")

        expect(lines[0]).toBe("1")
        expect(lines[1]).toBe("00:00:01,000 --> 00:00:05,000")
        expect(lines[2]).toBe("Hello")
        expect(lines[3]).toBe("")
        expect(lines[4]).toBe("2")
        expect(lines[5]).toBe("00:00:05,000 --> 00:00:10,000")
        expect(lines[6]).toBe("World")
    })

    it("skips entries with empty text", () => {
        const withEmpty: SrtEntry[] = [
            { index: 1, startMs: 0, endMs: 1000, text: "" },
            { index: 2, startMs: 1000, endMs: 2000, text: "Text" }
        ]
        const output = writeSrt(withEmpty)
        expect(output).not.toContain("1\n00:00:00,000")
        expect(output).toContain("Text")
    })

    it("handles empty entries array", () => {
        expect(writeSrt([])).toBe("")
    })
})

// ─── mergeduplicates ────────────────────────────────────────────────────────

describe("mergeduplicates", () => {
    it("removes duplicate entries", () => {
        const entries: SrtEntry[] = [
            { index: 1, startMs: 0, endMs: 1000, text: "Same" },
            { index: 2, startMs: 0, endMs: 1000, text: "Same" },
            { index: 3, startMs: 1000, endMs: 2000, text: "Different" }
        ]
        const result = mergeduplicates(entries)
        expect(result).toHaveLength(2)
        expect(result[0].text).toBe("Same")
        expect(result[1].text).toBe("Different")
    })

    it("keeps non-duplicates", () => {
        const entries: SrtEntry[] = [
            { index: 1, startMs: 0, endMs: 1000, text: "A" },
            { index: 2, startMs: 0, endMs: 1000, text: "B" }
        ]
        const result = mergeduplicates(entries)
        expect(result).toHaveLength(2)
    })

    it("re-indexes after merge", () => {
        const entries: SrtEntry[] = [
            { index: 1, startMs: 0, endMs: 1000, text: "A" },
            { index: 2, startMs: 0, endMs: 1000, text: "A" },
            { index: 3, startMs: 1000, endMs: 2000, text: "B" }
        ]
        const result = mergeduplicates(entries)
        expect(result[0].index).toBe(1)
        expect(result[1].index).toBe(2)
    })
})

// ─── reindex ────────────────────────────────────────────────────────────────

describe("reindex", () => {
    it("re-indexes sequentially from 1", () => {
        const entries: SrtEntry[] = [
            { index: 5, startMs: 0, endMs: 1000, text: "A" },
            { index: 10, startMs: 1000, endMs: 2000, text: "B" }
        ]
        const result = reindex(entries)
        expect(result[0].index).toBe(1)
        expect(result[1].index).toBe(2)
    })

    it("preserves other fields", () => {
        const entries: SrtEntry[] = [{ index: 99, startMs: 500, endMs: 1500, text: "Hello" }]
        const result = reindex(entries)
        expect(result[0].startMs).toBe(500)
        expect(result[0].text).toBe("Hello")
    })
})
