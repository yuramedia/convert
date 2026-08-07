import { describe, it, expect } from "vitest"
import { writeYtt, escapeYttText, type YttEntry } from "./ytt-writer"

describe("ytt-writer", () => {
    it("escapes special XML characters", () => {
        expect(escapeYttText("Fish & Chips <Tom & 'Jerry'>")).toBe(
            "Fish &amp; Chips &lt;Tom &amp; &apos;Jerry&apos;&gt;"
        )
    })

    it("serializes single-span entries into YTT XML format with dummy id=0 headers", () => {
        const entries: YttEntry[] = [
            {
                startMs: 1000,
                durationMs: 2000,
                position: { ap: 7, ah: 50, av: 100 },
                windowStyle: { ju: 2, wfo: 0 },
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
        expect(xml).toContain('<wp id="0" ap="7" ah="0" av="0"/>')
        expect(xml).toContain('<ws id="0" wfo="0" ju="2"/>')
        expect(xml).toContain('<pen id="0" fc="#000000" fo="0" bo="0"/>')
        expect(xml).toContain('<p t="1000" d="2000" wp="1" ws="1" p="1">Hello World</p>')
    })

    it("deduplicates identical pens, positions, and window styles", () => {
        const entries: YttEntry[] = [
            {
                startMs: 1000,
                durationMs: 2000,
                position: { ap: 7, ah: 50, av: 100 },
                windowStyle: { ju: 2, wfo: 0 },
                spans: [{ text: "Line 1", pen: { fc: "#FEFEFE", fo: 254, bo: 0 } }]
            },
            {
                startMs: 4000,
                durationMs: 2000,
                position: { ap: 7, ah: 50, av: 100 },
                windowStyle: { ju: 2, wfo: 0 },
                spans: [{ text: "Line 2", pen: { fc: "#FEFEFE", fo: 254, bo: 0 } }]
            }
        ]

        const xml = writeYtt(entries)
        expect(xml).toContain('<p t="1000" d="2000" wp="1" ws="1" p="1">Line 1</p>')
        expect(xml).toContain('<p t="4000" d="2000" wp="1" ws="1" p="1">Line 2</p>')
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
        expect(xml).toContain('<p t="1000" d="2000" wp="1" ws="1" p="1">Solo</p>')
        expect(xml).not.toContain("<s ")
    })
})
