"use client"

import { useCallback, useRef, useState } from "react"
import { Upload, FileText, X, AlertCircle, CheckCircle2, Loader2, ArrowRight } from "lucide-react"
import { type AssTrack } from "@/lib/ass-parser"
import { type SpreadsheetPreview } from "@/lib/spreadsheet-parser"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export interface QueuedFile {
    id: string
    name: string
    size: number
    type: "subtitle" | "spreadsheet"
    spreadsheetPreview?: SpreadsheetPreview
    spreadsheetBuffer?: ArrayBuffer
    track: AssTrack | null
    outputContent: string
    xlsxData?: Record<string, string | number>[]
    xlsxBuffer?: Uint8Array | null
    status: "pending_mapping" | "ready" | "converting" | "converted" | "error"
    error?: string
}

interface FileDropzoneProps {
    files: QueuedFile[]
    onFilesAdded: (newFiles: QueuedFile[]) => void
    onRemoveFile: (id: string) => void
    onMapFile: (id: string) => void
    onClear: () => void
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

export default function FileDropzone({ files, onFilesAdded, onRemoveFile, onMapFile, onClear }: FileDropzoneProps) {
    const [isDragOver, setIsDragOver] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFiles = useCallback(
        async (fileList: File[]) => {
            setIsLoading(true)
            const newFiles: QueuedFile[] = []

            for (const file of fileList) {
                const isSpreadsheet = !!file.name.match(/\.(csv|tsv|xlsx|xls|txt)$/i)
                const isSubtitle = !!file.name.match(/\.(ass|ssa)$/i)

                if (!isSpreadsheet && !isSubtitle) {
                    alert(`File "${file.name}" is not supported. Please select .ass, .ssa, .csv, .tsv, .xlsx, or .xls.`)
                    continue
                }

                try {
                    const id = Math.random().toString(36).substring(2, 9)
                    if (isSubtitle) {
                        const text = await file.text()
                        const { parseAss } = await import("@/lib/ass-parser")
                        const track = parseAss(text)
                        newFiles.push({
                            id,
                            name: file.name,
                            size: file.size,
                            type: "subtitle",
                            track,
                            status: "ready",
                            outputContent: ""
                        })
                    } else {
                        const buffer = await file.arrayBuffer()
                        const { getSpreadsheetPreview } = await import("@/lib/spreadsheet-parser")
                        const preview = getSpreadsheetPreview(buffer)
                        newFiles.push({
                            id,
                            name: file.name,
                            size: file.size,
                            type: "spreadsheet",
                            spreadsheetPreview: preview,
                            spreadsheetBuffer: buffer,
                            track: null,
                            status: "pending_mapping",
                            outputContent: ""
                        })
                    }
                } catch (err) {
                    console.error(`Failed to parse file ${file.name}:`, err)
                    alert(`Failed to parse file "${file.name}". Please verify it is a valid format.`)
                }
            }

            if (newFiles.length > 0) {
                onFilesAdded(newFiles)
            }
            setIsLoading(false)
        },
        [onFilesAdded]
    )

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            setIsDragOver(false)
            const droppedFiles = Array.from(e.dataTransfer.files)
            if (droppedFiles.length > 0) handleFiles(droppedFiles)
        },
        [handleFiles]
    )

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }, [])

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false)
    }, [])

    const handleClick = useCallback(() => {
        inputRef.current?.click()
    }, [])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            inputRef.current?.click()
        }
    }, [])

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const selectedFiles = e.target.files ? Array.from(e.target.files) : []
            if (selectedFiles.length > 0) handleFiles(selectedFiles)
            e.target.value = ""
        },
        [handleFiles]
    )

    const dropzoneLabel =
        files.length > 0 ? "Add more subtitle or spreadsheet files" : "Upload subtitle or spreadsheet files"

    return (
        <div className="flex flex-col gap-4">
            {/* aria-live region announces conversion status changes to screen readers */}
            <div aria-live="polite" aria-atomic="false" className="sr-only">
                {isLoading ? "Parsing files…" : ""}
            </div>

            <button
                type="button"
                role="region"
                aria-label={dropzoneLabel}
                aria-describedby="dropzone-hint"
                aria-busy={isLoading}
                className={`w-full border-2 border-dashed rounded-xl transition-all duration-300 group ${
                    files.length > 0 ? "p-6" : "p-12"
                } ${
                    isDragOver
                        ? "border-blue-600 bg-blue-600/5"
                        : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900"
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".ass,.ssa,.csv,.tsv,.xlsx,.xls,.txt"
                    className="hidden"
                    multiple
                    onChange={handleInputChange}
                    tabIndex={-1}
                    aria-hidden="true"
                />
                {isLoading ? (
                    <div className="flex flex-col items-center gap-3" role="status">
                        <div
                            className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
                            aria-hidden="true"
                        />
                        <p className="text-xs font-bold uppercase tracking-widest text-blue-500">Parsing...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <div
                            className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:scale-105 transition-transform"
                            aria-hidden="true"
                        >
                            <Upload size={20} className="text-zinc-500 group-hover:text-blue-500 transition-colors" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-sm font-bold text-zinc-300">
                                {files.length > 0 ? "Add More Files" : "Upload Subtitle or Spreadsheet Files"}
                            </p>
                            <p id="dropzone-hint" className="text-xs text-zinc-500">
                                Drag and drop .ass, .ssa, .csv, .tsv, .xlsx, or .xls here
                            </p>
                        </div>
                    </div>
                )}
            </button>

            {files.length > 0 ? (
                <Card
                    className="p-4 bg-zinc-950 border-zinc-800 animate-in fade-in duration-300"
                    role="region"
                    aria-label={`Uploaded files (${files.length})`}
                >
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-900">
                        <span
                            className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                            aria-hidden="true"
                        >
                            Uploaded Files ({files.length})
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] h-6 px-2 text-zinc-500 hover:text-zinc-300 uppercase tracking-wider font-bold"
                            onClick={onClear}
                            aria-label="Clear all uploaded files"
                        >
                            Clear All
                        </Button>
                    </div>
                    <ul className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1" aria-label="File list">
                        {files.map(file => (
                            <li key={file.id}>
                                <FileRow
                                    file={file}
                                    onRemove={() => onRemoveFile(file.id)}
                                    onMap={() => onMapFile(file.id)}
                                />
                            </li>
                        ))}
                    </ul>
                </Card>
            ) : null}
        </div>
    )
}

function FileRow({ file, onRemove, onMap }: { file: QueuedFile; onRemove: () => void; onMap: () => void }) {
    const ext = file.name.split(".").pop()?.toUpperCase() || "FILE"

    const statusConfig = {
        pending_mapping: {
            text: "Pending Mapping",
            class: "bg-amber-500/10 text-amber-500 border-amber-500/20",
            icon: <AlertCircle size={14} className="text-amber-500" aria-hidden="true" />
        },
        ready: {
            text: "Ready",
            class: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
            icon: <CheckCircle2 size={14} className="text-emerald-500" aria-hidden="true" />
        },
        converting: {
            text: "Converting",
            class: "bg-blue-500/10 text-blue-500 border-blue-500/20",
            icon: <Loader2 size={14} className="text-blue-500 animate-spin" aria-hidden="true" />
        },
        converted: {
            text: "Converted",
            class: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
            icon: <CheckCircle2 size={14} className="text-indigo-400" aria-hidden="true" />
        },
        error: {
            text: file.error || "Error",
            class: "bg-red-500/10 text-red-500 border-red-500/20",
            icon: <AlertCircle size={14} className="text-red-500" aria-hidden="true" />
        }
    }

    const currentStatus = statusConfig[file.status]

    return (
        <div
            className="flex items-center justify-between p-3 rounded-lg border border-zinc-900 bg-black/20 hover:bg-black/40 transition-colors"
            aria-label={`${file.name} — ${currentStatus.text}`}
        >
            <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                <div
                    className="relative shrink-0 w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center"
                    aria-hidden="true"
                >
                    <FileText size={16} className="text-zinc-400" />
                    <span className="absolute -bottom-1.5 -right-1 px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[8px] font-bold text-zinc-300">
                        {ext}
                    </span>
                </div>
                <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-zinc-200 truncate">{file.name}</p>
                    <p className="text-[10px] text-zinc-500 font-medium">
                        {formatBytes(file.size)}
                        {file.track && (
                            <span className="text-zinc-650">
                                {" · "}
                                {file.track.events.filter(e => e.type === "Dialogue").length} dialogues
                            </span>
                        )}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <Badge
                    variant="outline"
                    className={`text-[10px] font-bold px-2 py-0.5 flex items-center gap-1.5 ${currentStatus.class}`}
                    aria-label={`Status: ${currentStatus.text}`}
                >
                    {currentStatus.icon}
                    {currentStatus.text}
                </Badge>

                {file.status === "pending_mapping" && (
                    <Button
                        size="xs"
                        variant="secondary"
                        onClick={onMap}
                        aria-label={`Map columns for ${file.name}`}
                        className="h-7 px-2.5 text-[10px] font-bold text-amber-500 bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10"
                    >
                        Map Columns
                        <ArrowRight size={10} className="ml-1" aria-hidden="true" />
                    </Button>
                )}

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onRemove}
                    aria-label={`Remove ${file.name}`}
                    className="h-7 w-7 rounded-full hover:bg-zinc-900"
                >
                    <X size={14} className="text-zinc-500 hover:text-zinc-300" aria-hidden="true" />
                </Button>
            </div>
        </div>
    )
}
