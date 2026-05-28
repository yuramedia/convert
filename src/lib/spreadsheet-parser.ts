import * as XLSX from "xlsx"
import { type AssTrack, type AssEvent, type AssStyle } from "./ass-parser"

export interface ColumnMapping {
    start: number // -1 if none
    end: number // -1 if none
    duration: number // -1 if none
    text: number // -1 if none
    style: number // -1 if none
    actor: number // -1 if none
    layer: number // -1 if none
}

export interface SpreadsheetPreview {
    headers: string[]
    rows: string[][]
    autoMapping: ColumnMapping
}

export function autoDetectColumns(headers: string[]): ColumnMapping {
    const mapping: ColumnMapping = {
        start: -1,
        end: -1,
        duration: -1,
        text: -1,
        style: -1,
        actor: -1,
        layer: -1
    }

    const lowerHeaders = headers.map(h =>
        String(h)
            .toLowerCase()
            .trim()
            .replace(/[\s_-]/g, "")
    )

    for (let i = 0; i < lowerHeaders.length; i++) {
        const h = lowerHeaders[i]

        // Start Time detection
        if (
            mapping.start === -1 &&
            (h === "in" ||
                h === "from" ||
                h.includes("start") ||
                h.includes("timecode") ||
                h.includes("inpoint") ||
                h.includes("timein"))
        ) {
            mapping.start = i
        }
        // End Time detection
        else if (
            mapping.end === -1 &&
            (h === "out" || h === "to" || h.includes("end") || h.includes("outpoint") || h.includes("timeout"))
        ) {
            mapping.end = i
        }
        // Duration detection
        else if (mapping.duration === -1 && (h === "dur" || h.includes("duration") || h.includes("length"))) {
            mapping.duration = i
        }
        // Text/Subtitle detection
        else if (
            mapping.text === -1 &&
            (h === "sub" ||
                h.includes("text") ||
                h.includes("subtitle") ||
                h.includes("dialogue") ||
                h.includes("content") ||
                h.includes("translation") ||
                h.includes("body") ||
                h.includes("sentence"))
        ) {
            mapping.text = i
        }
        // Style detection
        else if (
            mapping.style === -1 &&
            (h === "style" || h === "font" || h.includes("style") || h.includes("fontname"))
        ) {
            mapping.style = i
        }
        // Actor/Speaker detection
        else if (
            mapping.actor === -1 &&
            (h === "char" ||
                h === "who" ||
                h.includes("actor") ||
                h.includes("character") ||
                h.includes("speaker") ||
                h.includes("name"))
        ) {
            mapping.actor = i
        }
        // Layer detection
        else if (mapping.layer === -1 && (h === "layer" || h.includes("level"))) {
            mapping.layer = i
        }
    }

    // Fallback detection if headers didn't match perfectly
    if (mapping.text === -1) {
        mapping.text = headers.length > 2 ? 2 : headers.length - 1
    }
    if (mapping.start === -1) {
        mapping.start = mapping.text === 0 && headers.length > 1 ? 1 : 0
    }
    if (mapping.end === -1 && mapping.duration === -1) {
        for (let idx = 0; idx < headers.length; idx++) {
            if (idx !== mapping.start && idx !== mapping.text) {
                mapping.end = idx
                break
            }
        }
    }

    return mapping
}

