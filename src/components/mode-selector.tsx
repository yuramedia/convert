"use client"

import { FileOutput, Brackets, Scaling } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type ConversionMode = "normal" | "keepts" | "resample"

interface ModeSelectorProps {
    mode: ConversionMode
    onModeChange: (mode: ConversionMode) => void
}

const MODES: { id: ConversionMode; label: string; description: string; icon: React.ReactNode }[] = [
    {
        id: "normal",
        label: "Normal",
        description: "Standard strip / basic HTML.",
        icon: <FileOutput />
    },
    {
        id: "keepts",
        label: "Keep TS",
        description: "Preserve all override tags.",
        icon: <Brackets />
    },
    {
        id: "resample",
        label: "Resample",
        description: "Scale coordinate metrics.",
        icon: <Scaling />
    }
]

export default function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
    return (
        <ToggleGroup
            value={[mode]}
            onValueChange={v => v[0] && onModeChange(v[0] as ConversionMode)}
            className="w-full bg-muted/50 p-1"
            spacing={1}
        >
            {MODES.map(m => (
                <ToggleGroupItem
                    key={m.id}
                    value={m.id}
                    className="flex-1 flex flex-col items-center h-auto py-3 px-2 gap-1.5 transition-all data-checked:bg-primary data-checked:text-primary-foreground"
                >
                    <div className="flex items-center gap-2">
                        {m.icon}
                        <span className="text-[11px] font-bold uppercase tracking-wider">{m.label}</span>
                    </div>
                    <p className="text-[9px] font-medium opacity-60 leading-none">{m.description}</p>
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    )
}
