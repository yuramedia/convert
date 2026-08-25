"use client"

import { useState } from "react"
import { type ColumnMapping, type SpreadsheetPreview } from "@/lib/spreadsheet-parser"
import { getColumnLetter } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

interface ColumnMapperProps {
    preview: SpreadsheetPreview
    fileName: string
    onCancel: () => void
    onConfirm: (mapping: ColumnMapping, hasHeader: boolean, fps: number) => void
}

const SELECT_CLASS =
    "w-full h-9 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-sm text-zinc-100 shadow-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"

interface MappingSelectProps {
    id: string
    label: React.ReactNode
    value: number
    onChange: (value: string) => void
    noneLabel: string
    headers: string[]
    disabled?: boolean
}

function MappingSelect({ id, label, value, onChange, noneLabel, headers, disabled = false }: MappingSelectProps) {
    return (
        <div className="space-y-1.5">
            <label
                htmlFor={id}
                className="text-xs font-bold text-zinc-400 uppercase tracking-wide flex items-center justify-between"
            >
                {label}
            </label>
            <select
                id={id}
                value={value}
                disabled={disabled}
                onChange={e => onChange(e.target.value)}
                className={SELECT_CLASS}
            >
                <option value="-1">{noneLabel}</option>
                {headers.map((h, idx) => (
                    <option key={idx} value={idx}>
                        Column {getColumnLetter(idx)}: {h}
                    </option>
                ))}
            </select>
        </div>
    )
}

