import { describe, it, expect } from "vitest"
import { parseAss } from "../ass-parser"
import { convertToCsv } from "./csv-export"
import {
    convertToXlsxData,
    convertToXlsxBuffer,
    DEFAULT_XLSX_OPTIONS,
    cleanSheetName,
    createCombinedXlsxBuffer
} from "./xlsx-export"
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
            showIndex: true,
            showStart: true,
            showEnd: true,
            showDuration: true,
            showActor: true,
            showStyle: true,
            showLayer: true,
            showText: true
        })

        const lines = csv.split("\n")
        expect(lines[0]).toBe("No.,Timecode In,Timecode Out,Duration,Name,Style,Layer,Subtitle")
        expect(lines[1]).toBe("1,00:00:01.000,00:00:03.500,00:00:02.500,Actor1,Default,0,Hello World")
        expect(lines[2]).toBe("2,00:00:04.000,00:00:06.000,00:00:02.000,Actor2,Default,1,<i>Italic</i> line")
        expect(lines[3]).toBe("3,00:00:07.000,00:00:09.000,00:00:02.000,,SignStyle,0,Positioned Sign")
    })

    it("strips signs when stripSigns option is true", () => {
        const csv = convertToCsv(track, {
            useHtmlTags: true,
            stripSigns: true,
            showIndex: true,
            showStart: true,
            showEnd: true,
            showDuration: false,
            showActor: false,
            showStyle: false,
            showLayer: false,
            showText: true
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
            showIndex: true,
            showStart: true,
            showEnd: true,
            showDuration: true,
            showActor: true,
            showStyle: true,
            showLayer: true,
            showText: true
        })

        expect(rows).toHaveLength(3)
        expect(rows[0]).toEqual({
            "No.": 1,
            "Timecode In": "00:00:01.000",
            "Timecode Out": "00:00:03.500",
            Duration: "00:00:02.500",
            Name: "Actor1",
            Style: "Default",
            Layer: 0,
            Subtitle: "Hello World"
        })
        expect(rows[1]["Subtitle"]).toBe("Italic line") // tags stripped
    })

    it("generates a valid xlsx binary workbook", () => {
        const buffer = convertToXlsxBuffer(track, {
            ...DEFAULT_XLSX_OPTIONS,
            showStyle: true
        })
        expect(buffer).toBeInstanceOf(Uint8Array)
        expect(buffer.byteLength).toBeGreaterThan(100)

        // Read it back using SheetJS to verify validity
        const workbook = XLSX.read(buffer, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        expect(sheetName).toBe("Subtitles")

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName])
        expect(rows).toHaveLength(3)
        expect(rows[0]["Subtitle"]).toBe("Hello World")
        expect(rows[0]["Style"]).toBe("Default")
    })
})

describe("XLSX Consolidated Export", () => {
    it("cleanSheetName cleans invalid characters and respects length limits", () => {
        const usedNames = new Set<string>()

        // Clean basic name
        expect(cleanSheetName("Episode 1.ass", 0, usedNames)).toBe("Episode 1")

        // Remove invalid characters like \ / ? * [ ] :
        expect(cleanSheetName("Ep\\1 / ? * [ ] : Test", 1, usedNames)).toBe("Ep1 Test")

        // Truncate to 30 characters
        const longName = "A".repeat(50) + ".ass"
        const cleanedLong = cleanSheetName(longName, 2, usedNames)
        expect(cleanedLong.length).toBeLessThanOrEqual(30)
        expect(cleanedLong).toBe("A".repeat(30))

        // Resolve duplicates
        expect(cleanSheetName("Episode 1.ass", 3, usedNames)).toBe("Episode 1_1")
        expect(cleanSheetName("Episode 1.ass", 4, usedNames)).toBe("Episode 1_2")
    })

    it("createCombinedXlsxBuffer creates a workbook with multiple sheets", () => {
        const filesData = [
            {
                name: "Ep1.ass",
                data: [{ "No.": 1, Subtitle: "Hello from Episode 1" }]
            },
            {
                name: "Ep2.ass",
                data: [{ "No.": 1, Subtitle: "Hello from Episode 2" }]
            }
        ]

        const buffer = createCombinedXlsxBuffer(filesData)
        expect(buffer).toBeInstanceOf(Uint8Array)

        // Verify sheet structures by parsing back
        const workbook = XLSX.read(buffer, { type: "array" })
        expect(workbook.SheetNames).toEqual(["Ep1", "Ep2"])

        const ep1Rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Ep1"])
        expect(ep1Rows).toHaveLength(1)
        expect(ep1Rows[0]["Subtitle"]).toBe("Hello from Episode 1")

        const ep2Rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Ep2"])
        expect(ep2Rows).toHaveLength(1)
        expect(ep2Rows[0]["Subtitle"]).toBe("Hello from Episode 2")
    })
})
