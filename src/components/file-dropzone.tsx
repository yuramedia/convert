"use client"

import { useCallback, useRef, useState } from "react"
import { Upload, FileText, X } from "lucide-react"
import { type AssTrack } from "@/lib/ass-parser"

interface FileDropzoneProps {
    onFileLoaded: (content: string, fileName: string, track: AssTrack) => void
    parsedTrack: AssTrack | null
    fileName: string
    onClear: () => void
}

export default function FileDropzone({ onFileLoaded, parsedTrack, fileName, onClear }: FileDropzoneProps) {
    const [isDragOver, setIsDragOver] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFile = useCallback(
        async (file: File) => {
            if (!file.name.match(/\.(ass|ssa)$/i)) {
                alert("Please select an .ass or .ssa file")
                return
            }

            setIsLoading(true)
            try {
                const text = await file.text()
                const { parseAss } = await import("@/lib/ass-parser")
                const track = parseAss(text)
                onFileLoaded(text, file.name, track)
            } catch (err) {
                console.error("Failed to parse file:", err)
                alert("Failed to parse the subtitle file. Please check the format.")
            } finally {
                setIsLoading(false)
            }
        },
        [onFileLoaded]
    )

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            setIsDragOver(false)
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
        },
        [handleFile]
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

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            // Reset input value so the same file can be re-selected
            e.target.value = ""
        },
        [handleFile]
    )

    if (parsedTrack && fileName) {
        const dialogues = parsedTrack.events.filter(e => e.type === "Dialogue")
        const comments = parsedTrack.events.filter(e => e.type === "Comment")
        const playRes =
            parsedTrack.scriptInfo.PlayResX && parsedTrack.scriptInfo.PlayResY
                ? `${parsedTrack.scriptInfo.PlayResX}×${parsedTrack.scriptInfo.PlayResY}`
                : "Not set"

        return (
            <div className="dropzone has-file fade-in">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="text-left">
                            <p className="font-semibold text-sm">{fileName}</p>
                            <p className="text-xs text-[var(--muted)]">
                                {parsedTrack.trackType} • {playRes}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={e => {
                            e.stopPropagation()
                            onClear()
                        }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
                        aria-label="Remove file"
                    >
                        <X className="w-4 h-4 text-[var(--muted)]" />
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatItem label="Styles" value={parsedTrack.styles.length} />
                    <StatItem label="Dialogue" value={dialogues.length} />
                    <StatItem label="Comments" value={comments.length} />
                    <StatItem label="PlayRes" value={playRes} />
                </div>
            </div>
        )
    }

    return (
        <button
            type="button"
            className={`dropzone ${isDragOver ? "active" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
            aria-label="Drop ASS file here or click to browse"
        >
            <input ref={inputRef} type="file" accept=".ass,.ssa" className="hidden" onChange={handleInputChange} />
            {isLoading ? (
                <div className="flex flex-col items-center gap-3">
                    <div className="spinner" />
                    <p className="text-sm text-[var(--muted)]">Parsing subtitle file...</p>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                        <Upload className="w-7 h-7 text-violet-400" />
                    </div>
                    <div>
                        <p className="font-semibold text-sm mb-1">Drop your .ass / .ssa file here</p>
                        <p className="text-xs text-[var(--muted)]">or click to browse</p>
                    </div>
                </div>
            )}
        </button>
    )
}

function StatItem({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="text-center p-2 rounded-lg bg-white/[0.03]">
            <p className="text-lg font-bold text-cyan-400">{value}</p>
            <p className="text-xs text-[var(--muted)]">{label}</p>
        </div>
    )
}
