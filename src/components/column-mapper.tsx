"use client"

import { useState } from "react"
import { type ColumnMapping, type SpreadsheetPreview } from "@/lib/spreadsheet-parser"
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

export default function ColumnMapper({ preview, fileName, onCancel, onConfirm }: ColumnMapperProps) {
    const [mapping, setMapping] = useState<ColumnMapping>({ ...preview.autoMapping })
    const [hasHeader, setHasHeader] = useState(true)
    const [fps, setFps] = useState(23.976)


    const handleSelectChange = (field: keyof ColumnMapping, value: string) => {
        const idx = parseInt(value, 10)
        setMapping(prev => ({ ...prev, [field]: idx }))
    }

    const handleConfirm = () => {
        if (mapping.text === -1) {
            alert("Please select a column for the Subtitle Text field.")
            return
        }
        onConfirm(mapping, hasHeader, fps)
    }

    // Helper to generate letter coordinates (A, B, C...)
    const getColLetter = (index: number) => String.fromCharCode(65 + index)

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
                    {/* Subtitle Text (Required) */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide flex items-center justify-between">
                            Subtitle Text{" "}
                            <span className="text-[10px] text-red-500 font-medium normal-case font-mono">
                                *required
                            </span>
                        </label>
                        <select
                            value={mapping.text}
                            onChange={e => handleSelectChange("text", e.target.value)}
                            className="w-full h-9 rounded-md border border-zinc-850 bg-zinc-900/50 px-3 py-1 text-sm text-zinc-100 shadow-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-colors"
                        >
                            <option value="-1">-- Select Column --</option>
                            {preview.headers.map((h, idx) => (
                                <option key={idx} value={idx}>
                                    Column {getColLetter(idx)}: {h}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Start Time */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Start Time</label>
                        <select
                            value={mapping.start}
                            onChange={e => handleSelectChange("start", e.target.value)}
                            className="w-full h-9 rounded-md border border-zinc-850 bg-zinc-900/50 px-3 py-1 text-sm text-zinc-100 shadow-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-colors"
                        >
                            <option value="-1">-- None (Auto-assign) --</option>
                            {preview.headers.map((h, idx) => (
                                <option key={idx} value={idx}>
                                    Column {getColLetter(idx)}: {h}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* End Time */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">End Time</label>
                        <select
                            value={mapping.end}
                            disabled={mapping.duration !== -1}
                            onChange={e => handleSelectChange("end", e.target.value)}
                            className="w-full h-9 rounded-md border border-zinc-850 bg-zinc-900/50 px-3 py-1 text-sm text-zinc-100 shadow-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="-1">-- None (Use Duration/Auto) --</option>
                            {preview.headers.map((h, idx) => (
                                <option key={idx} value={idx}>
                                    Column {getColLetter(idx)}: {h}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Duration */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Duration</label>
                        <select
                            value={mapping.duration}
                            disabled={mapping.end !== -1}
                            onChange={e => handleSelectChange("duration", e.target.value)}
                            className="w-full h-9 rounded-md border border-zinc-850 bg-zinc-900/50 px-3 py-1 text-sm text-zinc-100 shadow-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="-1">-- None (Use End Time) --</option>
                            {preview.headers.map((h, idx) => (
                                <option key={idx} value={idx}>
                                    Column {getColLetter(idx)}: {h}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Style */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                            Subtitle Style
                        </label>
                        <select
                            value={mapping.style}
                            onChange={e => handleSelectChange("style", e.target.value)}
                            className="w-full h-9 rounded-md border border-zinc-850 bg-zinc-900/50 px-3 py-1 text-sm text-zinc-100 shadow-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-colors"
                        >
                            <option value="-1">-- None (Default style) --</option>
                            {preview.headers.map((h, idx) => (
                                <option key={idx} value={idx}>
                                    Column {getColLetter(idx)}: {h}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Actor */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                            Actor / Speaker
                        </label>
                        <select
                            value={mapping.actor}
                            onChange={e => handleSelectChange("actor", e.target.value)}
                            className="w-full h-9 rounded-md border border-zinc-850 bg-zinc-900/50 px-3 py-1 text-sm text-zinc-100 shadow-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-colors"
                        >
                            <option value="-1">-- None --</option>
                            {preview.headers.map((h, idx) => (
                                <option key={idx} value={idx}>
                                    Column {getColLetter(idx)}: {h}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Layer */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Layer</label>
                        <select
                            value={mapping.layer}
                            onChange={e => handleSelectChange("layer", e.target.value)}
                            className="w-full h-9 rounded-md border border-zinc-850 bg-zinc-900/50 px-3 py-1 text-sm text-zinc-100 shadow-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-colors"
                        >
                            <option value="-1">-- None (Layer 0) --</option>
                            {preview.headers.map((h, idx) => (
                                <option key={idx} value={idx}>
                                    Column {getColLetter(idx)}: {h}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* FPS */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                            System FPS{" "}
                            <span className="text-[10px] text-zinc-600 font-medium normal-case">
                                (for frame timings)
                            </span>
                        </label>
                        <Input
                            type="number"
                            step="any"
                            value={fps}
                            onChange={e => setFps(parseFloat(e.target.value) || 23.976)}
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
                                        const colLetter = getColLetter(idx)
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
                                        <td className="p-3 text-zinc-650 font-bold font-mono text-center bg-zinc-900/10 border-r border-zinc-900">
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
