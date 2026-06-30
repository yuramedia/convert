import { describe, it, expect } from "vitest"
import { runQualityCheck, stripOverrideTags, DEFAULT_QC_OPTIONS, type QcOptions } from "./qc-engine"
import { type AssTrack, type AssEvent } from "./ass-parser"

// ─── Helper: create a minimal AssTrack with events ───────────────────────────

function makeTrack(events: Partial<AssEvent>[]): AssTrack {
    return {
        scriptInfo: {
            Title: "Test",
            ScriptType: "v4.00+",
            PlayResX: 1920,
            PlayResY: 1080,
            WrapStyle: 0,
            ScaledBorderAndShadow: true,
            Timer: 100,
            YCbCrMatrix: "",
            Kerning: true,
            LayoutResX: 1920,
            LayoutResY: 1080
        },
        styles: [
            {
                Name: "Default",
                FontName: "Arial",
                FontSize: 48,
                PrimaryColour: "&H00FFFFFF",
                SecondaryColour: "&H000000FF",
                OutlineColour: "&H00000000",
                BackColour: "&H00000000",
                Bold: false,
                Italic: false,
                Underline: false,
                StrikeOut: false,
                ScaleX: 100,
                ScaleY: 100,
                Spacing: 0,
                Angle: 0,
                BorderStyle: 1,
                Outline: 2,
                Shadow: 2,
                Alignment: 2,
                MarginL: 10,
                MarginR: 10,
                MarginV: 10,
                Encoding: 1,
                Blur: 0,
                Justify: 0,
                _raw: {}
            }
        ],
        events: events.map(e => ({
            type: "Dialogue" as const,
            Layer: 0,
            Start: 0,
            End: 2000,
            Style: "Default",
            Name: "",
            MarginL: 0,
            MarginR: 0,
            MarginV: 0,
            Effect: "",
            Text: "",
            ...e
        })),
        styleFormat: [],
        eventFormat: [],
        trackType: "ASS",
        rawSections: []
    }
}

function onlyRule(ruleId: string): QcOptions {
    return { ...DEFAULT_QC_OPTIONS, enabledRules: new Set([ruleId]) }
}

// ─── stripOverrideTags ───────────────────────────────────────────────────────

describe("stripOverrideTags", () => {
    it("removes override tags", () => {
        expect(stripOverrideTags("{\\b1}Hello{\\b0}")).toBe("Hello")
    })
    it("preserves \\N line breaks", () => {
        expect(stripOverrideTags("Line1\\NLine2")).toBe("Line1\\NLine2")
    })
    it("handles complex tags", () => {
        expect(stripOverrideTags("{\\pos(320,50)\\c&HFFFFFF&}Text")).toBe("Text")
    })
    it("returns unchanged text without tags", () => {
        expect(stripOverrideTags("Clean text")).toBe("Clean text")
    })
})

// ─── remove-empty-lines ──────────────────────────────────────────────────────

describe("remove-empty-lines", () => {
    it("detects empty subtitle with only tags", () => {
        const track = makeTrack([{ Text: "{\\b1}" }])
        const result = runQualityCheck(track, onlyRule("remove-empty-lines"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].ruleId).toBe("remove-empty-lines")
        expect(result.fixedTrack.events).toHaveLength(0)
    })

    it("does not flag non-empty lines", () => {
        const track = makeTrack([{ Text: "Hello world" }])
        const result = runQualityCheck(track, onlyRule("remove-empty-lines"))
        expect(result.issues).toHaveLength(0)
    })

    it("does not flag text with tags and visible content", () => {
        const track = makeTrack([{ Text: "{\\b1}Hello{\\b0}" }])
        const result = runQualityCheck(track, onlyRule("remove-empty-lines"))
        expect(result.issues).toHaveLength(0)
    })

    it("is DISABLED by default (matches SubtitleEdit)", () => {
        const track = makeTrack([{ Text: "{\\b1}" }])
        const result = runQualityCheck(track) // uses DEFAULT_QC_OPTIONS
        const emptyIssues = result.issues.filter(i => i.ruleId === "remove-empty-lines")
        expect(emptyIssues).toHaveLength(0)
    })
})

// ─── fix-double-spaces ───────────────────────────────────────────────────────

