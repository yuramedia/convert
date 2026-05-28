import { describe, it, expect } from "vitest"
import * as XLSX from "xlsx"
import {
    autoDetectColumns,
    parseSpreadsheetTimestamp,
    getSpreadsheetPreview,
    parseSpreadsheet
} from "./spreadsheet-parser"

describe("Spreadsheet Timestamp Parsing", () => {
    it("parses numbers correctly", () => {
        // Excel fractional day (e.g. 0.00011574074074074074 is 10 seconds)
        expect(parseSpreadsheetTimestamp(10 / 86400)).toBe(10000)
        // Milliseconds
        expect(parseSpreadsheetTimestamp(123400)).toBe(123400)
        // Seconds
        expect(parseSpreadsheetTimestamp(12.34)).toBe(12340)
        expect(parseSpreadsheetTimestamp(0)).toBe(0)
    })

    it("parses strings representing numbers correctly", () => {
        expect(parseSpreadsheetTimestamp("12.34")).toBe(12340)
        expect(parseSpreadsheetTimestamp("123400")).toBe(123400)
    })

    it("parses timecode formats correctly", () => {
        // HH:MM:SS.mmm
        expect(parseSpreadsheetTimestamp("01:02:03.456")).toBe(3723456)
        // HH:MM:SS,mmm
        expect(parseSpreadsheetTimestamp("01:02:03,456")).toBe(3723456)
        // HH:MM:SS.CC (centiseconds)
        expect(parseSpreadsheetTimestamp("01:02:03.45")).toBe(3723450)

        // MM:SS.mmm
        expect(parseSpreadsheetTimestamp("02:03.456")).toBe(123456)
        // MM:SS.CC (centiseconds)
        expect(parseSpreadsheetTimestamp("02:03.45")).toBe(123450)

        // HH:MM:SS
        expect(parseSpreadsheetTimestamp("01:02:03")).toBe(3723000)
        // MM:SS
        expect(parseSpreadsheetTimestamp("02:03")).toBe(123000)

        // Frames timecode HH:MM:SS:FF (at 23.976 fps, frame 12 is approx 500ms)
        expect(parseSpreadsheetTimestamp("00:00:10:12", 24)).toBe(10500)
    })

    it("handles empty or invalid inputs gracefully", () => {
        expect(parseSpreadsheetTimestamp(null)).toBe(0)
        expect(parseSpreadsheetTimestamp(undefined)).toBe(0)
        expect(parseSpreadsheetTimestamp("")).toBe(0)
        expect(parseSpreadsheetTimestamp("invalid-format")).toBe(0)
    })
})

describe("Spreadsheet Column Auto-detection", () => {
    it("detects standard headers correctly", () => {
        const headers = ["Index", "Start TC", "End TC", "Subtitle Text", "Style", "Actor", "Layer"]
        const mapping = autoDetectColumns(headers)

        expect(mapping.start).toBe(1)
        expect(mapping.end).toBe(2)
        expect(mapping.text).toBe(3)
        expect(mapping.style).toBe(4)
        expect(mapping.actor).toBe(5)
        expect(mapping.layer).toBe(6)
    })

    it("detects alternative header names correctly", () => {
        const headers = ["In", "Out", "Duration", "Content", "Speaker"]
        const mapping = autoDetectColumns(headers)

        expect(mapping.start).toBe(0)
        expect(mapping.end).toBe(1)
        expect(mapping.duration).toBe(2)
        expect(mapping.text).toBe(3)
        expect(mapping.actor).toBe(4)
    })
})

describe("Spreadsheet Workbook Parsing Flow", () => {
    // Generate a simple Excel workbook in memory
    const headers = ["Start", "End", "Text", "Style", "Actor", "Layer"]
    const mockData = [
        headers,
        ["00:00:01.00", "00:00:03.50", "Hello World", "Default", "Actor A", "0"],
        ["00:00:04.00", "00:00:06.00", "Second line\nwith newline", "Default", "Actor B", "1"],
        ["00:00:07.00", "", "No end time (auto duration)", "ItalicStyle", "", ""]
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(mockData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Subtitles")
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })

    it("extracts spreadsheet previews correctly", () => {
        const preview = getSpreadsheetPreview(excelBuffer)

        expect(preview.headers).toEqual(headers)
        expect(preview.rows).toHaveLength(3)
        expect(preview.rows[0][2]).toBe("Hello World")
        expect(preview.autoMapping.start).toBe(0)
        expect(preview.autoMapping.end).toBe(1)
        expect(preview.autoMapping.text).toBe(2)
    })

    it("parses spreadsheet entries into a valid AssTrack", () => {
        const preview = getSpreadsheetPreview(excelBuffer)
        const track = parseSpreadsheet(excelBuffer, preview.autoMapping, true)

        expect(track.trackType).toBe("ASS")
        expect(track.events).toHaveLength(3)

        // Event 1
        expect(track.events[0].Start).toBe(1000)
        expect(track.events[0].End).toBe(3500)
        expect(track.events[0].Text).toBe("Hello World")
        expect(track.events[0].Style).toBe("Default")
        expect(track.events[0].Name).toBe("Actor A")
        expect(track.events[0].Layer).toBe(0)

        // Event 2
        expect(track.events[1].Start).toBe(4000)
        expect(track.events[1].End).toBe(6000)
        expect(track.events[1].Text).toBe("Second line\\Nwith newline")
        expect(track.events[1].Style).toBe("Default")
        expect(track.events[1].Name).toBe("Actor B")
        expect(track.events[1].Layer).toBe(1)

        // Event 3 (missing end time, should fall back to start + 2s)
        expect(track.events[2].Start).toBe(7000)
        expect(track.events[2].End).toBe(9000)
        expect(track.events[2].Style).toBe("ItalicStyle")
        expect(track.events[2].Name).toBe("")

        // Styles list should be populated
        const styleNames = track.styles.map(s => s.Name)
        expect(styleNames).toContain("Default")
        expect(styleNames).toContain("ItalicStyle")
    })
})
