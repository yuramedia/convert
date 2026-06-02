import Link from "next/link"
import { Layers } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
    return (
        <main className="flex-1 flex flex-col items-center justify-center gap-6 p-12 text-center">
            <div className="w-10 h-10 rounded bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
                <Layers size={18} className="text-white" />
            </div>
            <div className="space-y-2">
                <h2 className="text-5xl font-extrabold tracking-tight text-zinc-50">404</h2>
                <p className="text-sm text-zinc-500">Page not found.</p>
            </div>
            <Link
                href="/"
                className={cn(
                    buttonVariants({ variant: "default", size: "default" }),
                    "bg-blue-600 hover:bg-blue-700 text-white font-bold"
                )}
            >
                Back to converter
            </Link>
        </main>
    )
}
