import { describe, it, expect } from "vitest"
import { parseAss, parseTimestamp, formatAssTimestamp } from "./ass-parser"

// ─── Shared fixture ─────────────────────────────────────────────────────────

const SAMPLE_ASS = `\ufeff[Script Info]
Title: Test Script
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
LayoutResX: 1920
LayoutResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes
Timer: 100.0000
YCbCr Matrix: TV.709
Kerning: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: *Signs,Verdana,30,&H00FFFFFF,&H000000FF,&H003C3C3C,&H80000000,0,-1,0,0,100,100,2,0,1,3,2,8,20,20,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0000,0000,0000,,Hello World
Comment: 0,0:00:02.00,0:00:03.00,Default,,0000,0000,0000,,This is a comment
Dialogue: 1,0:01:30.50,0:01:35.25,Signs,Actor,0010,0020,0030,,{\\pos(640,360)}Sign text, with commas
`

// ─── Timestamp parsing ──────────────────────────────────────────────────────

describe("parseTimestamp", () => {
    it("parses standard H:MM:SS.CC", () => {
        expect(parseTimestamp("0:00:01.00")).toBe(1000)
        expect(parseTimestamp("0:01:30.50")).toBe(90500)
        expect(parseTimestamp("1:23:45.67")).toBe(5025670)
    })

    it("parses zero timestamp", () => {
        expect(parseTimestamp("0:00:00.00")).toBe(0)
    })

    it("handles centiseconds correctly (cs * 10)", () => {
        expect(parseTimestamp("0:00:00.01")).toBe(10)
        expect(parseTimestamp("0:00:00.99")).toBe(990)
        expect(parseTimestamp("0:00:01.50")).toBe(1500)
    })

    it("handles negative timestamps", () => {
        expect(parseTimestamp("-0:00:01.00")).toBe(-1000)
    })

    it("returns 0 for invalid format", () => {
        expect(parseTimestamp("invalid")).toBe(0)
        expect(parseTimestamp("")).toBe(0)
    })
})

// ─── Timestamp formatting ───────────────────────────────────────────────────

describe("formatAssTimestamp", () => {
    it("formats milliseconds to H:MM:SS.CC", () => {
        expect(formatAssTimestamp(0)).toBe("0:00:00.00")
        expect(formatAssTimestamp(1000)).toBe("0:00:01.00")
        expect(formatAssTimestamp(90500)).toBe("0:01:30.50")
        expect(formatAssTimestamp(5025670)).toBe("1:23:45.67")
    })

    it("handles negative timestamps", () => {
        expect(formatAssTimestamp(-1000)).toBe("-0:00:01.00")
    })

    it("roundtrips with parseTimestamp", () => {
        const ms = 5025670
        expect(parseTimestamp(formatAssTimestamp(ms))).toBe(ms)
    })
})

// ─── Script Info parsing ────────────────────────────────────────────────────

describe("parseAss — Script Info", () => {
    const track = parseAss(SAMPLE_ASS)

    it("parses Title", () => {
        expect(track.scriptInfo.Title).toBe("Test Script")
    })

    it("parses ScriptType and detects ASS track type", () => {
        expect(track.scriptInfo.ScriptType).toBe("v4.00+")
        expect(track.trackType).toBe("ASS")
    })

    it("parses PlayRes", () => {
        expect(track.scriptInfo.PlayResX).toBe(1280)
        expect(track.scriptInfo.PlayResY).toBe(720)
    })

    it("parses LayoutRes", () => {
        expect(track.scriptInfo.LayoutResX).toBe(1920)
        expect(track.scriptInfo.LayoutResY).toBe(1080)
    })

    it("parses WrapStyle", () => {
        expect(track.scriptInfo.WrapStyle).toBe(0)
    })

    it("parses ScaledBorderAndShadow", () => {
        expect(track.scriptInfo.ScaledBorderAndShadow).toBe(true)
    })

    it("parses Timer", () => {
        expect(track.scriptInfo.Timer).toBe(100.0)
    })

    it("parses YCbCr Matrix", () => {
        expect(track.scriptInfo.YCbCrMatrix).toBe("TV.709")
    })

    it("parses Kerning", () => {
        expect(track.scriptInfo.Kerning).toBe(true)
    })
})

// ─── Style parsing ──────────────────────────────────────────────────────────

