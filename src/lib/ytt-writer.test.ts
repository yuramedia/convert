import { describe, it, expect } from "vitest"
import { writeYtt, escapeYttText, type YttEntry } from "./ytt-writer"

describe("ytt-writer", () => {
    it("escapes special XML characters", () => {
        expect(escapeYttText("Fish & Chips <Tom & 'Jerry'>")).toBe(
            "Fish &amp; Chips &lt;Tom &amp; &apos;Jerry&apos;&gt;"
        )
    })

    it("serializes single-span entries with pen on <p> element", () => {
        const entries: YttEntry[] = [
            {
                startMs: 1000,
                durationMs: 2000,
                position: { ap: 7, ah: 50, av: 100 },
                windowStyle: { ju: 2, pd: 0, sd: 0, wfo: 0 },
                spans: [
                    {
                        text: "Hello World",
                        pen: { fc: "#FEFEFE", fo: 254, bo: 0 }
                    }
                ]
            }
        ]

        const xml = writeYtt(entries)
        expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>')
        expect(xml).toContain('<timedtext format="3">')
        // Dummy entries
        expect(xml).toContain('<wp id="0" ap="7" ah="0" av="0"/>')
        expect(xml).toContain('<ws id="0" ju="2" pd="0" sd="0" wfo="0"/>')
        expect(xml).toContain('<pen id="0" fc="#000000" fo="0" bo="0"/>')
        // Single span: pen on <p> element
        expect(xml).toContain('<p t="1000" d="2000" p="1" wp="1" ws="1">Hello World</p>')
    })

    it("deduplicates identical pens, positions, and window styles", () => {
        const entries: YttEntry[] = [
            {
                startMs: 1000,
                durationMs: 2000,
                position: { ap: 7, ah: 50, av: 100 },
                windowStyle: { ju: 2, pd: 0, sd: 0, wfo: 0 },
                spans: [{ text: "Line 1", pen: { fc: "#FEFEFE", fo: 254, bo: 0 } }]
            },
            {
                startMs: 4000,
                durationMs: 2000,
                position: { ap: 7, ah: 50, av: 100 },
                windowStyle: { ju: 2, pd: 0, sd: 0, wfo: 0 },
                spans: [{ text: "Line 2", pen: { fc: "#FEFEFE", fo: 254, bo: 0 } }]
            }
        ]

        const xml = writeYtt(entries)
        expect(xml).toContain('<p t="1000" d="2000" p="1" wp="1" ws="1">Line 1</p>')
        expect(xml).toContain('<p t="4000" d="2000" p="1" wp="1" ws="1">Line 2</p>')
    })

    it("writes multi-section lines with per-section pen IDs and zero-width space workaround", () => {
        const entries: YttEntry[] = [
            {
                startMs: 1000,
                durationMs: 2000,
                position: { ap: 7, ah: 50, av: 100 },
                windowStyle: { ju: 2, pd: 0, sd: 0, wfo: 0 },
                spans: [
                    { text: "Normal ", pen: { fc: "#FEFEFE", fo: 254, bo: 0 } },
                    { text: "Bold", pen: { fc: "#FEFEFE", fo: 254, bo: 0, bold: true } }
                ]
            }
        ]

        const xml = writeYtt(entries)
        // Multi-section: no p= on <p>, each <s> gets p=, zero-width space after first <s>
        expect(xml).toContain('<p t="1000" d="2000" wp="1" ws="1">')
        expect(xml).toContain('<s p="1">Normal </s>')
        expect(xml).toContain("\u200B") // zero-width space workaround
        expect(xml).toContain('<s p="2">Bold</s>')
        expect(xml).not.toMatch(/<p t="1000"[^>]*\sp="/) // no p= on <p> for multi-section
    })

    it("writes pd and sd attributes on <ws> elements", () => {
        const entries: YttEntry[] = [
            {
                startMs: 1000,
                durationMs: 2000,
                position: { ap: 7, ah: 50, av: 100 },
                windowStyle: { ju: 2, pd: 0, sd: 0, wfo: 0 },
                spans: [{ text: "Test", pen: { fc: "#FEFEFE", fo: 254, bo: 0 } }]
            }
        ]

        const xml = writeYtt(entries)
        expect(xml).toContain('pd="0"')
        expect(xml).toContain('sd="0"')
    })

    it("writes bc only when bo > 0", () => {
        const entries: YttEntry[] = [
            {
                startMs: 1000,
                durationMs: 2000,
                position: { ap: 7, ah: 50, av: 100 },
                windowStyle: { ju: 2, pd: 0, sd: 0, wfo: 0 },
                spans: [
                    { text: "With BG", pen: { fc: "#FEFEFE", fo: 254, bc: "#000000", bo: 192 } },
                    { text: "No BG", pen: { fc: "#FEFEFE", fo: 254, bc: "#000000", bo: 0 } }
                ]
            }
        ]

        const xml = writeYtt(entries)
        // Pen with bo=192 should have bc=
        expect(xml).toMatch(/bc="#000000"[^/]*bo="192"/)
        // Pen with bo=0 should NOT have bc=
        expect(xml).toMatch(/fo="254" bo="0"/)
    })

    it("writes sz attribute on pen", () => {
        const entries: YttEntry[] = [
            {
                startMs: 1000,
                durationMs: 2000,
                position: { ap: 7, ah: 50, av: 100 },
                windowStyle: { ju: 2, pd: 0, sd: 0, wfo: 0 },
                spans: [{ text: "Test", pen: { fc: "#FEFEFE", fo: 254, bo: 0, sz: 150 } }]
            }
        ]

        const xml = writeYtt(entries)
        expect(xml).toContain('sz="150"')
    })

    it("writes karaoke timing on <s> elements", () => {
        const entries: YttEntry[] = [
            {
                startMs: 1000,
                durationMs: 5000,
                position: { ap: 7, ah: 50, av: 100 },
                windowStyle: { ju: 2, pd: 0, sd: 0, wfo: 0 },
                spans: [
                    { text: "First ", pen: { fc: "#FEFEFE", fo: 254, bo: 0 }, timeOffsetMs: 0 },
                    { text: "Second", pen: { fc: "#FEFEFE", fo: 254, bo: 0 }, timeOffsetMs: 500 }
                ]
            }
        ]

        const xml = writeYtt(entries)
        // First section has t=0 which should NOT be written (> 0 check)
        expect(xml).toContain('<s p="1">First </s>')
        // Second section has t=500
        expect(xml).toContain('<s p="1" t="500">Second</s>')
    })

    it("clamps start time to 1ms (Android workaround) and adjusts duration", () => {
        const entries: YttEntry[] = [
            {
                startMs: 0,
                durationMs: 5000,
                position: { ap: 7, ah: 50, av: 100 },
                windowStyle: { ju: 2, pd: 0, sd: 0, wfo: 0 },
                spans: [{ text: "Test", pen: { fc: "#FEFEFE", fo: 254, bo: 0 } }]
            }
        ]

        const xml = writeYtt(entries)
        expect(xml).toContain('t="1"')
        expect(xml).toContain('d="4999"')
    })

    it("always writes p= on every <s> in a multi-span paragraph and inserts a zero-width space after the first span", () => {
        const entries: YttEntry[] = [
            {
                startMs: 1000,
                durationMs: 2000,
                position: { ap: 7, ah: 50, av: 100 },
                windowStyle: { ju: 2, wfo: 0 },
                spans: [
                    { text: "Same", pen: { fc: "#FEFEFE", fo: 254, bo: 0 } },
                    { text: "Pen", pen: { fc: "#FEFEFE", fo: 254, bo: 0 } },
                    { text: "Different", pen: { fc: "#FF0000", fo: 254, bo: 0 } }
                ]
            }
        ]

        const xml = writeYtt(entries)
        // <p> itself must NOT carry a pen id when there's more than one span
        expect(xml).toContain('<p t="1000" d="2000" wp="1" ws="1">')
        // every <s>, including the first (whose pen matches the paragraph's base pen), gets an explicit p=
        expect(xml).toContain('<s p="1">Same</s>\u200B<s p="1">Pen</s><s p="2">Different</s>')
    })

    it("keeps p= on <p> and skips <s> wrapping for a single untimed span", () => {
        const entries: YttEntry[] = [
            {
                startMs: 1000,
                durationMs: 2000,
                position: { ap: 7, ah: 50, av: 100 },
                windowStyle: { ju: 2, wfo: 0 },
                spans: [{ text: "Solo", pen: { fc: "#FEFEFE", fo: 254, bo: 0 } }]
            }
        ]

        const xml = writeYtt(entries)
        expect(xml).toContain('<p t="1000" d="2000" p="1" wp="1" ws="1">Solo</p>')
        expect(xml).not.toContain("<s ")
    })
})
