/**
 * Timecode formatting utilities for subtitle exports.
 * Supports standard Milliseconds (HH:MM:SS.mmm) and SMPTE timecode (HH:MM:SS:FF).
 */

export type TimecodeFormat = "time" | "smpte"

/**
 * Format milliseconds into a timecode string.
 *
 * - "time": Standard HH:MM:SS.mmm (hours, minutes, seconds, milliseconds)
 * - "smpte": SMPTE standard HH:MM:SS:FF (hours, minutes, seconds, frames)
 *
 * @param ms Milliseconds to format (clamped to >= 0)
 * @param format "time" (default) or "smpte"
 * @param fps Frame rate for frame calculation in SMPTE mode (default: 23.976023976)
 */
export function formatTimecode(ms: number, format: TimecodeFormat = "time", fps: number = 23.976023976): string {
    // Clamp negatives and round fractional ms
    ms = Math.max(0, Math.round(ms))
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (format === "smpte") {
        const remainderMs = ms % 1000
        const validFps = Math.max(0.001, fps || 23.976023976)
        const maxFrames = Math.max(1, Math.round(validFps))
        let frame = Math.round((remainderMs * validFps) / 1000)
        if (frame >= maxFrames) {
            frame = maxFrames - 1
        }
        if (frame < 0) {
            frame = 0
        }
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(frame).padStart(2, "0")}`
    }

    const milliseconds = ms % 1000
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`
}
