import { describe, it, expect } from "vitest"
import { parseSrt, parseSrtCues, parseSrtTimestamp, htmlToAssTags } from "./srt-parser"

// ─── parseSrtTimestamp ───────────────────────────────────────────────────────

describe("parseSrtTimestamp", () => {
    it("parses standard SRT timestamp with comma", () => {
        expect(parseSrtTimestamp("00:00:00,000")).toBe(0)
        expect(parseSrtTimestamp("00:00:01,000")).toBe(1000)
        expect(parseSrtTimestamp("00:01:00,000")).toBe(60000)
        expect(parseSrtTimestamp("01:00:00,000")).toBe(3600000)
    })

    it("parses timestamp with dot separator", () => {
        expect(parseSrtTimestamp("00:00:01.500")).toBe(1500)
    })

    it("parses complex timestamp", () => {
        expect(parseSrtTimestamp("01:23:45,678")).toBe(5025678)
    })

    it("handles single-digit milliseconds by padding", () => {
        // "5" → "500" → 500ms
        expect(parseSrtTimestamp("00:00:01,5")).toBe(1500)
    })

    it("handles two-digit milliseconds by padding", () => {
        // "50" → "500" → 500ms
        expect(parseSrtTimestamp("00:00:01,50")).toBe(1500)
    })

    it("returns 0 for invalid timestamp", () => {
        expect(parseSrtTimestamp("invalid")).toBe(0)
        expect(parseSrtTimestamp("")).toBe(0)
    })

    it("handles negative timestamps", () => {
        expect(parseSrtTimestamp("-00:00:01,000")).toBe(-1000)
    })
})

// ─── htmlToAssTags ───────────────────────────────────────────────────────────

describe("htmlToAssTags", () => {
    it("converts <b> to ASS bold tags", () => {
        expect(htmlToAssTags("<b>bold</b>")).toBe("{\\b1}bold{\\b0}")
    })

    it("converts <i> to ASS italic tags", () => {
        expect(htmlToAssTags("<i>italic</i>")).toBe("{\\i1}italic{\\i0}")
    })

    it("converts <u> to ASS underline tags", () => {
        expect(htmlToAssTags("<u>underline</u>")).toBe("{\\u1}underline{\\u0}")
    })

    it("converts <s> to ASS strikeout tags", () => {
        expect(htmlToAssTags("<s>strike</s>")).toBe("{\\s1}strike{\\s0}")
    })

    it("handles case-insensitive tags", () => {
        expect(htmlToAssTags("<B>Bold</B>")).toBe("{\\b1}Bold{\\b0}")
        expect(htmlToAssTags("<I>Italic</I>")).toBe("{\\i1}Italic{\\i0}")
    })

    it("strips <font> tags", () => {
        expect(htmlToAssTags('<font color="#FF0000">red</font>')).toBe("red")
    })

    it("preserves existing ASS override tags", () => {
        expect(htmlToAssTags("{\\pos(320,50)}text")).toBe("{\\pos(320,50)}text")
    })

    it("handles mixed HTML and ASS tags", () => {
        expect(htmlToAssTags("{\\an8}<i>italic sign</i>")).toBe("{\\an8}{\\i1}italic sign{\\i0}")
    })

    it("returns plain text unchanged", () => {
        expect(htmlToAssTags("plain text")).toBe("plain text")
    })
})

// ─── parseSrtCues ────────────────────────────────────────────────────────────

describe("parseSrtCues", () => {
    it("parses a single cue", () => {
        const srt = `1
00:00:01,000 --> 00:00:03,000
Hello, world!
`
        const cues = parseSrtCues(srt)
        expect(cues).toHaveLength(1)
        expect(cues[0].index).toBe(1)
        expect(cues[0].startMs).toBe(1000)
        expect(cues[0].endMs).toBe(3000)
        expect(cues[0].text).toBe("Hello, world!")
    })

    it("parses multiple cues", () => {
        const srt = `1
00:00:01,000 --> 00:00:03,000
First line

2
00:00:04,000 --> 00:00:06,000
Second line
`
        const cues = parseSrtCues(srt)
        expect(cues).toHaveLength(2)
        expect(cues[0].text).toBe("First line")
        expect(cues[1].text).toBe("Second line")
    })

    it("handles multi-line cue text", () => {
        const srt = `1
00:00:01,000 --> 00:00:03,000
Line one
Line two
`
        const cues = parseSrtCues(srt)
        expect(cues).toHaveLength(1)
        expect(cues[0].text).toBe("Line one\nLine two")
    })

    it("handles BOM", () => {
        const srt = `\uFEFF1
00:00:01,000 --> 00:00:03,000
BOM text
`
        const cues = parseSrtCues(srt)
        expect(cues).toHaveLength(1)
        expect(cues[0].text).toBe("BOM text")
    })

    it("handles CRLF line endings", () => {
        const srt = "1\r\n00:00:01,000 --> 00:00:03,000\r\nCRLF text\r\n\r\n"
        const cues = parseSrtCues(srt)
        expect(cues).toHaveLength(1)
        expect(cues[0].text).toBe("CRLF text")
    })

    it("handles dot separator in timestamps", () => {
        const srt = `1
00:00:01.000 --> 00:00:03.500
Dot separator
`
        const cues = parseSrtCues(srt)
        expect(cues).toHaveLength(1)
        expect(cues[0].startMs).toBe(1000)
        expect(cues[0].endMs).toBe(3500)
    })

    it("handles cues with HTML tags", () => {
        const srt = `1
00:00:01,000 --> 00:00:03,000
<i>italic text</i>
`
        const cues = parseSrtCues(srt)
        expect(cues).toHaveLength(1)
        expect(cues[0].text).toBe("<i>italic text</i>")
    })

    it("handles cues with ASS override tags (Keep TS roundtrip)", () => {
        const srt = `1
00:00:01,000 --> 00:00:03,000
{\\an8}{\\pos(320,50)}Sign text
`
        const cues = parseSrtCues(srt)
        expect(cues).toHaveLength(1)
        expect(cues[0].text).toBe("{\\an8}{\\pos(320,50)}Sign text")
    })

    it("skips empty cues", () => {
        const srt = `1
00:00:01,000 --> 00:00:03,000


2
00:00:04,000 --> 00:00:06,000
Valid cue
`
        const cues = parseSrtCues(srt)
        expect(cues).toHaveLength(1)
        expect(cues[0].text).toBe("Valid cue")
    })

    it("handles no trailing newline", () => {
        const srt = `1
00:00:01,000 --> 00:00:03,000
No trailing newline`
        const cues = parseSrtCues(srt)
        expect(cues).toHaveLength(1)
        expect(cues[0].text).toBe("No trailing newline")
    })
})

