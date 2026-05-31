"use client"

import { Copy, Download, Check, FileCode, AlertCircle } from "lucide-react"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { type QueuedFile } from "./file-dropzone"

interface OutputPreviewProps {
    files: QueuedFile[]
    activePreviewId: string | null
    onSelectPreview: (id: string) => void
    onDownloadAll: () => void
    onDownloadCombined?: () => void
    outputFormat: "srt" | "ass" | "csv" | "xlsx"
}

export default function OutputPreview({
    files,
    activePreviewId,
    onSelectPreview,
    onDownloadAll,
    onDownloadCombined,
    outputFormat
}: OutputPreviewProps) {
    const [copied, setCopied] = useState(false)

    // Filter converted files
    const convertedFiles = useMemo(() => {
        return files.filter(f => f.status === "converted")
    }, [files])

    const activeFile = useMemo(() => {
        return files.find(f => f.id === activePreviewId && f.status === "converted")
    }, [files, activePreviewId])

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

    if (convertedFiles.length === 0 || !activeFile) return null

    return (
        <Card
            className="overflow-hidden flex flex-col mt-8 bg-zinc-950 border-zinc-800 animate-in fade-in duration-500 shadow-xl"
            role="region"
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
                            {lineCount} {outputFormat === "xlsx" ? "rows" : "lines"}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                            {sizeKb} KB
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
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

            {/* Preview content grid */}
            <div className="p-6 relative bg-black/40" role="tabpanel" aria-label={`Preview of ${activeFile.name}`}>
                <div className="absolute top-0 right-0 p-4 pointer-events-none opacity-20" aria-hidden="true">
                    <span className="font-mono text-[10px] font-bold text-zinc-400">{outputFormat.toUpperCase()}</span>
                </div>

                {outputFormat === "xlsx" && activeFile.xlsxData ? (
                    <div className="overflow-x-auto rounded-lg border border-zinc-900 bg-zinc-950 max-h-[450px]">
                        <table
                            className="w-full text-left border-collapse text-xs"
                            aria-label={`Preview of ${activeFile.name}`}
                        >
                            <caption className="sr-only">Converted subtitle data with {lineCount} rows</caption>
                            <thead>
                                <tr className="bg-zinc-900/50 border-b border-zinc-900 sticky top-0 backdrop-blur-md">
                                    {xlsxHeaders.map(h => (
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
                                {activeFile.xlsxData.map((row, idx) => (
                                    <tr
                                        key={idx}
                                        className="border-b border-zinc-900/50 hover:bg-zinc-900/10 last:border-0"
                                    >
                                        {xlsxHeaders.map(h => (
                                            <td
                                                key={h}
                                                className="p-3 text-zinc-400 border-r border-zinc-900/50 last:border-0 truncate max-w-[250px]"
                                            >
                                                {row[h]}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <pre
                        className="font-mono text-[13px] text-zinc-300 leading-relaxed overflow-x-auto max-h-[450px] scrollbar-thin whitespace-pre"
                        aria-label={`${outputFormat.toUpperCase()} output text`}
                        tabIndex={0}
                    >
                        {displayContent}
                    </pre>
                )}

                {isTruncated ? (
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
