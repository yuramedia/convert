import { describe, it, expect } from "vitest"
import { parseAss } from "../ass-parser"
import {
    convertToXlsxData,
    convertToXlsxBuffer,
    convertToXlsxJson,
    DEFAULT_XLSX_OPTIONS,
    cleanSheetName,
    createCombinedXlsxBuffer,
    regenerateXlsxBuffer
} from "./xlsx-export"
import * as XLSX from "xlsx-js-style"

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

describe("convertToXlsxData", () => {
    const track = parseAss(SAMPLE_ASS)

    it("returns all rows with correct field values", () => {
        const rows = convertToXlsxData(track, {
            ...DEFAULT_XLSX_OPTIONS,
            useHtmlTags: false,
            showStyle: true,
            showLayer: true
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

    it("preserves HTML tags when useHtmlTags is true", () => {
        const rows = convertToXlsxData(track, { ...DEFAULT_XLSX_OPTIONS, useHtmlTags: true })
        expect(rows[1]["Subtitle"]).toBe("<i>Italic</i> line")
    })

    it("strips signs when stripSigns is true", () => {
        const rows = convertToXlsxData(track, { ...DEFAULT_XLSX_OPTIONS, stripSigns: true })
        expect(rows).toHaveLength(2)
        expect(rows.every(r => r["Subtitle"] !== "Positioned Sign")).toBe(true)
    })

    it("selective columns: only index and subtitle", () => {
        const rows = convertToXlsxData(track, {
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

        expect(rows[0]).toEqual({ "No.": 1, Subtitle: "Hello World" })
        expect(Object.keys(rows[0])).toHaveLength(2)
    })

    it("indexes are sequential and start from 1", () => {
        const rows = convertToXlsxData(track, DEFAULT_XLSX_OPTIONS)
        rows.forEach((row, i) => {
            expect(row["No."]).toBe(i + 1)
        })
    })
})

describe("convertToXlsxJson", () => {
    it("returns a valid JSON string that parses to the same data as convertToXlsxData", () => {
        const track = parseAss(SAMPLE_ASS)
        const rows = convertToXlsxData(track, DEFAULT_XLSX_OPTIONS)
        const json = convertToXlsxJson(track, DEFAULT_XLSX_OPTIONS)

        const parsed = JSON.parse(json)
        expect(parsed).toEqual(rows)
    })
})

describe("convertToXlsxBuffer", () => {
    const track = parseAss(SAMPLE_ASS)

    it("generates a valid xlsx binary workbook readable by SheetJS", () => {
        const buffer = convertToXlsxBuffer(track, { ...DEFAULT_XLSX_OPTIONS, showStyle: true })
        expect(buffer).toBeInstanceOf(Uint8Array)
        expect(buffer.byteLength).toBeGreaterThan(100)

        const workbook = XLSX.read(buffer, { type: "array" })
        expect(workbook.SheetNames[0]).toBe("Subtitles")

        // Row 0: title, row 1: blank, row 2: episode marker, row 3: header — data starts at index 3
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Subtitles"], { range: 3 })
        expect(rows).toHaveLength(3)
        expect(rows[0]["Subtitle"]).toBe("Hello World")
        expect(rows[0]["Style"]).toBe("Default")
    })
})

describe("cleanSheetName", () => {
    it("strips file extension and returns the base name", () => {
        const used = new Set<string>()
        expect(cleanSheetName("Episode 1.ass", 0, used)).toBe("Episode 1")
    })

    it("removes Excel-invalid characters", () => {
        const used = new Set<string>()
        expect(cleanSheetName("Ep\\1 / ? * [ ] : Test", 0, used)).toBe("Ep1 Test")
    })

    it("truncates names longer than 30 characters", () => {
        const used = new Set<string>()
        const long = "A".repeat(50) + ".ass"
        const result = cleanSheetName(long, 0, used)
        expect(result.length).toBeLessThanOrEqual(30)
        expect(result).toBe("A".repeat(30))
    })

    it("resolves duplicate names by appending a counter suffix", () => {
        const used = new Set<string>()
        cleanSheetName("Episode 1.ass", 0, used)
        expect(cleanSheetName("Episode 1.ass", 1, used)).toBe("Episode 1_1")
        expect(cleanSheetName("Episode 1.ass", 2, used)).toBe("Episode 1_2")
    })

    it("falls back to Sheet_N when name is empty after cleaning", () => {
        const used = new Set<string>()
        expect(cleanSheetName("[?*].ass", 3, used)).toBe("Sheet_4")
    })
})

describe("createCombinedXlsxBuffer", () => {
    const filesData = [
        { name: "Ep1.ass", data: [{ "No.": 1, Subtitle: "Hello from Episode 1" }] },
        { name: "Ep2.ass", data: [{ "No.": 1, Subtitle: "Hello from Episode 2" }] }
    ]

    it("sheets mode: creates one sheet per file", () => {
        const buffer = createCombinedXlsxBuffer(filesData, "sheets")
        const workbook = XLSX.read(buffer, { type: "array" })
        expect(workbook.SheetNames).toEqual(["Ep1", "Ep2"])

        const ep1 = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Ep1"], { range: 3 })
        expect(ep1[0]["Subtitle"]).toBe("Hello from Episode 1")

        const ep2 = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Ep2"], { range: 3 })
        expect(ep2[0]["Subtitle"]).toBe("Hello from Episode 2")
    })

    it("single mode: stacks all episodes in one sheet with markers", () => {
        const buffer = createCombinedXlsxBuffer(filesData, "single")
        const workbook = XLSX.read(buffer, { type: "array" })
        expect(workbook.SheetNames).toEqual(["Subtitles"])

        const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["Subtitles"], {
            header: 1,
            defval: ""
        })

        // row 0: title, row 1: blank, row 2: Ep1 marker, row 3: headers, row 4: data,
        // row 5: blank spacer, row 6: Ep2 marker, row 7: headers, row 8: data
        expect(rows[0][0]).toBe("Ep1\nScript Indonesia")
        expect(rows[2][0]).toBe("Ep1")
        expect(rows[3]).toEqual(["No.", "Subtitle"])
        expect(rows[4]).toEqual([1, "Hello from Episode 1"])
        expect(rows[6][0]).toBe("Ep2")
        expect(rows[8]).toEqual([1, "Hello from Episode 2"])
    })

    it("defaults to sheets mode when combinedMode is not provided", () => {
        const buffer = createCombinedXlsxBuffer(filesData)
        const workbook = XLSX.read(buffer, { type: "array" })
        expect(workbook.SheetNames).toEqual(["Ep1", "Ep2"])
    })
})

describe("regenerateXlsxBuffer", () => {
    const data = [
        { "No.": 1, "Timecode In": "00:00:01.000", "Timecode Out": "00:00:03.500", Subtitle: "Hello Edited" },
        { "No.": 2, "Timecode In": "00:00:04.000", "Timecode Out": "00:00:06.000", Subtitle: "Italic line" }
    ]

    it("successfully creates a valid Excel workbook from inline-edited data array", () => {
        const buffer = regenerateXlsxBuffer(data, "TestFile.xlsx")
        expect(buffer).toBeInstanceOf(Uint8Array)
        expect(buffer.byteLength).toBeGreaterThan(100)

        const workbook = XLSX.read(buffer, { type: "array" })
        expect(workbook.SheetNames[0]).toBe("Subtitles")

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Subtitles"], { range: 3 })
        expect(rows).toHaveLength(2)
        expect(rows[0]["Subtitle"]).toBe("Hello Edited")
        expect(rows[1]["Subtitle"]).toBe("Italic line")
    })
})
