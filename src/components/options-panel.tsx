"use client"

import { type ConversionMode } from "./mode-selector"
import { type NormalSrtOptions } from "@/lib/converters/normal-srt"
import { type KeepTsOptions } from "@/lib/converters/keep-ts"
import { type ResampleOptions, RESOLUTION_PRESETS } from "@/lib/converters/resample-ts"

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
            <div className="glass-card p-5 fade-in">
                <h3 className="text-sm font-semibold mb-4">Keep TS Options</h3>
                <div className="space-y-4">
                    <Toggle
                        label={"Inject \\an2 explicitly"}
                        description={
                            "Always inject \\an2 alignment tag even though it's the libass global default. Disable to keep output cleaner."
                        }
                        checked={keeptOptions.injectAn2}
                        onChange={c => setKeeptOptions({ ...keeptOptions, injectAn2: c })}
                    />
                </div>
            </div>
        )
    }

    if (mode === "normal") {
        return (
            <div className="glass-card p-5 fade-in">
                <h3 className="text-sm font-semibold mb-4">Normal SRT Options</h3>
                <div className="space-y-4">
                    <Toggle
                        label="Map HTML tags (<b>, <i>, <u>, <s>)"
                        description="Convert simple ASS tags to standard SRT HTML tags."
                        checked={normalOptions.useHtmlTags}
                        onChange={c => setNormalOptions({ ...normalOptions, useHtmlTags: c })}
                    />
                    <Toggle
                        label="Merge duplicate lines"
                        description="Combine identical consecutive subtitle lines."
                        checked={normalOptions.mergeDuplicates}
                        onChange={c => setNormalOptions({ ...normalOptions, mergeDuplicates: c })}
                    />
                    <Toggle
                        label="Strip empty lines"
                        description="Remove lines that become empty after stripping typesetting tags."
                        checked={normalOptions.stripEmptyLines}
                        onChange={c => setNormalOptions({ ...normalOptions, stripEmptyLines: c })}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="glass-card p-5 fade-in">
            <h3 className="text-sm font-semibold mb-4">Resample TS Options</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="resolution-preset" className="block text-xs font-medium text-[var(--muted)] mb-2">
                        Resolution Preset
                    </label>
                    <select
                        id="resolution-preset"
                        className="input-field"
                        onChange={e => {
                            if (e.target.value === "custom") return
                            const [w, h] = e.target.value.split("x").map(Number)
                            setResampleOptions({ ...resampleOptions, targetWidth: w, targetHeight: h })
                        }}
                        value={`${resampleOptions.targetWidth}x${resampleOptions.targetHeight}`}
                    >
                        <option value="custom">Custom...</option>
                        {RESOLUTION_PRESETS.map(p => (
                            <option key={p.label} value={`${p.width}x${p.height}`}>
                                {p.label} ({p.width}×{p.height})
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="output-format" className="block text-xs font-medium text-[var(--muted)] mb-2">
                        Output Format
                    </label>
                    <select
                        id="output-format"
                        className="input-field"
                        value={resampleOptions.outputFormat}
                        onChange={e =>
                            setResampleOptions({
                                ...resampleOptions,
                                outputFormat: e.target.value as "ass" | "srt"
                            })
                        }
                    >
                        <option value="ass">.ass (Advanced SubStation Alpha)</option>
                        <option value="srt">.srt (SubRip + Embedded TS)</option>
                    </select>
                </div>

                <div className="col-span-1 md:col-span-2">
                    <label htmlFor="custom-width" className="block text-xs font-medium text-[var(--muted)] mb-3">
                        Custom Target Resolution
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            id="custom-width"
                            type="number"
                            className="input-field"
                            placeholder="Width"
                            value={resampleOptions.targetWidth || ""}
                            onChange={e =>
                                setResampleOptions({
                                    ...resampleOptions,
                                    targetWidth: parseInt(e.target.value) || 0
                                })
                            }
                        />
                        <span className="text-[var(--muted)] font-mono text-xs">×</span>
                        <input
                            type="number"
                            className="input-field"
                            placeholder="Height"
                            value={resampleOptions.targetHeight || ""}
                            onChange={e =>
                                setResampleOptions({
                                    ...resampleOptions,
                                    targetHeight: parseInt(e.target.value) || 0
                                })
                            }
                        />
                    </div>
                </div>

                {resampleOptions.outputFormat === "srt" && (
                    <div className="col-span-1 md:col-span-2 pt-2 border-t border-white/5">
                        <Toggle
                            label={"Inject \\an2 explicitly"}
                            description={
                                "Always inject \\an2 alignment tag in SRT output even though it's the libass global default."
                            }
                            checked={resampleOptions.injectAn2 ?? false}
                            onChange={c => setResampleOptions({ ...resampleOptions, injectAn2: c })}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

function Toggle({
    label,
    description,
    checked,
    onChange
}: {
    label: string
    description: string
    checked: boolean
    onChange: (c: boolean) => void
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-[var(--muted)]">{description}</p>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={`toggle ${checked ? "active" : ""}`}
            />
        </div>
    )
}
