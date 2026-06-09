import * as XLSX from "xlsx-js-style"
import { type AssTrack } from "../ass-parser"
import { convertTagsToHtml, stripTags, tokenizeText } from "../ass-tags"
import { isLikelySign } from "./normal-srt"

export interface XlsxExportOptions {
    useHtmlTags: boolean
    stripSigns?: boolean
    showIndex: boolean
    showStart: boolean
    showEnd: boolean
    showDuration: boolean
    showActor: boolean
    showStyle: boolean
    showLayer: boolean
    showText: boolean
    combinedMode?: "sheets" | "single"
}

export const DEFAULT_XLSX_OPTIONS: Required<XlsxExportOptions> = {
    useHtmlTags: true,
    stripSigns: false,
    showIndex: true,
    showStart: true,
    showEnd: true,
    showDuration: true,
    showActor: true,
    showStyle: false,
    showLayer: false,
    showText: true,
    combinedMode: "sheets"
}

function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const milliseconds = ms % 1000

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`
}

export interface XlsxRow {
    [key: string]: string | number
}

export function convertToXlsxData(track: AssTrack, options: XlsxExportOptions = DEFAULT_XLSX_OPTIONS): XlsxRow[] {
    const fullOptions = { ...DEFAULT_XLSX_OPTIONS, ...options }
    const styleMap = new Map(track.styles.map(s => [s.Name, s]))

    const rows: XlsxRow[] = []
    let index = 1

    for (const event of track.events) {
        if (event.type !== "Dialogue") continue

        const segments = tokenizeText(event.Text)
        const style = styleMap.get(event.Style)
        const isSign = isLikelySign(segments, style)

        if (fullOptions.stripSigns && isSign) continue

        let text: string
        if (fullOptions.useHtmlTags) {
            text = convertTagsToHtml(segments, true, {
                i: style?.Italic,
                u: style?.Underline,
                s: style?.StrikeOut
            })
        } else {
            text = stripTags(segments)
        }

        text = text.trim()
        if (!text) continue

        const row: XlsxRow = {}

        if (fullOptions.showIndex) row["No."] = index
        if (fullOptions.showStart) row["Timecode In"] = formatTime(event.Start)
        if (fullOptions.showEnd) row["Timecode Out"] = formatTime(event.End)
        if (fullOptions.showDuration) row["Duration"] = formatTime(event.End - event.Start)
        if (fullOptions.showActor) row["Name"] = event.Name
        if (fullOptions.showStyle) row["Style"] = event.Style
        if (fullOptions.showLayer) row["Layer"] = event.Layer
        if (fullOptions.showText) row["Subtitle"] = text

        rows.push(row)
        index++
    }

    return rows
}

export function convertToXlsxJson(track: AssTrack, options: XlsxExportOptions = DEFAULT_XLSX_OPTIONS): string {
    const rows = convertToXlsxData(track, options)
    return JSON.stringify(rows, null, 2)
}

export function buildStyledWorksheet(
    _titleText: string,
    filesData: { name: string; data: Record<string, string | number>[] }[]
): XLSX.WorkSheet {
    const aoa: unknown[][] = []
    const merges: XLSX.Range[] = []
    const rowsHeight: { hpt: number }[] = []
    const usedNames = new Set<string>()

    // Determine the maximum number of columns across all files
    let maxCols = 0
    for (const file of filesData) {
        if (file.data.length > 0) {
            maxCols = Math.max(maxCols, Object.keys(file.data[0]).length)
        }
    }
    if (maxCols === 0) {
        maxCols = 5
    }

    // 1. Title Row (Row 0)
    const titleLine = ""

    const titleStyle = {
        fill: { fgColor: { rgb: "4472C4" } },
        font: { name: "Calibri", sz: 16, bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true }
    }

    const titleCells = []
    for (let c = 0; c < maxCols; c++) {
        titleCells.push({ v: c === 0 ? titleLine : "", t: "s", s: titleStyle })
    }
    aoa.push(titleCells)
    merges.push({ s: { c: 0, r: 0 }, e: { c: maxCols - 1, r: 0 } })
    rowsHeight.push({ hpt: 71.25 })

    // 2. Blank Row (Row 1)
    const blankRow = []
    for (let c = 0; c < maxCols; c++) {
        blankRow.push({ v: "", t: "s" })
    }
    aoa.push(blankRow)
    rowsHeight.push({ hpt: 15 })

    // Styles for headers, markers, cells
    const markerStyle = {
        fill: { fgColor: { rgb: "4472C4" } },
        font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "left", vertical: "center" }
    }

    const headerStyle = {
        fill: { fgColor: { rgb: "C0C0C0" } },
        font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "000000" } },
        alignment: { horizontal: "left", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "A6A6A6" } },
            bottom: { style: "thin", color: { rgb: "A6A6A6" } },
            left: { style: "thin", color: { rgb: "A6A6A6" } },
            right: { style: "thin", color: { rgb: "A6A6A6" } }
        }
    }

    const cellStyle = {
        font: { name: "Calibri", sz: 11, color: { rgb: "000000" } },
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        border: {
            top: { style: "thin", color: { rgb: "D9D9D9" } },
            bottom: { style: "thin", color: { rgb: "D9D9D9" } },
            left: { style: "thin", color: { rgb: "D9D9D9" } },
            right: { style: "thin", color: { rgb: "D9D9D9" } }
        }
    }

    const centerCellStyle = {
        ...cellStyle,
        alignment: { horizontal: "center", vertical: "center" }
    }

    // Keep track of all headers so we can set column widths later
    let finalHeaders: string[] = []

    // 3. Render Files/Episodes
    filesData.forEach((file, index) => {
        const episodeName = cleanSheetName(file.name, index, usedNames)

        // Episode Marker Row
        const markerCells = []
        for (let c = 0; c < maxCols; c++) {
            markerCells.push({ v: c === 0 ? episodeName : "", t: "s", s: markerStyle })
        }
        aoa.push(markerCells)
        rowsHeight.push({ hpt: 24 })

        if (file.data.length > 0) {
            const headers = Object.keys(file.data[0])
            if (headers.length > finalHeaders.length) {
                finalHeaders = headers
            }

            // Header Row
            const headerCells = headers.map(h => ({ v: h, t: "s", s: headerStyle }))
            // Pad to maxCols if necessary
            while (headerCells.length < maxCols) {
                headerCells.push({ v: "", t: "s", s: headerStyle })
            }
            aoa.push(headerCells)
            rowsHeight.push({ hpt: 24 })

            // Data Rows
            file.data.forEach(row => {
                const dataCells = headers.map(key => {
                    const val = row[key] !== undefined ? row[key] : ""
                    const isNum = typeof val === "number"
                    // Center align Index/No. and Timecodes
                    const isCenter =
                        key === "No." ||
                        key.toLowerCase().includes("timecode") ||
                        key.toLowerCase() === "start" ||
                        key.toLowerCase() === "end" ||
                        key.toLowerCase() === "duration"
                    const style = isCenter ? centerCellStyle : cellStyle
                    return { v: val, t: isNum ? "n" : "s", s: style }
                })
                // Pad to maxCols
                while (dataCells.length < maxCols) {
                    dataCells.push({ v: "", t: "s", s: cellStyle })
                }
                aoa.push(dataCells)
                rowsHeight.push({ hpt: 30 })
            })
        }

        // Add blank row at the end of each episode (except the last one in single mode)
        if (index < filesData.length - 1) {
            const spaceRow = []
            for (let c = 0; c < maxCols; c++) {
                spaceRow.push({ v: "", t: "s" })
            }
            aoa.push(spaceRow)
            rowsHeight.push({ hpt: 15 })
        }
    })

    const worksheet = XLSX.utils.aoa_to_sheet(aoa)
    worksheet["!merges"] = merges
    worksheet["!rows"] = rowsHeight

    // Column widths
    const colsWidth: XLSX.ColInfo[] = []
    for (let c = 0; c < maxCols; c++) {
        const header = finalHeaders[c] || ""
        const headerLower = header.toLowerCase()

        if (header === "No." || headerLower === "layer") {
            colsWidth.push({ wch: 10 })
        } else if (
            headerLower.includes("timecode") ||
            headerLower === "start" ||
            headerLower === "end" ||
            headerLower === "duration"
        ) {
            colsWidth.push({ wch: 15 })
        } else if (headerLower === "name" || headerLower === "actor" || headerLower === "style") {
            colsWidth.push({ wch: 25 })
        } else if (headerLower === "subtitle" || headerLower.includes("script") || headerLower.includes("text")) {
            colsWidth.push({ wch: 50 })
        } else {
            colsWidth.push({ wch: 15 })
        }
    }
    worksheet["!cols"] = colsWidth

    // Enable gridlines
    worksheet["!views"] = [{ showGridLines: true }]

    return worksheet
}

export function convertToXlsxBuffer(
    track: AssTrack,
    options: XlsxExportOptions = DEFAULT_XLSX_OPTIONS,
    fileName?: string
): Uint8Array {
    const rows = convertToXlsxData(track, options)
    const titleText = fileName ? fileName.replace(/\.[^/.]+$/, "") : "Subtitles"

    const workbook = XLSX.utils.book_new()
    const worksheet = buildStyledWorksheet(titleText, [{ name: titleText, data: rows }])
    XLSX.utils.book_append_sheet(workbook, worksheet, "Subtitles")

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    return new Uint8Array(excelBuffer)
}

export function cleanSheetName(name: string, index: number, usedNames: Set<string>): string {
    // Strip file extension first
    const baseName = name.replace(/\.[^/.]+$/, "")

    // Clean invalid characters: \ / ? * [ ] :
    let clean = baseName.replace(/[\\/?*[\]:]/g, "")
    // Collapse consecutive spaces
    clean = clean.replace(/\s+/g, " ").trim()

    // Excel sheet name limit is 31 chars
    if (clean.length > 30) {
        clean = clean.substring(0, 30)
    }

    if (!clean) {
        clean = `Sheet_${index + 1}`
    }

    // Resolve duplicates
    let uniqueName = clean
    let counter = 1
    while (usedNames.has(uniqueName.toLowerCase())) {
        const suffix = `_${counter}`
        const maxLen = 31 - suffix.length
        uniqueName = clean.substring(0, maxLen) + suffix
        counter++
    }

    usedNames.add(uniqueName.toLowerCase())
    return uniqueName
}

export function createCombinedXlsxBuffer(
    filesData: { name: string; data: Record<string, string | number>[] }[],
    combinedMode: "sheets" | "single" = "sheets"
): Uint8Array {
    const workbook = XLSX.utils.book_new()
    const usedNames = new Set<string>()

    if (combinedMode === "single") {
        const firstBaseName = filesData[0].name.replace(/\.[^/.]+$/, "")
        let baseTitle = firstBaseName
        const epIndex = baseTitle.lastIndexOf(" - EP")
        if (epIndex !== -1) {
            baseTitle = baseTitle.substring(0, epIndex)
        }
        const worksheet = buildStyledWorksheet(baseTitle, filesData)
        XLSX.utils.book_append_sheet(workbook, worksheet, "Subtitles")
    } else {
        filesData.forEach((file, index) => {
            const sheetName = cleanSheetName(file.name, index, usedNames)
            const worksheet = buildStyledWorksheet(sheetName, [{ name: sheetName, data: file.data }])
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
        })
    }

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    return new Uint8Array(excelBuffer)
}

export function regenerateXlsxBuffer(xlsxData: Record<string, string | number>[], fileName?: string): Uint8Array {
    const titleText = fileName ? fileName.replace(/\.[^/.]+$/, "") : "Subtitles"

    const workbook = XLSX.utils.book_new()
    const worksheet = buildStyledWorksheet(titleText, [{ name: titleText, data: xlsxData }])
    XLSX.utils.book_append_sheet(workbook, worksheet, "Subtitles")

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    return new Uint8Array(excelBuffer)
}
