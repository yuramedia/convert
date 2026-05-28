"use client"

import { type ConversionMode } from "./mode-selector"
import { type NormalSrtOptions } from "@/lib/converters/normal-srt"
import { type KeepTsOptions } from "@/lib/converters/keep-ts"
import { type ResampleOptions, RESOLUTION_PRESETS } from "@/lib/converters/resample-ts"
import { type CsvExportOptions } from "@/lib/converters/csv-export"
import { type XlsxExportOptions } from "@/lib/converters/xlsx-export"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Check } from "lucide-react"

interface CustomCheckboxProps {
    label: string
    checked: boolean
    onChange: (checked: boolean) => void
}

function CustomCheckbox({ label, checked, onChange }: CustomCheckboxProps) {
    return (
        <label className="flex items-center gap-3 cursor-pointer select-none text-zinc-300 hover:text-zinc-100 transition-colors py-1">
            <div className="relative flex items-center justify-center">
                <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={checked}
                    onChange={e => onChange(e.target.checked)}
                    aria-label={label}
                />
                <div className="h-[18px] w-[18px] rounded border border-zinc-700 bg-zinc-900 transition-all peer-checked:bg-purple-600 peer-checked:border-purple-600 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white hidden peer-checked:block" strokeWidth={3.5} />
                </div>
            </div>
            <span className="text-sm font-medium">{label}</span>
        </label>
    )
}

interface OptionsPanelProps {
    mode: ConversionMode
    normalOptions: NormalSrtOptions
    setNormalOptions: (opts: NormalSrtOptions) => void
    keeptOptions: KeepTsOptions
    setKeeptOptions: (opts: KeepTsOptions) => void
    resampleOptions: ResampleOptions
    setResampleOptions: (opts: ResampleOptions) => void
    csvOptions: CsvExportOptions
    setCsvOptions: (opts: CsvExportOptions) => void
    xlsxOptions: XlsxExportOptions
    setXlsxOptions: (opts: XlsxExportOptions) => void
}

