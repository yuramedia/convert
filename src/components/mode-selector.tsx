"use client"

import { FileOutput, Brackets, Scaling, Table, FileSpreadsheet, Subtitles } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type ConversionMode = "normal" | "keepts" | "resample" | "csv" | "xlsx" | "ytt"

interface ModeSelectorProps {
    mode: ConversionMode
    onModeChange: (mode: ConversionMode) => void
}

const MODES: { id: ConversionMode; label: string; description: string; icon: React.ReactNode }[] = [
    {
        id: "normal",
        label: "Normal",
        description: "Standard strip / basic HTML",
        icon: <FileOutput size={18} />
    },
    {
        id: "keepts",
        label: "Keep TS",
        description: "Preserve all override tags",
        icon: <Brackets size={18} />
    },
    {
        id: "resample",
        label: "Resample",
        description: "Scale coordinate metrics",
        icon: <Scaling size={18} />
    },
    {
        id: "csv",
        label: "CSV",
        description: "Convert to CSV spreadsheet",
        icon: <FileSpreadsheet size={18} />
    },
    {
        id: "xlsx",
        label: "Excel",
        description: "Convert to XLSX spreadsheet",
        icon: <Table size={18} />
    },
    {
        id: "ytt",
        label: "YTT",
        description: "YouTube Subtitle XML",
        icon: <Subtitles size={18} />
    }
]

export default function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
    return (
        <ToggleGroup
            value={[mode]}
            onValueChange={v => v[0] && onModeChange(v[0] as ConversionMode)}
            variant="outline"
            spacing={2}
            className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto"
        >
            {MODES.map(m => (
                <ToggleGroupItem
                    key={m.id}
                    value={m.id}
                    className="flex flex-col items-center justify-between h-auto py-3 px-2 min-h-[95px] text-center rounded-lg border border-border bg-card hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary transition-all cursor-pointer whitespace-normal break-words overflow-hidden"
                >
                    <div className="flex flex-col items-center gap-1.5 w-full">
                        {m.icon}
                        <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap">{m.label}</span>
                    </div>
                    <p className="text-[10px] font-medium opacity-70 leading-tight mt-1.5 whitespace-normal break-words max-w-full text-center">
                        {m.description}
                    </p>
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    )
}
