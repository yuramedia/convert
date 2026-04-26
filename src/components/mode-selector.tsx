"use client"

import { FileOutput, Brackets, Scaling } from "lucide-react"

export type ConversionMode = "normal" | "keepts" | "resample"

interface ModeSelectorProps {
    mode: ConversionMode
    onModeChange: (mode: ConversionMode) => void
}

const MODES: { id: ConversionMode; label: string; description: string; icon: React.ReactNode }[] = [
    {
        id: "normal",
        label: "Normal SRT",
        description: "Clean SRT with basic HTML tags. Strips typesetting.",
        icon: <FileOutput className="w-5 h-5" />
    },
    {
        id: "keepts",
        label: "Keep TS",
        description: "Preserve all ASS override tags for mpv/libass players.",
        icon: <Brackets className="w-5 h-5" />
    },
    {
        id: "resample",
        label: "Resample TS",
        description: "Rescale typesetting coordinates between resolutions.",
        icon: <Scaling className="w-5 h-5" />
    }
]

export default function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MODES.map(m => (
                <button
                    key={m.id}
                    className={`mode-card text-left ${mode === m.id ? "selected" : ""}`}
                    onClick={() => onModeChange(m.id)}
                    id={`mode-${m.id}`}
                >
                    <div className="flex items-center gap-2.5 mb-2">
                        <div
                            className={`transition-colors ${mode === m.id ? "text-violet-400" : "text-[var(--muted)]"}`}
                        >
                            {m.icon}
                        </div>
                        <span className="font-semibold text-sm">{m.label}</span>
                    </div>
                    <p className="text-xs text-[var(--muted)] leading-relaxed">{m.description}</p>
                </button>
            ))}
        </div>
    )
}