export function parseSpreadsheetTimestamp(value: any, fps: number = 23.976): number {
    if (value === null || value === undefined) return 0

    // Heuristics for numbers
    if (typeof value === "number") {
        if (value > 0 && value < 1.0) {
            // Excel fractional day (e.g. 0.0001157 is 10s)
            return Math.round(value * 86400000)
        }
        if (value >= 1.0) {
            // Check if milliseconds (usually >= 100000 for non-zero timestamps)
            if (Number.isInteger(value) && value > 100000) {
                return value
            }
            // Otherwise treat as seconds
            return Math.round(value * 1000)
        }
        return 0
    }

    const str = String(value).trim()
    if (!str) return 0

    // Parse plain numbers in strings
    if (/^\d+(\.\d+)?$/.test(str)) {
        const num = parseFloat(str)
        return parseSpreadsheetTimestamp(num, fps)
    }

    // HH:MM:SS.mmm or HH:MM:SS,mmm
    const hmsMilliMatch = str.match(/^(-?)(\d+):(\d{2}):(\d{2})[.,](\d{2,3})$/)
    if (hmsMilliMatch) {
        const sign = hmsMilliMatch[1] === "-" ? -1 : 1
        const h = parseInt(hmsMilliMatch[2], 10)
        const m = parseInt(hmsMilliMatch[3], 10)
        const s = parseInt(hmsMilliMatch[4], 10)
        const decimalStr = hmsMilliMatch[5]
        const ms = decimalStr.length === 2 ? parseInt(decimalStr, 10) * 10 : parseInt(decimalStr, 10)
        return sign * ((h * 3600 + m * 60 + s) * 1000 + ms)
    }

    // MM:SS.mmm or MM:SS,mmm
    const msMilliMatch = str.match(/^(-?)(\d{2}):(\d{2})[.,](\d{2,3})$/)
    if (msMilliMatch) {
        const sign = msMilliMatch[1] === "-" ? -1 : 1
        const m = parseInt(msMilliMatch[2], 10)
        const s = parseInt(msMilliMatch[3], 10)
        const decimalStr = msMilliMatch[4]
        const ms = decimalStr.length === 2 ? parseInt(decimalStr, 10) * 10 : parseInt(decimalStr, 10)
        return sign * ((m * 60 + s) * 1000 + ms)
    }

    // HH:MM:SS:FF (Frames timecode)
    const framesMatch = str.match(/^(-?)(\d+):(\d{2}):(\d{2}):(\d{2})$/)
    if (framesMatch) {
        const sign = framesMatch[1] === "-" ? -1 : 1
        const h = parseInt(framesMatch[2], 10)
        const m = parseInt(framesMatch[3], 10)
        const s = parseInt(framesMatch[4], 10)
        const f = parseInt(framesMatch[5], 10)
        const msFromFrames = Math.round((f * 1000) / fps)
        return sign * ((h * 3600 + m * 60 + s) * 1000 + msFromFrames)
    }

    // HH:MM:SS
    const hmsMatch = str.match(/^(-?)(\d+):(\d{2}):(\d{2})$/)
    if (hmsMatch) {
        const sign = hmsMatch[1] === "-" ? -1 : 1
        const h = parseInt(hmsMatch[2], 10)
        const m = parseInt(hmsMatch[3], 10)
        const s = parseInt(hmsMatch[4], 10)
        return sign * (h * 3600 + m * 60 + s) * 1000
    }

    // MM:SS
    const minSecMatch = str.match(/^(-?)(\d{1,2}):(\d{2})$/)
    if (minSecMatch) {
        const sign = minSecMatch[1] === "-" ? -1 : 1
        const m = parseInt(minSecMatch[2], 10)
        const s = parseInt(minSecMatch[3], 10)
        return sign * (m * 60 + s) * 1000
    }

    return 0
}

export function getSpreadsheetPreview(arrayBuffer: ArrayBuffer): SpreadsheetPreview {
    const workbook = XLSX.read(arrayBuffer, { type: "array" })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
        throw new Error("Spreadsheet contains no sheets")
    }

    const worksheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" })

    if (rows.length === 0) {
        return { headers: [], rows: [], autoMapping: autoDetectColumns([]) }
    }

    // Extract headers (first row)
    const rawHeaders = rows[0]
    const headers = rawHeaders.map((cell, idx) => {
        const label = String(cell).trim()
        return label || `Column ${String.fromCharCode(65 + idx)}` // fallback to Column A, B, C...
    })

    // Get up to 10 rows for preview (excluding headers)
    const previewRows = rows.slice(1, 11).map(row => {
        // Ensure row array length matches headers
        const paddedRow: string[] = []
        for (let i = 0; i < headers.length; i++) {
            paddedRow.push(row[i] !== undefined ? String(row[i]) : "")
        }
        return paddedRow
    })

    const autoMapping = autoDetectColumns(headers)

    return {
        headers,
        rows: previewRows,
        autoMapping
    }
}

