"use client"

import { Copy, Download, Check, FileCode, AlertCircle, Table2, Code, Pencil } from "lucide-react"
import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { type QueuedFile } from "./file-dropzone"
import { parseSrtCues, parseSrtTimestamp } from "@/lib/srt-parser"
import { formatSrtTimestamp, writeSrt, type SrtEntry } from "@/lib/srt-writer"
import { cn } from "@/lib/utils"

interface OutputPreviewProps {
    files: QueuedFile[]
    activePreviewId: string | null
    onSelectPreview: (id: string) => void
    onDownloadAll: () => void
    onDownloadCombined?: () => void
    onUpdateOutput?: (fileId: string, newContent: string) => void
    onUpdateXlsxData?: (fileId: string, newData: Record<string, string | number>[]) => void
    outputFormat: "srt" | "ass" | "csv" | "xlsx"
}

// ─── Editable Cell Component ─────────────────────────────────────────────────

interface EditableCellProps {
    value: string
    onCommit: (newValue: string) => void
    className?: string
    isTimecode?: boolean
    multiline?: boolean
}

function EditableCell({ value, onCommit, className = "", isTimecode = false, multiline = false }: EditableCellProps) {
    const [editing, setEditing] = useState(false)
    const [editValue, setEditValue] = useState(value)
    const [modified, setModified] = useState(false)
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [editing])

    const [prevValue, setPrevValue] = useState(value)
    if (value !== prevValue) {
        setPrevValue(value)
        if (!editing) {
            setEditValue(value)
        }
    }

    const commit = useCallback(() => {
        const trimmed = editValue.trim()
        if (trimmed !== value) {
            // Validate timecode format if this is a timecode cell
            if (isTimecode) {
                const ms = parseSrtTimestamp(trimmed)
                if (ms === 0 && trimmed !== "00:00:00,000") {
                    // Invalid format — revert
                    setEditValue(value)
                    setEditing(false)
                    return
                }
            }
            onCommit(trimmed)
            setModified(true)
        }
        setEditing(false)
    }, [editValue, value, onCommit, isTimecode])

    const cancel = useCallback(() => {
        setEditValue(value)
        setEditing(false)
    }, [value])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault()
                cancel()
            } else if (e.key === "Enter" && !multiline) {
                e.preventDefault()
                commit()
            } else if (e.key === "Enter" && multiline && !e.shiftKey) {
                e.preventDefault()
                commit()
            }
        },
        [commit, cancel, multiline]
    )

    if (editing) {
        const sharedProps = {
            value: editValue,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditValue(e.target.value),
            onBlur: commit,
            onKeyDown: handleKeyDown,
            className: `w-full bg-zinc-900 border border-blue-500/50 rounded px-2 py-1 text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500/30 ${isTimecode ? "font-mono tabular-nums" : ""}`,
            autoComplete: "off" as const,
            spellCheck: false
        }

        if (multiline) {
            return (
                <td className={cn(className, "p-0")}>
                    <textarea
                        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                        {...sharedProps}
                        rows={Math.max(2, editValue.split("\n").length)}
                        className={cn(sharedProps.className, "resize-y min-h-[2rem]")}
                    />
                </td>
            )
        }

        return (
            <td className={cn(className, "p-0")}>
                <input ref={inputRef as React.RefObject<HTMLInputElement>} type="text" {...sharedProps} />
            </td>
        )
    }

    return (
        <td
            className={cn(className, "cursor-pointer group/cell relative", modified && "bg-blue-500/5")}
            onClick={() => setEditing(true)}
            title="Click to edit"
        >
            <span className={isTimecode ? "font-mono tabular-nums" : ""}>
                {value || <span className="text-zinc-700 italic">empty</span>}
            </span>
            <Pencil
                size={10}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-700 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                aria-hidden="true"
            />
        </td>
    )
}

// ─── SRT Table View ──────────────────────────────────────────────────────────

interface SrtTableEntry {
    index: number
    startMs: number
    endMs: number
    text: string
}

