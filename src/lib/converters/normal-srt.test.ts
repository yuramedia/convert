import { describe, it, expect } from "vitest"
import { parseAss } from "../ass-parser"
import { convertNormalSrt } from "./normal-srt"

const SAMPLE_ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,-1,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Signs,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,8,20,20,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Comment: 0,0:00:00.50,0:00:01.00,Default,,0000,0000,0000,,Comment line
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0000,0000,0000,,Hello World
Dialogue: 0,0:00:05.00,0:00:10.00,Default,,0000,0000,0000,,{\\b1}Bold{\\b0} text
Dialogue: 0,0:00:10.00,0:00:15.00,Default,,0000,0000,0000,,Line with \\Nnewline
Dialogue: 0,0:00:15.00,0:00:20.00,Signs,,0000,0000,0000,,{\\pos(640,360)\\fscx120}TS only
Dialogue: 0,0:00:20.00,0:00:25.00,Default,,0000,0000,0000,,{\\p1}m 0 0 l 100 100{\\p0}
Dialogue: 0,0:00:25.00,0:00:30.00,Default,,0000,0000,0000,,Duplicate
Dialogue: 0,0:00:25.00,0:00:30.00,Default,,0000,0000,0000,,Duplicate
Dialogue: 0,0:00:30.00,0:00:35.00,Default,,0000,0000,0000,,Styled italic
`

describe("convertNormalSrt", () => {
    const track = parseAss(SAMPLE_ASS)

    it("filters out Comment lines", () => {
        const srt = convertNormalSrt(track, { uppercaseSigns: false })
        expect(srt).not.toContain("Comment line")
    })

    it("outputs valid SRT format", () => {
        const srt = convertNormalSrt(track, { uppercaseSigns: false })
        expect(srt).toContain("1\n")
        expect(srt).toContain("-->")
        expect(srt).toContain("Hello World")
    })

    it("converts \\b1 to <b> tags", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: false, stripEmptyLines: true, uppercaseSigns: false })
        expect(srt).toContain("<b>Bold</b> text")
    })

    it("applies initial italic from style", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: false, stripEmptyLines: true, uppercaseSigns: false })
        expect(srt).toContain("<i>Styled italic</i>")
    })

    it("converts \\N to newline", () => {
        const srt = convertNormalSrt(track, { uppercaseSigns: false })
        expect(srt).toContain("Line with \nnewline")
    })

    it("strips TS-only tags (\\pos, \\fscx)", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: false, stripEmptyLines: true, uppercaseSigns: false })
        expect(srt).toContain("TS only")
        expect(srt).not.toContain("\\pos")
        expect(srt).not.toContain("\\fscx")
    })

    it("strips drawing lines when stripEmptyLines=true", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: false, stripEmptyLines: true, uppercaseSigns: false })
        expect(srt).not.toContain("m 0 0")
    })

    it("merges duplicate lines when mergeDuplicates=true", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: true, stripEmptyLines: true, uppercaseSigns: false })
        const matches = srt.match(/Duplicate/g)
        expect(matches).toHaveLength(1)
    })

    it("keeps duplicates when mergeDuplicates=false", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: false, stripEmptyLines: true, uppercaseSigns: false })
        const matches = srt.match(/Duplicate/g)
        expect(matches).toHaveLength(2)
    })

    it("strips HTML when useHtmlTags=false", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: false, mergeDuplicates: false, stripEmptyLines: true, uppercaseSigns: false })
        expect(srt).not.toContain("<b>")
        expect(srt).not.toContain("<i>")
        expect(srt).toContain("Bold text")
    })

    it("sorts events by start time", () => {
        const srt = convertNormalSrt(track, { uppercaseSigns: false })
        const timestamps = [...srt.matchAll(/(\d{2}:\d{2}:\d{2},\d{3}) -->/g)].map(m => m[1])
        for (let i = 1; i < timestamps.length; i++) {
            expect(timestamps[i] >= timestamps[i - 1]).toBe(true)
        }
    })
})

// ─── stripSigns option ───────────────────────────────────────────────────────

const OVERLAP_ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Calibri,78,&H00FFFFFF,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,3,1,2,30,30,45,1
Style: Sign,Arial,60,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,5,1,8,90,90,76,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:14:14.73,0:14:16.46,Sign,,0,0,0,,{\\an2\\pos(642,324)\\bord6\\b1\\shad0\\fs40\\frz-4.66}Alasan Mengapa Komedian Pria
Dialogue: 1,0:14:14.73,0:14:16.46,Sign,,0,0,0,,{\\an2\\pos(642,324)\\bord3\\b1\\shad0\\fs40\\frz-4.66}Alasan Mengapa Komedian Pria
Dialogue: 0,0:14:14.73,0:14:16.46,Sign,,0,0,0,,{\\an7\\pos(1479.78,393.02)\\fs30\\b1\\shad0\\frz8.64}Pengungkapan Eksklusif
Dialogue: 0,0:14:14.73,0:14:16.46,Sign,,0,0,0,,{\\an7\\pos(1376.34,881.7)\\bord8\\b1\\shad0\\frz15.34}Garis Depan Pemulihan
Dialogue: 10,0:14:09.54,0:14:14.96,Default,,0,0,0,,Dia itu lahir di Prancis, tapi ayahnya\\Nasal Prancis dan ibunya asal Jepang.
Dialogue: 10,0:14:14.96,0:14:17.40,Default,,0,0,0,,Kudengar dia sangat menyukai {\\i1}wine{\\i0}.
`