// ─── parseSrt (full integration) ─────────────────────────────────────────────

describe("parseSrt", () => {
    it("returns a valid AssTrack", () => {
        const srt = `1
00:00:01,000 --> 00:00:03,000
Hello!

2
00:00:04,000 --> 00:00:06,000
World!
`
        const track = parseSrt(srt)
        expect(track.trackType).toBe("ASS")
        expect(track.scriptInfo.Title).toBe("SRT Import")
        expect(track.scriptInfo.PlayResX).toBe(1920)
        expect(track.scriptInfo.PlayResY).toBe(1080)
        expect(track.styles).toHaveLength(1)
        expect(track.styles[0].Name).toBe("Default")
        expect(track.events).toHaveLength(2)
    })

    it("converts events with correct timestamps", () => {
        const srt = `1
01:23:45,678 --> 02:34:56,789
Test line
`
        const track = parseSrt(srt)
        expect(track.events[0].Start).toBe(5025678)
        expect(track.events[0].End).toBe(9296789)
    })

    it("converts multi-line cue text to ASS \\N", () => {
        const srt = `1
00:00:01,000 --> 00:00:03,000
Line one
Line two
`
        const track = parseSrt(srt)
        expect(track.events[0].Text).toBe("Line one\\NLine two")
    })

    it("converts HTML bold/italic to ASS tags", () => {
        const srt = `1
00:00:01,000 --> 00:00:03,000
<b>bold</b> and <i>italic</i>
`
        const track = parseSrt(srt)
        expect(track.events[0].Text).toBe("{\\b1}bold{\\b0} and {\\i1}italic{\\i0}")
    })

    it("preserves ASS override tags from Keep TS roundtrip", () => {
        const srt = `1
00:00:01,000 --> 00:00:03,000
{\\an8}{\\pos(320,50)}{\\fscx80\\fscy80}Sign text
`
        const track = parseSrt(srt)
        expect(track.events[0].Text).toBe("{\\an8}{\\pos(320,50)}{\\fscx80\\fscy80}Sign text")
    })

    it("sets all events to Dialogue type with Default style", () => {
        const srt = `1
00:00:01,000 --> 00:00:03,000
Test
`
        const track = parseSrt(srt)
        expect(track.events[0].type).toBe("Dialogue")
        expect(track.events[0].Style).toBe("Default")
        expect(track.events[0].Layer).toBe(0)
    })

    it("produces valid styleFormat and eventFormat arrays", () => {
        const track = parseSrt("1\n00:00:00,000 --> 00:00:01,000\nTest\n")
        expect(track.styleFormat).toContain("Name")
        expect(track.styleFormat).toContain("Fontname")
        expect(track.eventFormat).toContain("Layer")
        expect(track.eventFormat).toContain("Start")
        expect(track.eventFormat).toContain("Text")
    })

    it("handles empty input", () => {
        const track = parseSrt("")
        expect(track.events).toHaveLength(0)
        expect(track.styles).toHaveLength(1)
    })

    it("handles real-world SRT with mixed formatting", () => {
        const srt = `1
00:00:10,500 --> 00:00:13,000
<i>Previously on the show...</i>

2
00:00:15,000 --> 00:00:18,500
What happened?
I don't know.

3
00:00:20,000 --> 00:00:22,000
<b>THE END</b>
`
        const track = parseSrt(srt)
        expect(track.events).toHaveLength(3)
        expect(track.events[0].Text).toBe("{\\i1}Previously on the show...{\\i0}")
        expect(track.events[1].Text).toBe("What happened?\\NI don't know.")
        expect(track.events[2].Text).toBe("{\\b1}THE END{\\b0}")
        expect(track.events[0].Start).toBe(10500)
        expect(track.events[0].End).toBe(13000)
    })
})
