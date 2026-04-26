import { describe, it, expect } from "vitest"
import { parseAss } from "./ass-parser"
import { writeAss } from "./ass-writer"

const SAMPLE_ASS = `[Script Info]
Title: Roundtrip Test
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
LayoutResX: 1920
LayoutResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
Kerning: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Signs,Verdana,30,&H00FFFFFF,&H000000FF,&H003C3C3C,&H80000000,0,-1,0,0,100,100,2,0,1,3,2,8,20,20,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0010,0010,0010,,Hello World
Dialogue: 1,0:01:30.50,0:01:35.25,Signs,Actor,0020,0020,0015,,{\\pos(640,360)}Sign text
`

describe("writeAss", () => {
    it("produces valid ASS output", () => {
        const track = parseAss(SAMPLE_ASS)
        const output = writeAss(track)

        expect(output).toContain("[Script Info]")
        expect(output).toContain("[V4+ Styles]")
        expect(output).toContain("[Events]")
    })

    it("writes Script Info fields", () => {
        const track = parseAss(SAMPLE_ASS)
        const output = writeAss(track)

        expect(output).toContain("Title: Roundtrip Test")
        expect(output).toContain("PlayResX: 1920")
        expect(output).toContain("PlayResY: 1080")
        expect(output).toContain("LayoutResX: 1920")
        expect(output).toContain("LayoutResY: 1080")
        expect(output).toContain("ScaledBorderAndShadow: yes")
        expect(output).toContain("YCbCr Matrix: TV.709")
        expect(output).toContain("Kerning: yes")
    })

    it("omits LayoutRes when 0", () => {
        const track = parseAss(SAMPLE_ASS)
        track.scriptInfo.LayoutResX = 0
        track.scriptInfo.LayoutResY = 0
        const output = writeAss(track)

        expect(output).not.toContain("LayoutResX")
        expect(output).not.toContain("LayoutResY")
    })

    it("writes styles using format line", () => {
        const track = parseAss(SAMPLE_ASS)
        const output = writeAss(track)

        expect(output).toContain("Format: Name, Fontname, Fontsize")
        expect(output).toContain("Style: Default,")
        expect(output).toContain("Style: Signs,")
    })

    it("writes events with correct timestamps", () => {
        const track = parseAss(SAMPLE_ASS)
        const output = writeAss(track)

        expect(output).toContain("Dialogue: 0,0:00:01.00,0:00:05.00")
        expect(output).toContain("Dialogue: 1,0:01:30.50,0:01:35.25")
    })

    it("preserves event Text with commas", () => {
        const track = parseAss(SAMPLE_ASS)
        const output = writeAss(track)

        expect(output).toContain("{\\pos(640,360)}Sign text")
    })

    it("preserves Bold=-1 format", () => {
        const track = parseAss(SAMPLE_ASS)
        const output = writeAss(track)

        // Default style has Bold=true → -1
        expect(output).toMatch(/Style: Default,[^]*?,-1,/)
    })

    it("roundtrips parse → write → parse", () => {
        const track1 = parseAss(SAMPLE_ASS)
        const output = writeAss(track1)
        const track2 = parseAss(output)

        expect(track2.scriptInfo.PlayResX).toBe(track1.scriptInfo.PlayResX)
        expect(track2.scriptInfo.PlayResY).toBe(track1.scriptInfo.PlayResY)
        expect(track2.styles).toHaveLength(track1.styles.length)
        expect(track2.events).toHaveLength(track1.events.length)

        for (let i = 0; i < track1.events.length; i++) {
            expect(track2.events[i].Start).toBe(track1.events[i].Start)
            expect(track2.events[i].End).toBe(track1.events[i].End)
            expect(track2.events[i].Text).toBe(track1.events[i].Text)
        }
    })

    it("preserves raw sections (fonts, etc.)", () => {
        const assWithFonts = SAMPLE_ASS + "\n[Fonts]\nfontdata_line1\nfontdata_line2\n"
        const track = parseAss(assWithFonts)
        const output = writeAss(track)

        expect(output).toContain("[Fonts]")
        expect(output).toContain("fontdata_line1")
    })
})
