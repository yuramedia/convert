import { describe, it, expect } from "vitest"
import {
    tokenizeText,
    parseTagBlock,
    parseCoords,
    parseClip,
    formatCoords,
    hasDrawingCommand,
    stripTags,
    convertTagsToHtml
} from "./ass-tags"

// ─── tokenizeText ───────────────────────────────────────────────────────────

describe("tokenizeText", () => {
    it("splits plain text", () => {
        const segs = tokenizeText("Hello World")
        expect(segs).toHaveLength(1)
        expect(segs[0]).toEqual({ type: "text", content: "Hello World" })
    })

    it("splits tags and text", () => {
        const segs = tokenizeText("{\\b1}Bold{\\b0} Normal")
        expect(segs).toHaveLength(4)
        expect(segs[0].type).toBe("tags")
        expect(segs[0].content).toBe("{\\b1}")
        expect(segs[1]).toEqual({ type: "text", content: "Bold" })
        expect(segs[2].type).toBe("tags")
        expect(segs[3]).toEqual({ type: "text", content: " Normal" })
    })

    it("handles multiple tag blocks", () => {
        const segs = tokenizeText("{\\pos(100,200)}{\\fs24}Text")
        expect(segs).toHaveLength(3)
        expect(segs[0].type).toBe("tags")
        expect(segs[1].type).toBe("tags")
        expect(segs[2].type).toBe("text")
    })

    it("handles empty input", () => {
        expect(tokenizeText("")).toHaveLength(0)
    })

    it("handles tag-only input", () => {
        const segs = tokenizeText("{\\an8}")
        expect(segs).toHaveLength(1)
        expect(segs[0].type).toBe("tags")
    })

    it("handles nested parens in \\t()", () => {
        const segs = tokenizeText("{\\t(0,500,\\fs48)}")
        expect(segs).toHaveLength(1)
        expect(segs[0].content).toBe("{\\t(0,500,\\fs48)}")
    })
})

// ─── parseTagBlock ──────────────────────────────────────────────────────────

describe("parseTagBlock", () => {
    it("parses simple tags", () => {
        const tags = parseTagBlock("\\b1\\i1")
        expect(tags).toHaveLength(2)
        expect(tags[0].name).toBe("b")
        expect(tags[0].value).toBe("1")
        expect(tags[1].name).toBe("i")
        expect(tags[1].value).toBe("1")
    })

    it("parses parenthesized tags", () => {
        const tags = parseTagBlock("\\pos(640,360)")
        expect(tags).toHaveLength(1)
        expect(tags[0].name).toBe("pos")
        expect(tags[0].value).toBe("(640,360)")
    })

    it("parses \\t() with inner tags", () => {
        const tags = parseTagBlock("\\t(0,500,\\fs48)")
        expect(tags).toHaveLength(1)
        expect(tags[0].name).toBe("t")
        expect(tags[0].value).toBe("(0,500,\\fs48)")
    })

    it("parses colour tags (\\1c, \\2c, etc.)", () => {
        const tags = parseTagBlock("\\1c&HFFFFFF&\\3c&H000000&")
        expect(tags).toHaveLength(2)
        expect(tags[0].name).toBe("1c")
        expect(tags[0].value).toBe("&HFFFFFF&")
    })

    it("parses text commands \\N, \\n, \\h", () => {
        const tags = parseTagBlock("\\N\\n\\h")
        expect(tags).toHaveLength(3)
        expect(tags[0].name).toBe("N")
        expect(tags[1].name).toBe("n")
        expect(tags[2].name).toBe("h")
    })

    it("parses \\clip with rect coords", () => {
        const tags = parseTagBlock("\\clip(100,50,600,350)")
        expect(tags[0].name).toBe("clip")
        expect(tags[0].value).toBe("(100,50,600,350)")
    })

    it("parses \\move with optional timing", () => {
        const tags = parseTagBlock("\\move(100,200,500,400,0,1000)")
        expect(tags[0].name).toBe("move")
        expect(tags[0].value).toContain("100,200,500,400,0,1000")
    })

    it("ignores non-tag text inside block (comments)", () => {
        const tags = parseTagBlock("comment text\\b1")
        expect(tags).toHaveLength(1)
        expect(tags[0].name).toBe("b")
    })
})

// ─── parseCoords ────────────────────────────────────────────────────────────

describe("parseCoords", () => {
    it("parses (x,y)", () => {
        expect(parseCoords("(640,360)")).toEqual([640, 360])
    })

    it("parses (x1,y1,x2,y2)", () => {
        expect(parseCoords("(100,200,500,400)")).toEqual([100, 200, 500, 400])
    })

    it("handles decimal values", () => {
        expect(parseCoords("(10.5,20.3)")).toEqual([10.5, 20.3])
    })
})

// ─── parseClip ──────────────────────────────────────────────────────────────

