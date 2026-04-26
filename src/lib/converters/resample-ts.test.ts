import { describe, it, expect } from "vitest"
import { parseAss } from "../ass-parser"
import { convertResampleTs } from "./resample-ts"

const SAMPLE_ASS = `[Script Info]
Title: Resample Test
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
LayoutResX: 1920
LayoutResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Signs,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,3,2,8,20,20,15,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0000,0000,0000,,Hello World
Dialogue: 0,0:00:05.00,0:00:10.00,Signs,,0010,0010,0005,,{\\pos(640,360)\\fs24\\bord3\\shad1.5\\blur2}Sign
Dialogue: 0,0:00:10.00,0:00:15.00,Signs,,0000,0000,0000,,{\\move(100,200,500,400,0,1000)\\fsp2}Moving
Dialogue: 0,0:00:15.00,0:00:20.00,Default,,0000,0000,0000,,{\\clip(100,50,600,350)}Clipped
Dialogue: 0,0:00:20.00,0:00:25.00,Default,,0000,0000,0000,,{\\org(640,360)\\frz45}Rotated
Dialogue: 0,0:00:25.00,0:00:30.00,Default,,0000,0000,0000,,{\\xbord2\\ybord3\\xshad1\\yshad2}Dir
Dialogue: 0,0:00:30.00,0:00:35.00,Default,,0000,0000,0000,,{\\t(0,500,\\fs48\\bord5)}Anim
Dialogue: 0,0:00:35.00,0:00:40.00,Signs,,0000,0000,0000,,{\\iclip(200,100,800,500)}IClip
Dialogue: 0,0:00:40.00,0:00:45.00,Default,,0000,0000,0000,,{\\be4\\fsp3}Effects
Dialogue: 0,0:00:45.00,0:00:50.00,Default,,0020,0030,0040,,Margins
Dialogue: 0,0:00:50.00,0:00:55.00,Signs,,0000,0000,0000,,{\\clip(1,m 100 200 l 300 400 500 200)}DrawClip
Dialogue: 0,0:00:55.00,0:01:00.00,Default,,0000,0000,0000,,{\\t(0,1000,2,\\fs72\\blur5)}AccelAnim
Dialogue: 0,0:01:00.00,0:01:05.00,Default,,0000,0000,0000,,{\\fad(500,1000)}Fade
Dialogue: 0,0:01:05.00,0:01:10.00,Default,,0000,0000,0000,,{\\b1\\i1}BI{\\b0\\i0} N
`

const track = parseAss(SAMPLE_ASS)
const opts1080 = {
    sourceWidth: 1280,
    sourceHeight: 720,
    targetWidth: 1920,
    targetHeight: 1080,
    outputFormat: "ass" as const
}

// ─── Script Info ────────────────────────────────────────────────────────────

describe("resample — Script Info", () => {
    const result = parseAss(convertResampleTs(track, opts1080))

    it("updates PlayRes", () => {
        expect(result.scriptInfo.PlayResX).toBe(1920)
        expect(result.scriptInfo.PlayResY).toBe(1080)
    })

    it("scales LayoutRes proportionally", () => {
        expect(result.scriptInfo.LayoutResX).toBe(2880)
        expect(result.scriptInfo.LayoutResY).toBe(1620)
    })

    it("keeps LayoutRes=0 when not set", () => {
        const noLayout = SAMPLE_ASS.replace("LayoutResX: 1920\n", "").replace("LayoutResY: 1080\n", "")
        const r = parseAss(convertResampleTs(parseAss(noLayout), opts1080))
        expect(r.scriptInfo.LayoutResX).toBe(0)
        expect(r.scriptInfo.LayoutResY).toBe(0)
    })
})

// ─── Style scaling ──────────────────────────────────────────────────────────

describe("resample — Styles (1.5x)", () => {
    const result = parseAss(convertResampleTs(track, opts1080))
    const def = result.styles.find(s => s.Name === "Default")!
    const signs = result.styles.find(s => s.Name === "Signs")!

    it("scales FontSize by ry", () => {
        expect(def.FontSize).toBe(72) // 48*1.5
        expect(signs.FontSize).toBe(45) // 30*1.5
    })

    it("scales Spacing by rx", () => {
        expect(signs.Spacing).toBe(3) // 2*1.5
    })

    it("scales Outline by max(rx,ry)", () => {
        expect(def.Outline).toBe(3) // 2*1.5
    })

    it("scales Shadow by max(rx,ry)", () => {
        expect(def.Shadow).toBe(1.5) // 1*1.5
    })

    it("scales MarginL/R by rx", () => {
        expect(def.MarginL).toBe(15)
        expect(def.MarginR).toBe(15)
    })

    it("scales MarginV by ry", () => {
        expect(def.MarginV).toBe(15)
    })
})

// ─── Override tags ──────────────────────────────────────────────────────────

