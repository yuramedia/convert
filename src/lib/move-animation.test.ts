import { describe, it, expect } from "vitest"
import { expandMoveSnapshots } from "./move-animation"

describe("expandMoveSnapshots", () => {
    it("produces contiguous, gapless snapshots spanning the full line duration", () => {
        const snapshots = expandMoveSnapshots(1000, 2000, 1000, 2000, 0, 0, 1920, 1080)

        expect(snapshots.length).toBeGreaterThan(1)
        for (let i = 1; i < snapshots.length; i++) {
            expect(snapshots[i].startMs).toBe(snapshots[i - 1].endMs)
        }
        expect(snapshots[snapshots.length - 1].endMs).toBe(2000)
    })

    it("starts near the line's start time, allowing for frame-boundary rounding (< 1 frame ~33.4ms)", () => {
        const snapshots = expandMoveSnapshots(1000, 2000, 1000, 2000, 0, 0, 1920, 1080)
        expect(Math.abs(snapshots[0].startMs - 1000)).toBeLessThan(34)
    })

    it("ends the animation exactly at the end coordinate", () => {
        const snapshots = expandMoveSnapshots(1000, 2000, 1000, 2000, 0, 0, 1920, 1080)
        const last = snapshots[snapshots.length - 1]
        expect(last.x).toBe(1920)
        expect(last.y).toBe(1080)
    })

    it("interpolates monotonically from start to end coordinate across the animated window", () => {
        const snapshots = expandMoveSnapshots(1000, 2000, 1000, 2000, 0, 0, 1920, 1080)
        for (let i = 1; i < snapshots.length; i++) {
            expect(snapshots[i].x).toBeGreaterThanOrEqual(snapshots[i - 1].x)
            expect(snapshots[i].y).toBeGreaterThanOrEqual(snapshots[i - 1].y)
        }
    })

    it("holds the start position statically before a delayed move window begins", () => {
        // Move only becomes active 1000ms into a 3000ms line
        const snapshots = expandMoveSnapshots(0, 3000, 1000, 2000, 10, 20, 500, 600)
        const leading = snapshots[0]
        expect(leading.startMs).toBe(0)
        expect(leading.x).toBe(10)
        expect(leading.y).toBe(20)
        // Leading snapshot ends where the animated cluster begins (frame-rounded, close to 1000ms)
        expect(Math.abs(leading.endMs - 1000)).toBeLessThan(34)
    })

    it("holds the end position statically after the move window finishes, through to line end", () => {
        const snapshots = expandMoveSnapshots(0, 3000, 0, 1000, 10, 20, 500, 600)
        const trailing = snapshots[snapshots.length - 1]
        expect(trailing.endMs).toBe(3000)
        expect(trailing.x).toBe(500)
        expect(trailing.y).toBe(600)
        // Trailing snapshot begins where the animated cluster ends (frame-rounded, close to 1000ms)
        expect(Math.abs(trailing.startMs - 1000)).toBeLessThan(34)
    })

    it("handles a move that is active for the line's entire duration with no leading/trailing statics", () => {
        // t1=0 and the animated window covers [lineStart, lineEnd) exactly
        const snapshots = expandMoveSnapshots(500, 1500, 500, 1500, 0, 0, 100, 100)
        expect(snapshots[0].x).toBeLessThanOrEqual(50) // hasn't reached the far end yet
        expect(snapshots[snapshots.length - 1].x).toBe(100)
    })
})
