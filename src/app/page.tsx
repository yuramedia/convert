"use client"

import { useState } from "react"
import Link from "next/link"
import { Layers, Info, Cpu } from "lucide-react"
import FileDropzone from "@/components/file-dropzone"
import ModeSelector, { type ConversionMode } from "@/components/mode-selector"
import OptionsPanel from "@/components/options-panel"
import OutputPreview from "@/components/output-preview"
import { type AssTrack } from "@/lib/ass-parser"
import { convertNormalSrt, DEFAULT_NORMAL_OPTIONS, type NormalSrtOptions } from "@/lib/converters/normal-srt"
import { convertKeepTs, DEFAULT_KEEPTS_OPTIONS, type KeepTsOptions } from "@/lib/converters/keep-ts"
import { convertResampleTs, type ResampleOptions } from "@/lib/converters/resample-ts"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function Home() {
    const [parsedTrack, setParsedTrack] = useState<AssTrack | null>(null)
    const [fileName, setFileName] = useState<string>("")
    const [mode, setMode] = useState<ConversionMode>("normal")

    const [normalOptions, setNormalOptions] = useState<NormalSrtOptions>(DEFAULT_NORMAL_OPTIONS)
    const [keeptOptions, setKeeptOptions] = useState<KeepTsOptions>(DEFAULT_KEEPTS_OPTIONS)
    const [resampleOptions, setResampleOptions] = useState<ResampleOptions>({
        sourceWidth: 0,
        sourceHeight: 0,
        targetWidth: 1920,
        targetHeight: 1080,
        outputFormat: "srt",
        injectAn2: false,
        compensateAspectRatio: true
    })

    const [outputContent, setOutputContent] = useState<string>("")
    const [isConverting, setIsConverting] = useState(false)

    const handleFileLoaded = (content: string, name: string, track: AssTrack) => {
        setParsedTrack(track)
        setFileName(name)
        setOutputContent("")

        if (track && track.scriptInfo) {
            setResampleOptions(prev => ({
                ...prev,
                sourceWidth: track.scriptInfo.PlayResX || 0,
                sourceHeight: track.scriptInfo.PlayResY || 0
            }))
        }
    }

    const handleClear = () => {
        setParsedTrack(null)
        setFileName("")
        setOutputContent("")
    }

    const handleConvert = async () => {
        if (!parsedTrack) return

        setIsConverting(true)

        // Slight delay to allow UI to update to loading state
        await new Promise(resolve => setTimeout(resolve, 50))

        try {
            let result = ""
            if (mode === "normal") {
                result = convertNormalSrt(parsedTrack, normalOptions)
            } else if (mode === "keepts") {
                result = convertKeepTs(parsedTrack, keeptOptions)
            } else if (mode === "resample") {
                result = convertResampleTs(parsedTrack, resampleOptions)
            }
            setOutputContent(result)
        } catch (err) {
            console.error("Conversion failed", err)
            alert("Conversion failed. Please check the console for details.")
        } finally {
            setIsConverting(false)
        }
    }

    const getOutputFormat = () => {
        if (mode === "resample") return resampleOptions.outputFormat
        return "srt"
    }

    return (
        <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-12 flex flex-col gap-10 relative z-10">
            <div className="flex justify-end">
                <Link
                    href="/about"
                    className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-blue-500 transition-colors"
                >
                    <Info size={14} />
                    About
                </Link>
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
                    onFileLoaded={handleFileLoaded}
                    parsedTrack={parsedTrack}
                    fileName={fileName}
                    onClear={handleClear}
                />

                {parsedTrack ? (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <Card className="p-1">
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
                        />

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
                                ) : (
                                    "Convert File"
                                )}
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>

            <OutputPreview content={outputContent} originalFileName={fileName} outputFormat={getOutputFormat()} />

            {/* Footer */}
            <footer className="mt-auto pt-16 pb-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-medium text-zinc-600 uppercase tracking-wider">
                <div className="flex gap-6">
                    <Link
                        href="https://github.com/yuramedia/convert"
                        target="_blank"
                        className="hover:text-blue-500 transition-colors"
                    >
                        GitHub
                    </Link>
                </div>
                <Link href="https://yuramedia.com" target="_blank" className="text-center text-[10px] text-zinc-500">
                    &copy; {new Date().getFullYear()} Made with ❤️ by Yuramedia Link
                </Link>
                <p>No data uploaded. Privacy guaranteed.</p>
            </footer>
        </main>
    )
}
