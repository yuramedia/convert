import { describe, it, expect } from "vitest"
import { parseAss } from "../ass-parser"
import { convertToYtt } from "./ytt-export"

const SAMPLE_ASS = `[Script Info]
Title: Sample ASS
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: RedStyle,Arial,48,&H000000FF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,2,1,8,10,10,10,1
Style: BoxStyle,Arial,48,&H00FFFFFF,&H000000FF,&H00000080,&H00000000,0,0,0,0,100,100,0,0,3,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.50,Default,Actor1,0000,0000,0000,,Hello World
Dialogue: 0,0:00:04.00,0:00:06.00,Default,Actor2,0000,0000,0000,,{\\i1}Italic{\\i0} and {\\b1}Bold{\\b0}
Dialogue: 0,0:00:07.00,0:00:09.00,RedStyle,,0000,0000,0000,,{\\pos(640,360)}Center Positioned Red Text
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

    it("converts pos(640,360) in 1280×720 space using anti-adjustment formula", () => {
        const xml = convertToYtt(track, { convertPositioning: true })
        expect(xml).toContain('<wp id="')
        // pos(640,360) → pixel 640/1280=50%, 360/720=50%
        // Anti-adjustment: (50 - 2) / 0.96 = 50
        expect(xml).toContain('ah="50"')
        expect(xml).toContain('av="50"')
    })

    it("handles karaoke timing tags \\k", () => {
        const xml = convertToYtt(track, { convertKaraoke: true })
        expect(xml).toContain('t="500"')
        expect(xml).toContain('t="1500"')
    })

    it("writes pd and sd attributes on window styles", () => {
        const xml = convertToYtt(track)
        expect(xml).toContain('pd="0"')
        expect(xml).toContain('sd="0"')
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

    it("maps recognized font families to YouTube font style IDs with exact matching", () => {
        const assWithFonts = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,{\\fnCourier New}Mono Serif Text
Dialogue: 0,0:00:02.00,0:00:03.00,Default,,0000,0000,0000,,{\\fnTimes New Roman}Serif Text
Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0000,0000,0000,,{\\fnLucida Console}Mono Sans Text
Dialogue: 0,0:00:04.00,0:00:05.00,Default,,0000,0000,0000,,{\\fnComic Sans MS}Casual Text
Dialogue: 0,0:00:05.00,0:00:06.00,Default,,0000,0000,0000,,{\\fnMonotype Corsiva}Cursive Text
Dialogue: 0,0:00:06.00,0:00:07.00,Default,,0000,0000,0000,,{\\fnCarrois Gothic SC}SmallCaps Text
Dialogue: 0,0:00:07.00,0:00:08.00,Default,,0000,0000,0000,,{\\fnMyCustomFont}Fallback Text
`
        const t = parseAss(assWithFonts)
        const xml = convertToYtt(t)
        expect(xml).toContain('fs="1"') // Courier New → mono serif
        expect(xml).toContain('fs="2"') // Times New Roman → proportional serif
        expect(xml).toContain('fs="3"') // Lucida Console → mono sans
        expect(xml).toContain('fs="5"') // Comic Sans MS → casual
        expect(xml).toContain('fs="6"') // Monotype Corsiva → cursive
        expect(xml).toContain('fs="7"') // Carrois Gothic SC → small caps
    })

    it("maps Microsoft Windows typefaces to YouTube font style IDs", () => {
        const assWithWinFonts = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,{\\fnFixedsys}Fixedsys Text
Dialogue: 0,0:00:02.00,0:00:03.00,Default,,0000,0000,0000,,{\\fnPalatino Linotype}Palatino Text
Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0000,0000,0000,,{\\fnConsolas}Consolas Text
Dialogue: 0,0:00:04.00,0:00:05.00,Default,,0000,0000,0000,,{\\fnInk Free}Ink Free Text
Dialogue: 0,0:00:05.00,0:00:06.00,Default,,0000,0000,0000,,{\\fnSegoe Print}Segoe Print Text
Dialogue: 0,0:00:06.00,0:00:07.00,Default,,0000,0000,0000,,{\\fnCopperplate Gothic Bold}Copperplate Text
`
        const t = parseAss(assWithWinFonts)
        const xml = convertToYtt(t)
        expect(xml).toContain('fs="1"') // Fixedsys -> Monospaced Serif
        expect(xml).toContain('fs="2"') // Palatino Linotype -> Proportional Serif
        expect(xml).toContain('fs="3"') // Consolas -> Monospaced Sans-Serif
        expect(xml).toContain('fs="5"') // Ink Free -> Casual
        expect(xml).toContain('fs="6"') // Segoe Print -> Cursive / Script
        expect(xml).toContain('fs="7"') // Copperplate Gothic Bold -> Small Caps
    })

    it("uses et=3 (glow) for outline when BorderStyle != 3", () => {
        const assOutline = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H000000FF,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,Outlined Text
`
        const t = parseAss(assOutline)
        const xml = convertToYtt(t)
        expect(xml).toContain('et="3"') // Glow edge type for non-box outline
    })

    it("uses bc/bo for outline when BorderStyle == 3 (box mode)", () => {
        const assBox = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000080,&H00000000,0,0,0,0,100,100,0,0,3,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,Box Background Text
`
        const t = parseAss(assBox)
        const xml = convertToYtt(t)
        // Box mode: outline color becomes background
        expect(xml).toContain('bc="')
        expect(xml).toMatch(/bo="\d+"/)
        // Should NOT have glow edge type since it's box mode
        expect(xml).not.toContain('et="3"')
    })

    it("uses anti-adjustment for positions with non-1280x720 PlayRes", () => {
        const ass1920 = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,{\\pos(960,540)}Center Text
`
        const t = parseAss(ass1920)
        const xml = convertToYtt(t, { convertPositioning: true })
        // pos(960,540) in 1920×1080 space → scale to 1280×720:
        // refX = (960/1920)*1280 = 640, refY = (540/1080)*720 = 360
        // YouTube anti-adjust: (50-2)/0.96 = 50
        expect(xml).toContain('ah="50"')
        expect(xml).toContain('av="50"')
    })

    it("handles \\1a alpha override tag", () => {
        const assAlpha = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,{\\1a&H80&}Semi-Transparent
`
        const t = parseAss(assAlpha)
        const xml = convertToYtt(t)
        // &H80 = 128 alpha → opacity = 255 - 128 = 127
        expect(xml).toContain('fo="127"')
    })

    it("applies zero-width space workaround in multi-section output", () => {
        const xml = convertToYtt(track)
        // The italic+bold line has multiple sections → should have zero-width space
        expect(xml).toContain("\u200B")
    })

    it("computes default alignment positions using anti-adjustment formula", () => {
        // Test that default bottom-center (alignment 2) position uses the anti-adjustment
        // Default pixel pos for BottomCenter: (640, 705.6)
        // YouTube coord: ah = (50 - 2) / 0.96 = 50, av = (98 - 2) / 0.96 = 100
        const xml = convertToYtt(track)
        expect(xml).toContain('ah="50"')
        expect(xml).toContain('av="100"')
    })

    it("forces background box opacity when wfo option > 0", () => {
        const xmlOpaque = convertToYtt(track, { wfo: 255 })
        expect(xmlOpaque).toContain('bo="254"')

        const xmlTransparent = convertToYtt(track, { wfo: 0 })
        expect(xmlTransparent).toContain('bo="0"')
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

        it("splits a 4-arg \\move into frame-stepped <p> snapshots that are contiguous end-to-end", () => {
            const xml = convertToYtt(moveTrack)

            const paragraphs = [...xml.matchAll(/<p t="(\d+)" d="(\d+)"[^>]*>Moving Text<\/p>/g)].map(p => ({
                t: Number(p[1]),
                d: Number(p[2])
            }))

            // A 1000ms move at ~29.97fps, stepped 2 frames (~66.7ms) at a time, produces
            // more than a couple of snapshots
            expect(paragraphs.length).toBeGreaterThan(5)

            // Contiguous: each snapshot picks up exactly where the previous one left off
            for (let i = 1; i < paragraphs.length; i++) {
                expect(paragraphs[i].t).toBe(paragraphs[i - 1].t + paragraphs[i - 1].d)
            }

            // The line's start gets snapped to the nearest video frame boundary (matching
            // YTSubConverter's RoundTimeToFrameCenter), so it can land a few ms to either
            // side of the literal ASS start time (1000ms) rather than exactly on it
            expect(Math.abs(paragraphs[0].t - 1000)).toBeLessThan(34)

            // ...and the very last snapshot always ends exactly on the line's original end
            const last = paragraphs[paragraphs.length - 1]
            expect(last.t + last.d).toBe(2000)
        })

        it("interpolates <wp> ah/av from the start to the end coordinate across the move", () => {
            const xml = convertToYtt(moveTrack)

            const paragraphs = [...xml.matchAll(/<p t="\d+" d="\d+"[^>]*wp="(\d+)"[^>]*>Moving Text<\/p>/g)]
            expect(paragraphs.length).toBeGreaterThan(0)

            // Move goes from (0,0) to (1920,1080) on a 1920x1080 canvas -> ah/av from ~0 to 100.
            // The very last snapshot lands exactly at the end coordinate.
            expect(xml).toContain('ah="100"')
            expect(xml).toContain('av="100"')
        })

        it("emits a leading static snapshot before the move window and a trailing one after it", () => {
            const xml = convertToYtt(moveTrack)

            // "Partial Window Move" line runs 3000-4000ms with the move active only in the
            // first ~500ms of it, so the tail end (from wherever the move's cluster ends
            // through to the line's original end at 4000ms) must be a single static snapshot
            // pinned at the end coordinate (1920,1080 -> ah=100 av=100).
            const paragraphs = [...xml.matchAll(/<p t="(\d+)" d="(\d+)"[^>]*>Partial Window Move<\/p>/g)]
            expect(paragraphs.length).toBeGreaterThan(1)

            const last = paragraphs[paragraphs.length - 1]
            expect(Number(last[1]) + Number(last[2])).toBe(4000)
        })

        it("falls back to the line's default static position when t2 <= t1", () => {
            const xml = convertToYtt(moveTrack)

            // "Invalid Move" has t1=500, t2=100 (t2 <= t1), so it must render as a single,
            // unsplit paragraph at the default alignment position rather than any \move coordinate
            expect(xml).toContain('<p t="5000" d="1000" p="1" wp="')
            const paragraphs = [...xml.matchAll(/<p [^>]*>Invalid Move<\/p>/g)]
            expect(paragraphs.length).toBe(1)
        })

        it("does not split the line when convertPositioning is false", () => {
            const xml = convertToYtt(moveTrack, { convertPositioning: false })
            const paragraphs = [...xml.matchAll(/<p [^>]*>Moving Text<\/p>/g)]
            expect(paragraphs.length).toBe(1)
        })
    })

    describe("YTSubConverter Enhancement Workarounds", () => {
        it("maps \\fs font size tags to YouTube sz attribute", () => {
            const assFs = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,{\\fs96}Double Size Text
`
            const t = parseAss(assFs)
            const xml = convertToYtt(t)
            // realScale = 96/48 = 2.0 -> yttScale = 1 + (2.0 - 1) * 4 = 5.0 -> sz="500"
            expect(xml).toContain('sz="500"')
        })

        it("maps \\sub and \\super tags to of attribute", () => {
            const assSub = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,H{\\sub}2{\\ytsur}O and X{\\super}2
`
            const t = parseAss(assSub)
            const xml = convertToYtt(t)
            expect(xml).toContain('of="0"') // Subscript
            expect(xml).toContain('of="2"') // Superscript
        })

        it("applies Android dark text hack for dark foreground colors", () => {
            const assDark = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: DarkStyle,Arial,48,&H00101010,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,DarkStyle,,0000,0000,0000,,Dark Text
`
            const t = parseAss(assDark)
            const xml = convertToYtt(t)
            // Should emit 2 <p> tags for the same line: one dark, one brightened invisible overlay
            const paragraphs = [...xml.matchAll(/<p [^>]*>Dark Text<\/p>/g)]
            expect(paragraphs.length).toBe(2)
        })

        it("inserts italic prefetch dummy line when italic text is present", () => {
            const xml = convertToYtt(track)
            expect(xml).toContain('t="5000" d="100"')
            expect(xml).toContain('i="1"')
        })

        it("converts ASS \\h hard space escape sequence to non-breaking space \\u00A0", () => {
            const assH = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0000,0000,0000,,Word1\\hWord2
`
            const t = parseAss(assH)
            const xml = convertToYtt(t)
            expect(xml).not.toContain("\\h")
            expect(xml).toContain("Word1\u00A0Word2")
        })
    })
})
