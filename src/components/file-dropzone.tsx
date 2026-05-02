"use client"

import { useCallback, useRef, useState } from "react"
import { Upload, FileText, X } from "lucide-react"
import { type AssTrack } from "@/lib/ass-parser"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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
            e.target.value = ""
        },
        [handleFile]
    )

    if (parsedTrack && fileName) {
        const dialogues = parsedTrack.events.filter(e => e.type === "Dialogue")
        const comments = parsedTrack.events.filter(e => e.type === "Comment")
        const playRes =
            parsedTrack.scriptInfo.PlayResX && parsedTrack.scriptInfo.PlayResY
                ? `${parsedTrack.scriptInfo.PlayResX}x${parsedTrack.scriptInfo.PlayResY}`
                : "Not set"

        return (
            <Card className="p-6 bg-zinc-950 border-zinc-800 animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-600/10 rounded-lg flex items-center justify-center border border-blue-600/20">
                            <FileText className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="text-left">
                            <p className="text-xs font-bold text-blue-500/80 uppercase tracking-wider mb-0.5">
                                Stream Active
                            </p>
                            <p className="font-bold text-zinc-100 truncate max-w-[200px] md:max-w-md">{fileName}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClear} className="hover:bg-zinc-800 rounded-full">
                        <X size={18} className="text-zinc-500" />
                    </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatItem label="Styles" value={parsedTrack.styles.length} />
                    <StatItem label="Dialogue" value={dialogues.length} />
                    <StatItem label="Comments" value={comments.length} />
                    <StatItem label="Resolution" value={playRes} />
                </div>
            </Card>
        )
    }

    return (
        <button
            type="button"
            className={`w-full border-2 border-dashed rounded-xl p-12 transition-all duration-300 group ${
                isDragOver
                    ? "border-blue-600 bg-blue-600/5"
                    : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
        >
            <input ref={inputRef} type="file" accept=".ass,.ssa" className="hidden" onChange={handleInputChange} />
            {isLoading ? (
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <p className="text-xs font-bold uppercase tracking-widest text-blue-500">Parsing...</p>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload size={24} className="text-zinc-600 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-zinc-300">Upload Subtitle File</p>
                        <p className="text-xs text-zinc-500">Drag and drop .ass or .ssa here</p>
                    </div>
                </div>
            )}
        </button>
    )
}

function StatItem({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg border bg-muted/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
            <Badge
                variant="outline"
                className="font-mono text-xs font-bold border-primary/20 text-primary bg-primary/5"
            >
                {value}
            </Badge>
        </div>
    )
}
