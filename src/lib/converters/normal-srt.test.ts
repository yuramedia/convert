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
        const srt = convertNormalSrt(track, {
            useHtmlTags: true,
            mergeDuplicates: false,
            stripEmptyLines: true,
            uppercaseSigns: false
        })
        expect(srt).toContain("<b>Bold</b> text")
    })

    it("applies initial italic from style", () => {
        const srt = convertNormalSrt(track, {
            useHtmlTags: true,
            mergeDuplicates: false,
            stripEmptyLines: true,
            uppercaseSigns: false
        })
        expect(srt).toContain("<i>Styled italic</i>")
    })

    it("converts \\N to newline", () => {
        const srt = convertNormalSrt(track, { uppercaseSigns: false })
        expect(srt).toContain("Line with \nnewline")
    })

    it("strips TS-only tags (\\pos, \\fscx)", () => {
        const srt = convertNormalSrt(track, {
            useHtmlTags: true,
            mergeDuplicates: false,
            stripEmptyLines: true,
            uppercaseSigns: false
        })
        expect(srt).toContain("TS only")
        expect(srt).not.toContain("\\pos")
        expect(srt).not.toContain("\\fscx")
    })

    it("strips drawing lines when stripEmptyLines=true", () => {
        const srt = convertNormalSrt(track, {
            useHtmlTags: true,
            mergeDuplicates: false,
            stripEmptyLines: true,
            uppercaseSigns: false
        })
        expect(srt).not.toContain("m 0 0")
    })

    it("merges duplicate lines when mergeDuplicates=true", () => {
        const srt = convertNormalSrt(track, {
            useHtmlTags: true,
            mergeDuplicates: true,
            stripEmptyLines: true,
            uppercaseSigns: false
        })
        const matches = srt.match(/Duplicate/g)
        expect(matches).toHaveLength(1)
    })

    it("keeps duplicates when mergeDuplicates=false", () => {
        const srt = convertNormalSrt(track, {
            useHtmlTags: true,
            mergeDuplicates: false,
            stripEmptyLines: true,
            uppercaseSigns: false
        })
        const matches = srt.match(/Duplicate/g)
        expect(matches).toHaveLength(2)
    })

    it("strips HTML when useHtmlTags=false", () => {
        const srt = convertNormalSrt(track, {
            useHtmlTags: false,
            mergeDuplicates: false,
            stripEmptyLines: true,
            uppercaseSigns: false
        })
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
        const srt = convertNormalSrt(track, {
            useHtmlTags: false,
            mergeDuplicates: false,
            stripEmptyLines: true,
            uppercaseSigns: false
        })
        expect(srt).toContain("Alasan Mengapa")
        expect(srt).toContain("Pengungkapan Eksklusif")
        expect(srt).toContain("Garis Depan")
        expect(srt).toContain("Dia itu lahir di Prancis")
    })

    it("dialogue stays at the end (higher index) when signs are kept", () => {
        const srt = convertNormalSrt(track, {
            useHtmlTags: false,
            mergeDuplicates: false,
            stripEmptyLines: true,
            uppercaseSigns: false
        })
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

    it("respects enableFrameGap=false and bypasses adjustments", () => {
        const track = parseAss(OVERLAPPING_ASS)
        const srt = convertNormalSrt(track, {
            useHtmlTags: false,
            mergeDuplicates: false,
            stripEmptyLines: true,
            enableFrameGap: false,
            snapThreshold: 1500,
            minGap: 200
        })
        // Line B should NOT snap to Line C's start
        expect(srt).toContain("00:00:03,000 --> 00:00:07,000")
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
Style: Translation Top,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,8,10,10,10,1
Style: Stopwatch,Arial,40,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

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
Dialogue: 0,0:00:25.00,0:00:27.00,Translation Top,,0,0,0,,Translation Top line should be stripped
Dialogue: 0,0:00:27.00,0:00:29.00,Stopwatch,,0,0,0,,Stopwatch dialogue
`

describe("convertNormalSrt — keyword false-positive regression", () => {
    const track = parseAss(KEYWORD_FALSE_POSITIVE_ASS)
    const opts = {
        useHtmlTags: false,
        mergeDuplicates: false,
        stripEmptyLines: true,
        stripSigns: true,
        uppercaseSigns: false
    }

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

    it("DOES strip 'Translation Top' style (word boundary match on 'top')", () => {
        const srt = convertNormalSrt(track, opts)
        expect(srt).not.toContain("Translation Top line should be stripped")
    })

    it("does NOT strip 'Stopwatch' style (contains 'top' as substring)", () => {
        const srt = convertNormalSrt(track, opts)
        expect(srt).toContain("Stopwatch dialogue")
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

    it("converts sign lines to uppercase when HTML tags are disabled", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: false, uppercaseSigns: true })
        expect(srt).toContain("This is dialogue text")
        expect(srt).toContain("THIS IS A SIGN")
    })

    it("keeps sign line casing when HTML tags are enabled", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: true, uppercaseSigns: true })
        expect(srt).toContain("This is dialogue text")
        expect(srt).toContain("This is a sign")
    })

    it("does not convert sign lines to uppercase when disabled", () => {
        const srt = convertNormalSrt(track, { uppercaseSigns: false })
        expect(srt).toContain("This is dialogue text")
        expect(srt).toContain("This is a sign")
    })

    it("does not uppercase text with alignment tags alone (bug fix)", () => {
        // Alignment tags (\an) alone should NOT trigger sign detection
        const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\an8}<i>Kita memang begini!\\NRasakan semua perihnya!</i>
`)
        const srt = convertNormalSrt(track, { uppercaseSigns: true })
        // Should preserve original case (not uppercase)
        expect(srt).toContain("Kita memang begini")
        expect(srt).not.toContain("KITA MEMANG BEGINI")
        // Literal HTML-like text should be escaped, not interpreted as markup
        expect(srt).toContain("&lt;i&gt;")
        expect(srt).toContain("&lt;/i&gt;")
    })
})

