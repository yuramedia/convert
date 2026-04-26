"use client"

import { Copy, Download, Check } from "lucide-react"
import { useState } from "react"

interface OutputPreviewProps {
    content: string
    originalFileName: string
    outputFormat: "srt" | "ass"
}

export default function OutputPreview({ content, originalFileName, outputFormat }: OutputPreviewProps) {
    const [copied, setCopied] = useState(false)

    const lines = content.split("\n")
    const lineCount = lines.length
    const sizeKb = (new Blob([content]).size / 1024).toFixed(1)

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
        const blob = new Blob([content], { type: "text/plain" })
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

    if (!content) return null

    return (
        <div className="glass-card fade-in overflow-hidden flex flex-col mt-6">
            <div className="flex items-center justify-between p-3 border-b border-[var(--border)] bg-black/20">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                    </div>
                    <span className="text-xs font-medium text-[var(--muted)]">Preview Output</span>
                    <span className="stat-badge ml-2">{lineCount} lines</span>
                    <span className="stat-badge">{sizeKb} KB</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleCopy} className="btn-secondary !py-1.5 !px-3" title="Copy to clipboard">
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        <span className="sr-only">Copy</span>
                    </button>
                    <button onClick={handleDownload} className="btn-primary !py-1.5 !px-4">
                        <Download className="w-4 h-4" />
                        <span>Download .{outputFormat}</span>
                    </button>
                </div>
            </div>

            <div className="p-4 preview-area">
                <pre className="whitespace-pre-wrap break-words m-0">{content}</pre>
            </div>
        </div>
    )
}
