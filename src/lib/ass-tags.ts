/**
 * ASS Override Tag Tokenizer
 *
 * Parses override tag blocks {...} in ASS event text.
 * Follows libass/ass_parse.c conventions for tag parsing.
 */

export interface TagBlock {
    /** Raw content inside {} including backslashes */
    raw: string
    /** Individual parsed tags */
    tags: AssTag[]
}

export interface AssTag {
    /** Tag name without backslash (e.g., "pos", "b", "fscx") */
    name: string
    /** Raw value string after tag name */
    value: string
    /** Full raw text of this tag including backslash */
    raw: string
}

export interface TextSegment {
    type: "text" | "tags"
    content: string
    tags?: AssTag[]
}

// ─── Tag definitions ─────────────────────────────────────────────────────────

/** Tags that take parenthesized coordinate arguments */
const PAREN_TAGS = new Set(["pos", "move", "org", "fad", "fade", "clip", "iclip", "t"])

/** Tags that map to HTML in SRT (Subtitle Edit style) */
export const HTML_MAPPABLE_TAGS: Record<string, { on: string; off: string }> = {
    b: { on: "<b>", off: "</b>" },
    i: { on: "<i>", off: "</i>" },
    u: { on: "<u>", off: "</u>" },
    s: { on: "<s>", off: "</s>" }
}

/** Tags that involve positioning/coordinates (for resampling) */
export const POSITION_TAGS = new Set(["pos", "move", "org", "clip", "iclip"])

/** Tags that involve size values (for resampling) */
export const SIZE_TAGS = new Set(["fs", "fsp", "bord", "xbord", "ybord", "shad", "xshad", "yshad", "be", "blur"])

// ─── Tokenizer ───────────────────────────────────────────────────────────────

/**
 * Parse ASS event text into segments of text and tag blocks.
 * Handles nested braces in \t(...) and \clip(scale, drawing) correctly.
 */
export function tokenizeText(text: string): TextSegment[] {
    const segments: TextSegment[] = []
    let i = 0

    while (i < text.length) {
        if (text[i] === "{") {
            // Find matching closing brace
            const closeIdx = findClosingBrace(text, i)
            if (closeIdx < 0) {
                // Unmatched brace — treat rest as text
                segments.push({ type: "text", content: text.substring(i) })
                break
            }
            const blockContent = text.substring(i + 1, closeIdx)

            // Skip Aegisub extradata blocks {=N} — internal metadata, not renderable
            // Pattern: block content starts with '=' followed by digits/identifier
            if (/^=[^\\{}]*$/.test(blockContent)) {
                i = closeIdx + 1
                continue
            }

            const tags = parseTagBlock(blockContent)
            segments.push({
                type: "tags",
                content: text.substring(i, closeIdx + 1),
                tags
            })
            i = closeIdx + 1
        } else {
            // Regular text until next { or end
            let end = text.indexOf("{", i)
            if (end < 0) end = text.length
            const content = text.substring(i, end)
            if (content) {
                segments.push({ type: "text", content })
            }
            i = end
        }
    }

    return segments
}

/**
 * Find closing brace, handling nested parens in tags like \t(...)
 */
function findClosingBrace(text: string, openIdx: number): number {
    let depth = 0
    for (let i = openIdx; i < text.length; i++) {
        if (text[i] === "{") depth++
        else if (text[i] === "}") {
            depth--
            if (depth === 0) return i
        }
    }
    return -1
}

/**
 * Parse individual tags from a tag block content (without surrounding {})
 * Deduplicates simple override tags, keeping the last occurrence.
 */
