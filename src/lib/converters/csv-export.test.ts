import { describe, it, expect } from "vitest"
import { parseAss } from "../ass-parser"
import { convertToCsv, DEFAULT_CSV_OPTIONS } from "./csv-export"

const SAMPLE_ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: SignStyle,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,8,20,20,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.50,Default,Actor1,0000,0000,0000,,Hello World
Dialogue: 1,0:00:04.00,0:00:06.00,Default,Actor2,0000,0000,0000,,{\\i1}Italic{\\i0} line
Dialogue: 0,0:00:07.00,0:00:09.00,SignStyle,,0000,0000,0000,,{\\pos(960,540)}Positioned Sign
Comment: 0,0:00:10.00,0:00:12.00,Default,,0000,0000,0000,,This should be ignored
`

describe("convertToCsv", () => {
    const track = parseAss(SAMPLE_ASS)

    it("produces correct headers and rows with all columns enabled", () => {
        const csv = convertToCsv(track, {
            ...DEFAULT_CSV_OPTIONS,
            showStyle: true,
            showLayer: true
        })

        const lines = csv.split("\n")
        expect(lines[0]).toBe("No.,Timecode In,Timecode Out,Duration,Name,Style,Layer,Subtitle")
        expect(lines[1]).toBe("1,00:00:01.000,00:00:03.500,00:00:02.500,Actor1,Default,0,Hello World")
        expect(lines[2]).toBe("2,00:00:04.000,00:00:06.000,00:00:02.000,Actor2,Default,1,<i>Italic</i> line")
        expect(lines[3]).toBe("3,00:00:07.000,00:00:09.000,00:00:02.000,,SignStyle,0,Positioned Sign")
    })

    it("skips Comment events", () => {
        const csv = convertToCsv(track, DEFAULT_CSV_OPTIONS)
        expect(csv).not.toContain("This should be ignored")
    })

    it("strips signs when stripSigns is true", () => {
        const csv = convertToCsv(track, { ...DEFAULT_CSV_OPTIONS, stripSigns: true })
        const lines = csv.split("\n")
        expect(lines).toHaveLength(3) // header + 2 dialogue lines
        expect(csv).not.toContain("Positioned Sign")
    })

    it("strips ASS tags to plain text when useHtmlTags is false", () => {
        const csv = convertToCsv(track, { ...DEFAULT_CSV_OPTIONS, useHtmlTags: false })
        const lines = csv.split("\n")
        expect(lines[2]).toContain("Italic line")
        expect(lines[2]).not.toContain("<i>")
        expect(lines[2]).not.toContain("{\\i1}")
    })

    it("selective columns: only index and subtitle", () => {
        const csv = convertToCsv(track, {
            useHtmlTags: false,
            stripSigns: false,
            showIndex: true,
            showStart: false,
            showEnd: false,
            showDuration: false,
            showActor: false,
            showStyle: false,
            showLayer: false,
            showText: true
        })

        const lines = csv.split("\n")
        expect(lines[0]).toBe("No.,Subtitle")
        expect(lines[1]).toBe("1,Hello World")
    })

    it("escapes fields that contain commas", () => {
        const assWithComma = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,Hello, World
`
        const t = parseAss(assWithComma)
        const csv = convertToCsv(t, {
            ...DEFAULT_CSV_OPTIONS,
            showIndex: false,
            showStart: false,
            showEnd: false,
            showDuration: false,
            showActor: false
        })
        const lines = csv.split("\n")
        expect(lines[1]).toBe('"Hello, World"')
    })

    it("escapes fields that contain double quotes", () => {
        const assWithQuote = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,Say "hello"
`
        const t = parseAss(assWithQuote)
        const csv = convertToCsv(t, {
            ...DEFAULT_CSV_OPTIONS,
            showIndex: false,
            showStart: false,
            showEnd: false,
            showDuration: false,
            showActor: false
        })
        const lines = csv.split("\n")
        expect(lines[1]).toBe('"Say ""hello"""')
    })

    it("skips lines that are empty after tag stripping", () => {
        const assWithEmpty = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,Real line
Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0000,0000,0000,,{\\p1}m 0 0 l 100 0 100 100{\\p0}
`
        const t = parseAss(assWithEmpty)
        const csv = convertToCsv(t, {
            ...DEFAULT_CSV_OPTIONS,
            showIndex: true,
            showStart: false,
            showEnd: false,
            showDuration: false,
            showActor: false
        })
        const lines = csv.split("\n")
        expect(lines).toHaveLength(2) // header + 1 real line (drawing stripped)
        expect(lines[1]).toBe("1,Real line")
    })
})
