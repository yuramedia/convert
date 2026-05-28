import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import * as XLSX from "xlsx"
import {
    detectEpisodes,
    getSpreadsheetPreview,
    parseSpreadsheetSegment,
    readSpreadsheetRows
} from "./spreadsheet-parser"

describe("Spreadsheet Episode Segmentation", () => {
    const mockRows = [
        ["Title Banner at top", "", ""],
        ["", "", ""],
        ["EP1", "", ""],
        ["Start", "Actor", "Text"],
        ["00:00:01,000", "Actor A", "Hello Episode 1 Line 1"],
        ["00:00:03,000", "Actor B", "Hello Episode 1 Line 2"],
        ["EP2", "", ""],
        ["Start", "Actor", "Text"],
        ["00:00:00,500", "Actor A", "Hello Episode 2 Line 1"],
        ["00:00:02,000", "Actor B", "Hello Episode 2 Line 2"]
    ]

    it("detectEpisodes detects episode marker boundaries correctly", () => {
        const segments = detectEpisodes(mockRows)
        expect(segments).toHaveLength(2)

        expect(segments[0].name).toBe("EP1")
        expect(segments[0].startIndex).toBe(2)
        expect(segments[0].endIndex).toBe(6)

        expect(segments[1].name).toBe("EP2")
        expect(segments[1].startIndex).toBe(6)
        expect(segments[1].endIndex).toBe(mockRows.length)
    })

    it("getSpreadsheetPreview retrieves headers and rows from first segment", () => {
        // Build mock Excel workbook buffer
        const worksheet = XLSX.utils.aoa_to_sheet(mockRows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Subtitles")
        const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })

        const preview = getSpreadsheetPreview(buffer)
        expect(preview.segments).toBeDefined()
        expect(preview.segments).toHaveLength(2)

        // Headers should be from row 3: ["Start", "Actor", "Text"]
        expect(preview.headers).toEqual(["Start", "Actor", "Text"])

        // Preview rows should be from rows 4 & 5
        expect(preview.rows).toHaveLength(2)
        expect(preview.rows[0][2]).toBe("Hello Episode 1 Line 1")
        expect(preview.rows[1][2]).toBe("Hello Episode 1 Line 2")
    })

    it("parseSpreadsheetSegment parses correct ranges and timecodes", () => {
        const segments = detectEpisodes(mockRows)
        const mapping = {
            start: 0,
            end: -1,
            duration: -1,
            text: 2,
            style: -1,
            actor: 1,
            layer: -1
        }

        // Parse Episode 1
        const track1 = parseSpreadsheetSegment(mockRows, segments[0], mapping, true)
        expect(track1.events).toHaveLength(2)
        expect(track1.events[0].Start).toBe(1000)
        expect(track1.events[0].Text).toBe("Hello Episode 1 Line 1")
        expect(track1.events[0].Name).toBe("Actor A")

        expect(track1.events[1].Start).toBe(3000)
        expect(track1.events[1].Text).toBe("Hello Episode 1 Line 2")

        // Parse Episode 2
        const track2 = parseSpreadsheetSegment(mockRows, segments[1], mapping, true)
        expect(track2.events).toHaveLength(2)
        expect(track2.events[0].Start).toBe(500)
        expect(track2.events[0].Text).toBe("Hello Episode 2 Line 1")
        expect(track2.events[0].Name).toBe("Actor A")

        expect(track2.events[1].Start).toBe(2000)
        expect(track2.events[1].Text).toBe("Hello Episode 2 Line 2")
    })

    it("correctly segments and parses the actual reference file", () => {
        const filePath = path.resolve(
            __dirname,
            "../../reference/Dhaakad Ballebaaz - Script Indonesia - Episode 01-76.xlsx"
        )
        if (!fs.existsSync(filePath)) {
            // Skip test if reference file is not checked out locally
            return
        }

        const nodeBuffer = fs.readFileSync(filePath)
        const arrayBuffer = nodeBuffer.buffer.slice(
            nodeBuffer.byteOffset,
            nodeBuffer.byteOffset + nodeBuffer.byteLength
        ) as ArrayBuffer
        const rows = readSpreadsheetRows(arrayBuffer)

        const segments = detectEpisodes(rows)
        expect(segments.length).toBeGreaterThanOrEqual(21)
        expect(segments[0].name).toBe("EP1")
        expect(segments[20].name).toBe("EP21")

        const mapping = {
            start: 0,
            end: -1,
            duration: -1,
            text: 3, // Column D: Indonesian Script
            style: -1,
            actor: 1, // Column B: Actor
            layer: -1
        }

        // Episode 1 parsing
        const ep1Track = parseSpreadsheetSegment(rows, segments[0], mapping, true)
        expect(ep1Track.events.length).toBeGreaterThan(0)
        expect(ep1Track.events[0].Name).toBe("ANAK")
        expect(ep1Track.events[0].Text).toContain("Papa, ada jagoan film")

        // Episode 2 parsing
        const ep2Track = parseSpreadsheetSegment(rows, segments[1], mapping, true)
        expect(ep2Track.events.length).toBeGreaterThan(0)
        expect(ep2Track.events[0].Name).toBe("PENGAWAL 2")
        expect(ep2Track.events[0].Start).toBe(220) // 00:00:00,220 -> 220ms
        expect(ep2Track.events[0].Text).toContain("Belikan anakmu cangkul")
    })
})