export function parseTagBlock(content: string): AssTag[] {
    const rawTags: AssTag[] = []
    let i = 0

    while (i < content.length) {
        // Skip non-backslash content (comments inside {} are ignored by libass)
        if (content[i] !== "\\") {
            i++
            continue
        }

        // Found a tag starting with backslash
        i++ // skip the backslash
        if (i >= content.length) break

        // Extract tag name
        const tagStart = i - 1 // include the backslash
        let tagName = ""

        // Special case: \N, \n, \h are text commands, not override tags
        if (content[i] === "N" || content[i] === "n" || content[i] === "h") {
            // These are handled as text, but we still tokenize them
            tagName = content[i]
            rawTags.push({
                name: tagName,
                value: "",
                raw: content.substring(tagStart, i + 1)
            })
            i++
            continue
        }

        // Read tag name (alphabetic characters, plus digits for colors like 1c, 2c, etc.)
        while (i < content.length && /[a-zA-Z]/.test(content[i])) {
            tagName += content[i]
            i++
        }

        // Handle numbered color/alpha tags: \1c, \2c, \3c, \4c, \1a, \2a, etc.
        if (tagName === "" && i < content.length && /[1-4]/.test(content[i])) {
            tagName = content[i]
            i++
            while (i < content.length && /[a-zA-Z]/.test(content[i])) {
                tagName += content[i]
                i++
            }
        }

        if (!tagName) continue

        // Extract value
        let value = ""
        const tagNameLower = tagName.toLowerCase()

        if (PAREN_TAGS.has(tagNameLower) && i < content.length && content[i] === "(") {
            // Parenthesized value — find matching close paren
            // Handle nested parens for \t(\t(...))
            let parenDepth = 0
            const valueStart = i
            while (i < content.length) {
                if (content[i] === "(") parenDepth++
                else if (content[i] === ")") {
                    parenDepth--
                    if (parenDepth === 0) {
                        i++
                        break
                    }
                }
                i++
            }
            value = content.substring(valueStart, i)
        } else {
            // Non-paren value — read until next backslash, closing brace content end, or paren
            const valueStart = i
            while (i < content.length && content[i] !== "\\" && content[i] !== "(" && content[i] !== ")") {
                i++
            }
            value = content.substring(valueStart, i)
        }

        rawTags.push({
            name: tagName,
            value: value.trim(),
            raw: content.substring(tagStart, i)
        })
    }

    // Deduplicate override tags (keep only the last one of the same name)
    // Exclude tags that can meaningfully appear multiple times: \t, \k, \K, \kf, \ko, \N, \n, \h
    const MULTI_TAGS = new Set(["t", "k", "K", "kf", "ko", "n", "N", "h"])
    const filteredTags: AssTag[] = []
    const seen = new Map<string, number>()

    for (const tag of rawTags) {
        const nameLower = tag.name.toLowerCase()
        if (MULTI_TAGS.has(nameLower)) {
            filteredTags.push(tag)
        } else {
            if (seen.has(nameLower)) {
                const idx = seen.get(nameLower)!
                filteredTags[idx] = tag
            } else {
                seen.set(nameLower, filteredTags.length)
                filteredTags.push(tag)
            }
        }
    }

    return filteredTags
}

// ─── Tag value parsers ───────────────────────────────────────────────────────

/**
 * Parse coordinate values from \pos(x,y), \move(x1,y1,x2,y2,...), \org(x,y)
 */
export function parseCoords(value: string): number[] {
    // Remove surrounding parens
    const inner = value.replace(/^\(/, "").replace(/\)$/, "")
    return inner.split(",").map(v => parseFloat(v.trim()) || 0)
}

/**
 * Parse clip rect from \clip(x1,y1,x2,y2) or drawing from \clip(scale, drawing)
 */
export function parseClip(
    value: string
): { type: "rect"; coords: number[] } | { type: "drawing"; scale: number; commands: string } {
    const inner = value.replace(/^\(/, "").replace(/\)$/, "")
    const parts = inner.split(",").map(v => v.trim())

    if (parts.length === 4 && parts.every(p => !isNaN(Number(p)))) {
        return { type: "rect", coords: parts.map(Number) }
    }

    // Drawing clip: \clip(scale, drawing_commands)
    if (parts.length >= 2) {
        const scale = parseInt(parts[0], 10)
        if (!isNaN(scale)) {
            return { type: "drawing", scale, commands: parts.slice(1).join(",") }
        }
    }

    // Drawing clip without scale: \clip(m x y l ...) — implicit scale 1
    // Drawing commands always start with 'm' (moveto)
    if (/^\s*m\s/i.test(inner)) {
        return { type: "drawing", scale: 1, commands: inner }
    }

    // Fallback: try as rect
    return { type: "rect", coords: parts.map(p => parseFloat(p) || 0) }
}

/**
 * Format coordinates back to parenthesized string
 */