export default function OptionsPanel({
    mode,
    normalOptions,
    setNormalOptions,
    keeptOptions,
    setKeeptOptions,
    resampleOptions,
    setResampleOptions,
    csvOptions,
    setCsvOptions,
    xlsxOptions,
    setXlsxOptions
}: OptionsPanelProps) {
    if (mode === "csv") {
        return (
            <Card className="animate-in fade-in duration-500">
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        CSV Spreadsheet Settings
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="horizontal">
                            <div className="flex-1">
                                <FieldLabel>HTML Tag Mapping</FieldLabel>
                                <FieldDescription>
                                    Convert basic ASS tags to HTML equivalents ({"<b>"}, etc.).
                                </FieldDescription>
                            </div>
                            <Switch
                                checked={csvOptions.useHtmlTags}
                                onCheckedChange={c => setCsvOptions({ ...csvOptions, useHtmlTags: c })}
                            />
                        </Field>
                        <Field orientation="horizontal">
                            <div className="flex-1">
                                <FieldLabel>Strip Typesetting / Signs</FieldLabel>
                                <FieldDescription>Remove signs and drawings based on position/styles.</FieldDescription>
                            </div>
                            <Switch
                                checked={csvOptions.stripSigns ?? false}
                                onCheckedChange={c => setCsvOptions({ ...csvOptions, stripSigns: c })}
                            />
                        </Field>

                        <div className="mt-4 pt-6 border-t border-zinc-900/50">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-3.5 gap-x-4 px-2">
                                <CustomCheckbox
                                    label="No."
                                    checked={csvOptions.showIndex}
                                    onChange={checked => setCsvOptions({ ...csvOptions, showIndex: checked })}
                                />
                                <CustomCheckbox
                                    label="Timecode In"
                                    checked={csvOptions.showStart}
                                    onChange={checked => setCsvOptions({ ...csvOptions, showStart: checked })}
                                />
                                <CustomCheckbox
                                    label="Timecode Out"
                                    checked={csvOptions.showEnd}
                                    onChange={checked => setCsvOptions({ ...csvOptions, showEnd: checked })}
                                />
                                <CustomCheckbox
                                    label="Duration"
                                    checked={csvOptions.showDuration}
                                    onChange={checked => setCsvOptions({ ...csvOptions, showDuration: checked })}
                                />
                                <CustomCheckbox
                                    label="Name"
                                    checked={csvOptions.showActor}
                                    onChange={checked => setCsvOptions({ ...csvOptions, showActor: checked })}
                                />
                                <CustomCheckbox
                                    label="Subtitle"
                                    checked={csvOptions.showText}
                                    onChange={checked => setCsvOptions({ ...csvOptions, showText: checked })}
                                />
                                <CustomCheckbox
                                    label="Style"
                                    checked={csvOptions.showStyle}
                                    onChange={checked => setCsvOptions({ ...csvOptions, showStyle: checked })}
                                />
                                <CustomCheckbox
                                    label="Layer"
                                    checked={csvOptions.showLayer}
                                    onChange={checked => setCsvOptions({ ...csvOptions, showLayer: checked })}
                                />
                            </div>
                        </div>
                    </FieldGroup>
                </CardContent>
            </Card>
        )
    }

    if (mode === "xlsx") {
        return (
            <Card className="animate-in fade-in duration-500">
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        Excel Spreadsheet Settings
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="horizontal">
                            <div className="flex-1">
                                <FieldLabel>HTML Tag Mapping</FieldLabel>
                                <FieldDescription>
                                    Convert basic ASS tags to HTML equivalents ({"<b>"}, etc.).
                                </FieldDescription>
                            </div>
                            <Switch
                                checked={xlsxOptions.useHtmlTags}
                                onCheckedChange={c => setXlsxOptions({ ...xlsxOptions, useHtmlTags: c })}
                            />
                        </Field>
                        <Field orientation="horizontal">
                            <div className="flex-1">
                                <FieldLabel>Strip Typesetting / Signs</FieldLabel>
                                <FieldDescription>Remove signs and drawings based on position/styles.</FieldDescription>
                            </div>
                            <Switch
                                checked={xlsxOptions.stripSigns ?? false}
                                onCheckedChange={c => setXlsxOptions({ ...xlsxOptions, stripSigns: c })}
                            />
                        </Field>
                        <Field orientation="horizontal">
                            <div className="flex-1">
                                <FieldLabel>Combined Export Mode</FieldLabel>
                                <FieldDescription>
                                    Structure multiple tracks as separate tabs or stacked in a single sheet.
                                </FieldDescription>
                            </div>
                            <Select
                                value={xlsxOptions.combinedMode || "sheets"}
                                onValueChange={v =>
                                    setXlsxOptions({ ...xlsxOptions, combinedMode: v as "sheets" | "single" })
                                }
                            >
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Select mode">
                                        {xlsxOptions.combinedMode === "single"
                                            ? "Single Sheet (Stacked)"
                                            : "Separate Sheets (Tabs)"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value="sheets">Separate Sheets (Tabs)</SelectItem>
                                        <SelectItem value="single">Single Sheet (Stacked)</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </Field>

                        <div className="mt-4 pt-6 border-t border-zinc-900/50">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-3.5 gap-x-4 px-2">
                                <CustomCheckbox
                                    label="No."
                                    checked={xlsxOptions.showIndex}
                                    onChange={checked => setXlsxOptions({ ...xlsxOptions, showIndex: checked })}
                                />
                                <CustomCheckbox
                                    label="Timecode In"
                                    checked={xlsxOptions.showStart}
                                    onChange={checked => setXlsxOptions({ ...xlsxOptions, showStart: checked })}
                                />
                                <CustomCheckbox
                                    label="Timecode Out"
                                    checked={xlsxOptions.showEnd}
                                    onChange={checked => setXlsxOptions({ ...xlsxOptions, showEnd: checked })}
                                />
                                <CustomCheckbox
                                    label="Duration"
                                    checked={xlsxOptions.showDuration}
                                    onChange={checked => setXlsxOptions({ ...xlsxOptions, showDuration: checked })}
                                />
                                <CustomCheckbox
                                    label="Name"
                                    checked={xlsxOptions.showActor}
                                    onChange={checked => setXlsxOptions({ ...xlsxOptions, showActor: checked })}
                                />
                                <CustomCheckbox
                                    label="Subtitle"
                                    checked={xlsxOptions.showText}
                                    onChange={checked => setXlsxOptions({ ...xlsxOptions, showText: checked })}
                                />
                                <CustomCheckbox
                                    label="Style"
                                    checked={xlsxOptions.showStyle}
                                    onChange={checked => setXlsxOptions({ ...xlsxOptions, showStyle: checked })}
                                />
                                <CustomCheckbox
                                    label="Layer"
                                    checked={xlsxOptions.showLayer}
                                    onChange={checked => setXlsxOptions({ ...xlsxOptions, showLayer: checked })}
                                />
                            </div>
                        </div>
                    </FieldGroup>
                </CardContent>
            </Card>
        )
    }

    if (mode === "keepts") {
        return (
            <Card className="animate-in fade-in duration-500">
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        Tag Preservation
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="horizontal">
                            <div className="flex-1">
                                <FieldLabel>Explicit Alignment Injection</FieldLabel>
                                <FieldDescription>Inject \an2 tags into the output stream.</FieldDescription>
                            </div>
                            <Switch
                                checked={keeptOptions.injectAn2}
                                onCheckedChange={c => setKeeptOptions({ ...keeptOptions, injectAn2: c })}
                            />
                        </Field>
                        <Field orientation="horizontal">
                            <div className="flex-1">
                                <FieldLabel>Sign-First Ordering</FieldLabel>
                                <FieldDescription>
                                    Sort signs/TS before dialogue in SRT output so dialogue always renders on top
                                    (libass z-order).
                                </FieldDescription>
                            </div>
                            <Switch
                                checked={keeptOptions.signFirst}
                                onCheckedChange={c => setKeeptOptions({ ...keeptOptions, signFirst: c })}
                            />
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>
        )
    }

    if (mode === "normal") {
        return (
            <Card className="animate-in fade-in duration-500">
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        Normalization Settings
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                    <FieldGroup>
                        <Field orientation="horizontal">
                            <div className="flex-1">
                                <FieldLabel>HTML Tag Mapping</FieldLabel>
                                <FieldDescription>
                                    Convert ASS tags to {"<b>, <i>, <u>, <s>"} equivalents.
                                </FieldDescription>
                            </div>
                            <Switch
                                checked={normalOptions.useHtmlTags}
                                onCheckedChange={c => setNormalOptions({ ...normalOptions, useHtmlTags: c })}
                            />
                        </Field>
                        <Field orientation="horizontal">
                            <div className="flex-1">
                                <FieldLabel>Event Deduplication</FieldLabel>
                                <FieldDescription>Merge consecutive identical subtitle lines.</FieldDescription>
                            </div>
                            <Switch
                                checked={normalOptions.mergeDuplicates}
                                onCheckedChange={c => setNormalOptions({ ...normalOptions, mergeDuplicates: c })}
                            />
                        </Field>
                        <Field orientation="horizontal">
                            <div className="flex-1">
                                <FieldLabel>Empty Event Purge</FieldLabel>
                                <FieldDescription>Remove lines containing no visible text.</FieldDescription>
                            </div>
                            <Switch
                                checked={normalOptions.stripEmptyLines}
                                onCheckedChange={c => setNormalOptions({ ...normalOptions, stripEmptyLines: c })}
                            />
                        </Field>
                        <Field orientation="horizontal">
                            <div className="flex-1">
                                <FieldLabel>Strip Typesetting / Signs</FieldLabel>
                                <FieldDescription>
                                    Remove positioned signs and typesetting. Recommended for clean SRT — use Keep TS
                                    mode to preserve them.
                                </FieldDescription>
                            </div>
                            <Switch
                                checked={normalOptions.stripSigns ?? true}
                                onCheckedChange={c => setNormalOptions({ ...normalOptions, stripSigns: c })}
                            />
                        </Field>
                    </FieldGroup>

                    <div className="pt-6 border-t">
                        <FieldGroup className="flex-row gap-6">
                            <Field className="flex-1">
                                <FieldLabel>System FPS</FieldLabel>
                                <Input
                                    type="number"
                                    step="any"
                                    value={normalOptions.fps ?? ""}
                                    onChange={e =>
                                        setNormalOptions({
                                            ...normalOptions,
                                            fps: parseFloat(e.target.value) || 0
                                        })
                                    }
                                    placeholder="23.976"
                                />
                            </Field>

                            <Field className="flex-1">
                                <FieldLabel>Snap Point</FieldLabel>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        className="flex-1"
                                        value={normalOptions.snapThreshold ?? ""}
                                        onChange={e =>
                                            setNormalOptions({
                                                ...normalOptions,
                                                snapThreshold: parseFloat(e.target.value) || 0
                                            })
                                        }
                                        placeholder="0"
                                    />
                                    <Select
                                        value={normalOptions.snapUnit || "ms"}
                                        onValueChange={v =>
                                            setNormalOptions({ ...normalOptions, snapUnit: v as "ms" | "frames" })
                                        }
                                    >
                                        <SelectTrigger className="w-[80px]">
                                            <SelectValue>
                                                {normalOptions.snapUnit === "frames" ? "fr" : "ms"}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectItem value="ms">ms</SelectItem>
                                                <SelectItem value="frames">fr</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </Field>

                            <Field className="flex-1">
                                <FieldLabel>Min Gap</FieldLabel>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        className="flex-1"
                                        value={normalOptions.minGap ?? ""}
                                        onChange={e =>
                                            setNormalOptions({
                                                ...normalOptions,
                                                minGap: parseFloat(e.target.value) || 0
                                            })
                                        }
                                        placeholder="0"
                                    />
                                    <Select
                                        value={normalOptions.gapUnit || "ms"}
                                        onValueChange={v =>
                                            setNormalOptions({ ...normalOptions, gapUnit: v as "ms" | "frames" })
                                        }
                                    >
                                        <SelectTrigger className="w-[80px]">
                                            <SelectValue>
                                                {normalOptions.gapUnit === "frames" ? "fr" : "ms"}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectItem value="ms">ms</SelectItem>
                                                <SelectItem value="frames">fr</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </Field>
                        </FieldGroup>
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Resample mode
    const currentResolution = `${resampleOptions.targetWidth}x${resampleOptions.targetHeight}`
    const matchesPreset = RESOLUTION_PRESETS.some(p => `${p.width}x${p.height}` === currentResolution)

    return (
        <Card className="animate-in fade-in duration-500">
            <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Resampling Engine
                </CardTitle>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Field>
                            <FieldLabel>Target Preset</FieldLabel>
                            <Select
                                value={matchesPreset ? currentResolution : "custom"}
                                onValueChange={v => {
                                    if (!v || v === "custom") return
                                    const [w, h] = v.split("x").map(Number)
                                    setResampleOptions({ ...resampleOptions, targetWidth: w, targetHeight: h })
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select resolution">
                                        {(() => {
                                            const preset = RESOLUTION_PRESETS.find(
                                                p => `${p.width}x${p.height}` === currentResolution
                                            )
                                            return preset
                                                ? `${preset.label} (${preset.width}x${preset.height})`
                                                : "Custom Matrix"
                                        })()}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value="custom">Custom Matrix</SelectItem>
                                        {RESOLUTION_PRESETS.map(p => (
                                            <SelectItem key={p.label} value={`${p.width}x${p.height}`}>
                                                {p.label} ({p.width}x{p.height})
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </Field>

                        <Field>
                            <FieldLabel>Output Format</FieldLabel>
                            <Select
                                value={resampleOptions.outputFormat}
                                onValueChange={v =>
                                    setResampleOptions({
                                        ...resampleOptions,
                                        outputFormat: v as "ass" | "srt"
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue>
                                        {resampleOptions.outputFormat === "ass" ? "ASS (.ass)" : "SRT (.srt)"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value="ass">ASS (.ass)</SelectItem>
                                        <SelectItem value="srt">SRT (.srt)</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </Field>

                        <Field className="col-span-1 md:col-span-2">
                            <FieldLabel>Custom Dimensions</FieldLabel>
                            <div className="flex items-center gap-4">
                                <Input
                                    type="number"
                                    value={resampleOptions.targetWidth || ""}
                                    onChange={e =>
                                        setResampleOptions({
                                            ...resampleOptions,
                                            targetWidth: parseInt(e.target.value) || 0
                                        })
                                    }
                                    placeholder="Width"
                                />
                                <span className="text-muted-foreground font-bold">×</span>
                                <Input
                                    type="number"
                                    value={resampleOptions.targetHeight || ""}
                                    onChange={e =>
                                        setResampleOptions({
                                            ...resampleOptions,
                                            targetHeight: parseInt(e.target.value) || 0
                                        })
                                    }
                                    placeholder="Height"
                                />
                            </div>
                        </Field>

                        {resampleOptions.outputFormat === "srt" ? (
                            <>
                                <Field orientation="horizontal" className="col-span-1 md:col-span-2 pt-6 border-t">
                                    <div className="flex-1">
                                        <FieldLabel>Explicit Alignment</FieldLabel>
                                        <FieldDescription>Force inject \\an2 tags.</FieldDescription>
                                    </div>
                                    <Switch
                                        checked={resampleOptions.injectAn2 ?? false}
                                        onCheckedChange={c => setResampleOptions({ ...resampleOptions, injectAn2: c })}
                                    />
                                </Field>
                                <Field orientation="horizontal" className="col-span-1 md:col-span-2">
                                    <div className="flex-1">
                                        <FieldLabel>Sign-First Ordering</FieldLabel>
                                        <FieldDescription>
                                            Sort signs/TS before dialogue so dialogue renders on top (libass z-order).
                                        </FieldDescription>
                                    </div>
                                    <Switch
                                        checked={resampleOptions.signFirst}
                                        onCheckedChange={c => setResampleOptions({ ...resampleOptions, signFirst: c })}
                                    />
                                </Field>
                            </>
                        ) : null}

                        <Field orientation="horizontal" className="col-span-1 md:col-span-2 pt-6 border-t">
                            <div className="flex-1">
                                <FieldLabel>Aspect Ratio Correction</FieldLabel>
                                <FieldDescription>
                                    Adjust rotation (\frz) and scaling (\fscx/y) for non-uniform resolution changes
                                    (e.g., anamorphic DVD).
                                </FieldDescription>
                            </div>
                            <Switch
                                checked={resampleOptions.compensateAspectRatio ?? true}
                                onCheckedChange={c =>
                                    setResampleOptions({ ...resampleOptions, compensateAspectRatio: c })
                                }
                            />
                        </Field>
                    </div>
                </FieldGroup>
            </CardContent>
        </Card>
    )
}
