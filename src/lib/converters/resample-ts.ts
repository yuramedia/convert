/**
 * Mode 3: Resample TS Resolution
 *
 * Rescales typesetting coordinates/sizes from source to target resolution.
 * Inspired by arch1t3cht's Resample Perspective + Aegisub's built-in resampler.
 *
 * Scales: \pos, \move, \org, \clip, \iclip, \fs, \fsp, \bord, \shad, \be, \blur, margins
 * Output: Resampled .ass file OR .srt with preserved override tags
 */

import { type AssTrack } from "../ass-parser"
import { tokenizeText, parseClip } from "../ass-tags"
import { writeAss } from "../ass-writer"
import { convertKeepTs } from "./keep-ts"

export interface ResampleOptions {
    sourceWidth: number
    sourceHeight: number
    targetWidth: number
    targetHeight: number
    outputFormat: "ass" | "srt"
}

export const RESOLUTION_PRESETS: { label: string; width: number; height: number }[] = [
    { label: "640×360 (SD widescreen)", width: 640, height: 360 },
    { label: "640×480 (SD fullscreen)", width: 640, height: 480 },
    { label: "704×480 (SD anamorphic)", width: 704, height: 480 },
    { label: "704×396 (SD widescreen)", width: 704, height: 396 },
    { label: "640×352 (SD widescreen MOD16)", width: 640, height: 352 },
    { label: "704×400 (SD widescreen MOD16)", width: 704, height: 400 },
    { label: "1024×576 (SuperPAL widescreen)", width: 1024, height: 576 },
    { label: "1280×720 (HD 720p)", width: 1280, height: 720 },
    { label: "1920×1080 (FHD 1080p)", width: 1920, height: 1080 },
    { label: "2560×1440 (QHD 1440p)", width: 2560, height: 1440 },
    { label: "3840×2160 (4K UHD 2160p)", width: 3840, height: 2160 },
    { label: "1080×1920 (FHD vertical)", width: 1080, height: 1920 }
]

export function convertResampleTs(track: AssTrack, options: ResampleOptions): string {
    const rx = options.targetWidth / options.sourceWidth
    const ry = options.targetHeight / options.sourceHeight

    // Deep clone the track
    const resampled: AssTrack = JSON.parse(JSON.stringify(track))

    // Update PlayRes
    resampled.scriptInfo.PlayResX = options.targetWidth
    resampled.scriptInfo.PlayResY = options.targetHeight

    // Update LayoutRes if set (scale proportionally, following Aegisub's resampler behavior)
    if (resampled.scriptInfo.LayoutResX > 0) {
        resampled.scriptInfo.LayoutResX = Math.round(resampled.scriptInfo.LayoutResX * rx)
    }
    if (resampled.scriptInfo.LayoutResY > 0) {
        resampled.scriptInfo.LayoutResY = Math.round(resampled.scriptInfo.LayoutResY * ry)
    }

    // Resample styles
    for (const style of resampled.styles) {
        style.FontSize = round(style.FontSize * ry)
        style.Spacing = round(style.Spacing * rx)
        style.Outline = round(style.Outline * Math.max(rx, ry))
        style.Shadow = round(style.Shadow * Math.max(rx, ry))
        style.MarginL = Math.round(style.MarginL * rx)
        style.MarginR = Math.round(style.MarginR * rx)
        style.MarginV = Math.round(style.MarginV * ry)

        // Update raw values for lossless roundtrip
        if (style._raw) {
            if (style._raw["Fontsize"] || style._raw["FontSize"])
                style._raw[style._raw["Fontsize"] !== undefined ? "Fontsize" : "FontSize"] = String(style.FontSize)
            if (style._raw["Spacing"] !== undefined) style._raw["Spacing"] = String(style.Spacing)
            if (style._raw["Outline"] !== undefined) style._raw["Outline"] = String(style.Outline)
            if (style._raw["Shadow"] !== undefined) style._raw["Shadow"] = String(style.Shadow)
            if (style._raw["MarginL"] !== undefined) style._raw["MarginL"] = String(style.MarginL)
            if (style._raw["MarginR"] !== undefined) style._raw["MarginR"] = String(style.MarginR)
            if (style._raw["MarginV"] !== undefined) style._raw["MarginV"] = String(style.MarginV)
        }
    }

    // Resample events
    for (const event of resampled.events) {
        // Scale margins
        event.MarginL = Math.round(event.MarginL * rx)
        event.MarginR = Math.round(event.MarginR * rx)
        event.MarginV = Math.round(event.MarginV * ry)

        // Scale override tags in text
        event.Text = resampleEventText(event.Text, rx, ry)

        // Update raw
        if (event._raw) {
            if (event._raw["MarginL"] !== undefined) event._raw["MarginL"] = String(event.MarginL).padStart(4, "0")
            if (event._raw["MarginR"] !== undefined) event._raw["MarginR"] = String(event.MarginR).padStart(4, "0")
            if (event._raw["MarginV"] !== undefined) event._raw["MarginV"] = String(event.MarginV).padStart(4, "0")
        }
    }

    if (options.outputFormat === "ass") {
        return writeAss(resampled)
    } else {
        return convertKeepTs(resampled)
    }
}