describe("convertNormalSrt — stripSigns", () => {
    const track = parseAss(OVERLAP_ASS)

    it("strips all sign/TS lines when stripSigns=true", () => {
        const srt = convertNormalSrt(track, {
            useHtmlTags: true,
            mergeDuplicates: true,
            stripEmptyLines: true,
            stripSigns: true
        })
        expect(srt).not.toContain("Alasan Mengapa")
        expect(srt).not.toContain("Pengungkapan Eksklusif")
        expect(srt).not.toContain("Garis Depan")
    })

    it("keeps dialogue lines when stripSigns=true", () => {
        const srt = convertNormalSrt(track, {
            useHtmlTags: true,
            mergeDuplicates: true,
            stripEmptyLines: true,
            stripSigns: true
        })
        expect(srt).toContain("Dia itu lahir di Prancis")
        expect(srt).toContain("Kudengar dia sangat menyukai")
    })

    it("output is clean SRT with only dialogue when stripSigns=true", () => {
        const srt = convertNormalSrt(track, {
            useHtmlTags: true,
            mergeDuplicates: true,
            stripEmptyLines: true,
            stripSigns: true
        })
        const blocks = srt.trim().split(/\n\n+/)
        // Should only have 2 entries (the two dialogue lines)
        expect(blocks).toHaveLength(2)
        expect(blocks[0]).toContain("Dia itu lahir di Prancis")
        expect(blocks[1]).toContain("Kudengar dia sangat menyukai")
    })

    it("keeps sign lines by default (stripSigns=false)", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: false, mergeDuplicates: false, stripEmptyLines: true, uppercaseSigns: false })
        expect(srt).toContain("Alasan Mengapa")
        expect(srt).toContain("Pengungkapan Eksklusif")
        expect(srt).toContain("Garis Depan")
        expect(srt).toContain("Dia itu lahir di Prancis")
    })

    it("dialogue stays at the end (higher index) when signs are kept", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: false, mergeDuplicates: false, stripEmptyLines: true, uppercaseSigns: false })
        // At timestamp 14:14.73, signs should come before the dialogue at 14:14.96
        const signIdx = srt.indexOf("Alasan Mengapa")
        const dialogIdx = srt.indexOf("Kudengar dia sangat")
        expect(signIdx).toBeLessThan(dialogIdx)
    })
})

// ─── Overlap-aware snap/gap ──────────────────────────────────────────────────

