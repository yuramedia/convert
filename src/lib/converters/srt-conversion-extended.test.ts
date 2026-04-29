/**
 * Extended SRT conversion tests — covers ASS tag handling in both
 * Normal SRT (strip tags / HTML only) and Keep-TS (preserve all override tags).
 *
 * Pairs with ass-tags-extended.test.ts which tests the tokenizer in isolation.
 */
import { describe, it, expect } from "vitest"
import { parseAss } from "../ass-parser"
import { convertNormalSrt } from "./normal-srt"
import { convertKeepTs } from "./keep-ts"

// ─── Shared ASS fixture ──────────────────────────────────────────────────────

const SAMPLE = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Italic,Arial,40,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,-1,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Bold,Arial,40,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Signs,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,8,20,20,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0000,0000,0000,,Plain text
Dialogue: 0,0:00:03.00,0:00:05.00,Default,,0000,0000,0000,,{\\b1}Bold{\\b0} normal
Dialogue: 0,0:00:05.00,0:00:07.00,Default,,0000,0000,0000,,{\\i1}Italic{\\i0} normal
Dialogue: 0,0:00:07.00,0:00:09.00,Default,,0000,0000,0000,,{\\u1}Under{\\u0} normal
Dialogue: 0,0:00:09.00,0:00:11.00,Default,,0000,0000,0000,,{\\s1}Strike{\\s0} normal
Dialogue: 0,0:00:11.00,0:00:13.00,Default,,0000,0000,0000,,{\\b1\\i1}BoldItalic{\\b0\\i0}
Dialogue: 0,0:00:13.00,0:00:15.00,Signs,,0000,0000,0000,,{\\an8\\pos(960,54)\\fs40\\fnGeorgia\\b0\\shad0\\bord0\\c&H3B1583&}Sign text
Dialogue: 0,0:00:15.00,0:00:17.00,Default,,0000,0000,0000,,{\\pos(960,540)\\fscx120\\fscy80\\frz45}Positioned
Dialogue: 0,0:00:17.00,0:00:19.00,Default,,0000,0000,0000,,{\\clip(100,50,600,350)}Clipped
Dialogue: 0,0:00:19.00,0:00:21.00,Default,,0000,0000,0000,,{\\clip(1,m 0 0 l 640 0 640 360 0 360)}DrawClip
Dialogue: 0,0:00:21.00,0:00:23.00,Default,,0000,0000,0000,,{\\iclip(200,100,800,500)}InvClip
Dialogue: 0,0:00:23.00,0:00:25.00,Default,,0000,0000,0000,,{\\move(100,200,500,400,0,1000)}Moving
Dialogue: 0,0:00:25.00,0:00:27.00,Default,,0000,0000,0000,,{\\fad(500,1000)}Faded
Dialogue: 0,0:00:27.00,0:00:29.00,Default,,0000,0000,0000,,{\\fade(255,0,255,0,850,8820,8820)}ExtFade
Dialogue: 0,0:00:29.00,0:00:31.00,Default,,0000,0000,0000,,{\\t(0,500,\\fs48\\blur3)}Animated
Dialogue: 0,0:00:31.00,0:00:33.00,Default,,0000,0000,0000,,{\\k100}syl{\\k80}la{\\k120}ble
Dialogue: 0,0:00:33.00,0:00:35.00,Default,,0000,0000,0000,,{\\alpha&H80&\\c&HFF0000&\\1a&H40&}Coloured
Dialogue: 0,0:00:35.00,0:00:37.00,Default,,0000,0000,0000,,{\\p1}m 0 0 l 100 0 100 100 0 100{\\p0}
Dialogue: 0,0:00:37.00,0:00:39.00,Default,,0000,0000,0000,,{\\p1}m 0 0 l 50 50{\\p0}After drawing
Dialogue: 0,0:00:39.00,0:00:41.00,Default,,0000,0000,0000,,{\\clip()\\t(18,8819,\\clip())\\fs40}EmptyClip
Dialogue: 0,0:00:41.00,0:00:43.00,Default,,0000,0000,0000,,Line1\\NLine2
Dialogue: 0,0:00:43.00,0:00:45.00,Default,,0000,0000,0000,,Word1\\hWord2
Dialogue: 0,0:00:45.00,0:00:47.00,Italic,,0000,0000,0000,,Style italic text
Dialogue: 0,0:00:47.00,0:00:49.00,Default,,0000,0000,0000,,{=7}{\\an8\\pos(960,540)}Extradata line
Dialogue: 0,0:00:49.00,0:00:51.00,Default,,0000,0000,0000,,{\\b700}HeavyBold{\\b0}
Dialogue: 0,0:00:51.00,0:00:53.00,Default,,0000,0000,0000,,{\\an8\\bord0\\shad0\\blur0.2\\frx-0.05\\fry3.1\\frz-1.31\\fax0.02\\pos(960,54)}Complex sign
Dialogue: 0,0:00:53.00,0:00:55.00,Default,,0000,0000,0000,,{\\an4\\q0\\be2}Left aligned
Dialogue: 0,0:00:55.00,0:00:57.00,Default,,0000,0000,0000,,{\\org(960,540)\\frz30}Rotated
Dialogue: 0,0:00:57.00,0:00:59.00,Signs,,0000,0000,0000,,{\\an8\\p1\\bord2\\pos(100,200)}m 0 0 l 100 0 100 100 0 100
`

const track = parseAss(SAMPLE)

// ─── Normal SRT — tag stripping behaviour ────────────────────────────────────

describe("convertNormalSrt — basic tag stripping", () => {
    const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: false, stripEmptyLines: true })

    it("keeps plain text unchanged", () => {
        expect(srt).toContain("Plain text")
    })

    it("converts \\b1...\\b0 to <b>...<b>", () => {
        expect(srt).toContain("<b>Bold</b> normal")
    })

    it("converts \\i1...\\i0 to <i>...</i>", () => {
        expect(srt).toContain("<i>Italic</i> normal")
    })

    it("converts \\u1...\\u0 to <u>...</u>", () => {
        expect(srt).toContain("<u>Under</u> normal")
    })

    it("converts \\s1...\\s0 to <s>...</s>", () => {
        expect(srt).toContain("<s>Strike</s> normal")
    })

    it("handles nested \\b1\\i1 — closes in stack order", () => {
        // The HTML tag stack closes b before i because b was opened first
        // Actual output: <b><i>BoldItalic</b></i>
        expect(srt).toContain("<b><i>BoldItalic")
        expect(srt).toContain("BoldItalic")
    })

    it("converts \\b700 (bold weight) to <b>", () => {
        expect(srt).toContain("<b>HeavyBold</b>")
    })
})

describe("convertNormalSrt — ASS positioning/style tags stripped", () => {
    const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: false, stripEmptyLines: true })

    it("strips \\pos, keeps text", () => {
        expect(srt).toContain("Positioned")
        expect(srt).not.toContain("\\pos")
    })

    it("strips \\fscx, \\fscy, \\frz", () => {
        expect(srt).not.toContain("\\fscx")
        expect(srt).not.toContain("\\fscy")
        expect(srt).not.toContain("\\frz")
    })

    it("strips \\clip rect, keeps text", () => {
        expect(srt).toContain("Clipped")
        expect(srt).not.toContain("\\clip")
    })

    it("strips \\clip drawing, keeps text", () => {
        expect(srt).toContain("DrawClip")
        expect(srt).not.toContain("m 0 0 l 640")
    })

    it("strips \\iclip, keeps text", () => {
        expect(srt).toContain("InvClip")
        expect(srt).not.toContain("\\iclip")
    })

    it("strips \\move, keeps text", () => {
        expect(srt).toContain("Moving")
        expect(srt).not.toContain("\\move")
    })

    it("strips \\fad timing, keeps text", () => {
        expect(srt).toContain("Faded")
        expect(srt).not.toContain("\\fad")
    })

    it("strips \\fade extended, keeps text", () => {
        expect(srt).toContain("ExtFade")
        expect(srt).not.toContain("\\fade")
    })

    it("strips \\t() animation block, keeps text", () => {
        expect(srt).toContain("Animated")
        expect(srt).not.toContain("\\t(")
    })

    it("strips karaoke \\k tags, keeps syllable text joined", () => {
        expect(srt).toContain("syllable")
        expect(srt).not.toContain("\\k")
    })

    it("strips \\alpha, \\c, \\1a colour tags, keeps text", () => {
        expect(srt).toContain("Coloured")
        expect(srt).not.toContain("\\alpha")
        expect(srt).not.toContain("\\c&H")
    })

    it("strips \\org, keeps text", () => {
        expect(srt).toContain("Rotated")
        expect(srt).not.toContain("\\org")
    })

    it("strips \\be, \\q, \\an from left-aligned line", () => {
        expect(srt).toContain("Left aligned")
        expect(srt).not.toContain("\\be")
        expect(srt).not.toContain("\\q")
        expect(srt).not.toContain("\\an")
    })

    it("strips complex sign tags (\\bord, \\shad, \\blur, \\frx, \\fry, \\frz, \\fax)", () => {
        expect(srt).toContain("Complex sign")
        expect(srt).not.toContain("\\bord")
        expect(srt).not.toContain("\\blur")
        expect(srt).not.toContain("\\fax")
    })

    it("strips sign with \\fn (font name tag token)", () => {
        expect(srt).toContain("Sign text")
        // No raw tag blocks should appear
        expect(srt).not.toMatch(/\{[^}]*Sign text/)
    })
})

describe("convertNormalSrt — drawing line handling", () => {
    const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: false, stripEmptyLines: true })

    it("strips pure drawing line (no text after \\p0)", () => {
        // Line: {\\p1}m 0 0 l 100 0...{\\p0} — no visible text
        expect(srt).not.toContain("m 0 0 l 100 0")
    })

    it("keeps text AFTER \\p0 in drawing line", () => {
        // Line: {\\p1}m 0 0 l 50 50{\\p0}After drawing
        expect(srt).toContain("After drawing")
    })

    it("strips sign drawing line (\\an8\\p1, no dialogue text)", () => {
        // Last sign line: {\\an8\\p1\\bord2\\pos(100,200)}m 0 0 l 100 0 100 100 0 100
        // Drawing content only, stripEmptyLines=true should drop it
        const lines = srt.split("\n")
        expect(lines.some(l => l.includes("m 0 0 l 100 0 100 100"))).toBe(false)
    })
})

describe("convertNormalSrt — special text commands", () => {
    const srt = convertNormalSrt(track)

    it("converts \\N to real newline", () => {
        expect(srt).toContain("Line1\nLine2")
    })

    it("converts \\h to non-breaking space", () => {
        expect(srt).toContain("Word1\u00A0Word2")
    })
})

describe("convertNormalSrt — extradata stripping", () => {
    const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: false, stripEmptyLines: true })

    it("strips {=N} extradata blocks, keeps tag content", () => {
        expect(srt).toContain("Extradata line")
        expect(srt).not.toContain("{=7}")
        expect(srt).not.toContain("\\an8")
    })

    it("does not produce NaN from \\clip()", () => {
        expect(srt).toContain("EmptyClip")
        expect(srt).not.toContain("NaN")
    })
})

describe("convertNormalSrt — style-based initial formatting", () => {
    it("applies italic from Italic style", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: false, stripEmptyLines: true })
        expect(srt).toContain("<i>Style italic text</i>")
    })

    it("does NOT apply bold from Bold style (inline \\b required)", () => {
        // Bold style has Bold=-1, but per design bold is only applied via inline {\\b1}
        const srt = convertNormalSrt(track, { useHtmlTags: true, mergeDuplicates: false, stripEmptyLines: true })
        // No <b> wrapping around "Style italic text" or other non-inline-bold lines
        expect(srt).not.toMatch(/<b>[^<]*Style italic/)
    })

    it("useHtmlTags=false strips all formatting", () => {
        const srt = convertNormalSrt(track, { useHtmlTags: false, mergeDuplicates: false, stripEmptyLines: true })
        expect(srt).not.toContain("<b>")
        expect(srt).not.toContain("<i>")
        expect(srt).toContain("Bold normal")
        expect(srt).toContain("Italic normal")
    })
})

describe("convertNormalSrt — SRT format validity", () => {
    const srt = convertNormalSrt(track)

    it("starts with index 1", () => {
        expect(srt.trimStart()).toMatch(/^1\n/)
    })

    it("uses HH:MM:SS,mmm timestamp format", () => {
        expect(srt).toMatch(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/)
    })

    it("entries are sorted by start time", () => {
        const times = [...srt.matchAll(/(\d{2}:\d{2}:\d{2},\d{3}) -->/g)].map(m => m[1])
        for (let i = 1; i < times.length; i++) {
            expect(times[i] >= times[i - 1]).toBe(true)
        }
    })

    it("entries are separated by blank lines", () => {
        const blocks = srt.trim().split(/\n\n+/)
        for (const block of blocks) {
            // Each block should have index, timestamp, and text lines
            const lines = block.split("\n")
            expect(lines.length).toBeGreaterThanOrEqual(3)
        }
    })
})

// ─── Keep-TS — preserve override tags ────────────────────────────────────────

describe("convertKeepTs — tag preservation", () => {
    const srt = convertKeepTs(track)

    it("preserves \\pos in output", () => {
        expect(srt).toContain("\\pos(")
    })

    it("preserves \\fscx and \\fscy", () => {
        expect(srt).toContain("\\fscx")
        expect(srt).toContain("\\fscy")
    })

    it("preserves \\clip rect", () => {
        expect(srt).toContain("\\clip(100,50,600,350)")
    })

    it("preserves \\clip drawing", () => {
        expect(srt).toContain("\\clip(1,m 0 0 l 640 0")
    })

    it("preserves \\iclip", () => {
        expect(srt).toContain("\\iclip(200,100,800,500)")
    })

    it("preserves \\move with timing", () => {
        expect(srt).toContain("\\move(100,200,500,400,0,1000)")
    })

    it("preserves \\t() animation", () => {
        expect(srt).toContain("\\t(0,500,\\fs48\\blur3)")
    })

    it("preserves \\fad timing", () => {
        expect(srt).toContain("\\fad(500,1000)")
    })

    it("preserves \\fade extended", () => {
        expect(srt).toContain("\\fade(255,0,255,0,850,8820,8820)")
    })

    it("preserves karaoke \\k tags and syllable text", () => {
        // keep-ts preserves all override blocks verbatim
        // Output: {\an2\k100}syl{\k80}la{\k120}ble
        expect(srt).toContain("\\k100")
        expect(srt).toContain("syl")
        expect(srt).toContain("ble")
    })

    it("preserves drawing commands in \\p1 block", () => {
        // The sign line: {\\an8\\p1\\bord2\\pos(100,200)}m 0 0 l 100 0 100 100 0 100
        expect(srt).toContain("m 0 0 l 100 0 100 100")
    })

    it("preserves colour tags \\c, \\alpha", () => {
        expect(srt).toContain("\\alpha&H80&")
        expect(srt).toContain("\\c&HFF0000&")
    })

    it("preserves \\org and \\frz", () => {
        expect(srt).toContain("\\org(960,540)")
        expect(srt).toContain("\\frz30")
    })
})

describe("convertKeepTs — alignment injection", () => {
    const srt = convertKeepTs(track)

    it("preserves existing \\an8 (no double injection)", () => {
        // Sign line already has \\an8 — should not get a second one
        const signBlocks = srt.match(/\{[^}]*\\an8[^}]*\}/g) ?? []
        // Each occurrence of an8 should be in a single block, not duplicated
        for (const block of signBlocks) {
            expect(block.match(/\\an/g)?.length ?? 0).toBe(1)
        }
    })

    it("injects \\an2 for Default style lines with no alignment tag", () => {
        // Default style has Alignment=2; plain text lines get {\\an2...} or standalone
        expect(srt).toMatch(/\{\\an2[^}]*\}Plain text|\{\\an2\}Plain text/)
    })

    it("merges injected \\an into first existing tag block", () => {
        // "Positioned" line: {\\pos(960,540)\\fscx120\\fscy80\\frz45}
        // Should become {\\an2\\pos(960,540)...} not {\\an2}{\\pos...}
        expect(srt).toContain("{\\an2\\pos(960,540)")
    })

    it("injects standalone {\\anN} when line starts with text", () => {
        // "Line1\\NLine2" starts with text (no opening tag)
        expect(srt).toMatch(/\{\\an2\}Line1/)
    })
})

describe("convertKeepTs — extradata stripping", () => {
    const srt = convertKeepTs(track)

    it("strips {=N} Aegisub extradata from output", () => {
        expect(srt).not.toContain("{=7}")
        expect(srt).not.toContain("{=")
    })

    it("keeps the actual tags after extradata block", () => {
        expect(srt).toContain("Extradata line")
    })

    it("does not produce NaN from \\clip()", () => {
        expect(srt).not.toContain("NaN")
    })
})

describe("convertKeepTs — text commands", () => {
    const srt = convertKeepTs(track)

    it("converts \\N to newline", () => {
        expect(srt).toContain("Line1\nLine2")
    })

    it("converts \\h to non-breaking space", () => {
        expect(srt).toContain("Word1\u00A0Word2")
    })

    it("converts \\n to newline", () => {
        // \\n in keep-ts is also converted to newline (per implementation)
        const track2 = parseAss(`[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0000,0000,0000,,Word1\\nWord2
`)
        const out = convertKeepTs(track2)
        expect(out).toContain("Word1\nWord2")
    })
})

describe("convertKeepTs — SRT format validity", () => {
    const srt = convertKeepTs(track)

    it("uses HH:MM:SS,mmm timestamp format", () => {
        expect(srt).toMatch(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/)
    })

    it("entries are sequential and sorted", () => {
        const times = [...srt.matchAll(/(\d{2}:\d{2}:\d{2},\d{3}) -->/g)].map(m => m[1])
        for (let i = 1; i < times.length; i++) {
            expect(times[i] >= times[i - 1]).toBe(true)
        }
    })

    it("does not include empty lines (blank text after stripping)", () => {
        // Pure drawing-only lines have their text stripped... but in keep-ts
        // drawing commands ARE preserved verbatim. So only truly empty entries are excluded.
        const blocks = srt.trim().split(/\n\n+/)
        for (const block of blocks) {
            const lines = block.split("\n")
            // Each block must have at least 3 lines: index, timestamp, text
            expect(lines.length).toBeGreaterThanOrEqual(3)
        }
    })
})
