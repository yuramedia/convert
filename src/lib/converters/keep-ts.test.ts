import { describe, it, expect } from "vitest"
import { parseAss } from "../ass-parser"
import { convertKeepTs } from "./keep-ts"

const SAMPLE_ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: TopCenter,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,8,20,20,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Comment: 0,0:00:00.00,0:00:01.00,Default,,0000,0000,0000,,Comment
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0000,0000,0000,,Plain text
Dialogue: 0,0:00:05.00,0:00:10.00,Default,,0000,0000,0000,,{\\an8}Already has alignment
Dialogue: 0,0:00:10.00,0:00:15.00,TopCenter,,0000,0000,0000,,{\\pos(640,100)\\fscx120\\c&HFFFFFF&}Complex TS
Dialogue: 0,0:00:15.00,0:00:20.00,Default,,0000,0000,0000,,Line1\\NLine2
Dialogue: 0,0:00:20.00,0:00:25.00,Default,,0000,0000,0000,,Word1\\hWord2
Dialogue: 0,0:00:25.00,0:00:30.00,Default,,0000,0000,0000,,{\\p1}m 0 0 l 100 100{\\p0}Visible
`

describe("convertKeepTs", () => {
    const track = parseAss(SAMPLE_ASS)

    it("filters out Comment lines", () => {
        const srt = convertKeepTs(track)
        expect(srt).not.toContain("Comment")
    })

    it("outputs valid SRT format", () => {
        const srt = convertKeepTs(track)
        expect(srt).toContain("1\n")
        expect(srt).toContain("-->")
    })

    it("prepends {\\anN} when no alignment tag exists", () => {
        const srt = convertKeepTs(track)
        // "Plain text" has Default style (alignment=2), should get {\\an2}
        expect(srt).toContain("{\\an2}Plain text")
    })

    it("does not duplicate alignment when already present", () => {
        const srt = convertKeepTs(track)
        // Line with {\\an8} should not get another alignment tag
        expect(srt).not.toMatch(/\{\\an2\}\{\\an8\}/)
        expect(srt).toContain("{\\an8}Already has alignment")
    })

    it("merges alignment into first tag block", () => {
        const srt = convertKeepTs(track)
        // TopCenter style has alignment=8 — merged into existing tag block
        expect(srt).toContain("{\\an8\\pos(640,100)\\fscx120\\c&HFFFFFF&}Complex TS")
    })

    it("preserves ALL override tags verbatim", () => {
        const srt = convertKeepTs(track)
        expect(srt).toContain("\\pos(640,100)")
        expect(srt).toContain("\\fscx120")
        expect(srt).toContain("\\c&HFFFFFF&")
    })

    it("converts \\N to newline", () => {
        const srt = convertKeepTs(track)
        expect(srt).toContain("Line1\nLine2")
    })

    it("converts \\h to non-breaking space", () => {
        const srt = convertKeepTs(track)
        expect(srt).toContain("Word1\u00A0Word2")
    })

    it("preserves drawing commands for libass-based players", () => {
        const srt = convertKeepTs(track)
        expect(srt).toContain("Visible")
        expect(srt).toContain("m 0 0")
    })

    it("sorts by start time", () => {
        const srt = convertKeepTs(track)
        const timestamps = [...srt.matchAll(/(\d{2}:\d{2}:\d{2},\d{3}) -->/g)].map(m => m[1])
        for (let i = 1; i < timestamps.length; i++) {
            expect(timestamps[i] >= timestamps[i - 1]).toBe(true)
        }
    })
})