// ─── keepAlignment ──────────────────────────────────────────────────────────

describe("convertNormalSrt — keepAlignment", () => {
    const ALIGNMENT_ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: TopStyle,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,8,10,10,10,1
Style: MidStyle,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,5,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Bottom dialogue
Dialogue: 0,0:00:03.00,0:00:06.00,TopStyle,,0,0,0,,Top style text
Dialogue: 0,0:00:06.00,0:00:09.00,Default,,0,0,0,,{\\an8}Inline top override
Dialogue: 0,0:00:09.00,0:00:12.00,MidStyle,,0,0,0,,Middle style text
Dialogue: 0,0:00:12.00,0:00:15.00,TopStyle,,0,0,0,,{\\an2}Override to bottom
`

    const track = parseAss(ALIGNMENT_ASS)

    it("injects {\\an8} for top-aligned style when keepAlignment=true", () => {
        const srt = convertNormalSrt(track, {
            keepAlignment: true,
            mergeDuplicates: false,
            stripEmptyLines: true
        })
        expect(srt).toContain("{\\an8}Top style text")
    })

    it("does NOT inject {\\an2} for default bottom alignment", () => {
        const srt = convertNormalSrt(track, {
            keepAlignment: true,
            mergeDuplicates: false,
            stripEmptyLines: true
        })
        // Bottom dialogue should have no alignment tag prefix
        expect(srt).toContain("Bottom dialogue")
        expect(srt).not.toContain("{\\an2}Bottom dialogue")
    })

    it("uses inline \\an8 override instead of style default", () => {
        const srt = convertNormalSrt(track, {
            keepAlignment: true,
            mergeDuplicates: false,
            stripEmptyLines: true
        })
        // Default style is \\an2, but inline override is \\an8
        expect(srt).toContain("{\\an8}Inline top override")
    })

    it("uses inline \\an2 override on top-style (no tag injected since \\an2 is default)", () => {
        const srt = convertNormalSrt(track, {
            keepAlignment: true,
            mergeDuplicates: false,
            stripEmptyLines: true
        })
        // TopStyle is \\an8, but inline override is \\an2 — so no tag injected
        expect(srt).toContain("Override to bottom")
        expect(srt).not.toContain("{\\an2}Override to bottom")
        expect(srt).not.toContain("{\\an8}Override to bottom")
    })

    it("strips all alignment tags when keepAlignment=false", () => {
        const srt = convertNormalSrt(track, {
            keepAlignment: false,
            mergeDuplicates: false,
            stripEmptyLines: true
        })
        expect(srt).not.toContain("{\\an")
    })

    it("preserves alignment tags by default", () => {
        const srt = convertNormalSrt(track, {
            mergeDuplicates: false,
            stripEmptyLines: true
        })
        expect(srt).toContain("{\\an8}Top style text")
    })

    it("combines alignment tags with HTML formatting", () => {
        const srt = convertNormalSrt(track, {
            keepAlignment: true,
            useHtmlTags: true,
            mergeDuplicates: false,
            stripEmptyLines: true
        })
        // TopStyle text should have alignment prepended to HTML-tagged output
        expect(srt).toContain("{\\an8}Top style text")
    })

    it("injects {\\an5} for middle-aligned style", () => {
        const srt = convertNormalSrt(track, {
            keepAlignment: true,
            mergeDuplicates: false,
            stripEmptyLines: true
        })
        expect(srt).toContain("{\\an5}Middle style text")
    })
})

describe("convertNormalSrt — ampersand handling", () => {
    it("keeps literal ampersands intact and does not convert & to &amp;", () => {
        const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:01:03.03,0:01:04.40,Default,,0,0,0,,Subtitle provided by: Yuramedia Link\\NTL: Afiyah / QA: Findbp & Yosua Adi
Dialogue: 0,0:01:05.00,0:01:07.00,Default,,0,0,0,,Rock & Roll &amp; R&B
`)

        const srt = convertNormalSrt(track, { useHtmlTags: true })
        expect(srt).toContain("Findbp & Yosua Adi")
        expect(srt).not.toContain("&amp;")
        expect(srt).toContain("Rock & Roll & R&B")
    })
})

