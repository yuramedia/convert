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
})
