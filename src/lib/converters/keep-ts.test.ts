import { describe, it, expect } from "vitest"
import { parseAss } from "../ass-parser"
import { convertKeepTs } from "./keep-ts"

const SAMPLE_ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: TopCenter,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,8,20,20,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Comment: 0,0:00:00.00,0:00:01.00,Default,,0000,0000,0000,,Comment
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0000,0000,0000,,Plain text
Dialogue: 0,0:00:05.00,0:00:10.00,Default,,0000,0000,0000,,{\\an8}Already has alignment
Dialogue: 0,0:00:10.00,0:00:15.00,TopCenter,,0000,0000,0000,,{\\pos(640,100)\\fscx120\\c&HFFFFFF&}Complex TS
Dialogue: 0,0:00:15.00,0:00:20.00,Default,,0000,0000,0000,,Line1\\NLine2
Dialogue: 0,0:00:20.00,0:00:25.00,Default,,0000,0000,0000,,Word1\\hWord2
Dialogue: 0,0:00:25.00,0:00:30.00,Default,,0000,0000,0000,,{\\p1}m 0 0 l 100 100{\\p0}Visible
`

describe("convertKeepTs", () => {
    const track = parseAss(SAMPLE_ASS)

    it("filters out Comment lines", () => {
        const srt = convertKeepTs(track)
        expect(srt).not.toContain("Comment")
    })

    it("outputs valid SRT format", () => {
        const srt = convertKeepTs(track)
        expect(srt).toContain("1\n")
        expect(srt).toContain("-->")
    })

    it("does NOT inject \\an2 for Default style (it is the global default)", () => {
        const srt = convertKeepTs(track)
        // \\an2 is the default — no need to inject it
        expect(srt).toContain("Plain text")
        expect(srt).not.toMatch(/\{\\an2\}Plain text/)
    })

    it("does not duplicate alignment when already present", () => {
        const srt = convertKeepTs(track)
        // Line with {\\an8} should not get another alignment tag
        expect(srt).not.toMatch(/\{\\an2\}\{\\an8\}/)
        expect(srt).toContain("{\\an8}Already has alignment")
    })
    it("does not inject duplicate alignment when an alignment tag appears later in the event", () => {
        const laterAlignmentTrack = parseAss(`[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,{\\pos(100,100)}Text{\\an8}
`)

        const srt = convertKeepTs(laterAlignmentTrack)
        expect(srt).not.toContain("{\\an2}")
        expect(srt).toContain("{\\pos(100,100)}Text{\\an8}")
    })

    it("merges alignment into first tag block", () => {
        const srt = convertKeepTs(track)
        // TopCenter style has alignment=8 — merged into existing tag block
        expect(srt).toContain("{\\an8\\pos(640,100)\\fscx120\\c&HFFFFFF&}Complex TS")
    })

    it("preserves ALL override tags verbatim", () => {
        const srt = convertKeepTs(track)
        expect(srt).toContain("\\pos(640,100)")
        expect(srt).toContain("\\fscx120")
        expect(srt).toContain("\\c&HFFFFFF&")
    })

    it("converts \\N to newline", () => {
        const srt = convertKeepTs(track)
        expect(srt).toContain("Line1\nLine2")
    })

    it("converts \\h to non-breaking space", () => {
        const srt = convertKeepTs(track)
        expect(srt).toContain("Word1\u00A0Word2")
    })

    it("preserves drawing commands for libass-based players", () => {
        const srt = convertKeepTs(track)
        expect(srt).toContain("Visible")
        expect(srt).toContain("m 0 0")
    })

    it("sorts by start time when signFirst=false", () => {
        const srt = convertKeepTs(track, { injectAn2: false, signFirst: false })
        const timestamps = [...srt.matchAll(/(\d{2}:\d{2}:\d{2},\d{3}) -->/g)].map(m => m[1])
        for (let i = 1; i < timestamps.length; i++) {
            expect(timestamps[i] >= timestamps[i - 1]).toBe(true)
        }
    })

    it("sorts sign lines before dialogue within overlapping groups", () => {
        // Build a fixture where sign and dialogue overlap in time
        const overlapTrack = parseAss(`[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Sign,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,8,20,20,15,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 10,0:00:01.00,0:00:05.00,Default,,0,0,0,,Early dialogue
Dialogue: 0,0:00:10.00,0:00:18.00,Sign,,0,0,0,,{\\pos(640,100)}Overlapping sign
Dialogue: 10,0:00:12.00,0:00:20.00,Default,,0,0,0,,Overlapping dialogue
Dialogue: 10,0:00:25.00,0:00:30.00,Default,,0,0,0,,Later dialogue
`)
        const srt = convertKeepTs(overlapTrack, { injectAn2: false, signFirst: true })

        // Within the overlap group (10s-20s): sign should come before dialogue
        const signIdx = srt.indexOf("Overlapping sign")
        const dialogueIdx = srt.indexOf("Overlapping dialogue")
        expect(signIdx).toBeLessThan(dialogueIdx)

        // Non-overlapping entries stay chronological:
        // "Early dialogue" (1s) before the overlap group (10s)
        // "Later dialogue" (25s) after the overlap group
        const earlyIdx = srt.indexOf("Early dialogue")
        const laterIdx = srt.indexOf("Later dialogue")
        expect(earlyIdx).toBeLessThan(signIdx)
        expect(laterIdx).toBeGreaterThan(dialogueIdx)
    })

    it("keeps non-overlapping entries in chronological order with signFirst=true", () => {
        // Sign at 1s, dialogue at 10s — no overlap, should stay chronological
        const noOverlapTrack = parseAss(`[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Sign,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,8,20,20,15,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Sign,,0,0,0,,{\\pos(640,100)}Early sign
Dialogue: 10,0:00:10.00,0:00:15.00,Default,,0,0,0,,Later dialogue
`)
        const srt = convertKeepTs(noOverlapTrack, { injectAn2: false, signFirst: true })

        // No overlap → chronological order preserved: sign at 1s before dialogue at 10s
        const signIdx = srt.indexOf("Early sign")
        const dialogueIdx = srt.indexOf("Later dialogue")
        expect(signIdx).toBeLessThan(dialogueIdx)

        // Timestamps should also be chronological
        const timestamps = [...srt.matchAll(/(\d{2}:\d{2}:\d{2},\d{3}) -->/g)].map(m => m[1])
        for (let i = 1; i < timestamps.length; i++) {
            expect(timestamps[i] >= timestamps[i - 1]).toBe(true)
        }
    })
})