export function formatCoords(coords: number[]): string {
    return `(${coords.map(c => Math.round(c * 100) / 100).join(",")})`
}

/**
 * Check if a tag block contains drawing commands (\p1 or higher)
 */
export function hasDrawingCommand(tags: AssTag[]): boolean {
    return tags.some(t => t.name === "p" && parseInt(t.value, 10) > 0)
}

/**
 * Strip all override tag blocks from text, keeping only visible text.
 * Handles \N → newline, \n → space/newline, \h → hard space
 */
export function stripTags(textOrSegments: string | TextSegment[]): string {
    const segments = typeof textOrSegments === "string" ? tokenizeText(textOrSegments) : textOrSegments
    let result = ""
    let inDrawing = false

    for (const seg of segments) {
        if (seg.type === "tags") {
            if (seg.tags) {
                for (const tag of seg.tags) {
                    if (tag.name === "p") {
                        inDrawing = parseInt(tag.value, 10) > 0
                    }
                }
            }
        } else if (seg.type === "text" && !inDrawing) {
            result += seg.content
        }
    }

    // Process ASS text commands
    result = result.replace(/\\N/g, "\n")
    result = result.replace(/\\n/g, " ")
    result = result.replace(/\\h/g, "\u00A0")

    return result
}

/**
 * Convert ASS text to SRT with basic HTML tag mapping (Subtitle Edit style).
 * Maps \b, \i, \u, \s to HTML equivalents, strips everything else.
 */
export function convertTagsToHtml(
    textOrSegments: string | TextSegment[],
    useHtmlTags: boolean = true,
    initialStyle?: { b?: boolean; i?: boolean; u?: boolean; s?: boolean }
): string {
    const segments = typeof textOrSegments === "string" ? tokenizeText(textOrSegments) : textOrSegments
    let result = ""
    let inDrawing = false
    const openTags: string[] = []

    if (useHtmlTags && initialStyle) {
        if (initialStyle.b) {
            result += "<b>"
            openTags.push("b")
        }
        if (initialStyle.i) {
            result += "<i>"
            openTags.push("i")
        }
        if (initialStyle.u) {
            result += "<u>"
            openTags.push("u")
        }
        if (initialStyle.s) {
            result += "<s>"
            openTags.push("s")
        }
    }

    for (const seg of segments) {
        if (seg.type === "tags" && seg.tags) {
            for (const tag of seg.tags) {
                if (tag.name === "p") {
                    inDrawing = parseInt(tag.value, 10) > 0
                    continue
                }

                if (!useHtmlTags) continue

                const htmlDef = HTML_MAPPABLE_TAGS[tag.name.toLowerCase()]
                if (htmlDef) {
                    let val: number
                    if (tag.value === "") {
                        // Tags like \i, \b, \u, \s without value are treated as "on" (1)
                        val = 1
                    } else {
                        val = parseInt(tag.value, 10)
                    }

                    if (val === 1 || (tag.name.toLowerCase() === "b" && val > 1)) {
                        if (!openTags.includes(tag.name.toLowerCase())) {
                            result += htmlDef.on
                            openTags.push(tag.name.toLowerCase())
                        }
                    } else if (val === 0) {
                        const idx = openTags.lastIndexOf(tag.name.toLowerCase())
                        if (idx >= 0) {
                            result += htmlDef.off
                            openTags.splice(idx, 1)
                        }
                    }
                }
            }
        } else if (seg.type === "text" && !inDrawing) {
            result += seg.content
        }
    }

    // Close any remaining open tags
    for (let i = openTags.length - 1; i >= 0; i--) {
        const htmlDef = HTML_MAPPABLE_TAGS[openTags[i]]
        if (htmlDef) result += htmlDef.off
    }

    // Process ASS text commands
    result = result.replace(/\\N/g, "\n")
    result = result.replace(/\\n/g, " ")
    result = result.replace(/\\h/g, "\u00A0")

    // Clean up empty HTML tags (only if they were generated, e.g. in convertTagsToHtml)
    let finalResult = result
    while (/<(b|i|u|s)><\/\1>/.test(finalResult)) {
        finalResult = finalResult.replace(/<(b|i|u|s)><\/\1>/g, "")
    }

    return finalResult
}
