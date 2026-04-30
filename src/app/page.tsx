"use client"

import { useState, useEffect } from "react"
import { Layers } from "lucide-react"
import FileDropzone from "@/components/file-dropzone"
import ModeSelector, { type ConversionMode } from "@/components/mode-selector"
import OptionsPanel from "@/components/options-panel"
import OutputPreview from "@/components/output-preview"
import { type AssTrack } from "@/lib/ass-parser"
import { convertNormalSrt, DEFAULT_NORMAL_OPTIONS, type NormalSrtOptions } from "@/lib/converters/normal-srt"
import { convertKeepTs, DEFAULT_KEEPTS_OPTIONS, type KeepTsOptions } from "@/lib/converters/keep-ts"
import { convertResampleTs, type ResampleOptions } from "@/lib/converters/resample-ts"

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
        injectAn2: false
    })

    const [outputContent, setOutputContent] = useState<string>("")
    const [isConverting, setIsConverting] = useState(false)

    // Update source resolution when track loads
    useEffect(() => {
        if (parsedTrack && parsedTrack.scriptInfo) {
            setResampleOptions(prev => ({
                ...prev,
                sourceWidth: parsedTrack.scriptInfo.PlayResX || 0,
                sourceHeight: parsedTrack.scriptInfo.PlayResY || 0
            }))
        }
    }, [parsedTrack])

    const handleFileLoaded = (content: string, name: string, track: AssTrack) => {
        setParsedTrack(track)
        setFileName(name)
        setOutputContent("")
    }

    const handleClear = () => {
        setParsedTrack(null)
        setFileName("")
        setOutputContent("")
    }

    const handleConvert = async () => {
        if (!parsedTrack) return

        setIsConverting(true)

        // Slight delay to allow UI to update to loading state (since conversion is sync but can be heavy)
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
        <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 flex flex-col gap-8">
            {/* Header */}
            <header className="text-center pt-8 pb-4 fade-in">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-500 mb-6 shadow-[0_0_40px_rgba(139,92,246,0.3)]">
                    <Layers className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-white">
                    ASS to SRT <span className="gradient-text">Converter</span>
                </h1>
                <p className="text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">
                    Convert Advanced SubStation Alpha subtitles with options to preserve complex typesetting or resample
                    resolutions.
                </p>
            </header>

            {/* Main Form Area */}
            <div className="flex flex-col gap-6">
                <FileDropzone
                    onFileLoaded={handleFileLoaded}
                    parsedTrack={parsedTrack}
                    fileName={fileName}
                    onClear={handleClear}
                />

                {parsedTrack && (
                    <div className="fade-in flex flex-col gap-6">
                        <div className="glass-card p-2">
                            <ModeSelector mode={mode} onModeChange={setMode} />
                        </div>

                        <OptionsPanel
                            mode={mode}
                            normalOptions={normalOptions}
                            setNormalOptions={setNormalOptions}
                            keeptOptions={keeptOptions}
                            setKeeptOptions={setKeeptOptions}
                            resampleOptions={resampleOptions}
                            setResampleOptions={setResampleOptions}
                        />

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={handleConvert}
                                disabled={isConverting}
                                className="btn-primary w-full sm:w-auto text-base !px-8 !py-3"
                            >
                                {isConverting ? (
                                    <>
                                        <div className="spinner" />
                                        <span>Converting...</span>
                                    </>
                                ) : (
                                    <span>Convert File</span>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <OutputPreview content={outputContent} originalFileName={fileName} outputFormat={getOutputFormat()} />

            {/* Footer */}
            <footer className="mt-auto pt-16 pb-8 text-center text-sm text-[var(--muted)] fade-in">
                <p>
                    <a
                        href="https://github.com/yuramedia/convert"
                        target="_blank"
                        rel="noreferrer"
                        className="footer-link"
                    >
                        Yuramedia Link
                    </a>
                    . Files are not uploaded to any server.
                    <br />
                    Inspired by{" "}
                    <a
                        href="https://github.com/SubtitleEdit/subtitleedit"
                        target="_blank"
                        rel="noreferrer"
                        className="footer-link"
                    >
                        Subtitle Edit
                    </a>
                    ,{" "}
                    <a
                        href="https://github.com/TypesettingTools/arch1t3cht-Aegisub-Scripts"
                        target="_blank"
                        rel="noreferrer"
                        className="footer-link"
                    >
                        arch1t3cht-Aegisub-Scripts
                    </a>
                    ,{" "}
                    <a href="https://github.com/libass/libass" target="_blank" rel="noreferrer" className="footer-link">
                        libass
                    </a>
                    , and{" "}
                    <a
                        href="https://gist.github.com/rcombs/455fd9c2ef015d51d46791e0d353df44"
                        target="_blank"
                        rel="noreferrer"
                        className="footer-link"
                    >
                        rcombs
                    </a>
                    .
                </p>
            </footer>
        </main>
    )
}
