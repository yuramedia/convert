import { describe, it, expect } from "vitest"
import { checkQuality } from "./qc-checker"
import { parseAss } from "./ass-parser"

describe("QC Checker", () => {
    describe("Reading Speed (CPS)", () => {
        it("flags subtitles that are too fast", () => {
            const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,This is a very long subtitle with way too many characters for just one second
`)

            const report = checkQuality(track)
            // Triggers both CPS (70+ chars/1sec) and line length (70+ chars > 42) issues
            expect(report.issues.length).toBeGreaterThanOrEqual(1)
            const cpsIssues = report.issues.filter(i => i.category === "Reading Speed")
            expect(cpsIssues).toHaveLength(1)
            expect(cpsIssues[0].severity).toBe("critical")
        })

        it("passes subtitles with acceptable reading speed", () => {
            const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Normal subtitle text
`)

            const report = checkQuality(track)
            const cpsIssues = report.issues.filter(i => i.category === "Reading Speed")
            expect(cpsIssues).toHaveLength(0)
        })
    })

    describe("Line Length", () => {
        it("flags lines that are too long", () => {
            const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,This is an extremely long line that definitely exceeds the maximum recommended length for a single subtitle line
`)

            const report = checkQuality(track)
            const lengthIssues = report.issues.filter(i => i.category === "Line Length")
            expect(lengthIssues.length).toBeGreaterThan(0)
            expect(lengthIssues[0].severity).toBe("critical")
        })

        it("checks multi-line subtitles correctly", () => {
            const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,First line is okay\\NSecond line is also okay
`)

            const report = checkQuality(track)
            const lengthIssues = report.issues.filter(i => i.category === "Line Length")
            expect(lengthIssues).toHaveLength(0)
        })
    })

    describe("Duration Validation", () => {
        it("flags subtitles that are too short", () => {
            const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:01.50,Default,,0,0,0,,Flash
`)

            const report = checkQuality(track)
            const durationIssues = report.issues.filter(i => i.category === "Duration")
            expect(durationIssues.length).toBeGreaterThan(0)
            expect(durationIssues[0].issue).toContain("too short")
        })

        it("flags subtitles that are too long", () => {
            const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:10.00,Default,,0,0,0,,Very long static text
`)

            const report = checkQuality(track, { maxDuration: 7000 })
            const durationIssues = report.issues.filter(i => i.category === "Duration")
            expect(durationIssues.length).toBeGreaterThan(0)
            expect(durationIssues[0].issue).toContain("too long")
        })

        it("detects negative duration", () => {
            const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:05.00,0:00:03.00,Default,,0,0,0,,Broken timing
`)

            const report = checkQuality(track)
            const durationIssues = report.issues.filter(i => i.category === "Duration")
            expect(durationIssues.some(i => i.issue.includes("Negative"))).toBe(true)
        })
    })

    describe("Timing Issues", () => {
        it("detects overlapping subtitles", () => {
            const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,First subtitle
Dialogue: 0,0:00:02.50,0:00:04.00,Default,,0,0,0,,Overlapping subtitle
`)

            const report = checkQuality(track)
            const timingIssues = report.issues.filter(i => i.category === "Timing")
            expect(timingIssues.some(i => i.issue.includes("Overlapping"))).toBe(true)
            expect(timingIssues[0].severity).toBe("critical")
        })

        it("detects gaps that are too small", () => {
            const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,First subtitle
Dialogue: 0,0:00:03.05,0:00:05.00,Default,,0,0,0,,Very close subtitle
`)

            const report = checkQuality(track, { minGap: 83 })
            const timingIssues = report.issues.filter(i => i.category === "Timing" && i.issue.includes("Gap too small"))
            expect(timingIssues.length).toBeGreaterThan(0)
        })
    })

    describe("Formatting Issues", () => {
        it("detects unbalanced HTML tags", () => {
            const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,<i>Unclosed tag
`)

            const report = checkQuality(track)
            const formatIssues = report.issues.filter(i => i.category === "Formatting")
            expect(formatIssues.some(i => i.issue.includes("Unclosed"))).toBe(true)
        })

        it("detects uppercase HTML tags", () => {
            const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,<I>Wrong case</I>
`)

            const report = checkQuality(track)
            const formatIssues = report.issues.filter(i => i.category === "Formatting")
            expect(formatIssues.some(i => i.issue.includes("Uppercase"))).toBe(true)
        })

        it("detects double spaces", () => {
            const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Text with  double spaces
`)

            const report = checkQuality(track)
            const formatIssues = report.issues.filter(i => i.category === "Formatting")
            expect(formatIssues.some(i => i.issue.includes("Double spaces"))).toBe(true)
        })
    })

    describe("Summary Statistics", () => {
        it("correctly counts issues by severity", () => {
            const track = parseAss(`[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:01.20,Default,,0,0,0,,<I>Too short  and uppercase tags</I>
`)

            const report = checkQuality(track)
            expect(report.summary.critical).toBeGreaterThan(0)
            expect(report.summary.warning).toBeGreaterThan(0)
            expect(report.totalLines).toBe(1)
        })
    })
})