export default function ColumnMapper({ preview, fileName, onCancel, onConfirm }: ColumnMapperProps) {
    const [mapping, setMapping] = useState<ColumnMapping>({ ...preview.autoMapping })
    const [hasHeader, setHasHeader] = useState(true)
    // Kept as raw text so clearing/mid-typing states don't snap back to a preset value
    const [fpsText, setFpsText] = useState("23.976")

    const handleSelectChange = (field: keyof ColumnMapping, value: string) => {
        const idx = parseInt(value, 10)
        setMapping(prev => ({ ...prev, [field]: idx }))
    }

    const handleConfirm = () => {
        if (mapping.text === -1) {
            alert("Please select a column for the Subtitle Text field.")
            return
        }
        const fps = parseFloat(fpsText)
        onConfirm(mapping, hasHeader, Number.isFinite(fps) && fps > 0 ? fps : 23.976)
    }

    return (
        <Card className="w-full bg-zinc-950 border-zinc-800 animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-xl">
            <CardHeader className="border-b border-zinc-900 bg-zinc-900/10">
                <CardTitle className="text-base font-bold uppercase tracking-wider text-zinc-100 flex items-center justify-between">
                    <span>Map Spreadsheet Columns</span>
                    <span className="text-xs font-mono text-zinc-500 normal-case font-normal">{fileName}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
                {/* Column Mappers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    <MappingSelect
                        id="map-text"
                        label={
                            <>
                                Subtitle Text{" "}
                                <span className="text-[10px] text-red-500 font-medium normal-case font-mono">
                                    *required
                                </span>
                            </>
                        }
                        value={mapping.text}
                        onChange={v => handleSelectChange("text", v)}
                        noneLabel="-- Select Column --"
                        headers={preview.headers}
                    />

                    <MappingSelect
                        id="map-start"
                        label="Start Time"
                        value={mapping.start}
                        onChange={v => handleSelectChange("start", v)}
                        noneLabel="-- None (Auto-assign) --"
                        headers={preview.headers}
                    />

                    <MappingSelect
                        id="map-end"
                        label="End Time"
                        value={mapping.end}
                        disabled={mapping.duration !== -1}
                        onChange={v => handleSelectChange("end", v)}
                        noneLabel="-- None (Use Duration/Auto) --"
                        headers={preview.headers}
                    />

                    <MappingSelect
                        id="map-duration"
                        label="Duration"
                        value={mapping.duration}
                        disabled={mapping.end !== -1}
                        onChange={v => handleSelectChange("duration", v)}
                        noneLabel="-- None (Use End Time) --"
                        headers={preview.headers}
                    />

                    <MappingSelect
                        id="map-style"
                        label="Subtitle Style"
                        value={mapping.style}
                        onChange={v => handleSelectChange("style", v)}
                        noneLabel="-- None (Default style) --"
                        headers={preview.headers}
                    />

                    <MappingSelect
                        id="map-actor"
                        label="Actor / Speaker"
                        value={mapping.actor}
                        onChange={v => handleSelectChange("actor", v)}
                        noneLabel="-- None --"
                        headers={preview.headers}
                    />

                    <MappingSelect
                        id="map-layer"
                        label="Layer"
                        value={mapping.layer}
                        onChange={v => handleSelectChange("layer", v)}
                        noneLabel="-- None (Layer 0) --"
                        headers={preview.headers}
                    />

                    {/* FPS */}
                    <div className="space-y-1.5">
                        <label
                            htmlFor="map-fps"
                            className="text-xs font-bold text-zinc-400 uppercase tracking-wide flex items-center justify-between"
                        >
                            System FPS{" "}
                            <span className="text-[10px] text-zinc-600 font-medium normal-case">
                                (for frame timings)
                            </span>
                        </label>
                        <Input
                            id="map-fps"
                            type="number"
                            step="any"
                            min={0.001}
                            value={fpsText}
                            onChange={e => setFpsText(e.target.value)}
                            className="h-9"
                        />
                    </div>
                </div>

                {/* Additional Settings */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-4 border-t border-zinc-900">
                    <div className="flex items-center gap-3">
                        <Switch checked={hasHeader} onCheckedChange={setHasHeader} id="has-header-switch" />
                        <label
                            htmlFor="has-header-switch"
                            className="text-sm font-bold text-zinc-300 select-none cursor-pointer"
                        >
                            First row is a header label
                        </label>
                    </div>
                    <p className="text-xs text-zinc-500">
                        When enabled, the first row of your spreadsheet will be ignored during subtitle parsing.
                    </p>
                </div>

                {/* Spreadsheet Live Preview */}
                <div className="space-y-2 pt-4 border-t border-zinc-900">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        Spreadsheet Data Preview
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-zinc-900">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-zinc-900/50 border-b border-zinc-900">
                                    <th className="p-3 font-bold text-zinc-500 uppercase tracking-wider text-center w-12 border-r border-zinc-900">
                                        Row
                                    </th>
                                    {preview.headers.map((h, idx) => {
                                        const colLetter = getColumnLetter(idx)
                                        const isMappedText = mapping.text === idx
                                        const isMappedStart = mapping.start === idx
                                        const isMappedEnd = mapping.end === idx
                                        const isMappedDur = mapping.duration === idx

                                        let badge = null
                                        if (isMappedText)
                                            badge = (
                                                <span className="ml-1.5 px-1 py-0.5 rounded text-[8px] bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-widest font-bold">
                                                    Text
                                                </span>
                                            )
                                        else if (isMappedStart)
                                            badge = (
                                                <span className="ml-1.5 px-1 py-0.5 rounded text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-widest font-bold">
                                                    Start
                                                </span>
                                            )
                                        else if (isMappedEnd)
                                            badge = (
                                                <span className="ml-1.5 px-1 py-0.5 rounded text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-widest font-bold">
                                                    End
                                                </span>
                                            )
                                        else if (isMappedDur)
                                            badge = (
                                                <span className="ml-1.5 px-1 py-0.5 rounded text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest font-bold">
                                                    Dur
                                                </span>
                                            )

                                        return (
                                            <th
                                                key={idx}
                                                className="p-3 font-bold text-zinc-300 border-r border-zinc-900 last:border-0"
                                            >
                                                <div className="flex items-center">
                                                    <span className="font-mono text-zinc-500 font-bold mr-1.5">
                                                        {colLetter}
                                                    </span>
                                                    <span className="truncate max-w-[150px]">{hasHeader ? h : ""}</span>
                                                    {badge}
                                                </div>
                                            </th>
                                        )
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.rows.map((row, rowIdx) => (
                                    <tr
                                        key={rowIdx}
                                        className="border-b border-zinc-900/50 hover:bg-zinc-900/10 last:border-0"
                                    >
                                        <td className="p-3 text-zinc-600 font-bold font-mono text-center bg-zinc-900/10 border-r border-zinc-900">
                                            {rowIdx + (hasHeader ? 2 : 1)}
                                        </td>
                                        {row.map((cell, cellIdx) => (
                                            <td
                                                key={cellIdx}
                                                className="p-3 text-zinc-400 border-r border-zinc-900/50 last:border-0 truncate max-w-[200px]"
                                            >
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-6 border-t border-zinc-900">
                    <Button variant="ghost" onClick={onCancel} className="hover:bg-zinc-900 text-zinc-400">
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6">
                        Parse & Load Subtitles
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
