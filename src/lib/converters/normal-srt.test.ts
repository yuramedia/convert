import { describe, it, expect } from "vitest"
import { parseAss } from "../ass-parser"
import { convertNormalSrt } from "./normal-srt"

const SAMPLE_ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,-1,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Signs,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,8,20,20,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Comment: 0,0:00:00.50,0:00:01.00,Default,,0000,0000,0000,,Comment line
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0000,0000,0000,,Hello World
Dialogue: 0,0:00:05.00,0:00:10.00,Default,,0000,0000,0000,,{\\b1}Bold{\\b0} text
Dialogue: 0,0:00:10.00,0:00:15.00,Default,,0000,0000,0000,,Line with \\Nnewline
Dialogue: 0,0:00:15.00,0:00:20.00,Signs,,0000,0000,0000,,{\\pos(640,360)\\fscx120}TS only
Dialogue: 0,0:00:20.00,0:00:25.00,Default,,0000,0000,0000,,{\\p1}m 0 0 l 100 100{\\p0}
Dialogue: 0,0:00:25.00,0:00:30.00,Default,,0000,0000,0000,,Duplicate
Dialogue: 0,0:00:25.00,0:00:30.00,Default,,0000,0000,0000,,Duplicate
Dialogue: 0,0:00:30.00,0:00:35.00,Default,,0000,0000,0000,,Styled italic
`

describe("convertNormalSrt", () => {
    const track = parseAss(SAMPLE_ASS)

    it("filters out Comment lines", () => {
        const srt = convertNormalSrt(track)
        expect(srt).not.toContain("Comment line")
    })

    it("outputs valid SRT format", () => {
        const srt = convertNormalSrt(track)
        expect(srt).toContain("1\n")
        expect(srt).toContain("-->")
        expect(srt).toContain("Hello World")
    })

    it("converts \\b1 to <b> tags", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: false, stripEmptyLines: true })
        expect(srt).toContain("<b>Bold</b> text")
    })

    it("applies initial italic from style", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: false, stripEmptyLines: true })
        expect(srt).toContain("<i>Styled italic</i>")
    })

    it("converts \\N to newline", () => {
        const srt = convertNormalSrt(track)
        expect(srt).toContain("Line with \nnewline")
    })

    it("strips TS-only tags (\\pos, \\fscx)", () => {
        const srt = convertNormalSrt(track)
        expect(srt).toContain("TS only")
        expect(srt).not.toContain("\\pos")
        expect(srt).not.toContain("\\fscx")
    })

    it("strips drawing lines when stripEmptyLines=true", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: false, stripEmptyLines: true })
        expect(srt).not.toContain("m 0 0")
    })

    it("merges duplicate lines when mergeDuplicates=true", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: true, stripEmptyLines: true })
        const matches = srt.match(/Duplicate/g)
        expect(matches).toHaveLength(1)
    })

    it("keeps duplicates when mergeDuplicates=false", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: false, stripEmptyLines: true })
        const matches = srt.match(/Duplicate/g)
        expect(matches).toHaveLength(2)
    })

    it("strips HTML when useHtmlTags=false", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: false, mergeDuplicates: false, stripEmptyLines: true })
        expect(srt).not.toContain("<b>")
        expect(srt).not.toContain("<i>")
        expect(srt).toContain("Bold text")
    })

    it("sorts events by start time", () => {
        const srt = convertNormalSrt(track)
        const timestamps = [...srt.matchAll(/(\d{2}:\d{2}:\d{2},\d{3}) -->/g)].map(m => m[1])
        for (let i = 1; i < timestamps.length; i++) {
            expect(timestamps[i] >= timestamps[i - 1]).toBe(true)
        }
    })
})
