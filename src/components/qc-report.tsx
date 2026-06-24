"use client"

import { AlertCircle, CheckCircle, Info, Download, Filter } from "lucide-react"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { type QCReport, type QCSeverity } from "@/lib/qc-checker"
import { cn } from "@/lib/utils"

interface QCReportProps {
    report: QCReport | null
}

const SEVERITY_CONFIG = {
    critical: {
        label: "Critical",
        icon: AlertCircle,
        color: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-200"
    },
    warning: {
        label: "Warning",
        icon: AlertCircle,
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        border: "border-yellow-200"
    },
    info: {
        label: "Info",
        icon: Info,
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200"
    }
} as const

export function QCReport({ report }: QCReportProps) {
    const [selectedSeverity, setSelectedSeverity] = useState<QCSeverity | "all">("all")
    const [selectedCategory, setSelectedCategory] = useState<string>("all")

    const filteredIssues = useMemo(() => {
        if (!report) return []
        let issues = report.issues

        if (selectedSeverity !== "all") {
            issues = issues.filter(i => i.severity === selectedSeverity)
        }

        if (selectedCategory !== "all") {
            issues = issues.filter(i => i.category === selectedCategory)
        }

        return issues
    }, [report, selectedSeverity, selectedCategory])

    const categories = useMemo(() => {
        if (!report) return []
        const cats = new Set(report.issues.map(i => i.category))
        return Array.from(cats).sort()
    }, [report])

    const exportReport = () => {
        if (!report) return

        const lines = [
            `Quality Control Report: ${report.fileName}`,
            `Total Subtitles: ${report.totalLines}`,
            `Issues Found: ${report.issues.length}`,
            `  - Critical: ${report.summary.critical}`,
            `  - Warning: ${report.summary.warning}`,
            `  - Info: ${report.summary.info}`,
            "",
            "Issues:",
            ""
        ]

        for (const issue of report.issues) {
            lines.push(`[${issue.severity.toUpperCase()}] Line ${issue.line} @ ${issue.timestamp}`)
            lines.push(`  Category: ${issue.category}`)
            lines.push(`  Issue: ${issue.issue}`)
            lines.push(`  Current: ${issue.current}`)
            lines.push(`  Recommended: ${issue.recommended}`)
            lines.push(`  Suggestion: ${issue.suggestion}`)
            lines.push("")
        }

        const blob = new Blob([lines.join("\n")], { type: "text/plain" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `qc-report-${report.fileName}.txt`
        a.click()
        URL.revokeObjectURL(url)
    }

    if (!report) {
        return (
            <Card className="p-8 text-center">
                <Info className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No QC report available</p>
            </Card>
        )
    }

    const hasIssues = report.issues.length > 0

    return (
        <div className="space-y-4">
            {/* Summary Card */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold">{report.fileName}</h2>
                        <p className="text-sm text-gray-600">
                            {report.totalLines} subtitle{report.totalLines !== 1 ? "s" : ""} checked
                        </p>
                    </div>
                    {hasIssues ? (
                        <AlertCircle className="w-8 h-8 text-yellow-600" />
                    ) : (
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    )}
                </div>

                {hasIssues ? (
                    <div className="grid grid-cols-3 gap-4">
                        {(["critical", "warning", "info"] as const).map(severity => {
                            const config = SEVERITY_CONFIG[severity]
                            const Icon = config.icon
                            const count = report.summary[severity]

                            return (
                                <button
                                    key={severity}
                                    onClick={() =>
                                        setSelectedSeverity(selectedSeverity === severity ? "all" : severity)
                                    }
                                    className={cn(
                                        "p-4 rounded-lg border-2 transition-all hover:shadow-md",
                                        config.bg,
                                        config.border,
                                        selectedSeverity === severity && "ring-2 ring-offset-2 ring-blue-500"
                                    )}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <Icon className={cn("w-5 h-5", config.color)} />
                                        <span className="text-2xl font-bold">{count}</span>
                                    </div>
                                    <p className={cn("text-sm font-medium", config.color)}>{config.label}</p>
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
                        <p className="text-xl font-semibold text-green-600">All checks passed!</p>
                        <p className="text-sm text-gray-600 mt-2">No issues found in this subtitle file.</p>
                    </div>
                )}
            </Card>

            {/* Filters and Export */}
            {hasIssues && (
                <Card className="p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">Category:</span>
                                <select
                                    value={selectedCategory}
                                    onChange={e => setSelectedCategory(e.target.value)}
                                    className="border rounded px-3 py-1 text-sm"
                                >
                                    <option value="all">All Categories</option>
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedSeverity("all")
                                    setSelectedCategory("all")
                                }}
                                className="text-sm text-blue-600 hover:underline"
                            >
                                Clear filters
                            </button>
                        </div>
                        <Button onClick={exportReport} variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-2" />
                            Export Report
                        </Button>
                    </div>
                </Card>
            )}

            {/* Issues Table */}
            {hasIssues && (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Severity
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Line
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Time
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Category
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Issue
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Details
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredIssues.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                            No issues match the selected filters
                                        </td>
                                    </tr>
                                ) : (
                                    filteredIssues.map((issue, idx) => {
                                        const config = SEVERITY_CONFIG[issue.severity]
                                        const Icon = config.icon

                                        return (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className={cn("flex items-center gap-2", config.color)}>
                                                        <Icon className="w-4 h-4" />
                                                        <span className="text-xs font-medium uppercase">
                                                            {issue.severity}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-mono">
                                                    {issue.line}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                                                    {issue.timestamp}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                    {issue.category}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <div className="font-medium">{issue.issue}</div>
                                                    <div className="text-xs text-gray-600 mt-1">{issue.suggestion}</div>
                                                </td>
                                                <td className="px-4 py-3 text-xs">
                                                    <div className="space-y-1">
                                                        <div>
                                                            <span className="text-gray-500">Current:</span>{" "}
                                                            <span className="font-mono">{issue.current}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500">Recommended:</span>{" "}
                                                            <span className="font-mono text-green-600">
                                                                {issue.recommended}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    )
}