/**
 * Resample all override tags within event text
 */
function resampleEventText(text: string, rx: number, ry: number): string {
    const segments = tokenizeText(text)
    let result = ""
    let inDrawing = false

    for (const seg of segments) {
        if (seg.type === "tags") {
            result += resampleTagBlock(seg.content, rx, ry)

            // Track drawing state from \p tag
            if (seg.tags) {
                for (const tag of seg.tags) {
                    if (tag.name.toLowerCase() === "p") {
                        inDrawing = parseInt(tag.value, 10) > 0
                    }
                }
            }
        } else if (inDrawing) {
            // Scale drawing coordinates in text segments
            result += resampleDrawingCommands(seg.content, rx, ry)
        } else {
            result += seg.content
        }
    }

    return result
}

/**
 * Resample tags within a single {} block
 */
function resampleTagBlock(block: string, rx: number, ry: number): string {
    // Remove surrounding braces
    const inner = block.slice(1, -1)
    let result = ""
    let i = 0

    while (i < inner.length) {
        if (inner[i] !== "\\") {
            result += inner[i]
            i++
            continue
        }

        // Find the full tag
        const tagStart = i
        i++ // skip backslash

        // Read tag name
        let tagName = ""

        // Handle numbered tags: \1c, \2c, etc.
        if (i < inner.length && /[1-4]/.test(inner[i])) {
            tagName = inner[i]
            i++
        }

        while (i < inner.length && /[a-zA-Z]/.test(inner[i])) {
            tagName += inner[i]
            i++
        }

        if (!tagName) {
            result += "\\"
            continue
        }

        const tagLower = tagName.toLowerCase()

        // Handle tags that need parenthesized values
        if (["pos", "move", "org", "clip", "iclip", "fad", "fade"].includes(tagLower)) {
            if (i < inner.length && inner[i] === "(") {
                const parenStart = i
                let depth = 0
                while (i < inner.length) {
                    if (inner[i] === "(") depth++
                    else if (inner[i] === ")") {
                        depth--
                        if (depth === 0) {
                            i++
                            break
                        }
                    }
                    i++
                }
                const parenContent = inner.substring(parenStart, i)

                result += "\\" + tagName + resampleParenValue(tagLower, parenContent, rx, ry)
            } else {
                result += inner.substring(tagStart, i)
            }
            continue
        }

        // Handle \t(...) — recursive resample of inner tags
        if (tagLower === "t") {
            if (i < inner.length && inner[i] === "(") {
                const parenStart = i
                let depth = 0
                while (i < inner.length) {
                    if (inner[i] === "(") depth++
                    else if (inner[i] === ")") {
                        depth--
                        if (depth === 0) {
                            i++
                            break
                        }
                    }
                    i++
                }
                const parenContent = inner.substring(parenStart + 1, i - 1)
                const resampledInner = resampleTContent(parenContent, rx, ry)
                result += "\\t(" + resampledInner + ")"
            } else {
                result += inner.substring(tagStart, i)
            }
            continue
        }

        // Handle simple value tags that need scaling
        const valueStart = i
        while (i < inner.length && inner[i] !== "\\") {
            i++
        }
        const value = inner.substring(valueStart, i)

        switch (tagLower) {
            case "fs":
                result += `\\fs${round(parseFloat(value) * ry)}`
                break
            case "fsp":
                result += `\\fsp${round(parseFloat(value) * rx)}`
                break
            case "bord":
                result += `\\bord${round(parseFloat(value) * Math.max(rx, ry))}`
                break
            case "xbord":
                result += `\\xbord${round(parseFloat(value) * rx)}`
                break
            case "ybord":
                result += `\\ybord${round(parseFloat(value) * ry)}`
                break
            case "shad":
                result += `\\shad${round(parseFloat(value) * Math.max(rx, ry))}`
                break
            case "xshad":
                result += `\\xshad${round(parseFloat(value) * rx)}`
                break
            case "yshad":
                result += `\\yshad${round(parseFloat(value) * ry)}`
                break
            case "be":
                result += `\\be${round(parseFloat(value) * Math.max(rx, ry))}`
                break
            case "blur":
                result += `\\blur${round(parseFloat(value) * Math.max(rx, ry))}`
                break
            default:
                // Non-scalable tag — pass through
                result += inner.substring(tagStart, i)
                break
        }
    }

    return `{${result}}`
}

