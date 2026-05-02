"use client"

import { type ConversionMode } from "./mode-selector"
import { type NormalSrtOptions } from "@/lib/converters/normal-srt"
import { type KeepTsOptions } from "@/lib/converters/keep-ts"
import { type ResampleOptions, RESOLUTION_PRESETS } from "@/lib/converters/resample-ts"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"

interface OptionsPanelProps {
    mode: ConversionMode
    normalOptions: NormalSrtOptions
    setNormalOptions: (opts: NormalSrtOptions) => void
    keeptOptions: KeepTsOptions
    setKeeptOptions: (opts: KeepTsOptions) => void
    resampleOptions: ResampleOptions
    setResampleOptions: (opts: ResampleOptions) => void
}

export default function OptionsPanel({
    mode,
    normalOptions,
    setNormalOptions,
    keeptOptions,
    setKeeptOptions,
    resampleOptions,
    setResampleOptions
}: OptionsPanelProps) {
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
                                            <SelectValue />
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
                                            <SelectValue />
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
                                    <SelectValue placeholder="Select resolution" />
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
                                    <SelectValue />
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

                        {resampleOptions.outputFormat === "srt" && (
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
                        )}
                    </div>
                </FieldGroup>
            </CardContent>
        </Card>
    )
}