describe("parseAss — Styles", () => {
    const track = parseAss(SAMPLE_ASS)

    it("parses correct number of styles", () => {
        expect(track.styles).toHaveLength(2)
    })

    it("strips leading * from style name (STARREDSTRVAL)", () => {
        expect(track.styles[1].Name).toBe("Signs")
    })

    it("parses Default style fields", () => {
        const s = track.styles[0]
        expect(s.Name).toBe("Default")
        expect(s.FontName).toBe("Arial")
        expect(s.FontSize).toBe(48)
        expect(s.Bold).toBe(true)
        expect(s.Italic).toBe(false)
        expect(s.Outline).toBe(2)
        expect(s.Shadow).toBe(1)
        expect(s.Alignment).toBe(2)
        expect(s.MarginL).toBe(10)
        expect(s.MarginR).toBe(10)
        expect(s.MarginV).toBe(10)
    })

    it("parses Signs style fields", () => {
        const s = track.styles[1]
        expect(s.FontName).toBe("Verdana")
        expect(s.FontSize).toBe(30)
        expect(s.Bold).toBe(false)
        expect(s.Italic).toBe(true)
        expect(s.Spacing).toBe(2)
        expect(s.Alignment).toBe(8)
        expect(s.MarginL).toBe(20)
        expect(s.MarginV).toBe(15)
    })

    it("parses colours", () => {
        const s = track.styles[0]
        expect(s.PrimaryColour).toBe("&H00FFFFFF")
        expect(s.OutlineColour).toBe("&H00000000")
    })

    it("stores raw values for roundtrip", () => {
        const s = track.styles[0]
        expect(s._raw["Name"]).toBe("Default")
        expect(s._raw["Fontname"]).toBe("Arial")
    })

    it("parses style format line", () => {
        expect(track.styleFormat).toContain("Name")
        expect(track.styleFormat).toContain("Fontname")
        expect(track.styleFormat).toContain("Encoding")
    })
})

// ─── Event parsing ──────────────────────────────────────────────────────────

describe("parseAss — Events", () => {
    const track = parseAss(SAMPLE_ASS)

    it("parses correct number of events", () => {
        expect(track.events).toHaveLength(3)
    })

    it("distinguishes Dialogue and Comment", () => {
        expect(track.events[0].type).toBe("Dialogue")
        expect(track.events[1].type).toBe("Comment")
        expect(track.events[2].type).toBe("Dialogue")
    })

    it("parses timestamps correctly", () => {
        expect(track.events[0].Start).toBe(1000)
        expect(track.events[0].End).toBe(5000)
        expect(track.events[2].Start).toBe(90500)
        expect(track.events[2].End).toBe(95250)
    })

    it("parses Layer", () => {
        expect(track.events[0].Layer).toBe(0)
        expect(track.events[2].Layer).toBe(1)
    })

    it("parses Style", () => {
        expect(track.events[0].Style).toBe("Default")
        expect(track.events[2].Style).toBe("Signs")
    })

    it("parses Name/Actor", () => {
        expect(track.events[0].Name).toBe("")
        expect(track.events[2].Name).toBe("Actor")
    })

    it("parses event margins", () => {
        expect(track.events[2].MarginL).toBe(10)
        expect(track.events[2].MarginR).toBe(20)
        expect(track.events[2].MarginV).toBe(30)
    })

    it("Text field consumes remaining commas", () => {
        expect(track.events[2].Text).toBe("{\\pos(640,360)}Sign text, with commas")
    })

    it("parses event format line", () => {
        expect(track.eventFormat).toContain("Layer")
        expect(track.eventFormat).toContain("Text")
    })
})

// ─── BOM handling ───────────────────────────────────────────────────────────

describe("parseAss — BOM handling", () => {
    it("strips BOM from input", () => {
        const withBom = "\ufeff[Script Info]\nTitle: BOM Test\nPlayResX: 640\n"
        const track = parseAss(withBom)
        expect(track.scriptInfo.Title).toBe("BOM Test")
    })

    it("works without BOM", () => {
        const noBom = "[Script Info]\nTitle: No BOM\n"
        const track = parseAss(noBom)
        expect(track.scriptInfo.Title).toBe("No BOM")
    })
})

// ─── SSA format ─────────────────────────────────────────────────────────────

describe("parseAss — SSA detection", () => {
    it("detects SSA from ScriptType", () => {
        const ssa = `[Script Info]\nScriptType: v4.00\n[V4 Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, AlphaLevel, Encoding\nStyle: Default,Arial,18,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000080,0,0,1,0,0,2,10,10,10,0,1\n`
        const track = parseAss(ssa)
        expect(track.trackType).toBe("SSA")
    })
})

// ─── Raw sections preservation ──────────────────────────────────────────────

describe("parseAss — Raw sections", () => {
    it("preserves unknown sections", () => {
        const ass = `[Script Info]\nTitle: Test\n\n[Aegisub Project Garbage]\nActive Line: 0\n\n[Fonts]\nfontdata: abc123\n`
        const track = parseAss(ass)
        expect(track.rawSections).toHaveLength(2)
        expect(track.rawSections[0].name).toBe("[Aegisub Project Garbage]")
        expect(track.rawSections[1].name).toBe("[Fonts]")
    })
})

// ─── Default fallbacks ─────────────────────────────────────────────────────

describe("parseAss — Defaults", () => {
    it("applies defaults when format line is missing", () => {
        const minimal = `[Script Info]\nTitle: Minimal\n\n[V4+ Styles]\nStyle: Default,Arial,18,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,10,10,10,1\n\n[Events]\nDialogue: 0,0:00:00.00,0:00:01.00,Default,,0000,0000,0000,,Test\n`
        const track = parseAss(minimal)
        expect(track.styles).toHaveLength(1)
        expect(track.events).toHaveLength(1)
    })
})
