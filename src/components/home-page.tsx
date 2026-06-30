import { useState, useCallback } from "react"
import { Layers, Info, Cpu, ShieldCheck } from "lucide-react"
import FileDropzone, { type QueuedFile } from "@/components/file-dropzone"
import ModeSelector, { type ConversionMode } from "@/components/mode-selector"
import OptionsPanel from "@/components/options-panel"
import OutputPreview from "@/components/output-preview"
import ColumnMapper from "@/components/column-mapper"
import { convertNormalSrt, DEFAULT_NORMAL_OPTIONS, type NormalSrtOptions } from "@/lib/converters/normal-srt"
import { convertKeepTs, DEFAULT_KEEPTS_OPTIONS, type KeepTsOptions } from "@/lib/converters/keep-ts"
import { convertResampleTs, type ResampleOptions } from "@/lib/converters/resample-ts"
import { convertToCsv, DEFAULT_CSV_OPTIONS, type CsvExportOptions } from "@/lib/converters/csv-export"
import {
    convertToXlsxData,
    convertToXlsxBuffer,
    DEFAULT_XLSX_OPTIONS,
    type XlsxExportOptions,
    createCombinedXlsxBuffer,
    regenerateXlsxBuffer
} from "@/lib/converters/xlsx-export"
import {
    type ColumnMapping,
    parseSpreadsheet,
    parseSpreadsheetSegment,
    readSpreadsheetRows
} from "@/lib/spreadsheet-parser"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function Home() {
    const [files, setFiles] = useState<QueuedFile[]>([])
    const [mode, setMode] = useState<ConversionMode>("normal")
    const [isConverting, setIsConverting] = useState(false)
    const [activePreviewId, setActivePreviewId] = useState<string | null>(null)
    const [mappingFileId, setMappingFileId] = useState<string | null>(null)

    // Global settings options
    const [normalOptions, setNormalOptions] = useState<NormalSrtOptions>(DEFAULT_NORMAL_OPTIONS)
    const [keeptOptions, setKeeptOptions] = useState<KeepTsOptions>(DEFAULT_KEEPTS_OPTIONS)
    const [resampleOptions, setResampleOptions] = useState<ResampleOptions>({
        sourceWidth: 0,
        sourceHeight: 0,
        targetWidth: 1920,
        targetHeight: 1080,
        outputFormat: "srt",
        injectAn2: false,
        compensateAspectRatio: true,
        signFirst: true
    })
    const [csvOptions, setCsvOptions] = useState<CsvExportOptions>(DEFAULT_CSV_OPTIONS)
    const [xlsxOptions, setXlsxOptions] = useState<XlsxExportOptions>(DEFAULT_XLSX_OPTIONS)

    const handleFilesAdded = (newFiles: QueuedFile[]) => {
        setFiles(prev => {
            const updated = [...prev, ...newFiles]

            // Heuristic resolution setup from first subtitle file containing script resolution info
            const firstWithRes = newFiles.find(f => f.track && f.track.scriptInfo.PlayResX)
            if (firstWithRes && firstWithRes.track) {
                setResampleOptions(prevOpts => {
                    if (prevOpts.sourceWidth === 0) {
                        return {
                            ...prevOpts,
                            sourceWidth: firstWithRes.track!.scriptInfo.PlayResX || 0,
                            sourceHeight: firstWithRes.track!.scriptInfo.PlayResY || 0
                        }
                    }
                    return prevOpts
                })
            }

            return updated
        })
    }

    const handleRemoveFile = (id: string) => {
        setFiles(prev => {
            const filtered = prev.filter(f => f.id !== id)
            if (activePreviewId === id) {
                const nextConverted = filtered.find(f => f.status === "converted")
                setActivePreviewId(nextConverted ? nextConverted.id : null)
            }
            return filtered
        })
    }

    const handleColumnMappingConfirm = (id: string, mapping: ColumnMapping, hasHeader: boolean, fps: number) => {
        const file = files.find(f => f.id === id)
        if (!file || !file.spreadsheetBuffer) return

        try {
            // Check if multiple segments are present in preview
            if (file.spreadsheetPreview?.segments && file.spreadsheetPreview.segments.length > 0) {
                const rows = readSpreadsheetRows(file.spreadsheetBuffer)
                const extension = file.name.substring(file.name.lastIndexOf("."))
                const baseName = file.name.substring(0, file.name.lastIndexOf("."))

                const segmentFiles = file.spreadsheetPreview.segments.map(segment => {
                    const track = parseSpreadsheetSegment(rows, segment, mapping, hasHeader, fps)
                    const virtualName = `${baseName} - ${segment.name}${extension}`
                    return {
                        id: `${file.id}-${segment.name}`,
                        name: virtualName,
                        size: file.size,
                        type: "spreadsheet" as const,
                        track,
                        status: "ready" as const,
                        outputContent: ""
                    }
                })

                setFiles(prev => {
                    const updated: QueuedFile[] = []
                    for (const f of prev) {
                        if (f.id === id) {
                            updated.push(...segmentFiles)
                        } else {
                            updated.push(f)
                        }
                    }
                    return updated
                })

                // Auto-setup source width/height from the first segment track if available
                const firstTrack = segmentFiles[0]?.track
                if (firstTrack && firstTrack.scriptInfo.PlayResX) {
                    setResampleOptions(prevOpts => {
                        if (prevOpts.sourceWidth === 0) {
                            return {
                                ...prevOpts,
                                sourceWidth: firstTrack.scriptInfo.PlayResX || 0,
                                sourceHeight: firstTrack.scriptInfo.PlayResY || 0
                            }
                        }
                        return prevOpts
                    })
                }
            } else {
                const track = parseSpreadsheet(file.spreadsheetBuffer, mapping, hasHeader, fps)
                setFiles(prev =>
                    prev.map(f =>
                        f.id === id
                            ? {
                                  ...f,
                                  track,
                                  status: "ready" as const
                              }
                            : f
                    )
                )

                // Auto-setup source width/height for resampler if this is the first loaded track with resolutions set
                if (track && track.scriptInfo.PlayResX) {
                    setResampleOptions(prevOpts => {
                        if (prevOpts.sourceWidth === 0) {
                            return {
                                ...prevOpts,
                                sourceWidth: track.scriptInfo.PlayResX || 0,
                                sourceHeight: track.scriptInfo.PlayResY || 0
                            }
                        }
                        return prevOpts
                    })
                }
            }

            if (mappingFileId === id) {
                setMappingFileId(null)
            }
        } catch (err) {
            console.error("Failed to parse spreadsheet:", err)
            alert(`Failed to parse spreadsheet "${file.name}". Please verify the columns and layout.`)
        }
    }

    const handleColumnMappingCancel = (id: string) => {
        handleRemoveFile(id)
        if (mappingFileId === id) {
            setMappingFileId(null)
        }
    }

    const handleClearAll = () => {
        setFiles([])
        setActivePreviewId(null)
        setMappingFileId(null)
    }

    const handleConvert = async () => {
        const convertibles = files.filter(f => f.status === "ready" || f.status === "converted")
        if (convertibles.length === 0) return

        setIsConverting(true)
        await new Promise(resolve => setTimeout(resolve, 50))

        try {
            const updatedFiles = await Promise.all(
                convertibles.map(async file => {
                    if (!file.track) return file
                    try {
                        let outputContent = ""
                        let xlsxData: Record<string, string | number>[] | undefined = undefined
                        let xlsxBuffer: Uint8Array | null = null

                        if (mode === "normal") {
                            outputContent = convertNormalSrt(file.track, normalOptions)
                        } else if (mode === "keepts") {
                            outputContent = convertKeepTs(file.track, keeptOptions)
                        } else if (mode === "resample") {
                            outputContent = convertResampleTs(file.track, resampleOptions)
                        } else if (mode === "csv") {
                            outputContent = convertToCsv(file.track, csvOptions)
                        } else if (mode === "xlsx") {
                            xlsxData = convertToXlsxData(file.track, xlsxOptions)
                            xlsxBuffer = convertToXlsxBuffer(file.track, xlsxOptions, file.name)
                            outputContent = "EXCEL_EXPORT_SUCCESS"
                        }

                        return {
                            ...file,
                            status: "converted" as const,
                            outputContent,
                            xlsxData,
                            xlsxBuffer
                        }
                    } catch (err) {
                        console.error(`Conversion failed for ${file.name}:`, err)
                        return {
                            ...file,
                            status: "error" as const,
                            error: "Conversion failed"
                        }
                    }
                })
            )

            setFiles(prev =>
                prev.map(f => {
                    const updated = updatedFiles.find(uf => uf.id === f.id)
                    return updated ? updated : f
                })
            )

            // Default active preview to first successfully converted file in the batch
            const firstConverted = updatedFiles.find(uf => uf.status === "converted")
            if (firstConverted) {
                setActivePreviewId(firstConverted.id)
            }
        } catch (err) {
            console.error("Batch conversion failed:", err)
        } finally {
            setIsConverting(false)
        }
    }

    const handleDownloadCombinedXlsx = () => {
        const convertedFiles = files.filter(f => f.status === "converted")
        if (convertedFiles.length === 0) return

        const filesData = convertedFiles
            .filter(f => f.xlsxData && f.xlsxData.length > 0)
            .map(f => ({
                name: f.name,
                data: f.xlsxData!
            }))

        if (filesData.length === 0) return

        try {
            const combinedBuffer = createCombinedXlsxBuffer(filesData, xlsxOptions.combinedMode)
            const blob = new Blob([combinedBuffer as unknown as BlobPart], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url

            const firstBaseName = filesData[0].name.replace(/\.[^/.]+$/, "")
            let baseTitle = firstBaseName
            const epIndex = baseTitle.lastIndexOf(" - EP")
            if (epIndex !== -1) {
                baseTitle = baseTitle.substring(0, epIndex)
            }
            const downloadName = filesData.length > 1 ? `${baseTitle} - Combined.xlsx` : `${baseTitle}.xlsx`

            a.download = downloadName
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error("Failed to generate combined Excel workbook:", err)
            alert("Failed to generate combined Excel workbook. Please download individual files instead.")
        }
    }

    const handleDownloadAll = () => {
        const convertedFiles = files.filter(f => f.status === "converted")
        if (convertedFiles.length === 0) return

        convertedFiles.forEach((file, index) => {
            setTimeout(() => {
                let blob: Blob
                const format = getOutputFormat()

                if (format === "xlsx" && file.xlsxBuffer) {
                    blob = new Blob([file.xlsxBuffer as BlobPart], {
                        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    })
                } else {
                    blob = new Blob([file.outputContent], { type: "text/plain" })
                }

                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                const baseName = file.name.replace(/\.[^/.]+$/, "")
                a.download = `${baseName}.${format}`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            }, index * 300) // 300ms staggered delay to prevent browser blockages on multiple tab downloads
        })
    }

    const getOutputFormat = () => {
        if (mode === "resample") return resampleOptions.outputFormat
        if (mode === "csv") return "csv"
        if (mode === "xlsx") return "xlsx"
        return "srt"
    }

    const handleUpdateOutput = useCallback((fileId: string, newContent: string) => {
        setFiles(prev => prev.map(f => (f.id === fileId ? { ...f, outputContent: newContent } : f)))
    }, [])

    const handleUpdateXlsxData = useCallback((fileId: string, newData: Record<string, string | number>[]) => {
        setFiles(prev =>
            prev.map(f =>
                f.id === fileId
                    ? {
                          ...f,
                          xlsxData: newData,
                          xlsxBuffer: regenerateXlsxBuffer(newData, f.name)
                      }
                    : f
            )
        )
    }, [])

    // Sequentially map files: map manually selected files first, or map the first unmapped file in queue
    const fileToMap =
        files.find(f => f.id === mappingFileId && f.status === "pending_mapping") ||
        files.find(f => f.status === "pending_mapping")

    return (
        <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-12 flex flex-col gap-10 relative z-10">
            <div className="flex justify-end gap-4">
                <a
                    href="/qc/"
                    className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-emerald-500 transition-colors"
                >
                    <ShieldCheck size={14} />
                    Quality Check
                </a>
                <a
                    href="/about/"
                    className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-blue-500 transition-colors"
                >
                    <Info size={14} />
                    About
                </a>
            </div>

            {/* Header */}
            <header className="flex flex-col items-center text-center space-y-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
                        <Layers size={18} className="text-white" />
                    </div>
                    <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/20">
                        <Cpu size={18} className="text-white" />
                    </div>
                </div>
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-zinc-50 uppercase">
                        Yuuume ASS <span className="text-blue-500">Converter</span>
                    </h1>
                    <p className="text-sm text-zinc-500 font-medium">
                        Optimized for subbing workflows. Fully client-side.
                    </p>
                </div>
            </header>

            {/* Main Form Area */}
            <div className="flex flex-col gap-6">
                <FileDropzone
                    files={files}
                    onFilesAdded={handleFilesAdded}
                    onRemoveFile={handleRemoveFile}
                    onMapFile={setMappingFileId}
                    onClear={handleClearAll}
                />

                {fileToMap ? (
                    <ColumnMapper
                        key={fileToMap.id}
                        preview={fileToMap.spreadsheetPreview!}
                        fileName={fileToMap.name}
                        onCancel={() => handleColumnMappingCancel(fileToMap.id)}
                        onConfirm={(mapping, hasHeader, fps) =>
                            handleColumnMappingConfirm(fileToMap.id, mapping, hasHeader, fps)
                        }
                    />
                ) : null}

                {files.length > 0 && !fileToMap ? (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <Card className="p-5 flex flex-col gap-4 animate-in fade-in duration-500">
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground leading-none">
                                Convert Mode
                            </h3>
                            <ModeSelector mode={mode} onModeChange={setMode} />
                        </Card>

                        <OptionsPanel
                            mode={mode}
                            normalOptions={normalOptions}
                            setNormalOptions={setNormalOptions}
                            keeptOptions={keeptOptions}
                            setKeeptOptions={setKeeptOptions}
                            resampleOptions={resampleOptions}
                            setResampleOptions={setResampleOptions}
                            csvOptions={csvOptions}
                            setCsvOptions={setCsvOptions}
                            xlsxOptions={xlsxOptions}
                            setXlsxOptions={setXlsxOptions}
                        />

                        {files.some(f => f.status === "ready" || f.status === "converted") && (
                            <div className="flex justify-end">
                                <Button
                                    onClick={handleConvert}
                                    disabled={isConverting}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 h-11"
                                >
                                    {isConverting ? (
                                        <>
                                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            Converting...
                                        </>
                                    ) : files.filter(f => f.status === "ready" || f.status === "converted").length >
                                      1 ? (
                                        `Convert ${files.filter(f => f.status === "ready" || f.status === "converted").length} Files`
                                    ) : (
                                        "Convert File"
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>

            <OutputPreview
                files={files}
                activePreviewId={activePreviewId}
                onSelectPreview={setActivePreviewId}
                onDownloadAll={handleDownloadAll}
                onDownloadCombined={handleDownloadCombinedXlsx}
                onUpdateOutput={handleUpdateOutput}
                onUpdateXlsxData={handleUpdateXlsxData}
                outputFormat={getOutputFormat()}
            />

            {/* Footer */}
            <footer className="mt-auto pt-16 pb-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-medium text-zinc-600 uppercase tracking-wider">
                <div className="flex gap-6">
                    <a
                        href="https://github.com/yuramedia/convert"
                        target="_blank"
                        className="hover:text-blue-500 transition-colors"
                    >
                        GitHub
                    </a>
                </div>
                <a href="https://yuramedia.com" target="_blank" className="text-center text-[10px] text-zinc-500">
                    &copy; {new Date().getFullYear()} Made with ❤️ by Yuramedia Link
                </a>
                <p>No data uploaded. Privacy guaranteed.</p>
            </footer>
        </main>
    )
}
