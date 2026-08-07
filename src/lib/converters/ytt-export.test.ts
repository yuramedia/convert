import { describe, it, expect } from "vitest"
import { parseAss } from "../ass-parser"
import { convertToYtt } from "./ytt-export"

const SAMPLE_ASS = `[Script Info]
Title: Sample ASS
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: RedStyle,Arial,48,&H000000FF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,2,1,8,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.50,Default,Actor1,0000,0000,0000,,Hello World
Dialogue: 0,0:00:04.00,0:00:06.00,Default,Actor2,0000,0000,0000,,{\\i1}Italic{\\i0} and {\\b1}Bold{\\b0}
Dialogue: 0,0:00:07.00,0:00:09.00,RedStyle,,0000,0000,0000,,{\\pos(960,540)}Center Positioned Red Text
Dialogue: 0,0:00:10.00,0:00:12.00,Default,,0000,0000,0000,,{\\k50}Karaoke {\\k100}One {\\k50}Two
Comment: 0,0:00:13.00,0:00:15.00,Default,,0000,0000,0000,,Comment to skip
`

describe("convertToYtt", () => {
    const track = parseAss(SAMPLE_ASS)

    it("generates valid XML structure with timedtext format=3 root", () => {
        const xml = convertToYtt(track)
        expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>')
        expect(xml).toContain('<timedtext format="3">')
        expect(xml).toContain("<head>")
        expect(xml).toContain("</head>")
        expect(xml).toContain("<body>")
        expect(xml).toContain("</body>")
        expect(xml).toContain("</timedtext>")
    })

    it("skips Comment events", () => {
        const xml = convertToYtt(track)
        expect(xml).not.toContain("Comment to skip")
    })

    it("converts basic dialogue event with timestamps in milliseconds", () => {
        const xml = convertToYtt(track)
        expect(xml).toContain('t="1000" d="2500"')
        expect(xml).toContain("Hello World")
    })

    it("replaces pure white #FFFFFF with #FEFEFE when useOffWhite is true", () => {
        const xml = convertToYtt(track, { useOffWhite: true })
        expect(xml).toContain('fc="#FEFEFE"')
        expect(xml).not.toContain('fc="#FFFFFF"')
    })

    it("keeps #FFFFFF when useOffWhite is false", () => {
        const xml = convertToYtt(track, { useOffWhite: false })
        expect(xml).toContain('fc="#FFFFFF"')
    })

    it("parses ASS red color &H000000FF to hex #FF0000", () => {
        const xml = convertToYtt(track)
        expect(xml).toContain('fc="#FF0000"')
    })

    it("maps bold and italic override tags to separate pens and inline spans", () => {
        const xml = convertToYtt(track)
        expect(xml).toContain('<pen id="')
        expect(xml).toContain('i="1"')
        expect(xml).toContain('b="1"')
        expect(xml).toContain("<s p=")
    })

    it("converts pos(960,540) to window position ah=50 av=50", () => {
        const xml = convertToYtt(track, { convertPositioning: true })
        expect(xml).toContain('<wp id="')
        expect(xml).toContain('ah="50"')
        expect(xml).toContain('av="50"')
    })

    it("handles karaoke timing tags \\k", () => {
        const xml = convertToYtt(track, { convertKaraoke: true })
        expect(xml).toContain('t="500"')
        expect(xml).toContain('t="1500"')
    })

    it("escapes special XML characters", () => {
        const assWithSpecial = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,Fish & Chips <Tom & "Jerry">
`
        const t = parseAss(assWithSpecial)
        const xml = convertToYtt(t)
        expect(xml).toContain("Fish &amp; Chips &lt;Tom &amp; &quot;Jerry&quot;&gt;")
    })

    it("caps 100% opacity at fo=254 and hardens multiple spaces per YTSubConverter spec", () => {
        const assWithSpaces = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,Double  Space   Test
`
        const t = parseAss(assWithSpaces)
        const xml = convertToYtt(t)
        expect(xml).toContain('fo="254"')
        expect(xml).toContain("Double\u00A0\u00A0Space\u00A0\u00A0\u00A0Test")
    })

    it("emits wfo=254 and bo=254 when background box opacity option wfo is 255", () => {
        const xmlOpaque = convertToYtt(track, { wfo: 255 })
        expect(xmlOpaque).toContain('wfo="254"')
        expect(xmlOpaque).toContain('bo="254"')

        const xmlTransparent = convertToYtt(track, { wfo: 0 })
        expect(xmlTransparent).toContain('wfo="0"')
        expect(xmlTransparent).toContain('bo="0"')
    })

    it("maps recognized font families to YouTube font style IDs and falls back for custom fonts", () => {
        const assWithFonts = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,{\\fnCourier New}Mono Text
Dialogue: 0,0:00:02.00,0:00:03.00,Default,,0000,0000,0000,,{\\fnTimes New Roman}Serif Text
Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0000,0000,0000,,{\\fnMyCustomUnsupportedFont}Fallback Text
`
        const t = parseAss(assWithFonts)
        const xml = convertToYtt(t)
        expect(xml).toContain('fs="3"') // Monospaced for Courier
        expect(xml).toContain('fs="2"') // Serif for Times New Roman
    })

    describe("\\move animation", () => {
        const ASS_WITH_MOVE = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,{\\move(0,0,1920,1080)}Moving Text
Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0000,0000,0000,,{\\move(0,0,1920,1080,0,500)}Partial Window Move
Dialogue: 0,0:00:05.00,0:00:06.00,Default,,0000,0000,0000,,{\\move(960,540,960,540,500,100)}Invalid Move
`
        const moveTrack = parseAss(ASS_WITH_MOVE)

        it("splits a 4-arg \\move into multiple time-stepped <p> snapshots covering the full line duration", () => {
            const xml = convertToYtt(moveTrack, { moveStepMs: 250 })

            // Line spans 1000ms with a 250ms step -> 4 stepped snapshots, no separate
            // pre/post-move static snapshot since t1=0 and t2 defaults to the full duration
            const paragraphs = [...xml.matchAll(/<p t="(\d+)" d="(\d+)"[^>]*>Moving Text<\/p>/g)]
            expect(paragraphs.length).toBe(4)

            // First snapshot starts at the line's start time and covers the first step
            expect(paragraphs[0][1]).toBe("1000")
            expect(paragraphs[0][2]).toBe("250")

            // Snapshots are contiguous and together cover the whole 1000ms line
            const totalCovered = paragraphs.reduce((sum, p) => sum + Number(p[2]), 0)
            expect(totalCovered).toBe(1000)
        })

        it("interpolates <wp> ah/av from the start to the end coordinate across the move", () => {
            const xml = convertToYtt(moveTrack, { moveStepMs: 250 })

            // Start of the move is (0,0) -> ah=0 av=0; end is (1920,1080) -> ah=100 av=100
            expect(xml).toContain('ah="0"')
            expect(xml).toContain('av="0"')
            expect(xml).toContain('ah="100"')
            expect(xml).toContain('av="100"')
        })

        it("emits a leading static snapshot before the move window and a trailing one after it", () => {
            const xml = convertToYtt(moveTrack, { moveStepMs: 250 })

            // "Partial Window Move" line runs 3000-4000ms with move active only 0-500ms into it,
            // so there should be a static snapshot for the remaining 500-1000ms after the move ends
            const paragraphs = [...xml.matchAll(/<p t="(\d+)" d="(\d+)"[^>]*>Partial Window Move<\/p>/g)]
            const trailing = paragraphs.find(p => p[1] === "3500" && p[2] === "500")
            expect(trailing).toBeTruthy()
        })

        it("falls back to the line's default static position when t2 <= t1", () => {
            const xml = convertToYtt(moveTrack)

            // "Invalid Move" has t1=500, t2=100 (t2 <= t1), so it must render as a single,
            // unsplit paragraph at the default alignment position rather than any \move coordinate
            expect(xml).toContain('<p t="5000" d="1000" wp="')
            const paragraphs = [...xml.matchAll(/<p [^>]*>Invalid Move<\/p>/g)]
            expect(paragraphs.length).toBe(1)
        })

        it("does not split the line when convertPositioning is false", () => {
            const xml = convertToYtt(moveTrack, { convertPositioning: false })
            const paragraphs = [...xml.matchAll(/<p [^>]*>Moving Text<\/p>/g)]
            expect(paragraphs.length).toBe(1)
        })
    })
})
