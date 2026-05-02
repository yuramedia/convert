import Link from "next/link"
import { ArrowLeft, Info, Settings, Zap, Layers, RefreshCw } from "lucide-react"

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-gray-200 selection:bg-white/10 selection:text-white font-sans">
            {/* Header */}
            <header className="max-w-4xl mx-auto px-6 py-12 md:py-20">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-8 group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Converter
                </Link>

                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">
                    About <span className="text-white/60">ASS to SRT</span>
                </h1>
                <p className="text-xl text-gray-400 leading-relaxed max-w-2xl">
                    A professional-grade, high-performance subtitle converter designed for speed, accuracy, and modern
                    typesetting needs.
                </p>
            </header>

            <main className="max-w-4xl mx-auto px-6 pb-24">
                {/* Core Philosophy */}
                <section className="mb-16">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div>
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                <Zap className="text-white" size={20} />
                                High Performance
                            </h2>
                            <p className="text-gray-400 leading-relaxed text-sm">
                                Built with TypeScript and optimized for client-side processing. By moving all logic to
                                the browser, we ensure instant conversions without uploading your files to any server,
                                guaranteeing maximum privacy.
                            </p>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                <Layers className="text-white" size={20} />
                                Smart Layering
                            </h2>
                            <p className="text-gray-400 leading-relaxed text-sm">
                                Advanced heuristics automatically distinguish between dialogue and signs. Dialogue is
                                prioritized to appear at the bottom of the screen, ensuring standard player
                                compatibility while preserving typeset context.
                            </p>
                        </div>
                    </div>
                </section>

                <hr className="border-white/5 mb-16" />

                {/* Detailed Usage */}
                <section className="space-y-12">
                    <h2 className="text-2xl font-bold text-white mb-8">Detailed Conversion Modes</h2>

                    {/* Mode 1 */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 group hover:border-white/20 transition-colors">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white/10 rounded-xl">
                                <Info className="text-white" size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">Normal SRT</h3>
                                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                                    The "standard" conversion path for most users and video players. Ideal for TV shows,
                                    anime, and movies where you want clean, readable subtitles.
                                </p>
                                <ul className="space-y-3 text-sm">
                                    <li className="flex gap-3 text-gray-400">
                                        <span className="text-white font-mono">•</span>
                                        <span>
                                            Maps basic ASS tags (<code className="text-white/80">\b</code>,{" "}
                                            <code className="text-white/80">\i</code>, etc.) to valid SRT HTML.
                                        </span>
                                    </li>
                                    <li className="flex gap-3 text-gray-400">
                                        <span className="text-white font-mono">•</span>
                                        <span>Strips complex positioning and drawing commands.</span>
                                    </li>
                                    <li className="flex gap-3 text-gray-400">
                                        <span className="text-white font-mono">•</span>
                                        <span>
                                            Automatically merges overlapping signs and dialogue into a single block.
                                        </span>
                                    </li>
                                    <li className="flex gap-3 text-gray-400 font-medium text-white/60">
                                        <span className="text-white font-mono">•</span>
                                        <span>Deduplicates identical text layers to prevent flickering.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Mode 2 */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 group hover:border-white/20 transition-colors">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white/10 rounded-xl">
                                <Settings className="text-white" size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">Keep Typesetting (TS)</h3>
                                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                                    Preserves ALL ASS override tags inside the SRT output. This is intended for advanced
                                    players like <code className="text-white/80">mpv</code> or
                                    <code className="text-white/80">VLC</code> (via libass) that can render ASS-in-SRT
                                    markup.
                                </p>
                                <ul className="space-y-3 text-sm text-gray-400">
                                    <li className="flex gap-3">
                                        <span className="text-white font-mono">•</span>
                                        <span>Passes through all positioning, clips, and transforms verbatim.</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="text-white font-mono">•</span>
                                        <span>
                                            Ensures alignment tags (<code className="text-white/80">\an</code>) are
                                            explicitly injected for consistency.
                                        </span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Mode 3 */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 group hover:border-white/20 transition-colors">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white/10 rounded-xl">
                                <RefreshCw className="text-white" size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">Resample Resolution</h3>
                                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                                    Corrects subtitle scaling when your source resolution (
                                    <code className="text-white/80">PlayRes</code>) doesn't match your video file. This
                                    is crucial for complex typesetting.
                                </p>
                                <ul className="space-y-3 text-sm text-gray-400">
                                    <li className="flex gap-3">
                                        <span className="text-white font-mono">•</span>
                                        <span>
                                            Recalculates all coordinate tags (
                                            <code className="text-white/80">\pos</code>,{" "}
                                            <code className="text-white/80">\move</code>,{" "}
                                            <code className="text-white/80">\clip</code>).
                                        </span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="text-white font-mono">•</span>
                                        <span>Scales fonts, borders, and margins proportionally.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                <hr className="border-white/5 my-16" />

                {/* Technical Implementation */}
                <section>
                    <h2 className="text-2xl font-bold text-white mb-6">Technical Details</h2>
                    <div className="prose prose-invert prose-sm max-w-none text-gray-400 space-y-4 leading-relaxed">
                        <p>
                            This application implements the <code className="text-white/80">libass</code> parsing logic
                            directly in TypeScript. It strictly follows the ASS event format defined by the script's
                            header, ensuring compatibility with files exported from Aegisub and other professional
                            tools.
                        </p>
                        <p>
                            Our merging logic utilizes a high-performance <code className="text-white/80">Set</code>
                            -based deduplication engine. It processes multi-line entries and overlapping timestamps with
                            $O(N)$ efficiency, making it capable of handling thousands of events without UI lag.
                        </p>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-white/5 text-center text-xs text-gray-500">
                &copy; {new Date().getFullYear()} Yuuume ASS Converter. Built with Next.js and Lucide Icons.
            </footer>
        </div>
    )
}
