"use client"

import { useState, useCallback, useRef } from "react"
import {
    ShieldCheck,
    Upload,
    FileText,
    X,
    ArrowLeft,
    Download,
    CheckCircle2,
    AlertTriangle,
    Info,
    RotateCcw,
    Settings2,
    Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { parseAss, type AssTrack } from "@/lib/ass-parser"
import { parseSrt } from "@/lib/srt-parser"
import { writeAss } from "@/lib/ass-writer"
import { writeSrt, type SrtEntry } from "@/lib/srt-writer"
import {
    runQualityCheck,
    QC_RULES,
    DEFAULT_QC_OPTIONS,
    type QcIssue,
    type QcResult,
    type QcOptions,
    type QcCategory,
    type QcSeverity
} from "@/lib/qc-engine"

// ─── Types ───────────────────────────────────────────────────────────────────

interface LoadedFile {
    name: string
    track: AssTrack
    format: "ass" | "srt"
}

// ─── Severity config ─────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<QcSeverity, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    error: {
        color: "text-red-400",
        bg: "bg-red-500/10 border-red-500/20",
        icon: <X size={14} className="text-red-400" />,
        label: "Error"
    },
    warning: {
        color: "text-amber-400",
        bg: "bg-amber-500/10 border-amber-500/20",
        icon: <AlertTriangle size={14} className="text-amber-400" />,
        label: "Warning"
    },
    info: {
        color: "text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/20",
        icon: <Info size={14} className="text-blue-400" />,
        label: "Info"
    }
}