describe("convertNormalSrt — mergeSignLines", () => {
    const MERGE_ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Signs,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,5,20,20,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

    it("merges a single sign with overlapping dialogue", () => {
        const track = parseAss(
            MERGE_ASS +
                `Dialogue: 0,0:00:10.00,0:00:15.00,Signs,,0,0,0,,{\\\\pos(960,500)}Stasiun Seibu-Shinjuku
Dialogue: 20,0:00:10.00,0:00:15.00,Default,,0,0,0,,Tapi biasanya setiap hari aku sibuk,
`
        )
        const srt = convertNormalSrt(track, { mergeSignLines: true, useHtmlTags: false, keepAlignment: false })
        expect(srt).toContain("(Stasiun Seibu-Shinjuku)")
        expect(srt).toContain("(Stasiun Seibu-Shinjuku)\nTapi biasanya setiap hari aku sibuk,")
        // Should be a single cue, not two
        expect(srt.match(/-->/g)?.length).toBe(1)
    })

    it("merges sign into multiple overlapping dialogues", () => {
        const track = parseAss(
            MERGE_ASS +
                `Dialogue: 0,0:00:10.00,0:00:20.00,Signs,,0,0,0,,{\\\\pos(960,500)}Episode 1
Dialogue: 20,0:00:10.00,0:00:13.00,Default,,0,0,0,,Dialog A
Dialogue: 20,0:00:13.00,0:00:16.00,Default,,0,0,0,,Dialog B
`
        )
        const srt = convertNormalSrt(track, { mergeSignLines: true, useHtmlTags: false, keepAlignment: false })
        expect(srt).toContain("(Episode 1)\nDialog A")
        expect(srt).toContain("(Episode 1)\nDialog B")
    })

    it("emits standalone sign when no overlapping dialogue", () => {
        const track = parseAss(
            MERGE_ASS +
                `Dialogue: 0,0:00:05.00,0:00:08.00,Signs,,0,0,0,,{\\\\pos(960,500)}Standalone Sign
Dialogue: 20,0:00:10.00,0:00:15.00,Default,,0,0,0,,Some dialogue
`
        )
        const srt = convertNormalSrt(track, { mergeSignLines: true, useHtmlTags: false, keepAlignment: false })
        expect(srt).toContain("(Standalone Sign)")
        expect(srt.match(/-->/g)?.length).toBe(2) // two separate cues
    })

    it("collapses frame-by-frame sign events into a single cue", () => {
        // Simulate 5 frame-by-frame events at ~40ms intervals (23.976fps)
        const track = parseAss(
            MERGE_ASS +
                `Dialogue: 0,0:00:10.00,0:00:10.04,Signs,,0,0,0,,{\\\\pos(960,500)}Kereta Api
Dialogue: 0,0:00:10.04,0:00:10.08,Signs,,0,0,0,,{\\\\pos(960.1,500.1)}Kereta Api
Dialogue: 0,0:00:10.08,0:00:10.12,Signs,,0,0,0,,{\\\\pos(960.2,500.2)}Kereta Api
Dialogue: 0,0:00:10.12,0:00:10.16,Signs,,0,0,0,,{\\\\pos(960.3,500.3)}Kereta Api
Dialogue: 0,0:00:10.16,0:00:10.20,Signs,,0,0,0,,{\\\\pos(960.4,500.4)}Kereta Api
`
        )
        const srt = convertNormalSrt(track, { mergeSignLines: true, useHtmlTags: false, keepAlignment: false })
        // Should produce a single standalone sign cue
        expect(srt).toContain("(Kereta Api)")
        expect(srt.match(/-->/g)?.length).toBe(1)
        // Time span should cover full range
        expect(srt).toContain("00:00:10,000")
        expect(srt).toContain("00:00:10,200")
    })

    it("collapses interleaved frame-by-frame signs and drawings correctly", () => {
        // Interleaved frame-by-frame events for two signs and a drawing command
        const track = parseAss(
            MERGE_ASS +
                `Dialogue: 0,0:00:10.00,0:00:10.04,Signs,,0,0,0,,{\\\\pos(960,500)}Sign One
Dialogue: 0,0:00:10.00,0:00:10.04,Signs,,0,0,0,,{\\\\pos(100,200)}Sign Two
Dialogue: 0,0:00:10.00,0:00:10.04,Signs,,0,0,0,,{\\\\p1}m 0 0 l 10 10
Dialogue: 0,0:00:10.04,0:00:10.08,Signs,,0,0,0,,{\\\\pos(960.1,500.1)}Sign One
Dialogue: 0,0:00:10.04,0:00:10.08,Signs,,0,0,0,,{\\\\pos(100.1,200.1)}Sign Two
Dialogue: 0,0:00:10.04,0:00:10.08,Signs,,0,0,0,,{\\\\p1}m 0 0 l 10 10
Dialogue: 0,0:00:10.08,0:00:10.12,Signs,,0,0,0,,{\\\\pos(960.2,500.2)}Sign One
Dialogue: 0,0:00:10.08,0:00:10.12,Signs,,0,0,0,,{\\\\pos(100.2,200.2)}Sign Two
`
        )
        const srt = convertNormalSrt(track, { mergeSignLines: true, useHtmlTags: false, keepAlignment: false })
        // Both Sign One and Sign Two should collapse into 00:00:10,000 --> 00:00:10,120
        expect(srt).toContain("(Sign One)")
        expect(srt).toContain("(Sign Two)")
        expect(srt).toContain("00:00:10,000 --> 00:00:10,120")
        expect(srt).not.toContain("m 0 0")
    })

    it("merges multiple signs overlapping same dialogue", () => {
        const track = parseAss(
            MERGE_ASS +
                `Dialogue: 0,0:00:10.00,0:00:15.00,Signs,,0,0,0,,{\\\\pos(960,100)}Sign A
Dialogue: 0,0:00:10.00,0:00:15.00,Signs,,0,0,0,,{\\\\pos(960,800)}Sign B
Dialogue: 20,0:00:10.00,0:00:15.00,Default,,0,0,0,,Dialogue text
`
        )
        const srt = convertNormalSrt(track, { mergeSignLines: true, useHtmlTags: false, keepAlignment: false })
        expect(srt).toContain("(Sign A)\n(Sign B)\nDialogue text")
    })

    it("flattens multi-line sign text with dash separator", () => {
        const track = parseAss(
            MERGE_ASS +
                `Dialogue: 0,0:00:10.00,0:00:15.00,Signs,,0,0,0,,{\\\\pos(960,500)}Line One\\NLine Two
Dialogue: 20,0:00:10.00,0:00:15.00,Default,,0,0,0,,Dialogue
`
        )
        const srt = convertNormalSrt(track, { mergeSignLines: true, useHtmlTags: false, keepAlignment: false })
        expect(srt).toContain("(Line One - Line Two)")
        expect(srt).toContain("(Line One - Line Two)\nDialogue")
    })

    it("does not double-wrap already parenthesized sign text", () => {
        const track = parseAss(
            MERGE_ASS +
                `Dialogue: 0,0:00:10.00,0:00:15.00,Signs,,0,0,0,,{\\\\pos(960,500)}(Already Wrapped)
Dialogue: 20,0:00:10.00,0:00:15.00,Default,,0,0,0,,Dialogue
`
        )
        const srt = convertNormalSrt(track, { mergeSignLines: true, useHtmlTags: false, keepAlignment: false })
        expect(srt).toContain("(Already Wrapped)\nDialogue")
        expect(srt).not.toContain("((Already Wrapped))")
    })

    it("produces identical output when mergeSignLines is false (no regression)", () => {
        const track = parseAss(
            MERGE_ASS +
                `Dialogue: 0,0:00:10.00,0:00:15.00,Signs,,0,0,0,,{\\\\pos(960,500)}Sign Text
Dialogue: 20,0:00:10.00,0:00:15.00,Default,,0,0,0,,Dialogue text
`
        )
        const withMerge = convertNormalSrt(track, { mergeSignLines: false, useHtmlTags: false, keepAlignment: false })
        const withoutMerge = convertNormalSrt(track, { useHtmlTags: false, keepAlignment: false })
        expect(withMerge).toBe(withoutMerge)
    })

    it("stripSigns takes priority over mergeSignLines", () => {
        const track = parseAss(
            MERGE_ASS +
                `Dialogue: 0,0:00:10.00,0:00:15.00,Signs,,0,0,0,,{\\\\pos(960,500)}Sign Text
Dialogue: 20,0:00:10.00,0:00:15.00,Default,,0,0,0,,Dialogue text
`
        )
        const srt = convertNormalSrt(track, {
            mergeSignLines: true,
            stripSigns: true,
            useHtmlTags: false,
            keepAlignment: false
        })
        expect(srt).not.toContain("Sign Text")
        expect(srt).toContain("Dialogue text")
    })

    it("uppercaseSigns with mergeSignLines produces uppercase sign without parentheses", () => {
        const track = parseAss(
            MERGE_ASS +
                `Dialogue: 0,0:00:10.00,0:00:15.00,Signs,,0,0,0,,{\\\\pos(960,500)}Station Name
Dialogue: 20,0:00:10.00,0:00:15.00,Default,,0,0,0,,Dialogue text
`
        )
        const srt = convertNormalSrt(track, {
            mergeSignLines: true,
            uppercaseSigns: true,
            useHtmlTags: false,
            keepAlignment: false
        })
        expect(srt).toContain("STATION NAME\nDialogue text")
        expect(srt).not.toContain("(STATION NAME)")
    })

    it("drops drawing-only sign events", () => {
        const track = parseAss(
            MERGE_ASS +
                `Dialogue: 0,0:00:10.00,0:00:15.00,Signs,,0,0,0,,{\\\\pos(960,500)\\\\p1}m -15 5 l -15 -5 l 15 -5 l 15 5
Dialogue: 20,0:00:10.00,0:00:15.00,Default,,0,0,0,,Dialogue text
`
        )
        const srt = convertNormalSrt(track, { mergeSignLines: true, useHtmlTags: false, keepAlignment: false })
        expect(srt).toContain("Dialogue text")
        // Drawing should be stripped - no sign text prepended
        expect(srt).not.toContain("m -15 5")
        expect(srt.match(/-->/g)?.length).toBe(1)
    })

    it("handles partial time overlap correctly", () => {
        const track = parseAss(
            MERGE_ASS +
                `Dialogue: 0,0:00:08.00,0:00:20.00,Signs,,0,0,0,,{\\\\pos(960,500)}Long Sign
Dialogue: 20,0:00:10.00,0:00:15.00,Default,,0,0,0,,Dialog A
Dialogue: 20,0:00:18.00,0:00:22.00,Default,,0,0,0,,Dialog B
Dialogue: 20,0:00:25.00,0:00:30.00,Default,,0,0,0,,Dialog C
`
        )
        const srt = convertNormalSrt(track, { mergeSignLines: true, useHtmlTags: false, keepAlignment: false })
        // Sign overlaps Dialog A and Dialog B, but NOT Dialog C
        expect(srt).toContain("(Long Sign)\nDialog A")
        expect(srt).toContain("(Long Sign)\nDialog B")
        expect(srt).not.toContain("(Long Sign)\nDialog C")
        expect(srt).toContain("Dialog C")
    })

    it("works with useHtmlTags enabled (YouTube preset scenario)", () => {
        const track = parseAss(
            MERGE_ASS +
                `Dialogue: 0,0:00:10.00,0:00:15.00,Signs,,0,0,0,,{\\\\pos(960,500)}Sign Text
Dialogue: 20,0:00:10.00,0:00:15.00,Default,,0,0,0,,{\\\\i1}Italic dialogue
`
        )
        const srt = convertNormalSrt(track, {
            mergeSignLines: true,
            uppercaseSigns: true,
            useHtmlTags: true,
            keepAlignment: false
        })
        expect(srt).toContain("SIGN TEXT\n<i>Italic dialogue</i>")
    })

    it("strips \\b1 bold tags from signs when useHtmlTags is true (no <b> on signs)", () => {
        const track = parseAss(
            MERGE_ASS +
                `Dialogue: 0,0:02:16.95,0:02:18.37,Signs,,0,0,0,,{\\\\an5\\\\fnCalibri\\\\b1\\\\bord0\\\\pos(968,144)}Dingin
Dialogue: 0,0:03:37.36,0:03:41.74,Signs,,0,0,0,,{\\\\an4\\\\b1\\\\pos(358,115)}Jalur Kereta
Dialogue: 20,0:03:37.66,0:03:41.74,Default,,0,0,0,,{\\\\i1}Ujung Jepang paling barat?
`
        )
        const srt = convertNormalSrt(track, {
            mergeSignLines: true,
            uppercaseSigns: true,
            useHtmlTags: true,
            keepAlignment: false
        })
        // Standalone sign should be clean uppercase without <b>
        expect(srt).toContain("DINGIN")
        expect(srt).not.toContain("<b>DINGIN</b>")
        // Merged sign should be clean uppercase without <b>, while dialogue keeps <i>
        expect(srt).toContain("JALUR KERETA\n<i>Ujung Jepang paling barat?</i>")
        expect(srt).not.toContain("<b>JALUR KERETA</b>")
    })
})
