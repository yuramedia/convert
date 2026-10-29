import { describe, it, expect } from "vitest"
import { formatTimecode } from "./timecode"
import { parseSpreadsheetTimestamp } from "./spreadsheet-parser"

describe("formatTimecode", () => {
    describe("standard 'time' mode (HH:MM:SS.mmm)", () => {
        it("formats zero ms", () => {
            expect(formatTimecode(0, "time")).toBe("00:00:00.000")
        })

        it("clamps negative values to zero", () => {
            expect(formatTimecode(-500, "time")).toBe("00:00:00.000")
        })

        it("formats standard timestamps accurately", () => {
            expect(formatTimecode(1500, "time")).toBe("00:00:01.500")
            expect(formatTimecode(3661234, "time")).toBe("01:01:01.234")
        })

        it("rounds fractional milliseconds", () => {
            expect(formatTimecode(1234.6, "time")).toBe("00:00:01.235")
        })
    })

    describe("SMPTE mode (HH:MM:SS:FF)", () => {
        it("formats zero ms to 00:00:00:00", () => {
            expect(formatTimecode(0, "smpte", 24)).toBe("00:00:00:00")
        })

        it("clamps negative values to 00:00:00:00", () => {
            expect(formatTimecode(-1000, "smpte", 24)).toBe("00:00:00:00")
        })

        it("formats integer second boundaries correctly", () => {
            expect(formatTimecode(1000, "smpte", 24)).toBe("00:00:01:00")
            expect(formatTimecode(60000, "smpte", 25)).toBe("00:01:00:00")
            expect(formatTimecode(3600000, "smpte", 30)).toBe("01:00:00:00")
        })

        it("calculates frames accurately at 24 fps", () => {
            // At 24 fps: 1 frame = 41.666ms. Frame 12 is at 500ms.
            expect(formatTimecode(500, "smpte", 24)).toBe("00:00:00:12")
            expect(formatTimecode(1500, "smpte", 24)).toBe("00:00:01:12")
        })

        it("calculates frames accurately at 25 fps", () => {
            // At 25 fps: 1 frame = 40ms. Frame 10 is at 400ms.
            expect(formatTimecode(400, "smpte", 25)).toBe("00:00:00:10")
            expect(formatTimecode(480, "smpte", 25)).toBe("00:00:00:12")
        })

        it("calculates frames accurately at 30 fps", () => {
            // At 30 fps: 1 frame = 33.333ms. Frame 15 is at 500ms.
            expect(formatTimecode(500, "smpte", 30)).toBe("00:00:00:15")
        })

        it("calculates frames accurately at 23.976 fps", () => {
            // At 23.976 fps: 500ms * 23.976 / 1000 = 11.988 -> frame 12
            expect(formatTimecode(500, "smpte", 23.976023976)).toBe("00:00:00:12")
        })

        it("clamps frame number so it does not exceed max frame for the fps (e.g. 23 at 24fps)", () => {
            // At 24 fps, frame cannot be 24 (valid frames: 00..23)
            expect(formatTimecode(999, "smpte", 24)).toBe("00:00:00:23")
        })

        it("round-trips with parseSpreadsheetTimestamp", () => {
            const originalMs = 60500 // 1 minute and 500ms
            const smpteStr = formatTimecode(originalMs, "smpte", 24)
            expect(smpteStr).toBe("00:01:00:12")

            const parsedMs = parseSpreadsheetTimestamp(smpteStr, 24)
            expect(parsedMs).toBe(originalMs)
        })
    })
})
