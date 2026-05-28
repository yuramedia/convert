"use client"

import { Copy, Download, Check, FileCode, AlertCircle } from "lucide-react"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface OutputPreviewProps {
    content: string
    xlsxData?: any[]
    xlsxBuffer?: Uint8Array | null
    originalFileName: string
    outputFormat: "srt" | "ass" | "csv" | "xlsx"
}

export default function OutputPreview({
    content,
    xlsxData,
    xlsxBuffer,
    originalFileName,
    outputFormat
}: OutputPreviewProps) {
    const [copied, setCopied] = useState(false)

    const { lineCount, sizeKb, displayContent, isTruncated } = useMemo(() => {
        if (outputFormat === "xlsx") {
            const count = xlsxData?.length || 0
            const size = xlsxBuffer ? (xlsxBuffer.byteLength / 1024).toFixed(1) : "0.0"
            return {
                lineCount: count,
                sizeKb: size,
                displayContent: "",
                isTruncated: false
            }
        }

        if (!content) return { lineCount: 0, sizeKb: "0.0", displayContent: "", isTruncated: false }

        const lines = content.split("\n")
        const count = lines.length
        const size = (new Blob([content]).size / 1024).toFixed(1)

        // Truncate display for very large files to prevent DOM memory issues
        // 1000 lines is a safe limit for most browsers without virtualization
        const MAX_DISPLAY_LINES = 1000
        const isTruncated = count > MAX_DISPLAY_LINES
        const displayContent = isTruncated ? lines.slice(0, MAX_DISPLAY_LINES).join("\n") : content

        return {
            lineCount: count,
            sizeKb: size,
            displayContent,
            isTruncated
        }
    }, [content, xlsxData, xlsxBuffer, outputFormat])

    const xlsxHeaders = useMemo(() => {
        if (!xlsxData || xlsxData.length === 0) return []
        return Object.keys(xlsxData[0])
    }, [xlsxData])

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error("Failed to copy text", err)
        }
    }

    const handleDownload = () => {
        let blob: Blob
        if (outputFormat === "xlsx" && xlsxBuffer) {
            blob = new Blob([xlsxBuffer as any], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            })
        } else {
            blob = new Blob([content], { type: "text/plain" })
        }

        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url

        // Generate new filename
        const baseName = originalFileName.replace(/\.[^/.]+$/, "")
        a.download = `${baseName}.${outputFormat}`

        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    if (outputFormat !== "xlsx" && !content) return null
    if (outputFormat === "xlsx" && (!xlsxData || xlsxData.length === 0)) return null

    return (
        <Card className="overflow-hidden flex flex-col mt-8 bg-zinc-950 border-zinc-800 animate-in fade-in duration-500 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-900/20">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <FileCode size={16} className="text-blue-500" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-100">Output Preview</h3>
                    </div>
                    <div className="hidden sm:flex items-center gap-3">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                            {lineCount} {outputFormat === "xlsx" ? "rows" : "lines"}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                            {sizeKb} KB
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {outputFormat !== "xlsx" && (
                        <Button
                            onClick={handleCopy}
                            variant="secondary"
                            size="sm"
                            className="h-9 px-4 text-xs font-bold rounded-md transition-all"
                        >
                            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            <span className="ml-2">{copied ? "Copy" : "Copy"}</span>
                        </Button>
                    )}
                    <Button
                        onClick={handleDownload}
                        variant="default"
                        size="sm"
                        className="h-9 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                    >
                        <Download size={14} />
                        <span className="ml-2">Download</span>
                    </Button>
                </div>
            </div>

            <div className="p-6 relative bg-black/40">
                <div className="absolute top-0 right-0 p-4 pointer-events-none opacity-20">
                    <span className="font-mono text-[10px] font-bold text-zinc-400">{outputFormat.toUpperCase()}</span>
                </div>

                {outputFormat === "xlsx" && xlsxData ? (
                    <div className="overflow-x-auto rounded-lg border border-zinc-900 bg-zinc-950 max-h-[450px]">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-zinc-900/50 border-b border-zinc-900 sticky top-0 backdrop-blur-md">
                                    {xlsxHeaders.map(h => (
                                        <th
                                            key={h}
                                            className="p-3 font-bold text-zinc-300 uppercase tracking-wider border-r border-zinc-900 last:border-0"
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {xlsxData.map((row, idx) => (
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
                    <pre className="font-mono text-[13px] text-zinc-300 leading-relaxed overflow-x-auto max-h-[450px] scrollbar-thin whitespace-pre">
                        {displayContent}
                    </pre>
                )}

                {isTruncated ? (
                    <div className="mt-4 p-3 bg-blue-900/20 border border-blue-900/30 rounded flex items-center gap-3">
                        <AlertCircle size={16} className="text-blue-500 shrink-0" />
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
