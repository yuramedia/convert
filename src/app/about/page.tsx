"use client"

import Link from "next/link"
import { ArrowLeft, Terminal, Shield, Zap, Box, Code2, Cpu, Globe, Lock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-background text-zinc-400 font-sans relative z-10">
            {/* Header */}
            <header className="max-w-4xl mx-auto px-6 pt-20 pb-16 flex flex-col items-center text-center space-y-6">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-600 hover:text-blue-500 transition-colors bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-800"
                >
                    <ArrowLeft size={14} />
                    Back to Converter
                </Link>

                <div className="space-y-2">
                    <h1 className="text-4xl font-extrabold tracking-tight text-white uppercase">
                        Technical <span className="text-blue-500">Specifications</span>
                    </h1>
                    <p className="text-sm font-medium text-zinc-500 max-w-lg mx-auto leading-relaxed">
                        Deep dive into the architecture, algorithms, and technology stack powering the conversion
                        engine.
                    </p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 pb-24 space-y-20">
                {/* Tech Stack Section */}
                <section className="space-y-8">
                    <div className="flex items-center gap-3">
                        <Box size={20} className="text-blue-500" />
                        <h2 className="text-xl font-bold text-white">Technology Stack</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TechItem
                            title="Next.js 16 (Turbopack)"
                            description="Utilizing the latest Next.js features with Turbopack for lightning-fast build times and optimized static routing."
                            icon={<Globe size={16} />}
                        />
                        <TechItem
                            title="React 19"
                            description="Leveraging React 19's improved rendering engine and concurrent features for smooth UI transitions."
                            icon={<Cpu size={16} />}
                        />
                        <TechItem
                            title="Tailwind CSS v4"
                            description="High-performance styling with Tailwind's next-generation engine and OKLCH color spaces."
                            icon={<Code2 size={16} />}
                        />
                        <TechItem
                            title="Shadcn / UI"
                            description="Standardized component architecture built on top of Base UI primitives for consistent accessibility."
                            icon={<Terminal size={16} />}
                        />
                    </div>
                </section>

                <Separator className="bg-zinc-900" />

                {/* Core Logic Section */}
                <section className="space-y-8">
                    <div className="flex items-center gap-3">
                        <Cpu size={20} className="text-red-500" />
                        <h2 className="text-xl font-bold text-white">How it Works</h2>
                    </div>

                    <div className="space-y-6">
                        <Card className="bg-zinc-950 border-zinc-800 overflow-hidden">
                            <CardHeader className="bg-zinc-900/30 border-b border-zinc-900">
                                <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    1. ASS/SSA Parsing Engine
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 text-sm leading-relaxed space-y-4">
                                <p>
                                    The converter implements a custom parser that strictly follows the{" "}
                                    <strong>SSA/ASS V4+ specification</strong>. It processes the input stream in
                                    multiple passes:
                                </p>
                                <ul className="list-disc pl-5 space-y-2 text-zinc-500">
                                    <li>
                                        <strong>Header Extraction:</strong> Parses <code>[Script Info]</code> and{" "}
                                        <code>[V4+ Styles]</code> to establish global parameters like{" "}
                                        <code>PlayResX/Y</code>.
                                    </li>
                                    <li>
                                        <strong>Tag Tokenization:</strong> Uses a specialized tokenizer to extract{" "}
                                        <code>{`{...}`}</code> override blocks, maintaining the original order for
                                        complex animations.
                                    </li>
                                    <li>
                                        <strong>Heuristic Classification:</strong> Automatically distinguishes between{" "}
                                        <em>Dialogue</em> and <em>Typesetting (Signs)</em> based on layer depth and
                                        coordinate data.
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card className="bg-zinc-950 border-zinc-800 overflow-hidden">
                            <CardHeader className="bg-zinc-900/30 border-b border-zinc-900">
                                <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                    2. Coordinate Resampling Matrix
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 text-sm leading-relaxed space-y-4">
                                <p>
                                    When converting between different target resolutions, the engine applies a{" "}
                                    <strong>Linear Transformation Matrix</strong> to all coordinate-based tags:
                                </p>
                                <div className="bg-black/40 p-4 rounded font-mono text-[11px] text-blue-400 border border-zinc-900">
                                    NewValue = OriginalValue * (TargetRes / SourceRes)
                                </div>
                                <p className="text-zinc-500">
                                    This applies to <code>\pos</code>, <code>\move</code>, <code>\clip</code>, as well
                                    as font sizes (<code>\fs</code>) and border widths (<code>\bord</code>), ensuring
                                    your complex typesetting stays perfectly aligned on any screen.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-zinc-950 border-zinc-800 overflow-hidden">
                            <CardHeader className="bg-zinc-900/30 border-b border-zinc-900">
                                <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                    3. Semantic Normalization
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 text-sm leading-relaxed space-y-4">
                                <p>
                                    For standard SRT output, the engine performs high-velocity{" "}
                                    <strong>Deduplication</strong>. It identifies overlapping signs that share identical
                                    text and merges them into single events to prevent "flickering" in modern video
                                    players.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <Separator className="bg-zinc-900" />

                {/* Privacy Section */}
                <section className="bg-blue-600/5 border border-blue-600/10 p-8 rounded-2xl space-y-6">
                    <div className="flex items-center gap-3">
                        <Lock size={20} className="text-blue-500" />
                        <h2 className="text-xl font-bold text-white">Privacy by Architecture</h2>
                    </div>
                    <p className="text-sm leading-relaxed">
                        Unlike traditional converters that upload files to a server, this tool operates on a{" "}
                        <strong>Zero-Trust model</strong>. Every single byte of your subtitle file is processed within
                        your browser's RAM.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="flex gap-4">
                            <Shield className="text-blue-500 shrink-0" size={24} />
                            <div>
                                <h4 className="text-sm font-bold text-white">No Server Uploads</h4>
                                <p className="text-xs text-zinc-500 mt-1">Files never leave your local environment.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <Zap className="text-red-500 shrink-0" size={24} />
                            <div>
                                <h4 className="text-sm font-bold text-white">100% Offline Capable</h4>
                                <p className="text-xs text-zinc-500 mt-1">
                                    Works perfectly without an internet connection once loaded.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-zinc-900 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-800">
                &copy; {new Date().getFullYear()} ASS CONVERTER CORE // BUILT WITH BUN & NEXTJS
            </footer>
        </div>
    )
}

function TechItem({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
    return (
        <Card className="bg-zinc-950 border-zinc-800 p-4 flex gap-4 items-start">
            <div className="size-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                {icon}
            </div>
            <div className="space-y-1">
                <h4 className="text-sm font-bold text-zinc-100">{title}</h4>
                <p className="text-xs text-zinc-500 leading-normal">{description}</p>
            </div>
        </Card>
    )
}
