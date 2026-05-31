import { describe, it, expect } from "vitest"
import { parseAss } from "../ass-parser"
import { convertKeepTs } from "./keep-ts"
import { convertNormalSrt } from "./normal-srt"

// ─── Alignment edge cases (libass/libass#262) ────────────────────────────────

const ALIGNMENT_EDGE_ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ZeroAlign,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,0,10,10,10,1
Style: NegativeAlign,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,-2,10,10,10,1
Style: HugeAlign,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,99,10,10,10,1
Style: NormalAlign,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,ZeroAlign,,0,0,0,,Zero align line
Dialogue: 0,0:00:05.00,0:00:10.00,NegativeAlign,,0,0,0,,Negative align line
Dialogue: 0,0:00:10.00,0:00:15.00,HugeAlign,,0,0,0,,Huge align line
Dialogue: 0,0:00:15.00,0:00:20.00,NormalAlign,,0,0,0,,Normal align line
`

describe("round-trip — alignment edge cases (libass#262)", () => {
    const track = parseAss(ALIGNMENT_EDGE_ASS)

    describe("keepTs alignment injection guards", () => {
        const srt = convertKeepTs(track)

        it("does not inject \\an0 for zero alignment", () => {
            expect(srt).not.toContain("\\an0")
        })

        it("does not inject \\an-2 for negative alignment", () => {
            expect(srt).not.toMatch(/\\an-/)
        })

        it("does not inject \\an99 for huge alignment", () => {
            expect(srt).not.toContain("\\an99")
        })

        it("treats invalid alignment as default (\\an2) and skips injection", () => {
            // \\an2 is the global default and is skipped when injectAn2=false (default)
            // So lines with clamped-to-2 alignment should NOT get any standalone {\\anN}
            const zeroBlock = srt.substring(srt.indexOf("Zero align"), srt.indexOf("Zero align") + 50)
            expect(zeroBlock).not.toMatch(/\{\\an\d+\}/)

            const negBlock = srt.substring(srt.indexOf("Negative align"), srt.indexOf("Negative align") + 50)
            expect(negBlock).not.toMatch(/\{\\an\d+\}/)

            const hugeBlock = srt.substring(srt.indexOf("Huge align"), srt.indexOf("Huge align") + 50)
            expect(hugeBlock).not.toMatch(/\{\\an\d+\}/)
        })

        it("preserves text content for all lines", () => {
            expect(srt).toContain("Zero align line")
            expect(srt).toContain("Negative align line")
            expect(srt).toContain("Huge align line")
            expect(srt).toContain("Normal align line")
        })
    })

    describe("isLikelySign alignment guards", () => {
        it("does not classify Alignment 0 lines as signs", () => {
            const srt = convertNormalSrt(track, {
                useHtmlTags: false,
                mergeDuplicates: false,
                stripEmptyLines: true,
                stripSigns: true
            })
            expect(srt).toContain("Zero align line")
        })

        it("does not classify negative Alignment lines as signs", () => {
            const srt = convertNormalSrt(track, {
                useHtmlTags: false,
                mergeDuplicates: false,
                stripEmptyLines: true,
                stripSigns: true
            })
            expect(srt).toContain("Negative align line")
        })

        it("does not classify huge Alignment (99) lines as signs", () => {
            const srt = convertNormalSrt(track, {
                useHtmlTags: false,
                mergeDuplicates: false,
                stripEmptyLines: true,
                stripSigns: true
            })
            expect(srt).toContain("Huge align line")
        })

        it("still classifies valid Alignment 8 as sign", () => {
            const an8Track = parseAss(`[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: TopSign,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,8,10,10,10,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,TopSign,,0,0,0,,Top sign line
`)
            const srt = convertNormalSrt(an8Track, {
                useHtmlTags: false,
                mergeDuplicates: false,
                stripEmptyLines: true,
                stripSigns: true
            })
            expect(srt).not.toContain("Top sign line")
        })
    })
})

// ─── Override tag round-trip (keepTs) ────────────────────────────────────────

const OVERRIDE_TAGS_ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Signs,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,8,20,20,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Signs,,0,0,0,,{\\pos(640,360)}Positioned text
Dialogue: 0,0:00:05.00,0:00:10.00,Signs,,0,0,0,,{\\an8\\fscx120\\fscy80}Scaled text
Dialogue: 0,0:00:10.00,0:00:15.00,Default,,0,0,0,,{\\move(0,0,640,360,100,500)}Moving text
Dialogue: 0,0:00:15.00,0:00:20.00,Default,,0,0,0,,{\\clip(0,0,640,360)}Clipped text
Dialogue: 0,0:00:20.00,0:00:25.00,Default,,0,0,0,,{\\b1}Bold{\\b0} normal
Dialogue: 0,0:00:25.00,0:00:30.00,Default,,0,0,0,,{\\c&H0000FF&}Red text
`

describe("round-trip — override tag preservation (keepTs)", () => {
    const track = parseAss(OVERRIDE_TAGS_ASS)
    const srt = convertKeepTs(track)

    it("preserves \\pos tag", () => {
        expect(srt).toContain("\\pos(640,360)")
        expect(srt).toContain("Positioned text")
    })

    it("preserves \\fscx and \\fscy tags", () => {
        expect(srt).toContain("\\fscx120")
        expect(srt).toContain("\\fscy80")
        expect(srt).toContain("Scaled text")
    })

    it("preserves \\move tag", () => {
        expect(srt).toContain("\\move(0,0,640,360,100,500)")
        expect(srt).toContain("Moving text")
    })

    it("preserves \\clip tag", () => {
        expect(srt).toContain("\\clip(0,0,640,360)")
        expect(srt).toContain("Clipped text")
    })

    it("preserves \\b toggle tags", () => {
        expect(srt).toContain("{\\b1}Bold{\\b0} normal")
    })

    it("preserves colour tags", () => {
        expect(srt).toContain("\\c&H0000FF&")
        expect(srt).toContain("Red text")
    })

    it("produces valid SRT format", () => {
        expect(srt.trimStart()).toMatch(/^1\n/)
        expect(srt).toContain("-->")
        expect(srt).toMatch(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/)
    })

    it("normalSrt preserves text content (strips tags)", () => {
        const normal = convertNormalSrt(track, {
            useHtmlTags: false,
            mergeDuplicates: false,
            stripEmptyLines: true
        })
        expect(normal).toContain("Positioned text")
        expect(normal).toContain("Scaled text")
        expect(normal).toContain("Moving text")
        expect(normal).toContain("Clipped text")
        expect(normal).toContain("Bold")
        expect(normal).toContain("Red text")
    })
})

// ─── Sign-first ordering round-trip ──────────────────────────────────────────

const SIGNFIRST_OVERLAP_ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Signs,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,8,20,20,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 10,0:00:01.00,0:00:05.00,Default,,0,0,0,,Early dialogue
Dialogue: 0,0:00:10.00,0:00:18.00,Signs,,0,0,0,,{\\pos(640,100)}Overlapping sign A
Dialogue: 1,0:00:11.00,0:00:17.00,Signs,,0,0,0,,{\\pos(640,200)}Overlapping sign B
Dialogue: 10,0:00:12.00,0:00:20.00,Default,,0,0,0,,Overlapping dialogue
Dialogue: 10,0:00:25.00,0:00:30.00,Default,,0,0,0,,Later dialogue
`

describe("round-trip — sign-first ordering", () => {
    const track = parseAss(SIGNFIRST_OVERLAP_ASS)

    it("puts signs before dialogue within overlapping groups", () => {
        const srt = convertKeepTs(track, { injectAn2: false, signFirst: true })
        const signAIdx = srt.indexOf("Overlapping sign A")
        const signBIdx = srt.indexOf("Overlapping sign B")
        const dialogueIdx = srt.indexOf("Overlapping dialogue")
        expect(signAIdx).toBeLessThan(dialogueIdx)
        expect(signBIdx).toBeLessThan(dialogueIdx)
    })

    it("preserves all entries in sign-first output", () => {
        const srt = convertKeepTs(track, { injectAn2: false, signFirst: true })
        expect(srt).toContain("Early dialogue")
        expect(srt).toContain("Overlapping sign A")
        expect(srt).toContain("Overlapping sign B")
        expect(srt).toContain("Overlapping dialogue")
        expect(srt).toContain("Later dialogue")
    })

    it("keeps non-overlapping entries in chronological order", () => {
        const srt = convertKeepTs(track, { injectAn2: false, signFirst: true })
        const earlyIdx = srt.indexOf("Early dialogue")
        const signIdx = srt.indexOf("Overlapping sign A")
        const laterIdx = srt.indexOf("Later dialogue")
        // Early (1s) before overlap group (10s), later (25s) after
        expect(earlyIdx).toBeLessThan(signIdx)
        expect(laterIdx).toBeGreaterThan(signIdx)
    })

    it("preserves override tags in sign-first output", () => {
        const srt = convertKeepTs(track, { injectAn2: false, signFirst: true })
        expect(srt).toContain("\\pos(640,100)")
        expect(srt).toContain("\\pos(640,200)")
    })
})

// ─── Timestamp precision round-trip ──────────────────────────────────────────

describe("round-trip — timestamp precision", () => {
    it("preserves centisecond timestamps from ASS in SRT millisecond format", () => {
        const track = parseAss(`[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:14:09.54,0:14:14.96,Default,,0,0,0,,Timestamp precision test
`)
        const srt = convertKeepTs(track)
        // ASS 0:14:09.54 → SRT 00:14:09,540
        expect(srt).toContain("00:14:09,540")
        // ASS 0:14:14.96 → SRT 00:14:14,960
        expect(srt).toContain("00:14:14,960")
    })
})