describe("fix-double-spaces", () => {
    it("detects double spaces", () => {
        const track = makeTrack([{ Text: "Hello  world" }])
        const result = runQualityCheck(track, onlyRule("fix-double-spaces"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello world")
    })

    it("detects triple spaces", () => {
        const track = makeTrack([{ Text: "Hello   world" }])
        const result = runQualityCheck(track, onlyRule("fix-double-spaces"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello world")
    })

    it("preserves spaces inside override tags", () => {
        const track = makeTrack([{ Text: "{\\b1}Hello world{\\b0}" }])
        const result = runQualityCheck(track, onlyRule("fix-double-spaces"))
        expect(result.issues).toHaveLength(0)
    })

    it("does not flag single spaces", () => {
        const track = makeTrack([{ Text: "Hello world" }])
        const result = runQualityCheck(track, onlyRule("fix-double-spaces"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── fix-leading-trailing-whitespace ─────────────────────────────────────────

describe("fix-leading-trailing-whitespace", () => {
    it("fixes trailing spaces", () => {
        const track = makeTrack([{ Text: "Hello world  " }])
        const result = runQualityCheck(track, onlyRule("fix-leading-trailing-whitespace"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello world")
    })

    it("fixes leading spaces after override tags", () => {
        const track = makeTrack([{ Text: "{\\b1}  Hello" }])
        const result = runQualityCheck(track, onlyRule("fix-leading-trailing-whitespace"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("{\\b1}Hello")
    })

    it("preserves override tags at start", () => {
        const track = makeTrack([{ Text: "{\\pos(320,50)}Hello" }])
        const result = runQualityCheck(track, onlyRule("fix-leading-trailing-whitespace"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── fix-ellipsis ────────────────────────────────────────────────────────────

describe("fix-ellipsis", () => {
    it("converts three dots to ellipsis", () => {
        const track = makeTrack([{ Text: "Wait..." }])
        const result = runQualityCheck(track, onlyRule("fix-ellipsis"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Wait…")
    })

    it("does not flag existing ellipsis character", () => {
        const track = makeTrack([{ Text: "Wait…" }])
        const result = runQualityCheck(track, onlyRule("fix-ellipsis"))
        expect(result.issues).toHaveLength(0)
    })

    it("respects convertEllipsis option", () => {
        const track = makeTrack([{ Text: "Wait..." }])
        const result = runQualityCheck(track, {
            ...onlyRule("fix-ellipsis"),
            convertEllipsis: false
        })
        expect(result.issues).toHaveLength(0)
    })

    it("preserves tags around ellipsis", () => {
        const track = makeTrack([{ Text: "{\\b1}Wait...{\\b0}" }])
        const result = runQualityCheck(track, onlyRule("fix-ellipsis"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("{\\b1}Wait…{\\b0}")
    })

    it("is DISABLED by default (not in SubtitleEdit defaults)", () => {
        const track = makeTrack([{ Text: "Wait..." }])
        const result = runQualityCheck(track) // uses DEFAULT_QC_OPTIONS
        const ellipsisIssues = result.issues.filter(i => i.ruleId === "fix-ellipsis")
        expect(ellipsisIssues).toHaveLength(0)
    })
})

// ─── fix-double-punctuation ──────────────────────────────────────────────────

describe("fix-double-punctuation", () => {
    it("fixes double periods", () => {
        const track = makeTrack([{ Text: "Hello.." }])
        const result = runQualityCheck(track, onlyRule("fix-double-punctuation"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello.")
    })

    it("fixes double commas", () => {
        const track = makeTrack([{ Text: "Hello,, world" }])
        const result = runQualityCheck(track, onlyRule("fix-double-punctuation"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello, world")
    })

    it("fixes double exclamation marks", () => {
        const track = makeTrack([{ Text: "Wow!!" }])
        const result = runQualityCheck(track, onlyRule("fix-double-punctuation"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Wow!")
    })

    it("does not flag three dots (handled by ellipsis rule)", () => {
        const track = makeTrack([{ Text: "Wait..." }])
        const result = runQualityCheck(track, onlyRule("fix-double-punctuation"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── fix-space-before-punctuation ────────────────────────────────────────────

describe("fix-space-before-punctuation", () => {
    it("removes space before period", () => {
        const track = makeTrack([{ Text: "Hello ." }])
        const result = runQualityCheck(track, onlyRule("fix-space-before-punctuation"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello.")
    })

    it("removes space before comma", () => {
        const track = makeTrack([{ Text: "Hello , world" }])
        const result = runQualityCheck(track, onlyRule("fix-space-before-punctuation"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello, world")
    })

    it("does not flag normal punctuation", () => {
        const track = makeTrack([{ Text: "Hello, world." }])
        const result = runQualityCheck(track, onlyRule("fix-space-before-punctuation"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── fix-missing-space-after-punctuation ─────────────────────────────────────

describe("fix-missing-space-after-punctuation", () => {
    it("adds space after period before word", () => {
        const track = makeTrack([{ Text: "Hello.World" }])
        const result = runQualityCheck(track, onlyRule("fix-missing-space-after-punctuation"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello. World")
    })

    it("does not flag decimal numbers", () => {
        const track = makeTrack([{ Text: "It costs 3.50 dollars" }])
        const result = runQualityCheck(track, onlyRule("fix-missing-space-after-punctuation"))
        expect(result.issues).toHaveLength(0)
    })

    it("adds space after comma", () => {
        const track = makeTrack([{ Text: "Hello,world" }])
        const result = runQualityCheck(track, onlyRule("fix-missing-space-after-punctuation"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello, world")
    })
})

// ─── fix-commas ──────────────────────────────────────────────────────────────

describe("fix-commas", () => {
    it("fixes leading comma", () => {
        const track = makeTrack([{ Text: ", Hello" }])
        const result = runQualityCheck(track, onlyRule("fix-commas"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello")
    })

    it("fixes comma-dash", () => {
        const track = makeTrack([{ Text: "Hello,- world" }])
        const result = runQualityCheck(track, onlyRule("fix-commas"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello - world")
    })

    it("does not flag normal commas", () => {
        const track = makeTrack([{ Text: "Hello, world" }])
        const result = runQualityCheck(track, onlyRule("fix-commas"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── fix-double-apostrophes ──────────────────────────────────────────────────

describe("fix-double-apostrophes", () => {
    it("converts double apostrophes to quote", () => {
        const track = makeTrack([{ Text: "He said ''hello''" }])
        const result = runQualityCheck(track, onlyRule("fix-double-apostrophes"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe('He said "hello"')
    })

    it("does not flag single apostrophes", () => {
        const track = makeTrack([{ Text: "It's fine" }])
        const result = runQualityCheck(track, onlyRule("fix-double-apostrophes"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── split-dialog-on-one-line ────────────────────────────────────────────────

describe("split-dialog-on-one-line", () => {
    it("splits two-speaker dialog into two lines", () => {
        const track = makeTrack([{ Text: "- Hi John! - Hi Ida!" }])
        const result = runQualityCheck(track, onlyRule("split-dialog-on-one-line"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("- Hi John!\\N- Hi Ida!")
    })

    it("does not flag non-dialog single lines", () => {
        const track = makeTrack([{ Text: "Hello world" }])
        const result = runQualityCheck(track, onlyRule("split-dialog-on-one-line"))
        expect(result.issues).toHaveLength(0)
    })

    it("does not flag already-split dialog", () => {
        const track = makeTrack([{ Text: "- Hi John!\\N- Hi Ida!" }])
        const result = runQualityCheck(track, onlyRule("split-dialog-on-one-line"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── fix-three-plus-lines ────────────────────────────────────────────────────

describe("fix-three-plus-lines", () => {
    it("warns about three-line subtitle", () => {
        const track = makeTrack([{ Text: "Line 1\\NLine 2\\NLine 3" }])
        const result = runQualityCheck(track, onlyRule("fix-three-plus-lines"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].severity).toBe("warning")
        expect(result.issues[0].fixed).toBeNull()
    })

    it("does not warn about two-line subtitle", () => {
        const track = makeTrack([{ Text: "Line 1\\NLine 2" }])
        const result = runQualityCheck(track, onlyRule("fix-three-plus-lines"))
        expect(result.issues).toHaveLength(0)
    })

    it("is DISABLED by default (matches SubtitleEdit)", () => {
        const track = makeTrack([{ Text: "L1\\NL2\\NL3" }])
        const result = runQualityCheck(track)
        const threeLineIssues = result.issues.filter(i => i.ruleId === "fix-three-plus-lines")
        expect(threeLineIssues).toHaveLength(0)
    })
})

// ─── fix-long-lines ──────────────────────────────────────────────────────────

describe("fix-long-lines", () => {
    it("warns about line exceeding max length", () => {
        const longText = "A".repeat(50)
        const track = makeTrack([{ Text: longText }])
        const result = runQualityCheck(track, onlyRule("fix-long-lines"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].severity).toBe("warning")
    })

    it("does not warn about short lines", () => {
        const track = makeTrack([{ Text: "Short line" }])
        const result = runQualityCheck(track, onlyRule("fix-long-lines"))
        expect(result.issues).toHaveLength(0)
    })

    it("measures visible length excluding tags", () => {
        const taggedText = "{\\b1}" + "A".repeat(40) + "{\\b0}"
        const track = makeTrack([{ Text: taggedText }])
        const result = runQualityCheck(track, onlyRule("fix-long-lines"))
        expect(result.issues).toHaveLength(0) // 40 < 42
    })
})

// ─── merge-short-lines ───────────────────────────────────────────────────────

describe("merge-short-lines", () => {
    it("merges short broken lines", () => {
        const track = makeTrack([{ Text: "Hello\\Nworld" }])
        const result = runQualityCheck(track, onlyRule("merge-short-lines"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello world")
    })

    it("does not merge dialog lines (with dashes)", () => {
        const track = makeTrack([{ Text: "- Hello\\N- World" }])
        const result = runQualityCheck(track, onlyRule("merge-short-lines"))
        expect(result.issues).toHaveLength(0)
    })

    it("does not merge when combined length exceeds max", () => {
        const longLine1 = "A".repeat(25)
        const longLine2 = "B".repeat(25)
        const track = makeTrack([{ Text: `${longLine1}\\N${longLine2}` }])
        const result = runQualityCheck(track, onlyRule("merge-short-lines"))
        expect(result.issues).toHaveLength(0) // 50 > 42
    })

    it("does not flag single-line subtitles", () => {
        const track = makeTrack([{ Text: "Hello world" }])
        const result = runQualityCheck(track, onlyRule("merge-short-lines"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── fix-long-duration ───────────────────────────────────────────────────────

describe("fix-long-duration", () => {
    it("warns about long duration", () => {
        const track = makeTrack([{ Text: "Hello", Start: 0, End: 15000 }])
        const result = runQualityCheck(track, onlyRule("fix-long-duration"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].severity).toBe("warning")
    })

    it("does not warn about normal duration", () => {
        const track = makeTrack([{ Text: "Hello", Start: 0, End: 3000 }])
        const result = runQualityCheck(track, onlyRule("fix-long-duration"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── fix-short-duration ──────────────────────────────────────────────────────

describe("fix-short-duration", () => {
    it("warns about short duration", () => {
        const track = makeTrack([{ Text: "Hello", Start: 0, End: 200 }])
        const result = runQualityCheck(track, onlyRule("fix-short-duration"))
        expect(result.issues).toHaveLength(1)
    })

    it("does not warn about normal duration", () => {
        const track = makeTrack([{ Text: "Hello", Start: 0, End: 2000 }])
        const result = runQualityCheck(track, onlyRule("fix-short-duration"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── fix-overlapping-times ───────────────────────────────────────────────────

describe("fix-overlapping-times", () => {
    it("warns about overlapping events", () => {
        const track = makeTrack([
            { Text: "First", Start: 0, End: 3000 },
            { Text: "Second", Start: 2000, End: 5000 }
        ])
        const result = runQualityCheck(track, onlyRule("fix-overlapping-times"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].severity).toBe("warning")
    })

    it("does not warn about non-overlapping events", () => {
        const track = makeTrack([
            { Text: "First", Start: 0, End: 2000 },
            { Text: "Second", Start: 2500, End: 5000 }
        ])
        const result = runQualityCheck(track, onlyRule("fix-overlapping-times"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── fix-short-gaps ──────────────────────────────────────────────────────────

describe("fix-short-gaps", () => {
    it("warns about short gap between events", () => {
        const track = makeTrack([
            { Text: "First", Start: 0, End: 2000 },
            { Text: "Second", Start: 2010, End: 4000 }
        ])
        const result = runQualityCheck(track, onlyRule("fix-short-gaps"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].severity).toBe("warning")
        expect(result.issues[0].message).toContain("10ms")
    })

    it("does not warn about adequate gaps", () => {
        const track = makeTrack([
            { Text: "First", Start: 0, End: 2000 },
            { Text: "Second", Start: 2100, End: 4000 }
        ])
        const result = runQualityCheck(track, onlyRule("fix-short-gaps"))
        expect(result.issues).toHaveLength(0)
    })

    it("does not flag overlaps (handled by overlap rule)", () => {
        const track = makeTrack([
            { Text: "First", Start: 0, End: 3000 },
            { Text: "Second", Start: 2000, End: 5000 }
        ])
        const result = runQualityCheck(track, onlyRule("fix-short-gaps"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── fix-line-break-issues ───────────────────────────────────────────────────

describe("fix-line-break-issues", () => {
    it("removes leading \\N", () => {
        const track = makeTrack([{ Text: "\\NHello" }])
        const result = runQualityCheck(track, onlyRule("fix-line-break-issues"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello")
    })

    it("removes trailing \\N", () => {
        const track = makeTrack([{ Text: "Hello\\N" }])
        const result = runQualityCheck(track, onlyRule("fix-line-break-issues"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello")
    })

    it("collapses double \\N\\N to single \\N", () => {
        const track = makeTrack([{ Text: "Hello\\N\\NWorld" }])
        const result = runQualityCheck(track, onlyRule("fix-line-break-issues"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello\\NWorld")
    })

    it("does not flag normal \\N", () => {
        const track = makeTrack([{ Text: "Line1\\NLine2" }])
        const result = runQualityCheck(track, onlyRule("fix-line-break-issues"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── fix-unmatched-tags ──────────────────────────────────────────────────────

describe("fix-unmatched-tags", () => {
    it("warns about unmatched bold tag", () => {
        const track = makeTrack([{ Text: "{\\b1}Hello" }])
        const result = runQualityCheck(track, onlyRule("fix-unmatched-tags"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].message).toContain("\\b1")
    })

    it("does not warn about matched tags", () => {
        const track = makeTrack([{ Text: "{\\b1}Hello{\\b0}" }])
        const result = runQualityCheck(track, onlyRule("fix-unmatched-tags"))
        expect(result.issues).toHaveLength(0)
    })

    it("warns about unmatched italic tag", () => {
        const track = makeTrack([{ Text: "{\\i1}Narration" }])
        const result = runQualityCheck(track, onlyRule("fix-unmatched-tags"))
        expect(result.issues).toHaveLength(1)
    })
})

// ─── fix-missing-dialogue-dash ───────────────────────────────────────────────

describe("fix-missing-dialogue-dash", () => {
    it("adds dash to second line when first has one", () => {
        const track = makeTrack([{ Text: "- Hello\\NWorld" }])
        const result = runQualityCheck(track, onlyRule("fix-missing-dialogue-dash"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("- Hello\\N- World")
    })

    it("does not flag when both lines have dashes", () => {
        const track = makeTrack([{ Text: "- Hello\\N- World" }])
        const result = runQualityCheck(track, onlyRule("fix-missing-dialogue-dash"))
        expect(result.issues).toHaveLength(0)
    })

    it("does not flag single-line subtitles", () => {
        const track = makeTrack([{ Text: "- Hello" }])
        const result = runQualityCheck(track, onlyRule("fix-missing-dialogue-dash"))
        expect(result.issues).toHaveLength(0)
    })

    it("does not flag when first line has no dash", () => {
        const track = makeTrack([{ Text: "Hello\\NWorld" }])
        const result = runQualityCheck(track, onlyRule("fix-missing-dialogue-dash"))
        expect(result.issues).toHaveLength(0)
    })

    it("preserves override tags when adding dash", () => {
        const track = makeTrack([{ Text: "- Hello\\N{\\b1}World" }])
        const result = runQualityCheck(track, onlyRule("fix-missing-dialogue-dash"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("- Hello\\N{\\b1}- World")
    })

    it("is DISABLED by default (matches SubtitleEdit)", () => {
        const track = makeTrack([{ Text: "- Hello\\NWorld" }])
        const result = runQualityCheck(track)
        const dashIssues = result.issues.filter(i => i.ruleId === "fix-missing-dialogue-dash")
        expect(dashIssues).toHaveLength(0)
    })
})

// ─── fix-uppercase-after-paragraph ───────────────────────────────────────────

describe("fix-uppercase-after-paragraph", () => {
    it("capitalizes first letter of subtitle", () => {
        const track = makeTrack([{ Text: "hello world" }])
        const result = runQualityCheck(track, onlyRule("fix-uppercase-after-paragraph"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello world")
    })

    it("capitalizes first letter after dash", () => {
        const track = makeTrack([{ Text: "- hello" }])
        const result = runQualityCheck(track, onlyRule("fix-uppercase-after-paragraph"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("- Hello")
    })

    it("does not flag already capitalized text", () => {
        const track = makeTrack([{ Text: "Hello world" }])
        const result = runQualityCheck(track, onlyRule("fix-uppercase-after-paragraph"))
        expect(result.issues).toHaveLength(0)
    })

    it("preserves override tags", () => {
        const track = makeTrack([{ Text: "{\\b1}hello" }])
        const result = runQualityCheck(track, onlyRule("fix-uppercase-after-paragraph"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("{\\b1}Hello")
    })

    it("handles multi-line subtitles", () => {
        const track = makeTrack([{ Text: "Hello\\Nworld" }])
        const result = runQualityCheck(track, onlyRule("fix-uppercase-after-paragraph"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello\\NWorld")
    })
})

// ─── fix-uppercase-after-period ──────────────────────────────────────────────

describe("fix-uppercase-after-period", () => {
    it("capitalizes after period", () => {
        const track = makeTrack([{ Text: "Hello there! how are you?" }])
        const result = runQualityCheck(track, onlyRule("fix-uppercase-after-period"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello there! How are you?")
    })

    it("capitalizes after question mark", () => {
        const track = makeTrack([{ Text: "Really? yes indeed." }])
        const result = runQualityCheck(track, onlyRule("fix-uppercase-after-period"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Really? Yes indeed.")
    })

    it("does not flag already correct text", () => {
        const track = makeTrack([{ Text: "Hello. World." }])
        const result = runQualityCheck(track, onlyRule("fix-uppercase-after-period"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── fix-uppercase-after-colon ───────────────────────────────────────────────

describe("fix-uppercase-after-colon", () => {
    it("capitalizes after colon", () => {
        const track = makeTrack([{ Text: "Speaker: hello world" }])
        const result = runQualityCheck(track, onlyRule("fix-uppercase-after-colon"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Speaker: Hello world")
    })

    it("capitalizes after semicolon", () => {
        const track = makeTrack([{ Text: "First; second thing" }])
        const result = runQualityCheck(track, onlyRule("fix-uppercase-after-colon"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("First; Second thing")
    })

    it("does not flag already correct text", () => {
        const track = makeTrack([{ Text: "Speaker: Hello" }])
        const result = runQualityCheck(track, onlyRule("fix-uppercase-after-colon"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── fix-hyphens-remove-dash-single-line ──────────────────────────────────────

describe("fix-hyphens-remove-dash-single-line", () => {
    it("removes dash from single line", () => {
        const track = makeTrack([{ Text: "- Hello." }])
        const result = runQualityCheck(track, onlyRule("fix-hyphens-remove-dash-single-line"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello.")
    })
    it("does not remove dash if it is multi-line", () => {
        const track = makeTrack([{ Text: "- Hello.\\N- World." }])
        const result = runQualityCheck(track, onlyRule("fix-hyphens-remove-dash-single-line"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── remove-dialog-first-line-in-non-dialogs ──────────────────────────────────

describe("remove-dialog-first-line-in-non-dialogs", () => {
    it("removes dash from first line if second has no dash", () => {
        const track = makeTrack([{ Text: "- Hello.\\NWorld." }])
        const result = runQualityCheck(track, onlyRule("remove-dialog-first-line-in-non-dialogs"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello.\\NWorld.")
    })
    it("does not touch if both have dashes", () => {
        const track = makeTrack([{ Text: "- Hello.\\N- World." }])
        const result = runQualityCheck(track, onlyRule("remove-dialog-first-line-in-non-dialogs"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── fix-double-greater-than ──────────────────────────────────────────────────

describe("fix-double-greater-than", () => {
    it("replaces >> with >", () => {
        const track = makeTrack([{ Text: ">> Hello" }])
        const result = runQualityCheck(track, onlyRule("fix-double-greater-than"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("> Hello")
    })
})

// ─── fix-music-notation ───────────────────────────────────────────────────────

describe("fix-music-notation", () => {
    it("converts # singing # to ♪ singing ♪", () => {
        const track = makeTrack([{ Text: "# singing #" }])
        const result = runQualityCheck(track, onlyRule("fix-music-notation"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("♪ singing ♪")
    })
})

// ─── fix-missing-open-bracket ─────────────────────────────────────────────────

describe("fix-missing-open-bracket", () => {
    it("adds missing open bracket", () => {
        const track = makeTrack([{ Text: "Hello)" }])
        const result = runQualityCheck(track, onlyRule("fix-missing-open-bracket"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("(Hello)")
    })
})

// ─── fix-missing-close-bracket ────────────────────────────────────────────────

describe("fix-missing-close-bracket", () => {
    it("adds missing close bracket", () => {
        const track = makeTrack([{ Text: "[Hello" }])
        const result = runQualityCheck(track, onlyRule("fix-missing-close-bracket"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("[Hello]")
    })
})

// ─── fix-unnecessary-leading-dots ─────────────────────────────────────────────

describe("fix-unnecessary-leading-dots", () => {
    it("removes single leading dot", () => {
        const track = makeTrack([{ Text: ". Hello" }])
        const result = runQualityCheck(track, onlyRule("fix-unnecessary-leading-dots"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello")
    })
    it("does not remove ellipsis dots", () => {
        const track = makeTrack([{ Text: "... Hello" }])
        const result = runQualityCheck(track, onlyRule("fix-unnecessary-leading-dots"))
        expect(result.issues).toHaveLength(0)
    })
})

// ─── remove-space-between-numbers ─────────────────────────────────────────────

describe("remove-space-between-numbers", () => {
    it("removes spaces between numbers", () => {
        const track = makeTrack([{ Text: "1 000 000 dollars" }])
        const result = runQualityCheck(track, onlyRule("remove-space-between-numbers"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("1000000 dollars")
    })
})

// ─── fix-continuation-style ───────────────────────────────────────────────────

describe("fix-continuation-style", () => {
    it("removes ellipsis from continuation line", () => {
        const track = makeTrack([{ Text: "First line...\\N...Second line" }])
        const result = runQualityCheck(track, onlyRule("fix-continuation-style"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("First line...\\NSecond line")
    })
})

// ─── normalize-strings ────────────────────────────────────────────────────────

describe("normalize-strings", () => {
    it("normalizes multiple question/exclamations", () => {
        const track = makeTrack([{ Text: "Really!?!" }])
        const result = runQualityCheck(track, onlyRule("normalize-strings"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Really!?")
    })
})

// ─── fix-alone-lowercase-i ────────────────────────────────────────────────────

describe("fix-alone-lowercase-i", () => {
    it("capitalizes stand-alone i", () => {
        const track = makeTrack([{ Text: "what i think" }])
        const result = runQualityCheck(track, onlyRule("fix-alone-lowercase-i"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("what I think")
    })
})

// ─── fix-turkish-ansi ─────────────────────────────────────────────────────────

describe("fix-turkish-ansi", () => {
    it("corrects ANSI letters", () => {
        const track = makeTrack([{ Text: "Ýstanbul ve þehirler" }])
        const result = runQualityCheck(track, onlyRule("fix-turkish-ansi"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("İstanbul ve şehirler")
    })
})

// ─── fix-spanish-inverted-marks ───────────────────────────────────────────────

describe("fix-spanish-inverted-marks", () => {
    it("prepends inverted question mark", () => {
        const track = makeTrack([{ Text: "Cómo estás?" }])
        const result = runQualityCheck(track, onlyRule("fix-spanish-inverted-marks"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("¿Cómo estás?")
    })
})

// ─── add-missing-quotes ───────────────────────────────────────────────────────

describe("add-missing-quotes", () => {
    it("balances single unclosed quote", () => {
        const track = makeTrack([{ Text: '"She said, hello' }])
        const result = runQualityCheck(track, onlyRule("add-missing-quotes"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe('"She said, hello"')
    })
})

// ─── fix-unneeded-period-after-abbreviation ──────────────────────────────────

describe("fix-unneeded-period-after-abbreviation", () => {
    it("removes period before lowercase", () => {
        const track = makeTrack([{ Text: "Mr. smith came by" }])
        const result = runQualityCheck(track, onlyRule("fix-unneeded-period-after-abbreviation"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Mr smith came by")
    })
})

// ─── fix-uppercase-i-inside-words ────────────────────────────────────────────

describe("fix-uppercase-i-inside-words", () => {
    it("corrects uppercase I in words", () => {
        const track = makeTrack([{ Text: "thIs is lIke a test" }])
        const result = runQualityCheck(track, onlyRule("fix-uppercase-i-inside-words"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("this is like a test")
    })
})

// ─── fix-missing-periods-at-end ─────────────────────────────────────────────

describe("fix-missing-periods-at-end", () => {
    it("adds period before uppercase letter on next line", () => {
        const track = makeTrack([{ Text: "Hello world\\NHello" }])
        const result = runQualityCheck(track, onlyRule("fix-missing-periods-at-end"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello world.\\NHello")
    })
})

// ─── fix-double-dash ─────────────────────────────────────────────────────────

describe("fix-double-dash", () => {
    it("converts double dashes to em-dashes", () => {
        const track = makeTrack([{ Text: "Hello--world" }])
        const result = runQualityCheck(track, onlyRule("fix-double-dash"))
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].fixed).toBe("Hello—world")
    })
})

// ─── Integration: default rules match SubtitleEdit ───────────────────────────

describe("runQualityCheck — SubtitleEdit default behavior", () => {
    it("has correct default enabled rules", () => {
        const enabled = DEFAULT_QC_OPTIONS.enabledRules

        // Rules that SHOULD be enabled by default (matching SubtitleEdit)
        expect(enabled.has("fix-double-spaces")).toBe(true)
        expect(enabled.has("fix-leading-trailing-whitespace")).toBe(true)
        expect(enabled.has("fix-line-break-issues")).toBe(true)
        expect(enabled.has("fix-long-lines")).toBe(true)
        expect(enabled.has("merge-short-lines")).toBe(true)
        expect(enabled.has("fix-space-before-punctuation")).toBe(true)
        expect(enabled.has("fix-missing-space-after-punctuation")).toBe(true)
        expect(enabled.has("fix-commas")).toBe(true)
        expect(enabled.has("split-dialog-on-one-line")).toBe(true)
        expect(enabled.has("fix-overlapping-times")).toBe(true)
        expect(enabled.has("fix-short-duration")).toBe(true)
        expect(enabled.has("fix-long-duration")).toBe(true)
        expect(enabled.has("fix-short-gaps")).toBe(true)
        expect(enabled.has("fix-unmatched-tags")).toBe(true)
        expect(enabled.has("remove-dialog-first-line-in-non-dialogs")).toBe(true)
        expect(enabled.has("fix-missing-periods-at-end")).toBe(true)
        expect(enabled.has("fix-double-dash")).toBe(true)

        // Rules that SHOULD be DISABLED by default
        expect(enabled.has("remove-empty-lines")).toBe(false)
        expect(enabled.has("fix-ellipsis")).toBe(false)
        expect(enabled.has("fix-three-plus-lines")).toBe(false)
        expect(enabled.has("fix-missing-dialogue-dash")).toBe(false)
        expect(enabled.has("fix-uppercase-after-colon")).toBe(false)
        expect(enabled.has("fix-music-notation")).toBe(false)
        expect(enabled.has("fix-double-punctuation")).toBe(false)
        expect(enabled.has("fix-double-apostrophes")).toBe(false)
        expect(enabled.has("fix-hyphens-remove-dash-single-line")).toBe(false)
        expect(enabled.has("fix-double-greater-than")).toBe(false)
        expect(enabled.has("fix-missing-open-bracket")).toBe(false)
        expect(enabled.has("fix-missing-close-bracket")).toBe(false)
        expect(enabled.has("fix-unnecessary-leading-dots")).toBe(false)
        expect(enabled.has("remove-space-between-numbers")).toBe(false)
        expect(enabled.has("fix-continuation-style")).toBe(false)
        expect(enabled.has("normalize-strings")).toBe(false)
        expect(enabled.has("fix-turkish-ansi")).toBe(false)
        expect(enabled.has("fix-spanish-inverted-marks")).toBe(false)
        expect(enabled.has("add-missing-quotes")).toBe(false)
        expect(enabled.has("fix-unneeded-period-after-abbreviation")).toBe(false)
        expect(enabled.has("fix-uppercase-i-inside-words")).toBe(false)
        expect(enabled.has("fix-alone-lowercase-i")).toBe(false)
        expect(enabled.has("fix-uppercase-after-paragraph")).toBe(false)
        expect(enabled.has("fix-uppercase-after-period")).toBe(false)
    })

    it("returns correct stats", () => {
        const track = makeTrack([
            { Text: "Hello  world" }, // double spaces (error)
            { Text: "hello" }, // lowercase start (info) - disabled by default, so we'll enable it manually
            { Text: "Clean line" } // no issues
        ])
        const result = runQualityCheck(track, {
            ...DEFAULT_QC_OPTIONS,
            enabledRules: new Set([...DEFAULT_QC_OPTIONS.enabledRules, "fix-uppercase-after-paragraph"])
        })
        expect(result.stats.total).toBeGreaterThanOrEqual(2)
    })

    it("does not mutate the original track", () => {
        const track = makeTrack([{ Text: "Hello  world" }])
        const originalText = track.events[0].Text
        runQualityCheck(track)
        expect(track.events[0].Text).toBe(originalText)
    })

    it("applies fixes to the fixed track", () => {
        const track = makeTrack([{ Text: "Hello  world" }])
        const result = runQualityCheck(track, onlyRule("fix-double-spaces"))
        expect(result.fixedTrack.events[0].Text).toBe("Hello world")
    })

    it("handles disabled rules", () => {
        const track = makeTrack([{ Text: "Hello  world" }])
        const result = runQualityCheck(track, {
            ...DEFAULT_QC_OPTIONS,
            enabledRules: new Set<string>()
        })
        expect(result.issues).toHaveLength(0)
    })

    it("skips Comment events", () => {
        const track = makeTrack([{ Text: "Hello  world", type: "Comment" as const }])
        const result = runQualityCheck(track)
        expect(result.issues).toHaveLength(0)
    })
})