const CATEGORY_LABELS: Record<QcCategory, string> = {
    text: "Text",
    punctuation: "Punctuation",
    timing: "Timing",
    formatting: "Formatting",
    casing: "Casing"
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function QcPage() {
    const [file, setFile] = useState<LoadedFile | null>(null)
    const [result, setResult] = useState<QcResult | null>(null)
    const [isDragOver, setIsDragOver] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [showDiff, setShowDiff] = useState(false)
    const [excludedIssues, setExcludedIssues] = useState<Set<string>>(new Set())
    const [options, setOptions] = useState<QcOptions>(DEFAULT_QC_OPTIONS)
    const [filterSeverity, setFilterSeverity] = useState<QcSeverity | "all">("all")
    const [filterCategory, setFilterCategory] = useState<QcCategory | "all">("all")
    const inputRef = useRef<HTMLInputElement>(null)

    // ─── File Handling ───────────────────────────────────────────────────────

    const loadFile = useCallback(
        async (rawFile: File) => {
            setIsLoading(true)
            try {
                const text = await rawFile.text()
                const isSrt = /\.srt$/i.test(rawFile.name)
                const track = isSrt ? parseSrt(text) : parseAss(text)
                const format = isSrt ? "srt" : "ass"
                const loaded: LoadedFile = { name: rawFile.name, track, format }
                setFile(loaded)

                // Run QC immediately
                const qcResult = runQualityCheck(track, options)
                setResult(qcResult)
                setExcludedIssues(new Set())
            } catch {
                alert(`Failed to parse "${rawFile.name}". Please ensure it's a valid subtitle file.`)
            } finally {
                setIsLoading(false)
            }
        },
        [options]
    )

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            setIsDragOver(false)
            const droppedFile = e.dataTransfer.files[0]
            if (droppedFile && /\.(ass|ssa|srt)$/i.test(droppedFile.name)) {
                loadFile(droppedFile)
            }
        },
        [loadFile]
    )

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const selected = e.target.files?.[0]
            if (selected) loadFile(selected)
        },
        [loadFile]
    )

    const handleRerun = useCallback(() => {
        if (!file) return
        const qcResult = runQualityCheck(file.track, options)
        setResult(qcResult)
        setExcludedIssues(new Set())
    }, [file, options])

    const handleClear = useCallback(() => {
        setFile(null)
        setResult(null)
        setExcludedIssues(new Set())
    }, [])

    // ─── Toggle Rules ────────────────────────────────────────────────────────

    const toggleRule = useCallback((ruleId: string) => {
        setOptions(prev => {
            const next = new Set(prev.enabledRules)
            if (next.has(ruleId)) {
                next.delete(ruleId)
            } else {
                next.add(ruleId)
            }
            return { ...prev, enabledRules: next }
        })
    }, [])

    const toggleIssueExclusion = useCallback((issueId: string) => {
        setExcludedIssues(prev => {
            const next = new Set(prev)
            if (next.has(issueId)) {
                next.delete(issueId)
            } else {
                next.add(issueId)
            }
            return next
        })
    }, [])

    // ─── Download Fixed File ─────────────────────────────────────────────────

    const handleDownload = useCallback(() => {
        if (!result || !file) return

        // Apply only non-excluded fixes
        const fixedTrack = applySelectiveFixes(file.track, result.issues, excludedIssues)
        let output: string
        let ext: string

        if (file.format === "srt") {
            // Convert AssTrack events to SrtEntry[]
            const entries: SrtEntry[] = fixedTrack.events
                .filter(e => e.type === "Dialogue")
                .map((e, i) => ({
                    index: i + 1,
                    startMs: e.Start,
                    endMs: e.End,
                    text: e.Text.replace(/\\N/g, "\n")
                }))
            output = writeSrt(entries)
            ext = "srt"
        } else {
            output = writeAss(fixedTrack)
            ext = "ass"
        }

        const blob = new Blob([output], { type: "text/plain;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const baseName = file.name.replace(/\.[^/.]+$/, "")
        a.download = `${baseName}_fixed.${ext}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }, [result, file, excludedIssues])

    // ─── Filtered issues ─────────────────────────────────────────────────────

    const filteredIssues = result
        ? result.issues.filter(issue => {
              if (filterSeverity !== "all" && issue.severity !== filterSeverity) return false
              if (filterCategory !== "all" && issue.category !== filterCategory) return false
              return true
          })
        : []

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-12 flex flex-col gap-10 relative z-10">
            {/* Back nav */}
            <div className="flex justify-between items-center">
                <a
                    href="/"
                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-450 hover:text-blue-500 hover:border-blue-500/30 transition-all bg-zinc-950/50 hover:bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800/80 shadow-sm"
                >
                    <ArrowLeft size={14} />
                    Back to Converter
                </a>
                <a
                    href="/about/"
                    className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-blue-500 transition-colors"
                >
                    <Info size={14} />
                    About
                </a>
            </div>

            {/* Header */}
            <header className="flex flex-col items-center text-center space-y-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/20">
                        <ShieldCheck size={18} className="text-white" />
                    </div>
                </div>
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-zinc-50 uppercase">
                        Subtitle <span className="text-emerald-500">Quality Check</span>
                    </h1>
                    <p className="text-sm text-zinc-500 font-medium">
                        Detect and auto-fix common subtitle errors. Client-side, zero server.
                    </p>
                </div>
            </header>

            <input ref={inputRef} type="file" accept=".ass,.ssa,.srt" className="hidden" onChange={handleFileInput} />
            {!file ? (
                <button
                    type="button"
                    className={`
                        relative border-2 border-dashed rounded-xl p-12 transition-all duration-300 cursor-pointer w-full
                        flex flex-col items-center justify-center gap-4 text-center
                        ${
                            isDragOver
                                ? "border-emerald-500 bg-emerald-500/5 shadow-[0_0_30px_rgba(16,185,129,0.1)]"
                                : "border-zinc-800 hover:border-zinc-600 bg-zinc-950/30"
                        }
                    `}
                    onDragOver={e => {
                        e.preventDefault()
                        setIsDragOver(true)
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            inputRef.current?.click()
                        }
                    }}
                >
                    {isLoading ? (
                        <Loader2 size={32} className="text-emerald-500 animate-spin" />
                    ) : (
                        <Upload
                            size={32}
                            className={`transition-colors ${isDragOver ? "text-emerald-500" : "text-zinc-600"}`}
                        />
                    )}
                    <div>
                        <p className="text-sm font-semibold text-zinc-300">
                            {isDragOver ? "Drop your subtitle file" : "Drop a subtitle file or click to browse"}
                        </p>
                        <p className="text-xs text-zinc-600 mt-1">Supports .ass, .ssa, .srt</p>
                    </div>
                </button>
            ) : (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* File Info Bar */}
                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <FileText size={16} className="text-emerald-500" />
                                <span className="text-sm font-semibold text-zinc-200">{file.name}</span>
                                <Badge variant="outline" className="text-[10px] uppercase">
                                    {file.format}
                                </Badge>
                                <span className="text-xs text-zinc-500">
                                    {file.track.events.filter(e => e.type === "Dialogue").length} lines
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => setShowSettings(!showSettings)}
                                    title="Settings"
                                >
                                    <Settings2 size={14} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={handleRerun}
                                    title="Re-run quality check"
                                >
                                    <RotateCcw size={14} />
                                </Button>
                                <Button variant="ghost" size="icon-sm" onClick={handleClear} title="Clear">
                                    <X size={14} />
                                </Button>
                            </div>
                        </div>
                    </Card>

                    {/* Settings Panel */}
                    {showSettings && (
                        <Card className="p-5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground leading-none mb-4">
                                QC Rules
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                                {(["text", "punctuation", "timing", "formatting", "casing"] as QcCategory[]).map(
                                    category => (
                                        <div key={category} className="space-y-2 mb-4">
                                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                                {CATEGORY_LABELS[category]}
                                            </h4>
                                            {QC_RULES.filter(r => r.category === category).map(rule => (
                                                <label
                                                    key={rule.id}
                                                    className="flex items-center justify-between gap-3 py-1 group cursor-pointer"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">
                                                            {rule.name}
                                                        </span>
                                                        <p className="text-[10px] text-zinc-600 leading-tight truncate">
                                                            {rule.description}
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        size="sm"
                                                        checked={options.enabledRules.has(rule.id)}
                                                        onCheckedChange={() => toggleRule(rule.id)}
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>
                            <Separator className="my-3" />
                            <div className="flex items-center gap-6 flex-wrap">
                                <label className="flex items-center gap-2 text-xs text-zinc-400">
                                    Max line length:
                                    <input
                                        type="number"
                                        value={options.maxLineLength}
                                        onChange={e =>
                                            setOptions(prev => ({
                                                ...prev,
                                                maxLineLength: parseInt(e.target.value) || 42
                                            }))
                                        }
                                        className="w-14 h-6 bg-zinc-900 border border-zinc-800 rounded text-xs text-center text-zinc-200 focus:outline-none focus:border-emerald-500"
                                    />
                                </label>
                                <label className="flex items-center gap-2 text-xs text-zinc-400">
                                    Min gap (ms):
                                    <input
                                        type="number"
                                        value={options.minGapMs}
                                        onChange={e =>
                                            setOptions(prev => ({
                                                ...prev,
                                                minGapMs: parseInt(e.target.value) || 24
                                            }))
                                        }
                                        className="w-14 h-6 bg-zinc-900 border border-zinc-800 rounded text-xs text-center text-zinc-200 focus:outline-none focus:border-emerald-500"
                                    />
                                </label>
                                <label className="flex items-center gap-2 text-xs text-zinc-400">
                                    <span>Convert ... → …</span>
                                    <Switch
                                        size="sm"
                                        checked={options.convertEllipsis}
                                        onCheckedChange={v => setOptions(prev => ({ ...prev, convertEllipsis: v }))}
                                    />
                                </label>
                            </div>
                            <div className="flex justify-end mt-4">
                                <Button
                                    onClick={handleRerun}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 h-9 text-sm"
                                >
                                    Re-run Check
                                </Button>
                            </div>
                        </Card>
                    )}

                    {/* Results */}
                    {result && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            {/* Stats Bar */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <StatCard
                                    label="Total Issues"
                                    value={result.stats.total}
                                    color="text-zinc-200"
                                    bg="bg-zinc-800/50"
                                />
                                <StatCard
                                    label="Errors"
                                    value={result.stats.errors}
                                    color="text-red-400"
                                    bg="bg-red-500/5"
                                    onClick={() => setFilterSeverity(filterSeverity === "error" ? "all" : "error")}
                                    active={filterSeverity === "error"}
                                />
                                <StatCard
                                    label="Warnings"
                                    value={result.stats.warnings}
                                    color="text-amber-400"
                                    bg="bg-amber-500/5"
                                    onClick={() => setFilterSeverity(filterSeverity === "warning" ? "all" : "warning")}
                                    active={filterSeverity === "warning"}
                                />
                                <StatCard
                                    label="Info"
                                    value={result.stats.info}
                                    color="text-blue-400"
                                    bg="bg-blue-500/5"
                                    onClick={() => setFilterSeverity(filterSeverity === "info" ? "all" : "info")}
                                    active={filterSeverity === "info"}
                                />
                                <StatCard
                                    label="Auto-fixable"
                                    value={result.stats.fixable}
                                    color="text-emerald-400"
                                    bg="bg-emerald-500/5"
                                />
                            </div>
                            {/* Category filter pills and Show Diff toggle */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mr-1">
                                        Filter:
                                    </span>
                                    <FilterPill
                                        label="All"
                                        active={filterCategory === "all"}
                                        onClick={() => setFilterCategory("all")}
                                    />
                                    {(["text", "punctuation", "timing", "formatting", "casing"] as QcCategory[]).map(
                                        cat => (
                                            <FilterPill
                                                key={cat}
                                                label={CATEGORY_LABELS[cat]}
                                                active={filterCategory === cat}
                                                onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
                                                count={result.issues.filter(i => i.category === cat).length}
                                            />
                                        )
                                    )}
                                </div>
                                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">
                                        Show Diff:
                                    </span>
                                    <Switch size="sm" checked={showDiff} onCheckedChange={setShowDiff} />
                                </label>
                            </div>

                            {/* Issues Table */}
                            {filteredIssues.length > 0 ? (
                                <Card className="overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-zinc-800/50 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                                                    <th className="px-4 py-3 text-left w-10">Fix</th>
                                                    <th className="px-4 py-3 text-left w-16">Line</th>
                                                    <th className="px-4 py-3 text-left w-20">Severity</th>
                                                    <th className="px-4 py-3 text-left w-28">Rule</th>
                                                    <th className="px-4 py-3 text-left">Details</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredIssues.map(issue => (
                                                    <IssueRow
                                                        key={issue.id}
                                                        issue={issue}
                                                        excluded={excludedIssues.has(issue.id)}
                                                        showDiff={showDiff}
                                                        onToggle={() => toggleIssueExclusion(issue.id)}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            ) : (
                                <Card className="p-8 flex flex-col items-center justify-center gap-3 text-center">
                                    <CheckCircle2 size={32} className="text-emerald-500" />
                                    <p className="text-sm font-semibold text-zinc-300">
                                        {result.stats.total === 0
                                            ? "No issues found — your subtitle is clean!"
                                            : "No issues match current filters"}
                                    </p>
                                </Card>
                            )}

                            {/* Action Bar */}
                            {result.stats.total > 0 && (
                                <div className="flex justify-end">
                                    <Button
                                        onClick={handleDownload}
                                        disabled={result.stats.fixable === 0}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 h-10"
                                    >
                                        <Download size={16} className="mr-2" />
                                        Download Fixed File
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <footer className="mt-auto pt-16 pb-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-medium text-zinc-600 uppercase tracking-wider">
                <div className="flex gap-6">
                    <a
                        href="https://github.com/yuramedia/convert"
                        target="_blank"
                        className="hover:text-emerald-500 transition-colors"
                    >
                        GitHub
                    </a>
                </div>
                <a href="https://yuramedia.com" target="_blank" className="text-center text-[10px] text-zinc-500">
                    &copy; {new Date().getFullYear()} Made with ❤️ by Yuramedia Link
                </a>
                <p>No data uploaded. Privacy guaranteed.</p>
            </footer>
        </main>
    )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
    label,
    value,
    color,
    bg,
    onClick,
    active
}: {
    label: string
    value: number
    color: string
    bg: string
    onClick?: () => void
    active?: boolean
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className={`
                rounded-xl p-3 text-center transition-all border
                ${bg} ${active ? "border-zinc-600 ring-1 ring-zinc-700" : "border-transparent"}
                ${onClick ? "cursor-pointer hover:border-zinc-700" : "cursor-default"}
            `}
        >
            <p className={`text-2xl font-extrabold tabular-nums ${color}`}>{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mt-0.5">{label}</p>
        </button>
    )
}

function FilterPill({
    label,
    active,
    onClick,
    count
}: {
    label: string
    active: boolean
    onClick: () => void
    count?: number
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`
                inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all
                ${
                    active
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-700"
                }
            `}
        >
            {label}
            {count !== undefined && count > 0 && <span className="text-[9px] opacity-70">{count}</span>}
        </button>
    )
}

function IssueRow({
    issue,
    excluded,
    showDiff,
    onToggle
}: {
    issue: QcIssue
    excluded: boolean
    showDiff: boolean
    onToggle: () => void
}) {
    const sev = SEVERITY_CONFIG[issue.severity]
    const rule = QC_RULES.find(r => r.id === issue.ruleId)

    return (
        <tr
            className={`border-b border-zinc-800/30 transition-colors hover:bg-zinc-900/50 ${
                excluded ? "opacity-40" : ""
            }`}
        >
            <td className="px-4 py-3">
                {issue.fixed !== null ? (
                    <input
                        type="checkbox"
                        checked={!excluded}
                        onChange={onToggle}
                        className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
                    />
                ) : (
                    <span className="text-zinc-700">—</span>
                )}
            </td>
            <td className="px-4 py-3">
                <span className="text-xs font-mono text-zinc-400">#{issue.lineIndex + 1}</span>
            </td>
            <td className="px-4 py-3">
                <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${sev.bg}`}
                >
                    {sev.icon}
                    {sev.label}
                </span>
            </td>
            <td className="px-4 py-3">
                <span className="text-xs font-medium text-zinc-400">{rule?.name || issue.ruleId}</span>
            </td>
            <td className="px-4 py-3">
                <p className="text-xs text-zinc-300">{issue.message}</p>
                {showDiff && (
                    <div className="mt-2 space-y-1">
                        {issue.fixed !== null ? (
                            <>
                                <div className="flex items-start gap-2">
                                    <span className="text-[10px] font-bold text-red-400/70 w-7 shrink-0 pt-0.5">
                                        OLD
                                    </span>
                                    <code className="text-[11px] font-mono text-red-300/80 bg-red-500/5 px-2 py-0.5 rounded break-all leading-relaxed">
                                        {displayText(issue.original)}
                                    </code>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-[10px] font-bold text-emerald-400/70 w-7 shrink-0 pt-0.5">
                                        NEW
                                    </span>
                                    <code className="text-[11px] font-mono text-emerald-300/80 bg-emerald-500/5 px-2 py-0.5 rounded break-all leading-relaxed">
                                        {displayText(issue.fixed)}
                                    </code>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-start gap-2">
                                <span className="text-[10px] font-bold text-zinc-550 w-7 shrink-0 pt-0.5">LINE</span>
                                <code className="text-[11px] font-mono text-zinc-400 bg-zinc-900/40 px-2 py-0.5 rounded break-all leading-relaxed">
                                    {displayText(issue.original)}
                                </code>
                            </div>
                        )}
                    </div>
                )}
            </td>
        </tr>
    )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Display text with visible markers for whitespace */
function displayText(text: string): string {
    return text
}

/**
 * Apply selective fixes based on excluded issue IDs.
 * Returns a new cloned track with only non-excluded auto-fixes applied.
 */
function applySelectiveFixes(originalTrack: AssTrack, issues: QcIssue[], excluded: Set<string>): AssTrack {
    // Deep clone the track
    const track: AssTrack = {
        ...originalTrack,
        scriptInfo: { ...originalTrack.scriptInfo },
        styles: originalTrack.styles.map(s => ({ ...s, _raw: { ...s._raw } })),
        events: originalTrack.events.map(e => ({ ...e })),
        styleFormat: [...originalTrack.styleFormat],
        eventFormat: [...originalTrack.eventFormat],
        rawSections: originalTrack.rawSections.map(s => ({ ...s, lines: [...s.lines] }))
    }

    const indicesToRemove = new Set<number>()

    // Apply non-excluded fixes
    for (const issue of issues) {
        if (issue.fixed === null) continue
        if (excluded.has(issue.id)) continue

        if (issue.ruleId === "remove-empty-lines" && issue.fixed === "") {
            indicesToRemove.add(issue.lineIndex)
        } else {
            track.events[issue.lineIndex] = {
                ...track.events[issue.lineIndex],
                Text: issue.fixed
            }
        }
    }

    if (indicesToRemove.size > 0) {
        track.events = track.events.filter((_, i) => !indicesToRemove.has(i))
    }

    return track
}
