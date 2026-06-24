"use client"

import { useState, useCallback } from "react"
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { QCReport as QCReportDisplay } from "@/components/qc-report"
import { checkQuality, type QCReport, type QCOptions } from "@/lib/qc-checker"
import { parseAss, type AssTrack } from "@/lib/ass-parser"
import { parseSrt } from "@/lib/srt-parser"

interface FileState {
    name: string
    content: string
    track: AssTrack | null
    error: string | null
}

const DEFAULT_QC_OPTIONS: QCOptions = {
    maxCPS: 20,
    optimalCPS: 17,
    maxLineLength: 42,
    optimalLineLength: 38,
    minDuration: 800,
    maxDuration: 7000,
    minGap: 83,
    snapThreshold: 200,
    strict: false,
    fps: 23.976023976
}

export function QCApp() {
    const [file, setFile] = useState<FileState | null>(null)
    const [qcReport, setQcReport] = useState<QCReport | null>(null)
    const [isChecking, setIsChecking] = useState(false)
    const [options, setOptions] = useState<QCOptions>(DEFAULT_QC_OPTIONS)

    const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0]
        if (!selectedFile) return

        const reader = new FileReader()
        reader.onload = e => {
            const content = e.target?.result as string
            if (!content) return

            const fileName = selectedFile.name
            const ext = fileName.toLowerCase()

            let track: AssTrack | null = null
            let error: string | null = null

            try {
                if (ext.endsWith(".ass")) {
                    track = parseAss(content)
                } else if (ext.endsWith(".srt")) {
                    track = parseSrt(content)
                } else {
                    error = "Unsupported file format. Please upload .ass or .srt file."
                }
            } catch (err) {
                error = `Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}`
            }

            setFile({ name: fileName, content, track, error })
            setQcReport(null)
        }

        reader.onerror = () => {
            setFile({
                name: selectedFile.name,
                content: "",
                track: null,
                error: "Failed to read file"
            })
        }

        reader.readAsText(selectedFile)
    }, [])

    const handleRunQC = useCallback(() => {
        if (!file?.track) return

        setIsChecking(true)
        setTimeout(() => {
            try {
                const report = checkQuality(file.track!, options)
                setQcReport(report)
            } catch (err) {
                alert(`QC check failed: ${err instanceof Error ? err.message : "Unknown error"}`)
            } finally {
                setIsChecking(false)
            }
        }, 100)
    }, [file, options])

    const handleClear = () => {
        setFile(null)
        setQcReport(null)
    }

    return (
        <div className="space-y-6">
            {/* File Upload Card */}
            <Card className="p-6">
                <h2 className="text-lg font-bold mb-4">Upload Subtitle File</h2>

                {!file ? (
                    <label className="block cursor-pointer">
                        <div className="border-2 border-dashed border-zinc-700 rounded-lg p-12 text-center hover:border-zinc-600 hover:bg-zinc-900/50 transition">
                            <Upload className="w-12 h-12 mx-auto mb-4 text-zinc-500" />
                            <p className="text-zinc-400 mb-2">Drop subtitle file here or click to browse</p>
                            <p className="text-xs text-zinc-600">Supports .ass and .srt files</p>
                        </div>
                        <input type="file" accept=".ass,.srt" onChange={handleFileSelect} className="hidden" />
                    </label>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg">
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-blue-500" />
                                <div>
                                    <p className="font-medium">{file.name}</p>
                                    {file.track && (
                                        <p className="text-xs text-zinc-500">
                                            {file.track.events.filter(e => e.type === "Dialogue").length} dialogue lines
                                        </p>
                                    )}
                                </div>
                            </div>
                            <Button onClick={handleClear} variant="outline" size="sm">
                                Clear
                            </Button>
                        </div>

                        {file.error ? (
                            <div className="flex items-center gap-2 p-4 bg-red-950/20 border border-red-900 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                                <p className="text-red-400 text-sm">{file.error}</p>
                            </div>
                        ) : file.track ? (
                            <div className="flex items-center gap-2 p-4 bg-green-950/20 border border-green-900 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <p className="text-green-400 text-sm">File parsed successfully</p>
                            </div>
                        ) : null}
                    </div>
                )}
            </Card>

            {/* QC Options Card */}
            {file?.track && (
                <Card className="p-6">
                    <h2 className="text-lg font-bold mb-4">QC Options</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Max CPS</label>
                            <input
                                type="number"
                                value={options.maxCPS}
                                onChange={e => setOptions({ ...options, maxCPS: Number(e.target.value) })}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Max Line Length</label>
                            <input
                                type="number"
                                value={options.maxLineLength}
                                onChange={e => setOptions({ ...options, maxLineLength: Number(e.target.value) })}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Min Duration (ms)</label>
                            <input
                                type="number"
                                value={options.minDuration}
                                onChange={e => setOptions({ ...options, minDuration: Number(e.target.value) })}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Max Duration (ms)</label>
                            <input
                                type="number"
                                value={options.maxDuration}
                                onChange={e => setOptions({ ...options, maxDuration: Number(e.target.value) })}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Min Gap (ms)</label>
                            <input
                                type="number"
                                value={options.minGap}
                                onChange={e => setOptions({ ...options, minGap: Number(e.target.value) })}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded"
                            />
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={options.strict}
                                    onChange={e => setOptions({ ...options, strict: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm font-medium">Strict Mode</span>
                            </label>
                        </div>
                    </div>

                    <div className="mt-6">
                        <Button
                            onClick={handleRunQC}
                            disabled={isChecking}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            {isChecking ? (
                                <>
                                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Checking...
                                </>
                            ) : (
                                "Run Quality Check"
                            )}
                        </Button>
                    </div>
                </Card>
            )}

            {/* QC Report Display */}
            {qcReport && <QCReportDisplay report={qcReport} />}
        </div>
    )
}
