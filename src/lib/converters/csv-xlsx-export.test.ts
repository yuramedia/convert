import { describe, it, expect } from "vitest"
import { parseAss } from "../ass-parser"
import { convertToCsv } from "./csv-export"
import { convertToXlsxData, convertToXlsxBuffer, DEFAULT_XLSX_OPTIONS } from "./xlsx-export"
import * as XLSX from "xlsx"

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
`

describe("CSV Export Converter", () => {
    const track = parseAss(SAMPLE_ASS)

    it("converts subtitles to standard CSV with headers", () => {
        const csv = convertToCsv(track, {
            useHtmlTags: true,
            stripSigns: false,
            includeStyle: true,
            includeLayer: true,
            includeActor: true
        })

        const lines = csv.split("\n")
        expect(lines[0]).toBe("Index,Start,End,Text,Style,Layer,Actor")
        expect(lines[1]).toBe("1,00:00:01.000,00:00:03.500,Hello World,Default,0,Actor1")
        expect(lines[2]).toBe("2,00:00:04.000,00:00:06.000,<i>Italic</i> line,Default,1,Actor2")
        expect(lines[3]).toBe("3,00:00:07.000,00:00:09.000,Positioned Sign,SignStyle,0,")
    })

    it("strips signs when stripSigns option is true", () => {
        const csv = convertToCsv(track, {
            useHtmlTags: true,
            stripSigns: true,
            includeStyle: false,
            includeLayer: false,
            includeActor: false
        })

        const lines = csv.split("\n")
        // Sign line (positioned sign) is stripped, leaving only dialogue lines
        expect(lines).toHaveLength(3) // headers + 2 lines
        expect(csv).not.toContain("Positioned Sign")
    })
})

describe("XLSX Export Converter", () => {
    const track = parseAss(SAMPLE_ASS)

    it("converts subtitles to intermediate row data correctly", () => {
        const rows = convertToXlsxData(track, {
            useHtmlTags: false,
            stripSigns: false,
            includeStyle: true,
            includeLayer: true,
            includeActor: true
        })

        expect(rows).toHaveLength(3)
        expect(rows[0]).toEqual({
            Index: 1,
            Start: "00:00:01.000",
            End: "00:00:03.500",
            Text: "Hello World",
            Style: "Default",
            Layer: 0,
            Actor: "Actor1"
        })
        expect(rows[1].Text).toBe("Italic line") // tags stripped
    })

    it("generates a valid xlsx binary workbook", () => {
        const buffer = convertToXlsxBuffer(track, {
            ...DEFAULT_XLSX_OPTIONS,
            includeStyle: true
        })
        expect(buffer).toBeInstanceOf(Uint8Array)
        expect(buffer.byteLength).toBeGreaterThan(100)

        // Read it back using SheetJS to verify validity
        const workbook = XLSX.read(buffer, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        expect(sheetName).toBe("Subtitles")

        const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets[sheetName])
        expect(rows).toHaveLength(3)
        expect(rows[0].Text).toBe("Hello World")
        expect(rows[0].Style).toBe("Default")
    })
})
