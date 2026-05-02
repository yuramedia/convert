import { describe, it, expect } from "vitest"
import { convertNormalSrt } from "./normal-srt"
import { parseAss } from "../ass-parser"

describe("convertNormalSrt - Frame Gap & Snap", () => {
    const SAMPLE_ASS = `[Script Info]
ScriptType: v4.00+

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,Line 1
Dialogue: 0,0:00:02.10,0:00:03.00,Default,,0000,0000,0000,,Line 2
Dialogue: 0,0:00:03.05,0:00:04.00,Default,,0000,0000,0000,,Line 3
`

    it("snaps lines together within threshold", () => {
        const track = parseAss(SAMPLE_ASS)
        // Gap between 1 & 2 is 100ms. Gap between 2 & 3 is 50ms.
        // Threshold 150ms should snap BOTH.
        const srt = convertNormalSrt(track, {
            useHtmlTags: false,
            mergeDuplicates: false,
            stripEmptyLines: false,
            snapThreshold: 150,
            minGap: 0
        })

        // Line 1: 1000 -> 2100 (snapped to Line 2 start)
        expect(srt).toContain("00:00:01,000 --> 00:00:02,100")
        // Line 2: 2100 -> 3050 (snapped to Line 3 start)
        expect(srt).toContain("00:00:02,100 --> 00:00:03,050")
        // Line 3: 3050 -> 4000 (unchanged)
        expect(srt).toContain("00:00:03,050 --> 00:00:04,000")
    })

    it("enforces minimum gap by shortening previous line", () => {
        const track = parseAss(SAMPLE_ASS)
        // Gap between 2 & 3 is 50ms. minGap 100ms should shorten Line 2.
        const srt = convertNormalSrt(track, {
            useHtmlTags: false,
            mergeDuplicates: false,
            stripEmptyLines: false,
            snapThreshold: 0,
            minGap: 100
        })

        // Line 2 starts at 2100ms. Line 3 starts at 3050ms.
        // New end for Line 2 should be 3050 - 100 = 2950ms.
        expect(srt).toContain("00:00:02,100 --> 00:00:02,950")
    })

    it("respects safety minimum duration (200ms) when enforcing gap", () => {
        const SHORT_ASS = `[Script Info]
ScriptType: v4.00+
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:01.25,Default,,0000,0000,0000,,Short Line
Dialogue: 0,0:00:01.30,0:00:02.00,Default,,0000,0000,0000,,Next Line
`
        const track = parseAss(SHORT_ASS)
        // Gap is 50ms. minGap 100ms would set end to 1300-100 = 1200ms.
        // Duration would be 1200-1000 = 200ms (exactly safety min).
        const srt = convertNormalSrt(track, {
            useHtmlTags: false,
            mergeDuplicates: false,
            stripEmptyLines: false,
            snapThreshold: 0,
            minGap: 100
        })
        expect(srt).toContain("00:00:01,000 --> 00:00:01,200")
    })

    it("handles frame-based units for gap", () => {
        const track = parseAss(SAMPLE_ASS)
        // FPS 23.976 -> 1 frame is ~41.7ms
        // Gap between 2 & 3 is 50ms. minGap of 2 frames (~83ms) should shorten Line 2.
        const srt = convertNormalSrt(track, {
            useHtmlTags: false,
            mergeDuplicates: false,
            stripEmptyLines: false,
            snapThreshold: 0,
            snapUnit: "ms",
            minGap: 2,
            gapUnit: "frames",
            fps: 24000 / 1001
        })

        // Line 3 start: 3050ms
        // Expected gap: 2 * (1000/23.976) = 83.41ms
        // New end: 3050 - 83.41 = 2966.59 -> 2967ms
        expect(srt).toContain("00:00:02,100 --> 00:00:02,967")
    })
})