export function parseSpreadsheet(
    arrayBuffer: ArrayBuffer,
    mapping: ColumnMapping,
    hasHeader: boolean = true,
    fps: number = 23.976
): AssTrack {
    const workbook = XLSX.read(arrayBuffer, { type: "array" })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
        throw new Error("Spreadsheet contains no sheets")
    }

    const worksheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" })

    const startIdx = hasHeader ? 1 : 0
    const events: AssEvent[] = []
    const stylesSet = new Set<string>()

    let prevEndMs = 0

    for (let i = startIdx; i < rows.length; i++) {
        const row = rows[i]
        if (!row || row.length === 0) continue

        // Extract and parse Text (required)
        const textVal = mapping.text !== -1 && row[mapping.text] !== undefined ? String(row[mapping.text]).trim() : ""
        if (!textVal) continue // Skip empty lines

        // Extract and parse timings
        let startMs = 0
        const startVal = mapping.start !== -1 ? row[mapping.start] : undefined
        if (startVal !== undefined && startVal !== null && String(startVal).trim() !== "") {
            startMs = parseSpreadsheetTimestamp(startVal, fps)
        } else {
            startMs = prevEndMs
        }

        let endMs = 0
        const endVal = mapping.end !== -1 ? row[mapping.end] : undefined
        if (endVal !== undefined && endVal !== null && String(endVal).trim() !== "") {
            endMs = parseSpreadsheetTimestamp(endVal, fps)
        } else {
            const durVal = mapping.duration !== -1 ? row[mapping.duration] : undefined
            if (durVal !== undefined && durVal !== null && String(durVal).trim() !== "") {
                const durationMs = parseSpreadsheetTimestamp(durVal, fps)
                endMs = startMs + durationMs
            } else {
                endMs = startMs + 2000 // default 2 seconds
            }
        }

        prevEndMs = endMs

        // Style, Actor, Layer
        const styleName = mapping.style !== -1 && row[mapping.style] ? String(row[mapping.style]).trim() : "Default"
        stylesSet.add(styleName)

        const actorName = mapping.actor !== -1 && row[mapping.actor] ? String(row[mapping.actor]).trim() : ""

        let layerVal = 0
        if (mapping.layer !== -1 && row[mapping.layer] !== undefined) {
            const layerInt = parseInt(row[mapping.layer], 10)
            if (!isNaN(layerInt)) layerVal = layerInt
        }

        events.push({
            type: "Dialogue",
            Layer: layerVal,
            Start: startMs,
            End: endMs,
            Style: styleName,
            Name: actorName,
            MarginL: 0,
            MarginR: 0,
            MarginV: 0,
            Effect: "",
            Text: textVal.replace(/\r?\n/g, "\\N") // Normalize newlines to ASS format
        })
    }

    // Construct default styles list
    const styles: AssStyle[] = Array.from(stylesSet).map(name => ({
        Name: name,
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
        Alignment: 2, // center bottom
        MarginL: 10,
        MarginR: 10,
        MarginV: 10,
        Encoding: 1,
        Blur: 0,
        Justify: 0,
        _raw: {}
    }))

    if (styles.length === 0) {
        styles.push({
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
        })
    }

    return {
        scriptInfo: {
            Title: "Spreadsheet Import",
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
        styles,
        events,
        styleFormat: [
            "Name",
            "Fontname",
            "Fontsize",
            "PrimaryColour",
            "SecondaryColour",
            "OutlineColour",
            "BackColour",
            "Bold",
            "Italic",
            "Underline",
            "StrikeOut",
            "ScaleX",
            "ScaleY",
            "Spacing",
            "Angle",
            "BorderStyle",
            "Outline",
            "Shadow",
            "Alignment",
            "MarginL",
            "MarginR",
            "MarginV",
            "Encoding"
        ],
        eventFormat: ["Layer", "Start", "End", "Style", "Name", "MarginL", "MarginR", "MarginV", "Effect", "Text"],
        trackType: "ASS",
        rawSections: []
    }
}