/**
 * Resample parenthesized coordinate values
 */
function resampleParenValue(tagName: string, value: string, rx: number, ry: number): string {
    const inner = value.replace(/^\(/, "").replace(/\)$/, "")
    const parts = inner.split(",").map(s => s.trim())

    switch (tagName) {
        case "pos":
        case "org": {
            // \pos(x,y) \org(x,y)
            if (parts.length >= 2) {
                const x = round(parseFloat(parts[0]) * rx)
                const y = round(parseFloat(parts[1]) * ry)
                return `(${x},${y})`
            }
            return value
        }
        case "move": {
            // \move(x1,y1,x2,y2[,t1,t2])
            if (parts.length >= 4) {
                const x1 = round(parseFloat(parts[0]) * rx)
                const y1 = round(parseFloat(parts[1]) * ry)
                const x2 = round(parseFloat(parts[2]) * rx)
                const y2 = round(parseFloat(parts[3]) * ry)
                if (parts.length >= 6) {
                    return `(${x1},${y1},${x2},${y2},${parts[4]},${parts[5]})`
                }
                return `(${x1},${y1},${x2},${y2})`
            }
            return value
        }
        case "clip":
        case "iclip": {
            // Empty \clip() or malformed — pass through unchanged
            const clipInner = value.replace(/^\(/, "").replace(/\)$/, "").trim()
            if (!clipInner) return value

            const clip = parseClip(value)
            if (clip.type === "rect" && clip.coords.length === 4 && clip.coords.every(n => !isNaN(n))) {
                const c = clip.coords
                return `(${round(c[0] * rx)},${round(c[1] * ry)},${round(c[2] * rx)},${round(c[3] * ry)})`
            } else if (clip.type === "drawing") {
                const scaledCommands = resampleDrawingCommands(clip.commands, rx, ry)
                return `(${clip.scale},${scaledCommands})`
            }
            return value
        }
        case "fad":
        case "fade":
            // \fad(t1,t2) — time values, don't scale
            return value
        default:
            return value
    }
}

/**
 * Resample drawing commands (m, l, b, s, etc.)
 */
function resampleDrawingCommands(commands: string, rx: number, ry: number): string {
    // Drawing commands are sequences of: command letter followed by x,y coordinate pairs
    return commands.replace(
        /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g,
        (_, x, y) => `${round(parseFloat(x) * rx)} ${round(parseFloat(y) * ry)}`
    )
}

/**
 * Resample tags inside \t(...) — the inner content can contain override tags
 */
function resampleTContent(content: string, rx: number, ry: number): string {
    // \t has format: \t([t1,t2,][accel,]style_tags)
    // We need to find where the style tags start (after optional timing params)
    // and resample only those

    // Try to detect timing parameters vs style tags
    // Style tags start with \, timing params are just numbers
    const parts = content.split(",")
    let tagStartIdx = 0

    // Check if first parts are numeric (timing/accel params)
    for (let i = 0; i < parts.length; i++) {
        const trimmed = parts[i].trim()
        if (trimmed.match(/^-?\d+(\.\d+)?$/) && i < 3) {
            tagStartIdx = i + 1
        } else {
            break
        }
    }

    // Reconstruct: timing params unchanged, resample the tag part
    const timingParts = parts.slice(0, tagStartIdx)
    const tagPart = parts.slice(tagStartIdx).join(",")

    // Wrap in braces so resampleTagBlock can process it, then unwrap
    const resampledTags = resampleTagBlock(`{${tagPart}}`, rx, ry).slice(1, -1)

    if (timingParts.length > 0) {
        return timingParts.join(",") + "," + resampledTags
    }
    return resampledTags
}

function round(n: number): number {
    return Math.round(n * 100) / 100
}
