import {
    ArrowLeft,
    Terminal,
    Shield,
    Zap,
    Box,
    Code2,
    Cpu,
    Globe,
    Lock,
    Table,
    FileSpreadsheet,
    Layers,
    Brackets,
    Scaling,
    FileOutput,
    ShieldCheck
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-background text-zinc-400 font-sans relative z-10">
            {/* Header */}
            <header className="max-w-4xl mx-auto px-6 pt-20 pb-16 flex flex-col items-center text-center space-y-6">
                <a
                    href="/"
                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-450 hover:text-blue-500 hover:border-blue-500/30 transition-all bg-zinc-950/50 hover:bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800/80 shadow-sm"
                >
                    <ArrowLeft size={14} />
                    Back to Converter
                </a>
                <a
                    href="/qc/"
                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-450 hover:text-emerald-500 hover:border-emerald-500/30 transition-all bg-zinc-950/50 hover:bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800/80 shadow-sm"
                >
                    <ShieldCheck size={14} />
                    Quality Check
                </a>

                <div className="space-y-2">
                    <h1 className="text-4xl font-extrabold tracking-tight text-white uppercase sm:text-5xl">
                        Technical <span className="text-blue-500">Specifications</span>
                    </h1>
                    <p className="text-sm font-medium text-zinc-500 max-w-xl mx-auto leading-relaxed">
                        Deep dive into the architecture, compilers, and conversion engines powering the Yuuume ASS
                        Subtitle Suite.
                    </p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 pb-24 space-y-20">
                {/* Tech Stack Section */}
                <section className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center gap-3">
                        <Box size={20} className="text-blue-500 animate-pulse" />
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">Technology Stack</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TechItem
                            title="Astro"
                            description="Static site generation with zero-JS-by-default architecture. React islands hydrate only interactive components."
                            icon={<Globe size={16} />}
                        />
                        <TechItem
                            title="React 19"
                            description="Leveraging React 19's concurrent features, compiler-assisted hooks, and client rendering for seamless transitions."
                            icon={<Cpu size={16} />}
                        />
                        <TechItem
                            title="Tailwind CSS v4"
                            description="High-performance styling utilizing Tailwind's next-generation engine, modern grid architectures, and OKLCH color spaces."
                            icon={<Code2 size={16} />}
                        />
                        <TechItem
                            title="Shadcn / UI & Base UI"
                            description="Accessible component structure built on top of robust styling primitives to ensure focus states and screen-reader friendliness."
                            icon={<Terminal size={16} />}
                        />
                        <TechItem
                            title="xlsx-js-style"
                            description="Styled Excel sheet generator creating gridline-enabled, colored, and custom-sized XLSX files directly in-browser."
                            icon={<Table size={16} />}
                        />
                        <TechItem
                            title="Bun Runtime"
                            description="Fast local building, linting, formatting, and unit testing via Bun's high-speed JS engine toolchain."
                            icon={<Zap size={16} />}
                        />
                    </div>
                </section>

                <Separator className="bg-zinc-900" />

                {/* Subtitle Conversion Modes */}
                <section className="space-y-8">
                    <div className="flex items-center gap-3">
                        <Layers size={20} className="text-indigo-500" />
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">
                            Subtitle Conversion Engine
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-zinc-950/50 border-zinc-800/80 hover:border-blue-500/40 hover:scale-[1.01] transition-all duration-300">
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2 text-blue-500">
                                    <FileOutput size={16} />
                                    <CardTitle className="text-xs font-bold uppercase tracking-wider">
                                        Normal Mode
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="text-xs text-zinc-550 leading-relaxed space-y-2">
                                <p>Converts styled subtitles to clean, industry-standard SRT files.</p>
                                <ul className="list-disc pl-4 space-y-1 text-[11px] text-zinc-500">
                                    <li>
                                        Maps inline codes (<code>\b</code>, <code>\i</code>, <code>\u</code>,{" "}
                                        <code>\s</code>) to HTML tags (<code>&lt;b&gt;</code>, etc.).
                                    </li>
                                    <li>Filters out comments, drawing paths, and positional override commands.</li>
                                    <li>
                                        Adjusts sequential subtitle gaps using snap/threshold limits to prevent overlap
                                        flickers.
                                    </li>
                                    <li>Enforces minimum duration (e.g. 200ms) to guarantee legibility.</li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card className="bg-zinc-950/50 border-zinc-800/80 hover:border-indigo-500/40 hover:scale-[1.01] transition-all duration-300">
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2 text-indigo-500">
                                    <Brackets size={16} />
                                    <CardTitle className="text-xs font-bold uppercase tracking-wider">
                                        Keep TS Mode
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="text-xs text-zinc-550 leading-relaxed space-y-2">
                                <p>
                                    Preserves all typesetting code blocks verbatim for advanced players (e.g. mpv, VLC).
                                </p>
                                <ul className="list-disc pl-4 space-y-1 text-[11px] text-zinc-500">
                                    <li>
                                        Injects starting alignment codes (<code>\anN</code>) based on track defaults.
                                    </li>
                                    <li>
                                        Supports style resets (<code>\rStyleName</code>) and drawing coordinate vectors.
                                    </li>
                                    <li>
                                        Implements stable depth sorting (signs before dialogue) to ensure dialogue stays
                                        visible at the bottom.
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card className="bg-zinc-950/50 border-zinc-800/80 hover:border-violet-500/40 hover:scale-[1.01] transition-all duration-300">
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2 text-violet-500">
                                    <Scaling size={16} />
                                    <CardTitle className="text-xs font-bold uppercase tracking-wider">
                                        Resample Mode
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="text-xs text-zinc-550 leading-relaxed space-y-2">
                                <p>Scales coordinate metrics to match targets when video resolution changes.</p>
                                <ul className="list-disc pl-4 space-y-1 text-[11px] text-zinc-500">
                                    <li>
                                        Applies linear transformation matrices to positions (<code>\pos</code>) and
                                        motion parameters (<code>\move</code>).
                                    </li>
                                    <li>
                                        Scales vector drawing clip coordinates (<code>\clip</code>, <code>\iclip</code>
                                        ).
                                    </li>
                                    <li>
                                        Proportionally adjusts font sizes (<code>\fs</code>) and outline border widths (
                                        <code>\bord</code>).
                                    </li>
                                    <li>Compensates for aspect-ratio differences between source and target targets.</li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <Separator className="bg-zinc-900" />

                {/* Spreadsheet Integration Section */}
                <section className="space-y-8">
                    <div className="flex items-center gap-3">
                        <FileSpreadsheet size={20} className="text-emerald-500" />
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">
                            Spreadsheet Compiler & Importer
                        </h2>
                    </div>

                    <div className="space-y-6">
                        <Card className="bg-zinc-950 border-zinc-800 overflow-hidden hover:border-emerald-500/20 transition-all duration-300">
                            <CardHeader className="bg-zinc-900/30 border-b border-zinc-900 px-6 py-4">
                                <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-zinc-200">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    Heuristic Column Detection & Map
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm leading-relaxed p-6 space-y-4">
                                <p>
                                    When loading spreadsheets (<code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>,{" "}
                                    <code>.tsv</code>, <code>.txt</code>), the importer reads data columns in memory and
                                    analyzes column names using heuristic regex patterns to map subtitle fields:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono bg-black/30 p-4 rounded-lg border border-zinc-900">
                                    <div className="space-y-1">
                                        <div className="text-zinc-500">{"// Timings Mapping"}</div>
                                        <div>
                                            <span className="text-blue-400">Start Time:</span>{" "}
                                            <span className="text-zinc-350">"In", "From", "Start", "Timecode In"</span>
                                        </div>
                                        <div>
                                            <span className="text-blue-400">End Time:</span>{" "}
                                            <span className="text-zinc-350">"Out", "To", "End", "Timecode Out"</span>
                                        </div>
                                        <div>
                                            <span className="text-blue-400">Duration:</span>{" "}
                                            <span className="text-zinc-350">"Dur", "Duration", "Length"</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-zinc-500">{"// Dialogue Mapping"}</div>
                                        <div>
                                            <span className="text-emerald-400">Text Content:</span>{" "}
                                            <span className="text-zinc-350">"Sub", "Subtitle", "Text", "Dialogue"</span>
                                        </div>
                                        <div>
                                            <span className="text-emerald-400">Actor/Speaker:</span>{" "}
                                            <span className="text-zinc-350">"Char", "Who", "Name", "Speaker"</span>
                                        </div>
                                        <div>
                                            <span className="text-emerald-400">Style/Layer:</span>{" "}
                                            <span className="text-zinc-350">"Style", "Font", "Layer", "Level"</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-zinc-550 text-xs">
                                    Timestamps can be formatted as fractional days (Excel time format), decimal seconds,
                                    milliseconds, standard timecodes (<code>HH:MM:SS.mmm</code>), or frame-based codes (
                                    <code>HH:MM:SS:FF</code>). Frame-based timestamps are translated accurately using
                                    project-specific frame rates (FPS).
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-zinc-950 border-zinc-800 overflow-hidden hover:border-teal-500/20 transition-all duration-300">
                            <CardHeader className="bg-zinc-900/30 border-b border-zinc-900 px-6 py-4">
                                <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-zinc-200">
                                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                                    Multi-Episode Spreadsheet Segmentation
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm leading-relaxed p-6 space-y-4">
                                <p>
                                    Translating multi-episode sheets or script lists is simplified through row
                                    segmentation. The compiler automatically parses rows, looks for empty cells
                                    containing specific episode boundaries, and breaks them down:
                                </p>
                                <div className="bg-black/30 p-4 rounded-lg font-mono text-xs text-teal-400 border border-zinc-900 space-y-1">
                                    <div>
                                        Episode Marker Pattern:{" "}
                                        <span className="text-zinc-300">
                                            /^(EP|Episode|Ep\.?|Chapter|Ch\.?|E)\s*\d+$/i
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-zinc-500 pt-1">
                                        {
                                            '// Example: "EP 01", "Episode 2", "Ch. 3" inside a single row with empty adjacent fields'
                                        }
                                    </div>
                                </div>
                                <p className="text-zinc-550 text-xs">
                                    Upon discovering marker rows, the compiler splits the spreadsheet's dialog lists
                                    into discrete sub-tracks, letting you name, preview, modify, and convert individual
                                    episode subtitle files in a single pass.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-zinc-950 border-zinc-800 overflow-hidden hover:border-indigo-500/20 transition-all duration-300">
                            <CardHeader className="bg-zinc-900/30 border-b border-zinc-900 px-6 py-4">
                                <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-zinc-200">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                    Styled Excel Export Engine
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm leading-relaxed p-6 space-y-4">
                                <p>
                                    Transpiling subtitles back to Excel sheets generates highly styled,
                                    publication-ready workbooks. Our engine formats the worksheet layout dynamically:
                                </p>
                                <ul className="list-disc pl-5 space-y-2 text-xs text-zinc-500">
                                    <li>
                                        <strong>Auto-Calculated Widths:</strong> Analyzes text and timing content
                                        lengths to resize columns, preventing overflow truncation and text clipping.
                                    </li>
                                    <li>
                                        <strong>Color-Coded Templates:</strong> Highlights headers and index markers in
                                        professional theme colors (Aegisub Blue/Red accents) with styled border
                                        divisions.
                                    </li>
                                    <li>
                                        <strong>Worksheet Combination:</strong> Combines batch converted subtitles into
                                        a single spreadsheet workbook—either mapped onto separate named tabs or
                                        consolidated into a single sheet using custom episode markers.
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <Separator className="bg-zinc-900" />

                {/* Privacy & Offline Section */}
                <section className="bg-blue-600/5 border border-blue-600/10 p-8 rounded-2xl space-y-6">
                    <div className="flex items-center gap-3">
                        <Lock size={20} className="text-blue-500 animate-pulse" />
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">
                            Privacy by Architecture
                        </h2>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-350">
                        Unlike online subtitle sites that upload personal documents to backend servers, this application
                        runs on a <strong>Zero-Trust architecture</strong>. All parsing, resampling, spreadsheet
                        mapping, and workbook formatting happen entirely inside your local browser memory space.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="flex gap-4">
                            <Shield className="text-blue-500 shrink-0" size={24} />
                            <div>
                                <h4 className="text-sm font-bold text-white uppercase tracking-wide">
                                    No Server Uploads
                                </h4>
                                <p className="text-xs text-zinc-500 mt-1">
                                    Subtitle bytes and dialogue contents never cross the network interface. Absolute
                                    privacy.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <Zap className="text-amber-500 shrink-0" size={24} />
                            <div>
                                <h4 className="text-sm font-bold text-white uppercase tracking-wide">
                                    100% Offline Capable
                                </h4>
                                <p className="text-xs text-zinc-500 mt-1">
                                    Once loaded, all features and script compilation algorithms operate perfectly
                                    without internet connectivity.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-zinc-900 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                &copy; {new Date().getFullYear()} Yuuume ASS Converter. Made with ❤️ by Yuramedia Link
            </footer>
        </div>
    )
}

function TechItem({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
    return (
        <Card className="bg-zinc-950/40 border-zinc-800/80 p-4 flex gap-4 items-start hover:border-zinc-700/60 hover:bg-zinc-950/70 hover:scale-[1.01] transition-all duration-300">
            <div className="size-8 rounded bg-zinc-900/60 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 shadow-inner">
                {icon}
            </div>
            <div className="space-y-1">
                <h4 className="text-sm font-bold text-zinc-150">{title}</h4>
                <p className="text-xs text-zinc-550 leading-normal">{description}</p>
            </div>
        </Card>
    )
}