describe("parseClip", () => {
    it("parses rect clip", () => {
        const clip = parseClip("(100,50,600,350)")
        expect(clip.type).toBe("rect")
        if (clip.type === "rect") {
            expect(clip.coords).toEqual([100, 50, 600, 350])
        }
    })

    it("parses drawing clip", () => {
        const clip = parseClip("(1,m 100 200 l 300 400)")
        expect(clip.type).toBe("drawing")
        if (clip.type === "drawing") {
            expect(clip.scale).toBe(1)
            expect(clip.commands).toBe("m 100 200 l 300 400")
        }
    })
})

// ─── formatCoords ───────────────────────────────────────────────────────────

describe("formatCoords", () => {
    it("formats integer coords", () => {
        expect(formatCoords([100, 200])).toBe("(100,200)")
    })

    it("rounds to 2 decimal places", () => {
        expect(formatCoords([10.567, 20.123])).toBe("(10.57,20.12)")
    })
})

// ─── hasDrawingCommand ──────────────────────────────────────────────────────

describe("hasDrawingCommand", () => {
    it("detects \\p1", () => {
        const tags = parseTagBlock("\\p1")
        expect(hasDrawingCommand(tags)).toBe(true)
    })

    it("returns false for \\p0", () => {
        const tags = parseTagBlock("\\p0")
        expect(hasDrawingCommand(tags)).toBe(false)
    })

    it("returns false for no \\p tag", () => {
        const tags = parseTagBlock("\\b1")
        expect(hasDrawingCommand(tags)).toBe(false)
    })
})

// ─── stripTags ──────────────────────────────────────────────────────────────

describe("stripTags", () => {
    it("strips all override tags", () => {
        expect(stripTags("{\\b1\\fs24}Hello{\\b0} World")).toBe("Hello World")
    })

    it("converts \\N to newline", () => {
        expect(stripTags("Line1\\NLine2")).toBe("Line1\nLine2")
    })

    it("converts \\n to space", () => {
        expect(stripTags("Line1\\nLine2")).toBe("Line1 Line2")
    })

    it("converts \\h to non-breaking space", () => {
        expect(stripTags("Word1\\hWord2")).toBe("Word1\u00A0Word2")
    })

    it("strips drawing text (\\p1...\\p0)", () => {
        expect(stripTags("{\\p1}m 0 0 l 100 100{\\p0}Visible")).toBe("Visible")
    })

    it("handles complex tag blocks", () => {
        expect(stripTags("{\\pos(100,200)\\fscx120\\c&HFFFFFF&}Hello")).toBe("Hello")
    })
})

// ─── convertTagsToHtml ──────────────────────────────────────────────────────

describe("convertTagsToHtml", () => {
    it("converts \\b1 to <b>", () => {
        expect(convertTagsToHtml("{\\b1}Bold{\\b0}")).toBe("<b>Bold</b>")
    })

    it("converts \\i1 to <i>", () => {
        expect(convertTagsToHtml("{\\i1}Italic{\\i0}")).toBe("<i>Italic</i>")
    })

    it("converts \\u1 to <u>", () => {
        expect(convertTagsToHtml("{\\u1}Underline{\\u0}")).toBe("<u>Underline</u>")
    })

    it("converts \\s1 to <s>", () => {
        expect(convertTagsToHtml("{\\s1}Strike{\\s0}")).toBe("<s>Strike</s>")
    })

    it("handles multiple nested styles", () => {
        const result = convertTagsToHtml("{\\b1}{\\i1}BoldItalic{\\i0}{\\b0}")
        expect(result).toBe("<b><i>BoldItalic</i></b>")
    })

    it("auto-closes unclosed tags", () => {
        const result = convertTagsToHtml("{\\b1}Bold without close")
        expect(result).toBe("<b>Bold without close</b>")
    })

    it("strips non-HTML tags", () => {
        expect(convertTagsToHtml("{\\pos(100,200)\\fs24}Hello")).toBe("Hello")
    })

    it("applies initial style from ASS style definition", () => {
        const result = convertTagsToHtml("Italic text", true, { i: true })
        expect(result).toBe("<i>Italic text</i>")
    })

    it("respects useHtmlTags=false", () => {
        const result = convertTagsToHtml("{\\b1}Bold{\\b0}", false)
        expect(result).toBe("Bold")
    })

    it("handles \\b with weight > 1 as bold", () => {
        expect(convertTagsToHtml("{\\b700}Bold{\\b0}")).toBe("<b>Bold</b>")
    })

    it("strips drawing content", () => {
        expect(convertTagsToHtml("{\\p1}m 0 0 l 100 100{\\p0}Text")).toBe("Text")
    })

    it("handles \\N, \\n, \\h in text", () => {
        expect(convertTagsToHtml("A\\NB\\nC\\hD")).toBe("A\nB C\u00A0D")
    })
})
