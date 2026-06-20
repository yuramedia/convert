import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorProps {
    error: Error & { digest?: string }
    reset: () => void
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <main className="flex-1 flex flex-col items-center justify-center gap-6 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle size={24} className="text-destructive-foreground" />
            </div>
            <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight text-zinc-50">Something went wrong</h2>
                <p className="text-sm text-zinc-500 max-w-sm">
                    An unexpected error occurred. If the problem persists, try refreshing the page.
                </p>
                {error.digest && <p className="text-xs text-zinc-700 font-mono">Error ID: {error.digest}</p>}
            </div>
            <Button onClick={reset} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                Try again
            </Button>
        </main>
    )
}