describe("convertNormalSrt — overlap-aware snap/gap", () => {
    const OVERLAPPING_ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,Line A
Dialogue: 0,0:00:03.00,0:00:07.00,Default,,0,0,0,,Line B overlaps A
Dialogue: 0,0:00:08.00,0:00:10.00,Default,,0,0,0,,Line C after gap
`

    it("does not corrupt timestamps when entries overlap and snap is active", () => {
        const track = parseAss(OVERLAPPING_ASS)
        const srt = convertNormalSrt(track, {
            useHtmlTags: false,
            mergeDuplicates: false,
            stripEmptyLines: true,
            snapThreshold: 200,
            minGap: 0
        })
        // Line A ends at 5000, Line B starts at 3000 (overlap) — snap should be skipped
        expect(srt).toContain("00:00:01,000 --> 00:00:05,000")
        // Line B should remain unchanged
        expect(srt).toContain("00:00:03,000 --> 00:00:07,000")
    })

    it("does not corrupt timestamps when entries overlap and minGap is active", () => {
        const track = parseAss(OVERLAPPING_ASS)
        const srt = convertNormalSrt(track, {
            useHtmlTags: false,
            mergeDuplicates: false,
            stripEmptyLines: true,
            snapThreshold: 0,
            minGap: 100
        })
        // Overlap: Line A (1-5s) and Line B (3-7s) — gap is negative, skip
        expect(srt).toContain("00:00:01,000 --> 00:00:05,000")
        expect(srt).toContain("00:00:03,000 --> 00:00:07,000")
    })

    it("still applies snap to non-overlapping sequential entries", () => {
        const track = parseAss(OVERLAPPING_ASS)
        const srt = convertNormalSrt(track, {
            useHtmlTags: false,
            mergeDuplicates: false,
            stripEmptyLines: true,
            snapThreshold: 1500, // Line B ends at 7000, Line C starts at 8000 — gap 1000ms < 1500
            minGap: 0
        })
        // Line B should snap to Line C's start
        expect(srt).toContain("00:00:03,000 --> 00:00:08,000")
    })
})

// ─── isLikelySign keyword false-positive regression ──────────────────────────

const KEYWORD_FALSE_POSITIVE_ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Defaults,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Thoughts,Arial,40,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,-1,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Comments,Arial,40,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Effects,Arial,40,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Flashback,Arial,40,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Credited,Arial,40,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: TS,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,2,20,20,15,1
Style: OP,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,2,20,20,15,1
Style: ED,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,2,20,20,15,1
Style: Sign-TS,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,2,20,20,15,1
Style: OP Karaoke,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,2,20,20,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Default dialogue
Dialogue: 0,0:00:03.00,0:00:05.00,Defaults,,0,0,0,,Defaults dialogue
Dialogue: 0,0:00:05.00,0:00:07.00,Thoughts,,0,0,0,,Thoughts dialogue
Dialogue: 0,0:00:07.00,0:00:09.00,Comments,,0,0,0,,Comments dialogue
Dialogue: 0,0:00:09.00,0:00:11.00,Effects,,0,0,0,,Effects dialogue
Dialogue: 0,0:00:11.00,0:00:13.00,Flashback,,0,0,0,,Flashback dialogue
Dialogue: 0,0:00:13.00,0:00:15.00,Credited,,0,0,0,,Credited dialogue
Dialogue: 0,0:00:15.00,0:00:17.00,TS,,0,0,0,,TS line should be stripped
Dialogue: 0,0:00:17.00,0:00:19.00,OP,,0,0,0,,OP line should be stripped
Dialogue: 0,0:00:19.00,0:00:21.00,ED,,0,0,0,,ED line should be stripped
Dialogue: 0,0:00:21.00,0:00:23.00,Sign-TS,,0,0,0,,Sign-TS line should be stripped
Dialogue: 0,0:00:23.00,0:00:25.00,OP Karaoke,,0,0,0,,OP Karaoke line should be stripped
`

describe("convertNormalSrt — keyword false-positive regression", () => {
    const track = parseAss(KEYWORD_FALSE_POSITIVE_ASS)
    const opts = { useHtmlTags: false, mergeDuplicates: false, stripEmptyLines: true, stripSigns: true, uppercaseSigns: false }

    it("does NOT strip 'Defaults' style (contains 'ts' as substring)", () => {
        const srt = convertNormalSrt(track, opts)
        expect(srt).toContain("Defaults dialogue")
    })

    it("does NOT strip 'Thoughts' style (contains 'ts' as substring)", () => {
        const srt = convertNormalSrt(track, opts)
        expect(srt).toContain("Thoughts dialogue")
    })

    it("does NOT strip 'Comments' style (contains 'ts' as substring)", () => {
        const srt = convertNormalSrt(track, opts)
        expect(srt).toContain("Comments dialogue")
    })

    it("does NOT strip 'Effects' style (contains 'ts' as substring)", () => {
        const srt = convertNormalSrt(track, opts)
        expect(srt).toContain("Effects dialogue")
    })

    it("does NOT strip 'Flashback' style (contains 'ed' as substring)", () => {
        const srt = convertNormalSrt(track, opts)
        expect(srt).toContain("Flashback dialogue")
    })

    it("does NOT strip 'Credited' style (contains 'ed' as substring)", () => {
        const srt = convertNormalSrt(track, opts)
        expect(srt).toContain("Credited dialogue")
    })

    it("DOES strip 'TS' style (exact word match)", () => {
        const srt = convertNormalSrt(track, opts)
        expect(srt).not.toContain("TS line should be stripped")
    })

    it("DOES strip 'OP' style (exact word match)", () => {
        const srt = convertNormalSrt(track, opts)
        expect(srt).not.toContain("OP line should be stripped")
    })

    it("DOES strip 'ED' style (exact word match)", () => {
        const srt = convertNormalSrt(track, opts)
        expect(srt).not.toContain("ED line should be stripped")
    })

    it("DOES strip 'Sign-TS' style (word boundary match)", () => {
        const srt = convertNormalSrt(track, opts)
        expect(srt).not.toContain("Sign-TS line should be stripped")
    })

    it("DOES strip 'OP Karaoke' style (word boundary match)", () => {
        const srt = convertNormalSrt(track, opts)
        expect(srt).not.toContain("OP Karaoke line should be stripped")
    })

    it("keeps Default style dialogue", () => {
        const srt = convertNormalSrt(track, opts)
        expect(srt).toContain("Default dialogue")
    })
})

describe("convertNormalSrt — uppercaseSigns option", () => {
    const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Sign,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,8,20,20,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,This is dialogue text
Dialogue: 0,0:00:03.00,0:00:05.00,Sign,,0,0,0,,{\\pos(960,54)}This is a sign
`)

    it("converts sign lines to uppercase by default", () => {
        const srt = convertNormalSrt(track)
        expect(srt).toContain("This is dialogue text")
        expect(srt).toContain("THIS IS A SIGN")
    })

    it("does not convert sign lines to uppercase when disabled", () => {
        const srt = convertNormalSrt(track, { uppercaseSigns: false })
        expect(srt).toContain("This is dialogue text")
        expect(srt).toContain("This is a sign")
    })
})