interface SrtTableViewProps {
    entries: SrtTableEntry[]
    onUpdate: (entries: SrtTableEntry[]) => void
}

function SrtTableView({ entries, onUpdate }: SrtTableViewProps) {
    const handleCellEdit = useCallback(
        (rowIdx: number, field: keyof SrtTableEntry, newValue: string) => {
            const updated = [...entries]
            const entry = { ...updated[rowIdx] }

            if (field === "startMs") {
                entry.startMs = parseSrtTimestamp(newValue)
            } else if (field === "endMs") {
                entry.endMs = parseSrtTimestamp(newValue)
            } else if (field === "text") {
                entry.text = newValue
            }

            updated[rowIdx] = entry
            onUpdate(updated)
        },
        [entries, onUpdate]
    )

    if (entries.length === 0) {
        return <p className="text-zinc-500 text-xs text-center py-8">No entries to display.</p>
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-zinc-900 bg-zinc-950 max-h-[450px]">
            <table className="w-full text-left border-collapse text-xs" aria-label="Editable subtitle preview">
                <caption className="sr-only">Converted subtitle data — click any cell to edit</caption>
                <thead>
                    <tr className="bg-zinc-900/50 border-b border-zinc-900 sticky top-0 z-10 backdrop-blur-md">
                        <th
                            scope="col"
                            className="p-3 font-bold text-zinc-300 uppercase tracking-wider border-r border-zinc-900 w-[50px] text-center"
                        >
                            No.
                        </th>
                        <th
                            scope="col"
                            className="p-3 font-bold text-zinc-300 uppercase tracking-wider border-r border-zinc-900 w-[140px]"
                        >
                            Timecode In
                        </th>
                        <th
                            scope="col"
                            className="p-3 font-bold text-zinc-300 uppercase tracking-wider border-r border-zinc-900 w-[140px]"
                        >
                            Timecode Out
                        </th>
                        <th scope="col" className="p-3 font-bold text-zinc-300 uppercase tracking-wider">
                            Subtitle
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map((entry, idx) => (
                        <tr
                            key={`${entry.index}-${idx}`}
                            className="border-b border-zinc-900/50 hover:bg-zinc-900/20 last:border-0 transition-colors"
                        >
                            <td className="p-3 text-zinc-600 text-center font-mono tabular-nums border-r border-zinc-900/50">
                                {entry.index}
                            </td>
                            <EditableCell
                                value={formatSrtTimestamp(entry.startMs)}
                                onCommit={v => handleCellEdit(idx, "startMs", v)}
                                className="p-3 text-zinc-400 border-r border-zinc-900/50"
                                isTimecode
                            />
                            <EditableCell
                                value={formatSrtTimestamp(entry.endMs)}
                                onCommit={v => handleCellEdit(idx, "endMs", v)}
                                className="p-3 text-zinc-400 border-r border-zinc-900/50"
                                isTimecode
                            />
                            <EditableCell
                                value={entry.text}
                                onCommit={v => handleCellEdit(idx, "text", v)}
                                className="p-3 text-zinc-400"
                                multiline
                            />
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// ─── XLSX Table View (Editable) ──────────────────────────────────────────────

interface XlsxTableViewProps {
    data: Record<string, string | number>[]
    headers: string[]
    onUpdate: (data: Record<string, string | number>[]) => void
    fileName: string
}

function XlsxTableView({ data, headers, onUpdate, fileName }: XlsxTableViewProps) {
    const handleCellEdit = useCallback(
        (rowIdx: number, header: string, newValue: string) => {
            const updated = [...data]
            updated[rowIdx] = { ...updated[rowIdx], [header]: newValue }
            onUpdate(updated)
        },
        [data, onUpdate]
    )

    return (
        <div className="overflow-x-auto rounded-lg border border-zinc-900 bg-zinc-950 max-h-[450px]">
            <table className="w-full text-left border-collapse text-xs" aria-label={`Editable preview of ${fileName}`}>
                <caption className="sr-only">
                    Converted subtitle data with {data.length} rows — click any cell to edit
                </caption>
                <thead>
                    <tr className="bg-zinc-900/50 border-b border-zinc-900 sticky top-0 z-10 backdrop-blur-md">
                        {headers.map(h => (
                            <th
                                key={h}
                                scope="col"
                                className="p-3 font-bold text-zinc-300 uppercase tracking-wider border-r border-zinc-900 last:border-0"
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, idx) => (
                        <tr
                            key={idx}
                            className="border-b border-zinc-900/50 hover:bg-zinc-900/20 last:border-0 transition-colors"
                        >
                            {headers.map(h => {
                                const isTimecodeCol = /timecode|time/i.test(h)
                                return (
                                    <EditableCell
                                        key={h}
                                        value={String(row[h] ?? "")}
                                        onCommit={v => handleCellEdit(idx, h, v)}
                                        className="p-3 text-zinc-400 border-r border-zinc-900/50 last:border-0 max-w-[300px]"
                                        isTimecode={isTimecodeCol}
                                    />
                                )
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function OutputPreview({
    files,
    activePreviewId,
    onSelectPreview,
    onDownloadAll,
    onDownloadCombined,
    onUpdateOutput,
    onUpdateXlsxData,
    outputFormat
}: OutputPreviewProps) {
    const [copied, setCopied] = useState(false)
    const [viewMode, setViewMode] = useState<"table" | "raw">("table")

    // Filter converted files
    const convertedFiles = useMemo(() => {
        return files.filter(f => f.status === "converted")
    }, [files])

    const activeFile = useMemo(() => {
        return files.find(f => f.id === activePreviewId && f.status === "converted")
    }, [files, activePreviewId])

    // Parse SRT output into entries for table view
    const srtEntries = useMemo((): SrtTableEntry[] => {
        if (!activeFile || outputFormat === "xlsx") return []
        const content = activeFile.outputContent || ""
        if (!content) return []

        // Parse using parseSrtCues for SRT format
        if (outputFormat === "srt") {
            const cues = parseSrtCues(content)
            return cues.map(c => ({
                index: c.index,
                startMs: c.startMs,
                endMs: c.endMs,
                text: c.text.replace(/\n/g, "\\N")
            }))
        }

        return []
    }, [activeFile, outputFormat])

    const { lineCount, sizeKb, displayContent, isTruncated } = useMemo(() => {
        if (!activeFile) return { lineCount: 0, sizeKb: "0.0", displayContent: "", isTruncated: false }

        if (outputFormat === "xlsx") {
            const count = activeFile.xlsxData?.length || 0
            const size = activeFile.xlsxBuffer ? (activeFile.xlsxBuffer.byteLength / 1024).toFixed(1) : "0.0"
            return {
                lineCount: count,
                sizeKb: size,
                displayContent: "",
                isTruncated: false
            }
        }

        const content = activeFile.outputContent || ""
        if (!content) return { lineCount: 0, sizeKb: "0.0", displayContent: "", isTruncated: false }

        const lines = content.split("\n")
        const count = lines.length
        const size = (new Blob([content]).size / 1024).toFixed(1)

        const MAX_DISPLAY_LINES = 1000
        const isTruncated = count > MAX_DISPLAY_LINES
        const displayContent = isTruncated ? lines.slice(0, MAX_DISPLAY_LINES).join("\n") : content

        return {
            lineCount: count,
            sizeKb: size,
            displayContent,
            isTruncated
        }
    }, [activeFile, outputFormat])

    const xlsxHeaders = useMemo(() => {
        if (!activeFile || !activeFile.xlsxData || activeFile.xlsxData.length === 0) return []
        return Object.keys(activeFile.xlsxData[0])
    }, [activeFile])

    const handleCopy = async () => {
        if (!activeFile) return
        try {
            await navigator.clipboard.writeText(activeFile.outputContent)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error("Failed to copy text", err)
        }
    }

    const handleDownload = () => {
        if (!activeFile) return
        let blob: Blob
        if (outputFormat === "xlsx" && activeFile.xlsxBuffer) {
            blob = new Blob([activeFile.xlsxBuffer as BlobPart], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            })
        } else {
            blob = new Blob([activeFile.outputContent], { type: "text/plain" })
        }

        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url

        const baseName = activeFile.name.replace(/\.[^/.]+$/, "")
        a.download = `${baseName}.${outputFormat}`

        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    // Handle SRT table edits — rebuild outputContent
    const handleSrtEntriesUpdate = useCallback(
        (updated: SrtTableEntry[]) => {
            if (!activeFile || !onUpdateOutput) return
            const srtEntries: SrtEntry[] = updated.map(e => ({
                index: e.index,
                startMs: e.startMs,
                endMs: e.endMs,
                text: e.text.replace(/\\N/g, "\n")
            }))
            const newContent = writeSrt(srtEntries)
            onUpdateOutput(activeFile.id, newContent)
        },
        [activeFile, onUpdateOutput]
    )

    // Handle XLSX data edits
    const handleXlsxDataUpdate = useCallback(
        (updated: Record<string, string | number>[]) => {
            if (!activeFile || !onUpdateXlsxData) return
            onUpdateXlsxData(activeFile.id, updated)
        },
        [activeFile, onUpdateXlsxData]
    )

    if (convertedFiles.length === 0 || !activeFile) return null

    // Determine if table view is available
    const hasTableView = outputFormat === "srt" || outputFormat === "xlsx"

    return (
        <Card
            className="overflow-hidden flex flex-col mt-8 bg-zinc-950 border-zinc-800 animate-in fade-in duration-500 shadow-xl"
            as="section"
            aria-label="Output preview"
        >
            {/* aria-live announces copy action result */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
                {copied ? "Output copied to clipboard." : ""}
            </div>

            {/* Header info */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-900/20">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <FileCode size={16} className="text-blue-500" aria-hidden="true" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-100">Output Preview</h3>
                    </div>
                    <div className="hidden sm:flex items-center gap-3" aria-hidden="true">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                            {outputFormat === "srt" && viewMode === "table"
                                ? `${srtEntries.length} rows`
                                : `${lineCount} ${outputFormat === "xlsx" ? "rows" : "lines"}`}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                            {sizeKb} KB
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Table/Raw toggle */}
                    {hasTableView && (
                        <div className="flex items-center rounded-md border border-zinc-800 overflow-hidden mr-1">
                            <button
                                onClick={() => setViewMode("table")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                    viewMode === "table"
                                        ? "bg-zinc-800 text-zinc-200"
                                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
                                }`}
                                aria-label="Table view"
                                aria-pressed={viewMode === "table"}
                            >
                                <Table2 size={12} aria-hidden="true" />
                                Table
                            </button>
                            <button
                                onClick={() => setViewMode("raw")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                    viewMode === "raw"
                                        ? "bg-zinc-800 text-zinc-200"
                                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
                                }`}
                                aria-label="Raw text view"
                                aria-pressed={viewMode === "raw"}
                            >
                                <Code size={12} aria-hidden="true" />
                                Raw
                            </button>
                        </div>
                    )}

                    {convertedFiles.length > 1 && (
                        <>
                            {outputFormat === "xlsx" && onDownloadCombined && (
                                <Button
                                    onClick={onDownloadCombined}
                                    variant="secondary"
                                    size="sm"
                                    aria-label="Download all files as a combined Excel workbook"
                                    className="h-9 px-4 text-xs font-bold rounded-md transition-all border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300"
                                >
                                    <Download size={14} aria-hidden="true" />
                                    <span className="ml-2">Download Combined Excel</span>
                                </Button>
                            )}
                            <Button
                                onClick={onDownloadAll}
                                variant="secondary"
                                size="sm"
                                aria-label={`Download all ${convertedFiles.length} converted files`}
                                className="h-9 px-4 text-xs font-bold rounded-md transition-all border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300"
                            >
                                <Download size={14} aria-hidden="true" />
                                <span className="ml-2">
                                    {outputFormat === "xlsx" ? "Download All (Zip/Individual)" : "Download All"}
                                </span>
                            </Button>
                        </>
                    )}
                    {outputFormat !== "xlsx" && (
                        <Button
                            onClick={handleCopy}
                            variant="secondary"
                            size="sm"
                            aria-label={copied ? "Copied to clipboard" : "Copy output to clipboard"}
                            className="h-9 px-4 text-xs font-bold rounded-md transition-all"
                        >
                            {copied ? (
                                <Check size={14} className="text-green-500" aria-hidden="true" />
                            ) : (
                                <Copy size={14} aria-hidden="true" />
                            )}
                            <span className="ml-2">{copied ? "Copied" : "Copy"}</span>
                        </Button>
                    )}
                    <Button
                        onClick={handleDownload}
                        variant="default"
                        size="sm"
                        aria-label={`Download ${activeFile.name} as .${outputFormat}`}
                        className="h-9 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                    >
                        <Download size={14} aria-hidden="true" />
                        <span className="ml-2">Download</span>
                    </Button>
                </div>
            </div>

            {/* Tab selector for multiple converted files */}
            {convertedFiles.length > 1 && (
                <div
                    role="tablist"
                    aria-label="Converted files"
                    className="flex gap-2 p-2 border-b border-zinc-900 bg-zinc-950/80 overflow-x-auto scrollbar-thin"
                >
                    {convertedFiles.map(f => (
                        <button
                            key={f.id}
                            role="tab"
                            aria-selected={f.id === activePreviewId}
                            onClick={() => onSelectPreview(f.id)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-colors border ${
                                f.id === activePreviewId
                                    ? "bg-zinc-800/80 text-zinc-150 border-zinc-700"
                                    : "text-zinc-500 hover:text-zinc-300 border-transparent hover:bg-zinc-900/45"
                            }`}
                        >
                            {f.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Preview content */}
            <div className="p-6 relative bg-black/40" role="tabpanel" aria-label={`Preview of ${activeFile.name}`}>
                <div className="absolute top-0 right-0 p-4 pointer-events-none opacity-20" aria-hidden="true">
                    <span className="font-mono text-[10px] font-bold text-zinc-400">{outputFormat.toUpperCase()}</span>
                </div>

                {/* XLSX Table View */}
                {outputFormat === "xlsx" && activeFile.xlsxData ? (
                    viewMode === "table" ? (
                        <XlsxTableView
                            data={activeFile.xlsxData}
                            headers={xlsxHeaders}
                            onUpdate={handleXlsxDataUpdate}
                            fileName={activeFile.name}
                        />
                    ) : (
                        <pre
                            className="font-mono text-[13px] text-zinc-300 leading-relaxed overflow-x-auto max-h-[450px] scrollbar-thin whitespace-pre"
                            aria-label="XLSX raw data"
                        >
                            {activeFile.xlsxData
                                .map(row => xlsxHeaders.map(h => String(row[h] ?? "")).join("\t"))
                                .join("\n")}
                        </pre>
                    )
                ) : outputFormat === "srt" && viewMode === "table" && srtEntries.length > 0 ? (
                    /* SRT Editable Table View */
                    <SrtTableView entries={srtEntries} onUpdate={handleSrtEntriesUpdate} />
                ) : (
                    /* Raw text fallback */
                    <pre
                        className="font-mono text-[13px] text-zinc-300 leading-relaxed overflow-x-auto max-h-[450px] scrollbar-thin whitespace-pre"
                        aria-label={`${outputFormat.toUpperCase()} output text`}
                    >
                        {displayContent}
                    </pre>
                )}

                {isTruncated && viewMode === "raw" ? (
                    <div
                        role="alert"
                        className="mt-4 p-3 bg-blue-900/20 border border-blue-900/30 rounded flex items-center gap-3"
                    >
                        <AlertCircle size={16} className="text-blue-500 shrink-0" aria-hidden="true" />
                        <p className="text-[11px] text-blue-300 font-medium uppercase tracking-wider">
                            Preview truncated for performance ({lineCount - 1000} lines hidden). Download to see full
                            content.
                        </p>
                    </div>
                ) : null}
            </div>
        </Card>
    )
}