describe("resample — Override tags (1.5x)", () => {
    const result = parseAss(convertResampleTs(track, opts1080))

    it("scales \\pos(x,y)", () => {
        expect(result.events[1].Text).toContain("\\pos(960,540)")
    })

    it("scales \\fs", () => {
        expect(result.events[1].Text).toContain("\\fs36")
    })

    it("scales \\bord by max(rx,ry)", () => {
        expect(result.events[1].Text).toContain("\\bord4.5")
    })

    it("scales \\shad by max(rx,ry)", () => {
        expect(result.events[1].Text).toContain("\\shad2.25")
    })

    it("scales \\blur by max(rx,ry)", () => {
        expect(result.events[1].Text).toContain("\\blur3")
    })

    it("scales \\move preserving timing", () => {
        expect(result.events[2].Text).toContain("\\move(150,300,750,600,0,1000)")
    })

    it("scales \\fsp by rx", () => {
        expect(result.events[2].Text).toContain("\\fsp3")
    })

    it("scales \\clip rect", () => {
        expect(result.events[3].Text).toContain("\\clip(150,75,900,525)")
    })

    it("scales \\org", () => {
        expect(result.events[4].Text).toContain("\\org(960,540)")
    })

    it("scales \\xbord by rx, \\ybord by ry", () => {
        expect(result.events[5].Text).toContain("\\xbord3")
        expect(result.events[5].Text).toContain("\\ybord4.5")
    })

    it("scales \\xshad by rx, \\yshad by ry", () => {
        expect(result.events[5].Text).toContain("\\xshad1.5")
        expect(result.events[5].Text).toContain("\\yshad3")
    })

    it("scales \\iclip rect", () => {
        expect(result.events[7].Text).toContain("\\iclip(300,150,1200,750)")
    })

    it("scales \\be by max(rx,ry)", () => {
        expect(result.events[8].Text).toContain("\\be6")
    })

    it("does NOT scale \\fad timing", () => {
        expect(result.events[12].Text).toContain("\\fad(500,1000)")
    })

    it("passes through non-scalable tags", () => {
        expect(result.events[4].Text).toContain("\\frz45")
        expect(result.events[13].Text).toContain("\\b1")
        expect(result.events[13].Text).toContain("\\i1")
    })
})

// ─── \\t() animation ────────────────────────────────────────────────────────

describe("resample — \\t() animation", () => {
    const result = parseAss(convertResampleTs(track, opts1080))

    it("preserves timing, scales inner tags", () => {
        expect(result.events[6].Text).toContain("\\t(0,500,\\fs72\\bord7.5)")
    })

    it("handles accel parameter", () => {
        expect(result.events[11].Text).toContain("\\t(0,1000,2,\\fs108\\blur7.5)")
    })
})

// ─── Drawing clips ──────────────────────────────────────────────────────────

describe("resample — Drawing clips", () => {
    const result = parseAss(convertResampleTs(track, opts1080))

    it("scales drawing coordinates in clip", () => {
        expect(result.events[10].Text).toContain("150 300")
        expect(result.events[10].Text).toContain("450 600")
    })
})

// ─── Event margins ──────────────────────────────────────────────────────────

describe("resample — Event margins", () => {
    const result = parseAss(convertResampleTs(track, opts1080))

    it("scales event MarginL/R by rx", () => {
        expect(result.events[9].MarginL).toBe(30) // 20*1.5
        expect(result.events[9].MarginR).toBe(45) // 30*1.5
    })

    it("scales event MarginV by ry", () => {
        expect(result.events[9].MarginV).toBe(60) // 40*1.5
    })
})

// ─── Anamorphic ─────────────────────────────────────────────────────────────

describe("resample — Anamorphic (rx≠ry)", () => {
    const anaOpts = {
        sourceWidth: 1280,
        sourceHeight: 720,
        targetWidth: 1920,
        targetHeight: 720,
        outputFormat: "ass" as const
    }
    const result = parseAss(convertResampleTs(track, anaOpts))

    it("FontSize scales by ry only (unchanged)", () => {
        expect(result.styles.find(s => s.Name === "Default")!.FontSize).toBe(48)
    })

    it("MarginL scales by rx=1.5", () => {
        expect(result.styles.find(s => s.Name === "Default")!.MarginL).toBe(15)
    })

    it("MarginV scales by ry=1.0 (unchanged)", () => {
        expect(result.styles.find(s => s.Name === "Default")!.MarginV).toBe(10)
    })

    it("\\pos x scales by rx, y by ry", () => {
        expect(result.events[1].Text).toContain("\\pos(960,360)")
    })
})

// ─── SRT output ─────────────────────────────────────────────────────────────

describe("resample — SRT output", () => {
    const srt = convertResampleTs(track, { ...opts1080, outputFormat: "srt" })

    it("outputs valid SRT format", () => {
        expect(srt).toContain("1\n")
        expect(srt).toContain("-->")
    })

    it("contains resampled tags", () => {
        expect(srt).toContain("\\pos(960,540)")
    })
})

// ─── Does not mutate original ───────────────────────────────────────────────

describe("resample — Immutability", () => {
    it("does not mutate original track", () => {
        const original = parseAss(SAMPLE_ASS)
        const origPlayResX = original.scriptInfo.PlayResX
        const origFontSize = original.styles[0].FontSize

        convertResampleTs(original, opts1080)

        expect(original.scriptInfo.PlayResX).toBe(origPlayResX)
        expect(original.styles[0].FontSize).toBe(origFontSize)
    })
})
